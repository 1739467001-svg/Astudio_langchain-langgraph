# LangChain 生态架构图解

> 用图解方式理解 LangChain 的包结构、模块组成和数据流转。

---

## 一、包结构全景

LangChain 从 v0.2 起拆分为多个独立包，各自职责清晰：

```mermaid
graph TB
    subgraph 应用层
        APP[你的应用代码]
    end

    subgraph langchain ["langchain<br/>(应用层组件)"]
        LC_CHAINS[Chains / Agents]
        LC_RAG[Retrieval]
        LC_MEM[Memory 辅助]
    end

    subgraph langchain-core ["langchain-core<br/>(核心抽象)"]
        CORE_RUN[Runnable 接口]
        CORE_MSG[Messages 消息]
        CORE_PROMPT[PromptTemplates]
        CORE_PARSE[OutputParsers]
    end

    subgraph 集成层
        direction LR
        subgraph langchain-openai
            OAI[ChatOpenAI<br/>OpenAIEmbeddings]
        end
        subgraph langchain-anthropic
            ANT[ChatAnthropic]
        end
        subgraph langchain-ollama
            OLL[ChatOllama]
        end
        subgraph langchain-community
            COMM[FAISS/Chroma<br/>Loaders<br/>Tools]
        end
    end

    subgraph langgraph ["langgraph<br/>(工作流编排)"]
        LG_GRAPH[StateGraph]
        LG_STATE[State/Reducer]
        LG_NODE[Node/Edge]
    end

    subgraph langsmith ["langsmith<br/>(可观测性)"]
        LS[Tracing / Eval]
    end

    APP --> LC_CHAINS
    APP --> LC_RAG
    APP --> LG_GRAPH

    LC_CHAINS --> CORE_RUN
    LC_RAG --> CORE_RUN
    LG_GRAPH --> CORE_RUN

    CORE_RUN --> OAI
    CORE_RUN --> ANT
    CORE_RUN --> OLL
    CORE_RUN --> COMM

    LC_CHAINS -.->|自动上报| LS

    style langchain fill:#E3F2FD,stroke:#1565C0
    style langchain-core fill:#FFF9C4,stroke:#F9A825
    style 集成层 fill:#FFF3E0,stroke:#E65100
    style langgraph fill:#F3E5F5,stroke:#6A1B9A
    style langsmith fill:#E8F5E9,stroke:#2E7D32
```

## 二、核心模块关系

```mermaid
graph LR
    subgraph 输入层
        U[用户输入]
        D[文档数据]
    end

    subgraph 处理层
        P[Prompt<br/>提示词模板]
        L[LLM<br/>模型调用]
        P2[Parser<br/>输出解析]
        M[Memory<br/>对话记忆]
        T[Tools<br/>外部工具]
        R[Retriever<br/>检索器]
    end

    subgraph 编排层
        C[Chain / LCEL<br/>链式编排]
        A[Agent<br/>智能代理]
        G[LangGraph<br/>图式编排]
    end

    subgraph 输出层
        O[结构化结果]
        S[流式输出]
    end

    U --> P
    U --> M
    D --> R
    P --> L
    L --> P2
    M --> P
    R --> P
    T --> A

    C --> L
    A --> L
    A --> T
    G --> C
    G --> A

    P2 --> O
    C --> S

    style 输入层 fill:#E3F2FD
    style 处理层 fill:#FFF3E0
    style 编排层 fill:#F3E5F5
    style 输出层 fill:#E8F5E9
```

## 三、数据在 LangChain 中的流转

以一个典型的"问答链"为例，追踪数据从输入到输出的完整流转过程：

```mermaid
sequenceDiagram
    participant U as 用户
    participant P as PromptTemplate
    participant L as ChatOpenAI
    participant P2 as OutputParser

    U->>P: {"topic": "量子计算"}
    Note over P: 填充模板<br/>生成 ChatPromptValue
    P->>L: [SystemMessage, HumanMessage]
    Note over L: 调用 OpenAI API
    L-->>L: 接收流式响应
    L->>P2: AIMessage(content="量子计算是...")
    Note over P2: 解析为纯文本
    P2-->>U: "量子计算是..."
```

### 类型流转详解

