# LangChain 架构详解最新

> 知识库 02 有 279 行但内容需更新。这篇基于 v0.3 最新架构重新讲解——LCEL 统一接口、Runnable 协议、与 LangGraph 的关系。

---

## 一、v0.3 架构全景

```mermaid
graph TB
    subgraph 架构 &#123;"LangChain v0.3 架构"&#125;
        CORE["langchain-core<br/>Runnable协议+消息类型"]
        MAIN["langchain<br/>链+工具集成"]
        GRAPH["langgraph<br/>图式编排+状态管理"]
        COMM["langchain-community<br/>第三方集成"]
        EXP["langchain-experimental<br/>实验功能"]
    end

    CORE --> MAIN
    CORE --> GRAPH
    MAIN --> COMM
    MAIN --> EXP

    style CORE fill:#1565C0,color:#fff
    style GRAPH fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、核心包说明

| 包 | 用途 | 依赖 |
|------|------|------|
| langchain-core | Runnable协议、消息类型、基础接口 | 必装 |
| langchain | 链、工具、文档加载器 | 依赖core |
| langgraph | 图式编排、状态管理、检查点 | 依赖core |
| langchain-community | 第三方集成（搜索/数据库等） | 可选 |
| langchain-experimental | 实验功能（Python REPL等） | 可选 |
| langchain-openai | OpenAI集成 | 按需 |
| langchain-anthropic | Claude集成 | 按需 |

---

## 三、Runnable 协议

```python
class RunnableProtocol:
    """Runnable是LangChain v0.3的统一接口。

    所有组件（LLM/Prompt/Tool/Chain）都实现Runnable接口，
    支持：invoke/ainvoke/stream/astream/batch/abatch
    """

    @staticmethod
    def show_interface():
        return &#123;
            "invoke": "同步调用: result = component.invoke(input)",
            "ainvoke": "异步调用: result = await component.ainvoke(input)",
            "stream": "同步流式: for chunk in component.stream(input)",
            "astream": "异步流式: async for chunk in component.astream(input)",
            "batch": "批量: results = component.batch([input1, input2])",
            "abatch": "异步批量: results = await component.abatch([input1, input2])",
        &#125;

    @staticmethod
    def composition_operators():
        """组合操作符。"""
        return &#123;
            "pipe (|)": "component1 | component2 → 顺序执行",
            "parallel": "component1 | parallel(component2) → 并行",
            "fallback": "component1.with_fallbacks([component2]) → 降级",
            "retry": "component.with_retry(stop_after_attempt=3) → 重试",
            "bind": "llm.bind_tools(tools) → 绑定工具",
            "config": "component.with_config(tags=['monitor']) → 配置",
        &#125;
```

---

## 四、LCEL（LangChain Expression Language）

```python
class LCELGuide:
    """LCEL——用管道符|组合组件。"""

    @staticmethod
    def examples():
        examples = &#123;&#125;

        # 1. 基本管道
        examples["基本管道"] = """
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_template("回答: &#123;question&#125;")
llm = ChatOpenAI(model="gpt-4o-mini")

chain = prompt | llm  # 用|组合
result = chain.invoke(&#123;"question": "什么是RAG?"&#125;)
"""

        # 2. 带输出解析器
        examples["带解析器"] = """
from langchain_core.output_parsers import StrOutputParser

chain = prompt | llm | StrOutputParser()
result = chain.invoke(&#123;"question": "什么是RAG?"&#125;)
"""

        # 3. RAG管道
        examples["RAG管道"] = """
from langchain_core.runnables import RunnablePassthrough

chain = (
    &#123;"context": retriever, "question": RunnablePassthrough()&#125;
    | prompt
    | llm
    | StrOutputParser()
)
result = chain.invoke("什么是RAG?")
"""

        return examples
```

---

## 五、LangChain 与 LangGraph 的关系

```mermaid
graph TB
    subgraph 关系 &#123;"LangChain vs LangGraph"&#125;
        LC["LangChain<br/>组件库+LCEL管道<br/>适合线性流程"]
        LG["LangGraph<br/>图式编排+状态管理<br/>适合复杂工作流"]

        LC -.->|"复杂场景→迁移"| LG
        LG -.->|"简单场景→可用"| LC
    end

    style LG fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

| 场景 | 用 LangChain | 用 LangGraph |
|------|-------------|-------------|
| 简单问答 | ✅ LCEL 管道 | 过度 |
| RAG 问答 | ✅ 可以 | ✅ 更灵活 |
| Agent + 工具 | ❌ 旧方式废弃 | ✅ create_react_agent |
| 多 Agent | ❌ 不支持 | ✅ 原生支持 |
| 有条件分支 | ❌ 不方便 | ✅ 条件边 |
| 人机交互 | ❌ 不支持 | ✅ interrupt |
| 状态持久化 | ❌ 不支持 | ✅ Checkpointer |

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用LCEL组合简单流程 | 管道符优雅 | ★★★ |
| 复杂场景用LangGraph | 状态+循环+分支 | ★★★ |
| 用Runnable统一接口 | invoke/stream/batch | ★★★ |
| 社区包按需安装 | 减少依赖 | ★★☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解v0.3架构 | ☐ |
| 知道Runnable协议 | ☐ |
| 能用LCEL组合 | ☐ |
| 知道何时用LangGraph | ☐ |
