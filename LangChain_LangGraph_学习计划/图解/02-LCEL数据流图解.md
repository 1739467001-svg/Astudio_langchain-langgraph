# LCEL 数据流图解

> 深入理解 LangChain Expression Language 的管道机制、类型流转和组合方式。

---

## 一、LCEL 核心理念

```mermaid
graph LR
    subgraph 传统方式
        direction TB
        T1["手动编排每一步"] --> T2["手动处理类型转换"]
        T2 --> T3["手动实现流式"]
        T3 --> T4["手动实现异步"]
        T4 --> T5["手动实现批处理"]
    end

    subgraph LCEL方式
        direction TB
        L1["prompt | llm | parser"] --> L2["自动类型适配"]
        L2 --> L3["自动流式输出"]
        L3 --> L4["自动异步支持"]
        L4 --> L5["自动批处理"]
    end

    style 传统方式 fill:#FFCDD2,stroke:#C62828
    style LCEL方式 fill:#C8E6C9,stroke:#2E7D32
```

## 二、管道符的工作原理

`|` 管道符把多个 Runnable 串联成一个流水线。上一步的输出自动作为下一步的输入：

```mermaid
graph LR
    INPUT["输入: {'topic': 'AI'}"] --> P

    subgraph 管道流水线
        P["PromptTemplate<br/>填充模板"] -->|"ChatPromptValue"| L["ChatOpenAI<br/>调用模型"]
        L -->|"AIMessage"| P2["StrOutputParser<br/>提取文本"]
    end

    P2 --> OUTPUT["输出: 'AI是...'"]

    style INPUT fill:#E3F2FD
    style P fill:#FFF9C4
    style L fill:#FFE0B2
    style P2 fill:#C8E6C9
    style OUTPUT fill:#E8F5E9
```

### 每一步的类型变化

```mermaid
graph TB
    subgraph Step1 ["Step 1: PromptTemplate"]
        S1A["输入: dict"] --> S1B["处理: 填充模板变量"]
        S1B --> S1C["输出: ChatPromptValue<br/>(SystemMessage + HumanMessage)"]
    end

    subgraph Step2 ["Step 2: ChatOpenAI"]
        S2A["输入: ChatPromptValue"] --> S2B["处理: 调用API"]
        S2B --> S2C["输出: AIMessage<br/>(.content / .tool_calls)"]
    end

    subgraph Step3 ["Step 3: OutputParser"]
        S3A["输入: AIMessage"] --> S3B["处理: 提取/解析"]
        S3B --> S3C["输出: str / dict / object"]
    end

    Step1 -->|输出类型<br/>必须匹配| Step2
    Step2 -->|输出类型<br/>必须匹配| Step3

    style Step1 fill:#FFF9C4
    style Step2 fill:#FFE0B2
    style Step3 fill:#C8E6C9
```

## 三、Runnable 组件家族

```mermaid
graph TB
    subgraph 工具组件 ["工具组件（数据加工）"]
        RP[RunnablePassthrough<br/>透传]
        RL[RunnableLambda<br/>包装函数]
        RPar[RunnableParallel<br/>并行执行]
        RB[RunnableBranch<br/>条件分支]
    end

    subgraph 功能组件 ["功能组件（实际处理）"]
        PT[PromptTemplate]
        LLM[ChatOpenAI等]
        OP[OutputParser]
        RT[Retriever]
    end

    subgraph 包装组件 ["包装组件（增强能力）"]
        WM[RunnableWithMessageHistory<br/>添加记忆]
        ST[with_structured_output<br/>结构化输出]
        BT[bind_tools<br/>绑定工具]
    end

    style 工具组件 fill:#E3F2FD,stroke:#1565C0
    style 功能组件 fill:#FFF3E0,stroke:#E65100
    style 包装组件 fill:#F3E5F5,stroke:#6A1B9A
```

### 各组件的作用与数据流

```mermaid
graph LR
    subgraph RunnablePassthrough
        RP_IN["输入: {'a': 1}"] --> RP_OUT["输出: {'a': 1}<br/>(原样透传)"]
    end

    subgraph RunnablePassthrough.assign
        RPA_IN["输入: {'a': 1}"] --> RPA_OUT["输出: {'a': 1, 'b': 2}<br/>(添加新字段)"]
    end

    subgraph RunnableLambda
        RL_IN["输入: 任意"] --> RL_OUT["输出: 函数返回值<br/>(自定义转换)"]
    end

    subgraph RunnableParallel
        RPar_IN["输入: X"] --> RPar1["分支A"]
        RPar_IN --> RPar2["分支B"]
        RPar1 --> RPar_OUT["输出: {'A': ..., 'B': ...}"]
        RPar2 --> RPar_OUT
    end

    style RunnablePassthrough fill:#E3F2FD
    style RPA_IN fill:#E3F2FD
    style RunnableLambda fill:#FFF3E0
    style RunnableParallel fill:#F3E5F5
```

## 四、经典组合模式

### 模式一：基础三件套

```mermaid
graph LR
    A["dict<br/>{question}"] -->|PromptTemplate| B["ChatPromptValue"]
    B -->|ChatOpenAI| C["AIMessage"]
    C -->|StrOutputParser| D["str<br/>回答"]

    style A fill:#E3F2FD
    style D fill:#C8E6C9
```

