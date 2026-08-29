# Agent 数据流与 DAG 编排引擎指南

> LangGraph 的 StateGraph 本质上是一个 DAG（有向无环图）——节点是处理步骤、边是数据流向。但当任务变复杂——需要并行扇出、动态添加节点、子图嵌套、数据依赖追踪——你需要理解底层的 DAG 编排机制。本指南系统讲解 DAG 数据流模型、拓扑排序、并行执行、动态编排，以及与 Temporal/Airflow 的对比。

---

## 1. DAG 数据流模型

### 核心概念

```
DAG（Directed Acyclic Graph，有向无环图）：
  节点（Node）：处理步骤（LLM 调用/工具/条件判断）
  边（Edge）：数据流向（A 的输出 → B 的输入）
  无环：不能回到已经执行过的节点（防止死循环）

示例：
  用户输入 → [检索] → [分析] → [生成报告]
                    ↘ [验证] ↗

  检索 → 分析 和 检索 → 验证 可以并行
  分析 和 验证 都完成后 → 生成报告
```

### LangGraph 中的 DAG

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class DAGState(TypedDict):
    query: str
    search_results: list
    analysis: str
    verification: str
    report: str

# 节点定义
async def search_node(state: DAGState):
    results = await vector_search(state["query"])
    return &#123;"search_results": results&#125;

async def analyze_node(state: DAGState):
    # 依赖 search_results
    analysis = await llm_analyze(state["search_results"])
    return &#123;"analysis": analysis&#125;

async def verify_node(state: DAGState):
    # 依赖 search_results（与分析并行）
    verification = await fact_check(state["search_results"])
    return &#123;"verification": verification&#125;

async def report_node(state: DAGState):
    # 依赖 analysis 和 verification
    report = await generate_report(state["analysis"], state["verification"])
    return &#123;"report": report&#125;

# 构建 DAG
graph = StateGraph(DAGState)
graph.add_node("search", search_node)
graph.add_node("analyze", analyze_node)
graph.add_node("verify", verify_node)
graph.add_node("report", report_node)

# 边定义数据流
graph.add_edge(START, "search")
graph.add_edge("search", "analyze")   # search → analyze
graph.add_edge("search", "verify")    # search → verify（并行）
graph.add_edge("analyze", "report")   # analyze → report
graph.add_edge("verify", "report")    # verify → report
graph.add_edge("report", END)

# LangGraph 自动识别 analyze 和 verify 可以并行
dag_app = graph.compile()
```

---

## 2. 拓扑排序与执行计划

```python
from dataclasses import dataclass, field
from collections import defaultdict, deque

