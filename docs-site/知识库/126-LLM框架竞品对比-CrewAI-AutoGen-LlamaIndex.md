# LLM 框架竞品对比：CrewAI / AutoGen / LlamaIndex

> LangChain 和 LangGraph 不是唯一选择。CrewAI 擅长多 Agent 角色扮演，AutoGen 擅长多 Agent 对话，LlamaIndex 擅长数据连接和 RAG。这份指南从架构理念、核心能力、适用场景三个维度做系统对比，帮你选对工具。

---

## 一、四大框架定位

```mermaid
graph TB
    subgraph 定位 &#123;"四大LLM框架定位"&#125;
        LC["LangChain<br/>通用LLM应用框架<br/>生态最大<br/>组件最全"]
        LG["LangGraph<br/>图式编排框架<br/>复杂工作流<br/>状态管理"]
        CA["CrewAI<br/>多Agent角色协作<br/>角色+任务+流程<br/>简单直观"]
        AG["AutoGen<br/>多Agent对话<br/>Agent间自由对话<br/>代码执行强"]
        LI["LlamaIndex<br/>数据连接+RAG<br/>文档索引强<br/>检索优化深"]
    end

    style LC fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style LG fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style CA fill:#FFF3E0,stroke:#E65100
    style AG fill:#C8E6C9,stroke:#2E7D32
    style LI fill:#F3E5F5,stroke:#6A1B9A
```

---

## 二、架构理念对比

```mermaid
graph TB
    subgraph LangChain &#123;"LangChain/LangGraph: 组件化+图编排"&#125;
        L1["核心: 可组合的组件<br/>Model/Prompt/Retriever/Tool"]
        L2["编排: LangGraph图结构<br/>State→Node→Edge"]
        L3["理念: 给你积木<br/>你搭什么都可以"]
    end

    subgraph CrewAI &#123;"CrewAI: 角色扮演+任务分配"&#125;
        C1["核心: Agent(角色)+Task(任务)+Crew(团队)"]
        C2["编排: 流程(Sequential/Hierarchical)"]
        C3["理念: 模拟人类团队<br/>每个Agent有角色和目标"]
    end

    subgraph AutoGen &#123;"AutoGen: Agent间自由对话"&#125;
        A1["核心: ConversableAgent<br/>Agent之间直接对话"]
        A2["编排: GroupChat + Manager"]
        A3["理念: Agent通过对话协商<br/>自主解决问题"]
    end

    subgraph LlamaIndex &#123;"LlamaIndex: 数据→索引→查询"&#125;
        I1["核心: Document/Index/Query Engine"]
        I2["编排: 查询引擎+路由"]
        I3["理念: 先建索引<br/>再高效查询"]
    end

    style LangChain fill:#E3F2FD
    style CrewAI fill:#FFF3E0
    style AutoGen fill:#C8E6C9
    style LlamaIndex fill:#F3E5F5
```

---

## 三、核心能力对比

| 能力 | LangChain+LangGraph | CrewAI | AutoGen | LlamaIndex |
|------|-------------------|--------|---------|------------|
| 单Agent | ✅ 完整 | ✅ 完整 | ✅ 完整 | ✅ 完整 |
| 多Agent | ✅ 图编排 | ✅ 角色协作 | ✅ 对话协商 | ⚠️ 基础 |
| RAG | ✅ 完整 | ⚠️ 需自建 | ⚠️ 需自建 | ✅ 最强 |
| 工具调用 | ✅ 完整 | ✅ 完整 | ✅ 代码执行强 | ✅ 完整 |
| 状态管理 | ✅ 最强(Checkpointer) | ⚠️ 基础 | ⚠️ 对话历史 | ⚠️ 基础 |
| 人机交互 | ✅ interrupt | ⚠️ 基础 | ✅ human_input | ⚠️ 基础 |
| 流式输出 | ✅ 完整 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 可观测性 | ✅ LangSmith | ⚠️ 基础 | ⚠️ 基础 | ✅ LlamaHub |
| 学习曲线 | 中等 | 简单 | 中等 | 简单 |
| 生态规模 | 最大 | 中等 | 中等 | 大 |

---

## 四、CrewAI 深度解析

### 4.1 核心概念

```mermaid
graph TB
    subgraph CrewAI &#123;"CrewAI三要素"&#125;
        AGENT["Agent<br/>角色: 研究员<br/>目标: 收集信息<br/>工具: 搜索工具"]
        TASK["Task<br/>描述: 研究AI趋势<br/>期望输出: 报告<br/>指派给: Agent"]
        CREW["Crew<br/>Agent列表 + Task列表<br/>流程: Sequential/Hierarchical"]
    end

    AGENT --> CREW
    TASK --> CREW
    CREW --> RESULT["执行结果"]

    style CrewAI fill:#FFF3E0
```

### 4.2 代码示例