```python
chain = prompt | llm | StrOutputParser()
```

### 模式二：RAG 检索增强

```mermaid
graph TB
    Q["用户问题"] --> R1

    subgraph 数据组装 ["RunnableParallel 数据组装"]
        R1["Retriever<br/>检索相关文档"] -->|format| C["context 文本"]
        R2["RunnablePassthrough<br/>透传问题"] --> Q2["question"]
    end

    C --> P
    Q2 --> P

    subgraph 生成 ["生成回答"]
        P["PromptTemplate<br/>组装 context+question"] --> L["ChatOpenAI<br/>生成回答"]
        L --> P2["StrOutputParser<br/>输出文本"]
    end

    P2 --> A["最终回答"]

    style 数据组装 fill:#E3F2D,stroke:#1565C0
    style 生成 fill:#FFF3E0,stroke:#E65100
    style Q fill:#E3F2FD
    style A fill:#C8E6C9
```

```python
chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)
```

### 模式三：多步骤串联

```mermaid
graph LR
    A["用户问题"] --> P1["Prompt1<br/>生成关键词"]
    P1 --> L1["LLM<br/>生成"]
    L1 --> P2["RunnableLambda<br/>转换格式"]
    P2 --> P3["Prompt2<br/>基于关键词写摘要"]
    P3 --> L2["LLM<br/>生成"]
    L2 --> O["最终摘要"]

    style A fill:#E3F2FD
    style P1 fill:#FFF9C4
    style L1 fill:#FFE0B2
    style P2 fill:#F3E5F5
    style P3 fill:#FFF9C4
    style L2 fill:#FFE0B2
    style O fill:#C8E6C9
```

### 模式四：并行生成

```mermaid
graph TB
    IN["输入: {'topic': 'AI'}"] --> SPLIT

    subgraph 并行执行
        SPLIT["RunnableParallel"] --> A1["LLM: 生成标题"]
        SPLIT --> A2["LLM: 生成摘要"]
        SPLIT --> A3["LLM: 生成关键词"]
    end

    A1 --> MERGE["合并: {'title': ..., 'summary': ..., 'keywords': ...}"]
    A2 --> MERGE
    A3 --> MERGE

    style IN fill:#E3F2FD
    style SPLIT fill:#F3E5F5
    style MERGE fill:#C8E6C9
```

## 五、invoke / stream / batch 对比

```mermaid
graph TB
    subgraph invoke ["invoke（单条同步）"]
        I_IN["1条输入"] --> I_LLM["调用LLM"]
        I_LLM --> I_WAIT["等待完成"]
        I_WAIT --> I_OUT["1条结果"]
    end

    subgraph batch ["batch（批量并发）"]
        B_IN["N条输入"] --> B_LLM["并发调用N次"]
        B_LLM --> B_OUT["N条结果"]
    end

    subgraph stream ["stream（流式）"]
        S_IN["1条输入"] --> S_LLM["调用LLM"]
        S_LLM --> S1["chunk 1"]
        S_LLM --> S2["chunk 2"]
        S_LLM --> S3["chunk 3"]
        S1 --> S_OUT["逐步返回"]
        S2 --> S_OUT
        S3 --> S_OUT
    end

    style invoke fill:#E3F2FD
    style batch fill:#FFF3E0
    style stream fill:#E8F5E9
```

### 性能对比示意

```
invoke 逐个调用: ──●──────●──────●──  (总时间: 9秒)
batch 批量调用:   ──●●●─────────────  (总时间: 3秒，并发)
stream 流式输出:  ──▓▓▓▓▓▓▓▓▓─────  (首字时间: 0.3秒)
```

## 六、类型兼容性规则

管道串联的关键约束——上一步的输出类型必须能被下一步接收：

```mermaid
graph TB
    subgraph 兼容 ["✅ 类型兼容"]
        C1["PromptTemplate<br/>输出: ChatPromptValue"] --> C2["ChatOpenAI<br/>接收: ChatPromptValue"] --> C3["OutputParser<br/>接收: AIMessage"]
    end

    subgraph 不兼容 ["❌ 类型不兼容"]
        N1["ChatOpenAI<br/>输出: AIMessage"] --> N2["PromptTemplate<br/>接收: dict<br/>(类型不匹配!)"]
        N3["StrOutputParser<br/>输出: str"] --> N4["ChatOpenAI<br/>接收: 消息列表<br/>(类型不匹配!)"]
    end

    style 兼容 fill:#C8E6C9,stroke:#2E7D32
    style 不兼容 fill:#FFCDD2,stroke:#C62828
```

### 常见类型链路速查

| 组合方式 | 输入类型 | Step 1 输出 | Step 2 输入 | Step 2 输出 |
|----------|----------|-------------|-------------|-------------|
| `prompt \| llm` | dict | ChatPromptValue | ChatPromptValue | AIMessage |
| `prompt \| llm \| StrOutputParser` | dict | ChatPromptValue | — | str |
| `retriever \| format_docs` | str | List[Document] | str | str |
| `RunnablePassthrough \| llm` | 消息列表 | 消息列表 | 消息列表 | AIMessage |
