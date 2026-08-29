# Agent 工具选择与智能编排指南

> Agent 有 20 个工具，每次调用该选哪个？选错了浪费 Token，选漏了回答不全。工具选择不只是模型"猜"——可以通过工具描述优化、动态过滤、工具路由、链式编排来提升准确率。本指南系统讲解工具选择优化、工具链编排、动态工具发现。

---

## 1. 工具选择问题

### 常见问题

```
问题1：选错工具
  用户问"北京天气" → Agent 调用 search_news 而非 get_weather
  原因：工具描述不够区分

问题2：选太多工具
  Agent 有 20 个工具，每次 LLM 调用都把 20 个工具的 Schema 放进上下文
  → 上下文爆炸 + 模型选择困难

问题3：不选工具
  用户问"计算 1+1" → Agent 直接用 LLM "算"（可能出错）
  → 应该调用 calculator 工具

问题4：工具顺序错误
  需要 先搜索→再分析→最后生成报告
  Agent 跳过搜索直接生成
```

---

## 2. 工具描述优化

```python
from langchain_core.tools import tool

# === 优化前：描述模糊 ===
@tool
def search(query: str) -> str:
    """搜索"""
    pass

# === 优化后：描述清晰、区分度高 ===
@tool
def search_web(query: str) -> str:
    """搜索互联网网页。适合查找新闻、公开信息、最新事件。
    输入搜索关键词，返回最相关的网页摘要。
    不适合：查找内部文档（用 search_documents）、查询天气（用 get_weather）。"""

    pass

@tool
def search_documents(query: str) -> str:
    """搜索内部文档库。适合查找产品手册、技术规范、公司政策。
    输入搜索关键词，返回相关文档片段。
    不适合：搜索互联网（用 search_web）。"""
    pass

@tool
def get_weather(city: str) -> str:
    """查询指定城市的实时天气。
    输入城市名，返回温度、天气状况、湿度。
    不适合：查询历史天气数据。"""
    pass

@tool
def calculator(expression: str) -> str:
    """执行数学计算。适合加减乘除、复杂表达式。
    输入数学表达式（如 "3.14 * 5^2"），返回计算结果。
    LLM 自身计算可能出错，涉及精确数值时务必使用此工具。"""
    pass
```

### 工具描述最佳实践

| 要素 | 说明 | 示例 |
|------|------|------|
| 核心功能 | 一句话说清做什么 | "搜索互联网网页" |
| 输入说明 | 输入什么格式 | "输入搜索关键词" |
| 输出说明 | 返回什么 | "返回网页摘要" |
| 适用场景 | 什么时候用 | "适合查找新闻、公开信息" |
| 不适用场景 | 什么时候不用 | "不适合查找内部文档" |
| 与其他工具区分 | 和类似工具的区别 | "用 search_documents 搜内部" |
---

## 3. 动态工具过滤

```python
@dataclass
class DynamicToolFilter:
    """动态工具过滤：根据查询只给模型相关工具"""

    async def select_tools(self, query: str, all_tools: list) -> list:
        """根据查询选择相关工具"""
        # 1. 用便宜模型快速分类
        classifier = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        tool_descriptions = "\n".join([
            f"- &#123;t.name&#125;: &#123;t.description[:80]&#125;" for t in all_tools
        ])

        response = await classifier.ainvoke(
            f"""根据用户查询，选择需要的工具（最多5个）。

可用工具:
&#123;tool_descriptions&#125;

用户查询: &#123;query&#125;

只返回工具名称，逗号分隔。"""
        )

        selected_names = [n.strip() for n in response.content.split(",")]
        selected = [t for t in all_tools if t.name in selected_names]

        return selected if selected else all_tools[:3]  # 兜底

    async def select_by_category(self, query: str) -> list:
        """按类别选择工具"""
        # 先分类查询类型
        categories = &#123;
            "search": ["search_web", "search_documents"],
            "calculation": ["calculator", "unit_converter"],
            "data": ["query_database", "generate_chart"],
            "communication": ["send_email", "send_message"],
        &#125;

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"分类查询属于哪个类别: &#123;list(categories.keys())&#125;。只回答类别名。\n查询: &#123;query&#125;"
        )

        category = response.content.strip().lower()
        tool_names = categories.get(category, [])

        return [t for t in all_tools if t.name in tool_names]
```