```python
# CrewAI: 多Agent角色协作
from crewai import Agent, Task, Crew, Process

# 定义Agent（角色）
researcher = Agent(
    role="研究员",
    goal="收集关于AI Agent市场趋势的信息",
    backstory="你是一位经验丰富的AI行业研究员，擅长发现新兴趋势。",
    tools=[search_tool],
    llm="gpt-4o",
    verbose=True,
)

writer = Agent(
    role="技术作家",
    goal="将研究结果写成清晰的报告",
    backstory="你是一位擅长将复杂技术概念通俗化的作家。",
    llm="gpt-4o",
    verbose=True,
)

# 定义Task（任务）
research_task = Task(
    description="研究2024年AI Agent市场的主要趋势和关键玩家",
    expected_output="一份包含趋势分析、关键玩家和未来展望的研究报告",
    agent=researcher,
)

write_task = Task(
    description="基于研究结果写一份通俗易懂的市场分析报告",
    expected_output="一份2000字的市场分析报告，包含执行摘要",
    agent=writer,
)

# 组建Crew（团队）
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.sequential,  # 顺序执行: 研究员→作家
    verbose=True,
)

# 执行
result = crew.kickoff()
```

### 4.3 与 LangGraph 对比

```python
# 同样的多Agent协作，用LangGraph实现

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class ResearchState(TypedDict):
    topic: str
    research_results: Annotated[list[str], add]
    report: str

async def research_node(state: ResearchState) -> dict:
    """研究员节点"""
    # 调用搜索工具
    results = await search_tool.ainvoke(&#123;"query": state["topic"]&#125;)
    return &#123;"research_results": [results]&#125;

async def write_node(state: ResearchState) -> dict:
    """作家节点"""
    research_data = "\n".join(state["research_results"])
    report = await llm.ainvoke(f"基于以下研究写报告: &#123;research_data&#125;")
    return &#123;"report": report.content&#125;

# 构建图
graph = StateGraph(ResearchState)
graph.add_node("researcher", research_node)
graph.add_node("writer", write_node)
graph.add_edge(START, "researcher")
graph.add_edge("researcher", "writer")
graph.add_edge("writer", END)

app = graph.compile()
# LangGraph优势：状态可见、可检查点、可中断
```

---

## 五、AutoGen 深度解析

### 5.1 核心概念

```mermaid
graph TB
    subgraph AutoGen &#123;"AutoGen: Agent间对话"&#125;
        U["UserProxyAgent<br/>代表用户<br/>可执行代码"]
        A1["AssistantAgent<br/>AI助手<br/>推理和写作"]
        A2["AssistantAgent 2<br/>代码审查员"]

        U -->|"问题"| A1
        A1 -->|"回答/代码"| U
        A1 -->|"请审查"| A2
        A2 -->|"修改建议"| A1
        U -->|"执行代码"| EXEC["代码执行结果"]
        EXEC --> A1
    end

    style AutoGen fill:#C8E6C9
    style U fill:#E3F2FD
```

### 5.2 代码示例

```python
# AutoGen: 多Agent对话协作
import autogen

# 配置
config_list = [&#123;"model": "gpt-4o", "api_key": "sk-..."&#125;]

# 创建用户代理（可执行代码）
user_proxy = autogen.UserProxyAgent(
    name="用户",
    human_input_mode="NEVER",  # 不需要人工输入
    max_consecutive_auto_reply=10,
    code_execution_config=&#123;"work_dir": "coding"&#125;,
)

# 创建AI助手
assistant = autogen.AssistantAgent(
    name="研究员",
    system_message="你是一个能写代码的研究助手。回复TERMINATE表示任务完成。",
    llm_config=&#123;"config_list": config_list&#125;,
)

# 开始对话
user_proxy.initiate_chat(
    assistant,
    message="分析以下CSV数据的统计特征: data.csv",
)
# AutoGen会自动：
# 1. 助手写Python代码
# 2. 用户代理执行代码
# 3. 助手看到结果后继续分析
# 4. 直到输出TERMINATE
```

### 5.3 群聊模式

```mermaid
graph TB
    subgraph GroupChat &#123;"AutoGen GroupChat"&#125;
        M["GroupChatManager<br/>管理对话轮次"]
        U["UserProxy<br/>用户代理"]
        A1["Coder<br/>写代码"]
        A2["Reviewer<br/>审查代码"]
        A3["Tester<br/>测试代码"]

        U --> M
        A1 --> M
        A2 --> M
        A3 --> M
        M -->|"轮到谁"| U
        M -->|"轮到谁"| A1
    end

    style M fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

```python
# AutoGen GroupChat
manager = autogen.GroupChatManager(
    groupchat=autogen.GroupChat(
        agents=[user_proxy, coder, reviewer, tester],
        messages=[],
        max_round=20,
    ),
    llm_config=&#123;"config_list": config_list&#125;,
)

