# Memory 机制图解

> 理解 LLM 的"无状态"问题以及 LangChain 如何通过 Memory 机制解决它。

---

## 一、问题：LLM 是无状态的

```mermaid
sequenceDiagram
    participant U as 用户
    participant L as LLM

    U->>L: "我叫张三"
    L-->>U: "你好，张三！"

    Note over L: ⚠️ LLM 不记得上一次对话

    U->>L: "我叫什么名字？"
    L-->>U: "抱歉，我不知道你叫什么。"  ❌ 忘了！
```

## 二、解决思路：手动传递历史

```mermaid
sequenceDiagram
    participant U as 用户
    participant M as Memory(历史列表)
    participant L as LLM

    U->>M: "我叫张三"
    M->>L: 传递完整历史:[Human("我叫张三")]
    L-->>M: AIMessage("你好，张三！")
    Note over M: 保存: [Human("我叫张三"), AI("你好，张三！")]

    U->>M: "我叫什么名字？"
    M->>L: 传递完整历史:[Human("我叫张三"), AI("你好，张三！"), Human("我叫什么名字？")]
    Note over L: LLM 看到历史中<br/>用户说过叫张三
    L-->>U: "你叫张三。"  ✅ 记住了！
```

## 三、Memory 架构演进

```mermaid
graph TB
    subgraph 旧版 ["v0.1 及以前（已废弃）"]
        direction LR
        OLD1["ConversationBufferMemory<br/>全量保留"]
        OLD2["ConversationBufferWindowMemory<br/>窗口截断"]
        OLD3["ConversationSummaryMemory<br/>摘要压缩"]
        OLD1 & OLD2 & OLD3 --> OLD4["与 LLMChain 耦合<br/>不支持 LCEL"]
    end

    subgraph 新版 ["v0.2+（推荐）"]
        direction LR
        NEW1["RunnableWithMessageHistory<br/>给 Chain 添加历史"]
        NEW2["ChatMessageHistory<br/>存储后端(内存/文件/DB)"]
        NEW3["LangGraph State<br/>在图状态中管理消息"]
        NEW1 --> NEW2
    end

    旧版 -.->|"迁移"| 新版

    style 旧版 fill:#FFCDD2,stroke:#C62828
    style 新版 fill:#C8E6C9,stroke:#2E7D32
```

## 四、RunnableWithMessageHistory 工作原理

```mermaid
graph TB
    subgraph 调用流程
        U["用户输入<br/>{input: '你好'}"] --> CONFIG

        subgraph 配置
            CONFIG["config:<br/>session_id='user_001'"]
        end

        CONFIG --> HIST["get_session_history('user_001')"]
        HIST --> STORE[("会话历史存储<br/>session_id → 消息列表")]

        STORE --> ASSEMBLE["组装完整消息:<br/>System + History + Human"]

        ASSEMBLE --> CHAIN["Chain 执行<br/>prompt | llm | parser"]

        CHAIN --> RESULT["AI 回复"]
        RESULT --> SAVE["保存到历史:<br/>追加 AI 消息"]
        SAVE --> STORE
    end

    style CONFIG fill:#FFF9C4
    style STORE fill:#F3E5F5,stroke:#6A1B9A
    style CHAIN fill:#FFE0B2
```

### 多用户隔离

```mermaid
graph TB
    subgraph 会话存储
        STORE{"store (字典)"}
        STORE --> S1["session_id='user_A'<br/>[Human('我叫A'), AI('你好A')]<br/>[Human('我喜欢苹果'), AI('好的')]<br/>[Human('我叫什么?'), AI('你叫A')<br/>(记住A的上下文)]"]
        STORE --> S2["session_id='user_B'<br/>[Human('我叫B'), AI('你好B')]<br/>(记住B的上下文)"]
        STORE --> S3["session_id='user_C'<br/>(空，新会话)"]
    end

    UA["用户A提问"] -->|"session_id=user_A"| STORE
    UB["用户B提问"] -->|"session_id=user_B"| STORE

    style STORE fill:#F3E5F5,stroke:#6A1B9A
    style S1 fill:#C8E6C9
    style S2 fill:#C8E6C9
    style S3 fill:#FFE0B2
```

## 五、历史管理策略对比