@dataclass
class TopologicalSorter:
    """拓扑排序：确定执行顺序"""

    def sort(self, nodes: dict, edges: list) -> list:
        """
        nodes: &#123;node_id: node_config&#125;
        edges: [(from, to), ...]
        返回: 执行层级 [[parallel_nodes], [parallel_nodes], ...]
        """
        # 构建邻接表和入度
        adj = defaultdict(list)
        in_degree = defaultdict(int)

        for from_node, to_node in edges:
            adj[from_node].append(to_node)
            in_degree[to_node] += 1

        # 入度为 0 的节点（第一层）
        queue = deque([n for n in nodes if in_degree[n] == 0])
        levels = []

        while queue:
            current_level = list(queue)
            levels.append(current_level)
            queue.clear()

            for node in current_level:
                for neighbor in adj[node]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)

        return levels

    def get_parallel_groups(self, nodes: dict, edges: list) -> list:
        """获取可并行执行的分组"""
        levels = self.sort(nodes, edges)

        parallel_groups = []
        for level in levels:
            if len(level) > 1:
                parallel_groups.append(&#123;
                    "nodes": level,
                    "parallel": True,
                &#125;)
            else:
                parallel_groups.append(&#123;
                    "nodes": level,
                    "parallel": False,
                &#125;)

        return parallel_groups

# 使用
sorter = TopologicalSorter()
nodes = &#123;"search": &#123;&#125;, "analyze": &#123;&#125;, "verify": &#123;&#125;, "report": &#123;&#125;&#125;
edges = [("search", "analyze"), ("search", "verify"), ("analyze", "report"), ("verify", "report")]

levels = sorter.sort(nodes, edges)
# [["search"], ["analyze", "verify"], ["report"]]
# search 先执行 → analyze 和 verify 并行 → report 最后
```

---

## 3. 并行执行

### 扇出-扇入模式

```python
import asyncio

@dataclass
class FanOutFanIn:
    """扇出扇入：并行处理→聚合"""

    async def fan_out(self, tasks: list, max_concurrency: int = 10) -> list:
        """并行执行多个任务"""
        semaphore = asyncio.Semaphore(max_concurrency)

        async def run_with_limit(task):
            async with semaphore:
                return await task

        results = await asyncio.gather(*[run_with_limit(t) for t in tasks])
        return list(results)

    async def fan_in(self, results: list, merge_strategy: str = "concat") -> str:
        """聚合结果"""
        if merge_strategy == "concat":
            return "\n\n".join(str(r) for r in results)
        elif merge_strategy == "summarize":
            llm = ChatOpenAI(model="gpt-4o-mini")
            combined = "\n".join(str(r)[:500] for r in results)
            response = await llm.ainvoke(f"综合以下结果：\n&#123;combined&#125;")
            return response.content
        elif merge_strategy == "best":
            # 用 LLM 选最好的
            llm = ChatOpenAI(model="gpt-4o")
            prompt = f"从以下结果中选择最好的一个：\n"
            for i, r in enumerate(results):
                prompt += f"\n[&#123;i&#125;] &#123;str(r)[:300]&#125;"
            response = await llm.ainvoke(prompt + "\n\n只回答编号。")
            idx = int(response.content.strip("[]"))
            return results[idx]
        else:
            return str(results)

# 使用：并行分析 5 个文档
async def parallel_doc_analysis(documents: list, query: str):
    fof = FanOutFanIn()

    # 扇出：每个文档并行分析
    tasks = [analyze_document(doc, query) for doc in documents]
    results = await fof.fan_out(tasks, max_concurrency=5)

    # 扇入：聚合
    summary = await fof.fan_in(results, merge_strategy="summarize")
    return summary
```

---

## 4. 动态编排

### 运行时动态添加节点

```python
@dataclass
class DynamicOrchestrator:
    """动态编排器：根据运行时状态决定执行什么"""

    async def execute_dynamic(self, query: str, available_tools: list) -> dict:
        """根据查询动态选择工具组合"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        # LLM 决定需要哪些工具
        tool_descriptions = "\n".join([f"- &#123;t.name&#125;: &#123;t.description&#125;" for t in available_tools])
        response = await llm.ainvoke(
            f"处理以下问题需要哪些工具？从列表中选择。\n\n问题: &#123;query&#125;\n工具:\n&#123;tool_descriptions&#125;\n\n返回JSON数组。"
        )

        needed_tools = json.loads(response.content)

        # 动态构建执行图
        steps = []
        for tool_name in needed_tools:
            tool = next((t for t in available_tools if t.name == tool_name), None)
            if tool:
                steps.append(&#123;"tool": tool, "name": tool_name&#125;)

        # 按拓扑顺序执行
        results = &#123;&#125;
        for step in steps:
            tool = step["tool"]
            # 前一步的结果作为下一步的输入
            input_data = results.get("last_output", query)
            result = await tool.ainvoke(input_data)
            results[step["name"]] = result
            results["last_output"] = result

        return results
```

---

## 5. 子图嵌套

```python
@dataclass
class SubgraphComposition:
    """子图组合：把小图嵌套到大图中"""

    def build_research_subgraph(self):
        """研究子图：检索→分析→总结"""
        graph = StateGraph(dict)
        graph.add_node("search", search_node)
        graph.add_node("analyze", analyze_node)
        graph.add_node("summarize", lambda s: &#123;"summary": llm_summarize(s.get("analysis"))&#125;)
        graph.add_edge(START, "search")
        graph.add_edge("search", "analyze")
        graph.add_edge("analyze", "summarize")
        graph.add_edge("summarize", END)
        return graph.compile()

    def build_report_subgraph(self):
        """报告子图：数据→生成→审核"""
        graph = StateGraph(dict)
        graph.add_node("generate", lambda s: &#123;"draft": llm_generate(s.get("summary"))&#125;)
        graph.add_node("review", lambda s: &#123;"final": llm_review(s.get("draft"))&#125;)
        graph.add_edge(START, "generate")
        graph.add_edge("generate", "review")
        graph.add_edge("review", END)
        return graph.compile()

    def build_master_graph(self):
        """主图：组合子图"""
        research = self.build_research_subgraph()
        report = self.build_report_subgraph()

        master = StateGraph(dict)
        master.add_node("research", research)
        master.add_node("report", report)
        master.add_edge(START, "research")
        master.add_edge("research", "report")
        master.add_edge("report", END)

        return master.compile()

# 子图优势：
# 1. 模块化：每个子图独立开发和测试
# 2. 复用：同一子图可在多个流程中使用
# 3. 状态隔离：子图有独立的状态空间
```

---

## 6. 与 Temporal/Airflow 对比

| 维度 | LangGraph | Temporal | Airflow |
|------|-----------|---------|---------|
| 定位 | Agent 编排 | 通用工作流 | 数据管道 |
| 编程模型 | Python 图 | 代码工作流 | DAG YAML |
| 状态管理 | Checkpointer | 内置持久化 | 数据库 |
| 重试 | 手动实现 | 内置 | 内置 |
| 人机交互 | interrupt | Signal | 手动 |
| 定时调度 | Cron | Timer | Scheduler |
| 适用 | LLM Agent | 微服务工作流 | ETL/数据 |
| 学习曲线 | 中 | 高 | 中 |

### 何时用什么

```
LLM Agent 编排 → LangGraph
  特点：LLM 调用、工具选择、非确定流程

微服务工作流 → Temporal
  特点：跨服务编排、长运行、强一致性

数据 ETL → Airflow
  特点：定时数据管道、批处理、依赖管理
```

---

## 7. 数据依赖追踪

```python
@dataclass
class DataDependencyTracker:
    """数据依赖追踪"""

    def __init__(self):
        self.dependencies: dict = &#123;&#125;  # &#123;output_key: [produced_by, consumed_by]&#125;

    def register_producer(self, key: str, node: str):
        """注册数据生产者"""
        if key not in self.dependencies:
            self.dependencies[key] = &#123;"producer": node, "consumers": []&#125;

    def register_consumer(self, key: str, node: str):
        """注册数据消费者"""
        if key in self.dependencies:
            self.dependencies[key]["consumers"].append(node)

    def get_lineage(self, key: str) -> dict:
        """获取数据血缘"""
        dep = self.dependencies.get(key, &#123;&#125;)
        return &#123;
            "key": key,
            "produced_by": dep.get("producer"),
            "consumed_by": dep.get("consumers", []),
        &#125;

    def get_execution_order(self) -> list:
        """根据依赖关系计算执行顺序"""
        # 生成节点依赖图
        node_deps = defaultdict(set)
        for key, dep in self.dependencies.items():
            for consumer in dep["consumers"]:
                node_deps[consumer].add(dep["producer"])

        # 拓扑排序
        all_nodes = set()
        for key, dep in self.dependencies.items():
            all_nodes.add(dep["producer"])
            all_nodes.update(dep["consumers"])

        sorted_nodes = []
        remaining = set(all_nodes)

        while remaining:
            ready = &#123;n for n in remaining if not (node_deps[n] & remaining)&#125;
            sorted_nodes.append(list(ready))
            remaining -= ready

        return sorted_nodes
```

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 DAG 数据流模型 | ☐ |
| 能在 LangGraph 中定义 DAG | ☐ |
| 理解拓扑排序 | ☐ |
| 实现了扇出扇入并行 | ☐ |
| 实现了动态编排 | ☐ |
| 实现了子图嵌套 | ☐ |
| 理解与 Temporal/Airflow 的区别 | ☐ |
| 实现了数据依赖追踪 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 06 | LangGraph 图结构图解 | 图结构 |
| 48 | 并行扇出 | 并行 |
| 67 | LangGraph 并行与扇出深度 | 并行深度 |
| 100 | LangGraph 子图状态映射 | 子图 |
| 120 | LangGraph 子图模式 | 子图模式 |
| 129 | Agent 工作流模式全集 | 工作流 |
| 152 | LangGraph 子图模式 | 子图 |
| 189 | Agent 工作流引擎设计 | 引擎 |
| 228 | 并行扇出 | 并行 |
| 260 | LangGraph 并行与扇出 | 并行 |
| 307 | 编排引擎 | 编排 |
| 316 | 工作流编排 | 编排 |
| 335 | 子图组合 | 子图 |
| 365 | 子图组合与模块化编排 | 模块化 |
| 373 | 编译优化与延迟降低 | 编译优化 |
| 399 | 子图通信与消息传递 | 子图通信 |
| 462 | Agent 设计模式 | 设计模式 |