---

## 4. 工具链编排

### 预定义工具链

```python
@dataclass
class ToolChainOrchestrator:
    """工具链编排器"""

    # 预定义工具链
    chains = &#123;
        "research": ["search_web", "search_documents", "analyze", "summarize"],
        "data_analysis": ["query_database", "analyze", "generate_chart", "report"],
        "content_creation": ["search_web", "draft", "review", "polish", "publish"],
    &#125;

    async def execute_chain(self, chain_name: str, input_data: dict) -> dict:
        """执行工具链"""
        chain = self.chains.get(chain_name)
        if not chain:
            raise ValueError(f"未知工具链: &#123;chain_name&#125;")

        current_data = input_data
        results = &#123;&#125;

        for step, tool_name in enumerate(chain):
            tool = self._get_tool(tool_name)
            if not tool:
                print(f"⚠️ 工具 &#123;tool_name&#125; 不可用，跳过")
                continue

            # 前一步输出作为后一步输入
            result = await tool.ainvoke(current_data)
            results[tool_name] = result
            current_data = result if isinstance(result, dict) else &#123;"input": result&#125;

            print(f"  Step &#123;step+1&#125;: &#123;tool_name&#125; ✅")

        return &#123;"chain": chain_name, "results": results, "final": current_data&#125;

    async def auto_chain(self, query: str) -> str:
        """自动选择工具链"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(
            f"选择最适合处理以下查询的工具链: &#123;list(self.chains.keys())&#125;\n查询: &#123;query&#125;\n只回答链名。"
        )

        chain_name = response.content.strip()
        result = await self.execute_chain(chain_name, &#123;"query": query&#125;)
        return result["final"]
```

---

## 5. 工具调用监控

```python
@dataclass
class ToolCallMonitor:
    """工具调用监控"""

    async def analyze_tool_usage(self, history: list) -> dict:
        """分析工具使用情况"""
        stats = &#123;&#125;

        for record in history:
            tool = record.get("tool_name", "unknown")
            if tool not in stats:
                stats[tool] = &#123;
                    "total_calls": 0,
                    "successes": 0,
                    "failures": 0,
                    "avg_latency_ms": 0,
                    "avg_tokens": 0,
                &#125;

            stats[tool]["total_calls"] += 1
            if record.get("success"):
                stats[tool]["successes"] += 1
            else:
                stats[tool]["failures"] += 1
            stats[tool]["avg_latency_ms"] = (
                stats[tool]["avg_latency_ms"] * (stats[tool]["total_calls"] - 1) + record.get("latency_ms", 0)
            ) / stats[tool]["total_calls"]

        # 计算成功率
        for tool, s in stats.items():
            s["success_rate"] = s["successes"] / s["total_calls"] if s["total_calls"] else 0

        # 找出问题工具
        problem_tools = [
            &#123;"tool": t, "success_rate": s["success_rate"]&#125;
            for t, s in stats.items() if s["success_rate"] < 0.8
        ]

        return &#123;
            "stats": stats,
            "problem_tools": problem_tools,
            "recommendation": "优化低成功率工具的描述或实现" if problem_tools else "工具运行正常",
        &#125;
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 优化了工具描述 | ☐ |
| 实现了动态工具过滤 | ☐ |
| 实现了工具链编排 | ☐ |
| 实现了自动工具链选择 | ☐ |
| 实现了工具调用监控 | ☐ |
| 能分析工具使用统计 | ☐ |
| 能识别问题工具 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 06 | Agents 与 Tools | Agent 基础 |
| 15 | 工具调用全链路 | 全链路 |
| 54 | Agent 工具链设计 | 工具链 |
| 79 | Agent 工具结果验证 | 验证 |
| 83 | Agent 工具链编排 | 编排 |
| 142 | Agent 工具链设计 | 设计 |
| 174 | Agent 工具链设计深度 | 深度 |
| 199 | Agent 工具集成大全 | 集成 |
| 231 | Agent 工具集成大全 | 集成 |
| 243 | 工具链编排 | 编排 |
| 251 | 工具版本管理 | 版本 |
| 395 | Agent 工具动态发现 | 动态发现 |
| 425 | Agent 工具动态发现与绑定 | 动态绑定 |
| 427 | MCP 协议 | MCP |
| 462 | Agent 设计模式 | 设计模式 |