```mermaid
graph LR
    A["dict<br/>{'topic': 'AI'}"] -->|PromptTemplate| B["ChatPromptValue<br/>(消息列表)"]
    B -->|ChatOpenAI| C["AIMessage<br/>(模型回复)"]
    C -->|StrOutputParser| D["str<br/>'AI是...'"]
    C -->|JsonOutputParser| E["dict<br/>{'name': ...}"]
    C -->|PydanticOutputParser| F["Pydantic对象<br/>Person(...)"]

    style A fill:#E3F2FD
    style B fill:#FFF9C4
    style C fill:#FFE0B2
    style D fill:#C8E6C9
    style E fill:#C8E6C9
    style F fill:#C8E6C9
```

## 四、Runnable 统一接口

所有 LangChain 组件都实现了 Runnable 接口，这是可组合性的基础：

```mermaid
graph TB
    subgraph Runnable接口
        R1["invoke(input)<br/>单条同步调用"]
        R2["batch(inputs)<br/>批量并发"]
        R3["stream(input)<br/>流式输出"]
        R4["ainvoke(input)<br/>异步单条"]
        R5["abatch(inputs)<br/>异步批量"]
        R6["astream(input)<br/>异步流式"]
    end

    subgraph 实现者
        I1[PromptTemplate]
        I2[ChatOpenAI]
        I3[OutputParser]
        I4[Retriever]
        I5[RunnableLambda]
        I6[RunnableParallel]
        I7[RunnablePassthrough]
        I8[你的自定义函数]
    end

    R1 -.-> I1
    R1 -.-> I2
    R1 -.-> I3
    R1 -.-> I4
    R1 -.-> I5
    R1 -.-> I6
    R1 -.-> I7

    style Runnable接口 fill:#FFF9C4,stroke:#F9A825
    style 实现者 fill:#E3F2FD,stroke:#1565C0
```

### 组合方式

```mermaid
graph LR
    subgraph 管道串联
        A[组件A] -->|"|"| B[组件B]
        B -->|"|"| C[组件C]
    end

    subgraph 并行执行
        D[输入] --> E1[组件A]
        D --> E2[组件B]
        E1 --> F[合并结果]
        E2 --> F
    end

    subgraph 透传增强
        G[输入] --> H[RunnablePassthrough]
        H --> I{assign}
        I -->|原数据| J[输出]
        I -->|新增字段| J
    end

    style 管道串联 fill:#E3F2FD
    style 并行执行 fill:#FFF3E0
    style 透传增强 fill:#F3E5F5
```

## 五、消息类型体系

```mermaid
graph TB
    BM[BaseMessage<br/>消息基类]

    BM --> SM[SystemMessage<br/>系统角色<br/>设定模型行为]
    BM --> HM[HumanMessage<br/>用户角色<br/>用户的输入]
    BM --> AIM[AIMessage<br/>AI角色<br/>模型的回复]
    BM --> TM[ToolMessage<br/>工具角色<br/>工具执行结果]

    AIM -->|.tool_calls| AIC[包含工具调用请求<br/>让Agent执行工具]

    style BM fill:#FFF9C4,stroke:#F9A825
    style SM fill:#E3F2FD,stroke:#1565C0
    style HM fill:#E8F5E9,stroke:#2E7D32
    style AIM fill:#FFE0B2,stroke:#E65100
    style TM fill:#F3E5F5,stroke:#6A1B9A
    style AIC fill:#FFCCBC,stroke:#BF360C
```

### 消息在对话中的顺序

```mermaid
sequenceDiagram
    participant S as System
    participant H as Human
    participant A as AI
    participant T as Tool

    S->>A: "你是一个助手"
    H->>A: "北京天气怎么样？"
    A->>T: tool_calls: get_weather(city="北京")
    T->>A: "晴，25°C"
    A->>H: "北京今天晴，气温25°C"
    
    Note over S,H: 这整条消息链会作为<br/>下次调用的上下文
```

## 六、安装策略决策

```mermaid
graph TD
    Q{你的需求?}
    Q -->|学习基础| A["pip install langchain<br/>langchain-openai<br/>langchain-community"]
    Q -->|用LangGraph| B["+ pip install langgraph"]
    Q -->|用RAG| C["+ pip install faiss-cpu<br/>pypdf"]
    Q -->|用搜索工具| D["+ pip install duckduckgo-search"]
    Q -->|用本地模型| E["pip install langchain-ollama<br/>+ 安装 Ollama"]
    Q -->|用Claude| F["pip install langchain-anthropic"]
    Q -->|需要追踪调试| G["+ 配置 LangSmith"]

    style A fill:#C8E6C9
    style B fill:#E1BEE7
    style C fill:#FFE0B2
```
