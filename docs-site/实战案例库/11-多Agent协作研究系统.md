# 实战案例 11：多 Agent 协作研究系统

> 一个 Agent 做研究容易跑偏、遗漏视角。但如果多个 Agent 分工协作——一个负责搜索、一个负责分析、一个负责批判、一个负责写作——研究质量会大幅提升。这个案例构建一个多 Agent 研究团队，综合运用 LangGraph 多 Agent 编排、工作流模式和状态管理。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"多Agent协作研究系统"&#125;
        COORD["协调Agent<br/>分配任务+综合结果"]
        COORD --> R["研究员Agent<br/>搜索+收集信息"]
        COORD --> A["分析师Agent<br/>分析数据+发现模式"]
        COORD --> C["批判员Agent<br/>质疑+验证结论"]
        R --> W["写作Agent<br/>撰写报告"]
        A --> W
        C --> W
        W --> FINAL["研究报告"]
    end

    style COORD fill:#1565C0,color:#fff,stroke-width:3px
    style R fill:#E3F2FD
    style A fill:#FFF3E0
    style C fill:#FFCDD2
    style W fill:#C8E6C9
```

**核心技术栈：** LangGraph 多 Agent 编排 + 状态管理 + 角色分工 + 汇总融合

**适合学完：** 第 11 课 + 知识库 129（工作流模式）+ 知识库 90（任务分配）

---

## 二、系统架构

```mermaid
graph TB
    subgraph 协调模式 &#123;"Supervisor协调模式"&#125;
        SUPERVISOR["Supervisor<br/>接收任务→分配→收集→综合"]
        SUPERVISOR --> R1["研究Agent<br/>搜索信息"]
        SUPERVISOR --> A1["分析Agent<br/>分析数据"]
        SUPERVISOR --> C1["批判Agent<br/>验证结论"]
        R1 --> SUPERVISOR
        A1 --> SUPERVISOR
        C1 --> SUPERVISOR
        SUPERVISOR --> W1["写作Agent<br/>综合写报告"]
        W1 --> FINAL["最终报告"]
    end

    subgraph 状态 &#123;"共享状态"&#125;
        S1["研究发现"]
        S2["分析结果"]
        S3["批判意见"]
        S4["报告草稿"]
    end

    style SUPERVISOR fill:#1565C0,color:#fff
    style W1 fill:#C8E6C9
```

---

## 三、State 定义

```python
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from operator import add

class ResearchState(TypedDict):
    # 输入
    topic: str                           # 研究主题
    depth: str                           # 研究深度: brief/standard/deep

    # 各Agent的产出
    research_findings: Annotated[list[str], add]    # 研究发现
    analysis_results: Annotated[list[str], add]     # 分析结果
    critiques: Annotated[list[str], add]            # 批判意见
    report: str                                       # 最终报告

    # 控制
    research_done: bool
    analysis_done: bool
    critique_done: bool
    revision_count: int
    messages: Annotated[list, add_messages]
```

---

## 四、Agent 实现

### 4.1 研究 Agent

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
def search_web(query: str) -> str:
    """搜索网络获取信息"""
    from langchain_community.tools.tavily_search import TavilySearchResults
    search = TavilySearchResults(max_results=3)
    results = search.invoke(query)
    return "\n".join([r["content"] for r in results])

async def research_agent(state: ResearchState) -> dict:
    """研究员Agent：多角度搜索收集信息。"""
    topic = state["topic"]
    depth = state.get("depth", "standard")

    # 根据深度决定搜索轮数
    num_searches = &#123;"brief": 2, "standard": 3, "deep": 5&#125;.get(depth, 3)

    # 生成搜索角度
    angle_prompt = f"""对于研究主题'&#123;topic&#125;'，请从&#123;num_searches&#125;个不同角度提出搜索方向。
每行一个搜索方向:"""

    angle_response = await llm.ainvoke([HumanMessage(content=angle_prompt)])
    search_angles = [l.strip() for l in angle_response.content.split("\n") if l.strip()]

    # 多角度搜索
    findings = []
    for angle in search_angles[:num_searches]:
        result = await search_web.ainvoke(&#123;"query": f"&#123;topic&#125; &#123;angle&#125;"&#125;)
        findings.append(f"[&#123;angle&#125;]\n&#123;result[:500]&#125;")

    return &#123;
        "research_findings": findings,
        "research_done": True,
    &#125;
```

### 4.2 分析 Agent

```python
async def analysis_agent(state: ResearchState) -> dict:
    """分析师Agent：分析研究发现，提取洞察。"""
    findings = state.get("research_findings", [])
    findings_text = "\n\n".join(f"发现&#123;i+1&#125;: &#123;f&#125;" for i, f in enumerate(findings))

    prompt = f"""你是数据分析师。请分析以下研究发现，输出：

1. 关键发现（最重要的3-5条）
2. 趋势和模式
3. 数据支撑的结论
4. 信息缺口（还有什么不知道的）

## 研究发现
&#123;findings_text[:3000]&#125;

## 分析:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    return &#123;
        "analysis_results": [response.content],
        "analysis_done": True,
    &#125;
```

### 4.3 批判 Agent