```mermaid
graph TB
    subgraph 全量保留 ["策略一：全量保留"]
        F1["保留所有消息"]
        F2["优点: 上下文最完整"]
        F3["缺点: Token消耗增长<br/>最终超出上下文窗口"]
        F1 --> F2 & F3
    end

    subgraph 窗口截断 ["策略二：窗口截断"]
        W1["只保留最近N轮"]
        W2["优点: Token消耗稳定"]
        W3["缺点: 丢失早期信息"]
        W1 --> W2 & W3
    end

    subgraph 摘要压缩 ["策略三：摘要压缩"]
        S1["用LLM总结旧对话"]
        S2["优点: 保留关键信息<br/>Token可控"]
        S3["缺点: 增加LLM调用<br/>摘要可能丢细节"]
        S1 --> S2 & S3
    end

    subgraph 混合策略 ["策略四：摘要+窗口（推荐）"]
        M1["旧对话→摘要<br/>+ 最近N轮→完整保留"]
        M2["优点: 平衡记忆与成本"]
        M1 --> M2
    end

    style 全量保留 fill:#FFCDD2
    style 窗口截断 fill:#FFF9C4
    style 摘要压缩 fill:#FFE0B2
    style 混合策略 fill:#C8E6C9
```

### 窗口截断可视化

```mermaid
graph LR
    subgraph 对话历史
        M1["消息1 (旧)"]
        M2["消息2"]
        M3["消息3"]
        M4["消息4"]
        M5["消息5"]
        M6["消息6 (最新)"]
    end

    subgraph 窗口=4
        W["保留最近4条"]
    end

    M3 --> W
    M4 --> W
    M5 --> W
    M6 --> W

    M1 -.->|丢弃| D["❌"]
    M2 -.->|丢弃| D

    style W fill:#C8E6C9
    style D fill:#FFCDD2
```

### 摘要压缩流程

```mermaid
graph TB
    subgraph 压缩前
        H1["消息1-20 (旧历史)"]
        H2["消息21-30 (近期)"]
    end

    H1 --> SUM["LLM总结:<br/>'用户讨论了A、B、C...'"]
    SUM --> S_MSG["SystemMessage:<br/>'之前对话摘要: ...'"]

    subgraph 压缩后
        S_MSG
        H2
    end

    S_MSG --> NEXT["后续对话使用<br/>摘要+近期消息"]

    style H1 fill:#FFCDD2
    style SUM fill:#FFF9C4
    style S_MSG fill:#C8E6C9
    style NEXT fill:#E3F2FD
```

## 六、持久化存储层

```mermaid
graph TB
    subgraph 存储后端选择
        MEM["内存存储<br/>ChatMessageHistory"]
        FILE["文件存储<br/>FileChatMessageHistory"]
        SQL["SQLite存储<br/>SQLChatMessageHistory"]
        REDIS["Redis存储<br/>RedisChatMessageHistory"]
        PG["PostgreSQL<br/>PostgresChatMessageHistory"]
    end

    MEM -->|"适用: 开发调试<br/>特点: 快但重启丢失"| L1["学习/原型"]
    FILE -->|"适用: 单机简单场景<br/>特点: 持久但性能一般"| L2["个人项目"]
    SQL -->|"适用: 中小应用<br/>特点: 持久+可查询"| L3["中小型应用"]
    REDIS -->|"适用: 高并发<br/>特点: 快+持久"| L4["生产环境"]
    PG -->|"适用: 大规模<br/>特点: 持久+可扩展"| L5["企业应用"]

    style MEM fill:#C8E6C9
    style FILE fill:#FFF9C4
    style SQL fill:#FFE0B2
    style REDIS fill:#E3F2FD
    style PG fill:#F3E5F5
```

## 七、LangGraph 中的 Memory

在 LangGraph 中，Memory 通过 State + Reducer 实现，更加灵活：

```mermaid
graph TB
    subgraph LangGraph方式
        S["State:<br/>messages: Annotated[list, add]"]

        subgraph 节点A
            NA["读取 state['messages']<br/>获取完整历史"]
            NA --> NB["LLM 生成回复"]
            NB --> NC["返回 {'messages': [AIMessage]}"]
        end

        NC --> R["Reducer: add<br/>自动追加到 messages"]
        R --> S

        S --> subgraph_checkpoint["Checkpointer<br/>持久化 State"]
    end

    style S fill:#F3E5F5,stroke:#6A1B9A
    style R fill:#FFF9C4
    style subgraph_checkpoint fill:#C8E6C9
```

### LangChain Memory vs LangGraph State 对比

```mermaid
graph LR
    subgraph LangChain方式
        LC1["RunnableWithMessageHistory"]
        LC2["外部存储管理"]
        LC3["每次调用从存储加载"]
        LC1 --> LC2 --> LC3
    end

    subgraph LangGraph方式
        LG1["State 中直接管理消息"]
        LG2["Reducer 自动追加"]
        LG3["Checkpointer 自动持久化"]
        LG4["支持时间旅行"]
        LG1 --> LG2 --> LG3 --> LG4
    end

    style LangChain方式 fill:#E3F2FD
    style LangGraph方式 fill:#F3E5F5
```