user_proxy.initiate_chat(
    manager,
    message="写一个Web爬虫，爬取天气数据",
)
```

---

## 六、LlamaIndex 深度解析

### 6.1 核心概念

```mermaid
graph TB
    subgraph LlamaIndex &#123;"LlamaIndex: 数据→索引→查询"&#125;
        D["Documents<br/>文档/数据源"] --> INDEX["Index<br/>向量/树/关键词索引"]
        INDEX --> QE["Query Engine<br/>查询引擎"]
        QE --> R["回答+引用"]
    end

    subgraph 优势 &#123;"LlamaIndex优势"&#125;
        A1["文档加载器最全<br/>100+数据源连接器"]
        A2["索引类型丰富<br/>Vector/List/Tree/Keyword"]
        A3["查询引擎可组合<br/>路由/子查询/递归"]
    end

    style LlamaIndex fill:#F3E5F5
    style 优势 fill:#E3F2FD
```

### 6.2 代码示例

```python
# LlamaIndex: 数据连接+RAG
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, ServiceContext

# 1. 加载文档（LlamaIndex的文档加载器最丰富）
documents = SimpleDirectoryReader("./data").load_data()

# 2. 创建索引
index = VectorStoreIndex.from_documents(documents)

# 3. 查询
query_engine = index.as_query_engine(
    similarity_top_k=3,
    response_mode="tree_summarize",  # 树形摘要
)
response = query_engine.query("什么是RAG?")
print(response.response)
print(response.source_nodes)  # 引用来源

# 4. 聊天模式（支持多轮对话）
chat_engine = index.as_chat_engine()
chat_response = chat_engine.chat("能详细说说吗？")
```

---

## 七、选型决策

```mermaid
graph TB
    Q1["你的需求？"] --> Q2&#123;"多Agent协作<br/>是核心？"&#125;
    Q2 -->|是| Q3&#123;"Agent间需要<br/>自由对话？"&#125;
    Q3 -->|是,自主协商| AG["AutoGen"]
    Q3 -->|否,角色分工| CA["CrewAI"]
    Q2 -->|否| Q4&#123;"RAG/数据连接<br/>是核心？"&#125;
    Q4 -->|是| LI["LlamaIndex<br/>(或LangChain RAG)"]
    Q4 -->|否| Q5&#123;"需要复杂状态管理<br/>和精确控制流？"&#125;
    Q5 -->|是| LG["LangGraph"]
    Q5 -->|否| LC["LangChain"]

    style AG fill:#C8E6C9
    style CA fill:#FFF3E0
    style LI fill:#F3E5F5
    style LG fill:#E3F2FD
    style LC fill:#E3F2FD
```

| 场景 | 推荐 | 理由 |
|------|------|------|
| 快速多Agent原型 | CrewAI | 角色+任务模型直观 |
| Agent需要代码执行+自主协商 | AutoGen | 原生代码执行+群聊 |
| RAG为主的数据应用 | LlamaIndex | 索引和查询引擎最强 |
| 复杂工作流+状态管理 | LangGraph | 图编排+检查点最强 |
| 通用LLM应用 | LangChain | 生态最大、组件最全 |
| 需要生产级可观测性 | LangChain+LangSmith | 追踪能力最成熟 |
| 教学和学习 | LangChain | 文档最全、社区最大 |

---

## 八、混合使用

```python
# LlamaIndex做RAG + LangGraph做编排
from llama_index.core import VectorStoreIndex
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class AppState(TypedDict):
    query: str
    retrieved_docs: list[str]
    answer: str

# 用LlamaIndex的检索能力
llama_index = VectorStoreIndex.from_documents(docs)
query_engine = llama_index.as_query_engine()

async def retrieve_node(state: AppState) -> dict:
    """用LlamaIndex检索"""
    response = query_engine.query(state["query"])
    return &#123;
        "retrieved_docs": [response.response],
        "answer": response.response,
    &#125;

# 用LangGraph编排
graph = StateGraph(AppState)
graph.add_node("retrieve", retrieve_node)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", END)
app = graph.compile()
```

---

## 九、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 别盲目追新框架 | LangChain生态够用就别换 | ★★★ |
| RAG重考虑LlamaIndex | 索引和查询引擎确实更强 | ★★☆ |
| 多Agent角色明确用CrewAI | 比手写LangGraph多Agent更快 | ★★☆ |
| 代码执行场景考虑AutoGen | 原生代码执行+群聊是独特优势 | ★★☆ |
| 混合使用取长补短 | LlamaIndex检索+LangGraph编排 | ★☆☆ |
| 关注框架活跃度 | 选社区活跃、更新频繁的 | ★★☆ |

---

## 十、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四大框架的定位差异 | ☐ |
| 知道CrewAI的角色+任务模型 | ☐ |
| 知道AutoGen的对话+代码执行 | ☐ |
| 知道LlamaIndex的索引优势 | ☐ |
| 能根据场景选择合适框架 | ☐ |
| 理解混合使用的思路 | ☐ |