```python
async def critique_agent(state: ResearchState) -> dict:
    """批判员Agent：质疑和验证分析结论。"""
    analysis = state.get("analysis_results", [])
    findings = state.get("research_findings", [])

    analysis_text = "\n".join(analysis)
    findings_text = "\n".join(findings)[:2000]

    prompt = f"""你是严谨的批判员。请审查以下研究和分析，找出潜在问题。

## 原始研究
&#123;findings_text&#125;

## 分析结论
&#123;analysis_text[:2000]&#125;

请审查：
1. 逻辑漏洞：推理是否有跳步？
2. 数据不足：结论是否缺乏证据？
3. 偏见风险：是否只呈现单方面观点？
4. 矛盾之处：各发现间是否有矛盾？
5. 改进建议：需要补充什么？

## 批判报告:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    return &#123;
        "critiques": [response.content],
        "critique_done": True,
    &#125;
```

### 4.4 写作 Agent

```python
async def writer_agent(state: ResearchState) -> dict:
    """写作Agent：综合所有信息撰写报告。"""
    findings = state.get("research_findings", [])
    analysis = state.get("analysis_results", [])
    critiques = state.get("critiques", [])

    prompt = f"""你是专业的研究报告写作专家。请基于以下材料撰写一份研究报告。

## 研究主题
&#123;state['topic']&#125;

## 研究发现
&#123;chr(10).join(findings)[:2000]&#125;

## 分析结果
&#123;chr(10).join(analysis)[:1500]&#125;

## 批判意见
&#123;chr(10).join(critiques)[:1000]&#125;

## 要求
1. 结构清晰：执行摘要→背景→发现→分析→结论→建议
2. 兼顾分析和批判意见
3. 指出信息缺口和不确定性
4. 1000-2000字

## 研究报告:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    return &#123;"report": response.content&#125;
```

### 4.5 Supervisor

```python
async def supervisor(state: ResearchState) -> dict:
    """Supervisor：协调各Agent。"""
    # Supervisor只做路由，不生成内容
    return &#123;&#125;
```

---

## 五、组装多 Agent 图

```mermaid
graph TB
    START["START"] --> RESEARCH["研究Agent<br/>多角度搜索"]
    RESEARCH --> ANALYSIS["分析Agent<br/>提取洞察"]
    ANALYSIS --> CRITIQUE["批判Agent<br/>质疑验证"]
    CRITIQUE --> REVIEW&#123;"需要修改？"&#125;
    REVIEW -->|是,修订<2次| RESEARCH
    REVIEW -->|否| WRITER["写作Agent<br/>综合报告"]
    WRITER --> END["END"]

    style RESEARCH fill:#E3F2FD
    style ANALYSIS fill:#FFF3E0
    style CRITIQUE fill:#FFCDD2
    style WRITER fill:#C8E6C9
    style REVIEW fill:#FFF9C4
```

```python
from langgraph.graph import StateGraph, START, END

def build_research_system():
    """构建多Agent协作研究系统。"""
    graph = StateGraph(ResearchState)

    # 注册节点
    graph.add_node("researcher", research_agent)
    graph.add_node("analyst", analysis_agent)
    graph.add_node("critic", critique_agent)
    graph.add_node("writer", writer_agent)

    # 连接边
    graph.add_edge(START, "researcher")
    graph.add_edge("researcher", "analyst")
    graph.add_edge("analyst", "critic")

    # 条件路由：批判后决定是否修改
    def after_critique(state: ResearchState) -> str:
        revision_count = state.get("revision_count", 0)
        critiques = state.get("critiques", [])

        # 简化逻辑：批判意见太多→重新研究
        # 实际中可用LLM判断
        if revision_count < 1 and len(critiques) > 0:
            # 检查批判是否严重
            critique_text = critiques[0]
            if "严重" in critique_text or "重大" in critique_text:
                return "revise"

        return "write"

    graph.add_conditional_edges("critic", after_critique, &#123;
        "revise": "researcher",
        "write": "writer",
    &#125;)
    graph.add_edge("writer", END)

    return graph.compile()

research_system = build_research_system()
```

---

## 六、使用示例

```python
import asyncio

async def main():
    # 运行多Agent研究系统
    result = await research_system.ainvoke(&#123;
        "topic": "2024年AI Agent技术趋势与产业应用",
        "depth": "standard",
        "research_findings": [],
        "analysis_results": [],
        "critiques": [],
        "report": "",
        "research_done": False,
        "analysis_done": False,
        "critique_done": False,
        "revision_count": 0,
        "messages": [],
    &#125;)

    print("=" * 60)
    print("研究报告")
    print("=" * 60)
    print(result["report"])

    # 查看各Agent产出
    print(f"\n研究发现: &#123;len(result['research_findings'])&#125;条")
    print(f"分析结果: &#123;len(result['analysis_results'])&#125;条")
    print(f"批判意见: &#123;len(result['critiques'])&#125;条")

asyncio.run(main())
```

---

## 七、扩展方向

| 扩展 | 说明 | 难度 |
|------|------|------|
| 并行搜索 | 多个研究Agent同时搜索不同角度 | ★★☆ |
| 多轮迭代 | 批判后自动补充研究 | ★★☆ |
| 图谱集成 | 研究发现存入知识图谱 | ★★★ |
| A2A跨框架 | 用A2A协议连接不同框架的Agent | ★★★ |
| 人审环节 | 报告生成前人工审核 | ★★☆ |
| 多模型 | 不同Agent用不同模型 | ★☆☆ |

---

## 八、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解Supervisor协调模式 | ☐ |
| 实现了4个角色Agent | ☐ |
| 有条件路由（批判后修改） | ☐ |
| 各Agent产出在State共享 | ☐ |
| 最终报告综合所有信息 | ☐ |
| 理解扩展方向 | ☐ |
