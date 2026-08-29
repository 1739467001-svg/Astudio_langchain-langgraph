# Agent 工作原理图解

> 深入理解 Agent 的 ReAct 循环、Tool Calling 流程和 Chain vs Agent 的区别。

---

## 一、Chain vs Agent 对比

```mermaid
graph TB
    subgraph Chain ["Chain（固定流程）"]
        direction LR
        CH_IN["输入"] --> CH_S1["Step1: 检索"]
        CH_S1 --> CH_S2["Step2: LLM生成"]
        CH_S2 --> CH_S3["Step3: 解析输出"]
        CH_S3 --> CH_OUT["输出"]
    end

    subgraph Agent ["Agent（动态决策）"]
        direction TB
        AG_IN["输入"] --> AG_THINK{"LLM思考:<br/>需要用什么工具?"}
        AG_THINK -->|"需要搜索"| AG_T1["调用搜索工具"]
        AG_THINK -->|"需要计算"| AG_T2["调用计算器"]
        AG_THINK -->|"需要查库"| AG_T3["调用数据库工具"]
        AG_T1 --> AG_OBS["观察结果"]
        AG_T2 --> AG_OBS
        AG_T3 --> AG_OBS
        AG_OBS --> AG_THINK2{"LLM思考:<br/>还需要工具?"}
        AG_THINK2 -->|"是"| AG_THINK
        AG_THINK2 -->|"否，可以回答了"| AG_OUT["最终输出"]
    end

    style Chain fill:#E3F2FD,stroke:#1565C0
    style Agent fill:#FFF3E0,stroke:#E65100
```

### 何时用 Chain，何时用 Agent

```mermaid
graph TD
    Q{"你的任务?"}
    Q -->|"步骤固定、可预测"| C["用 Chain"]
    Q -->|"步骤不确定、需要判断"| A["用 Agent"]
    Q -->|"每步做什么已提前知道"| C
    Q -->|"取决于中间结果<br/>才能决定下一步"| A
    Q -->|"性能优先、低延迟"| C
    Q -->|"灵活性优先"| A

    style C fill:#E3F2FD
    style A fill:#FFF3E0
```

## 二、ReAct 模式详解

ReAct = Reasoning（推理）+ Acting（行动）。这是 Agent 的核心范式：

```mermaid
graph TB
    START([用户提问]) --> THINK1
    
    subgraph 循环 ["ReAct 循环"]
        THINK1["🧠 Thought: 思考<br/>'用户想知道天气，<br/>我需要调用天气工具'"]
        THINK1 --> ACT1["🔨 Action: 行动<br/>调用 get_weather(city='北京')"]
        ACT1 --> OBS1["👀 Observation: 观察<br/>'晴，25°C'"]
        OBS1 --> THINK2{"🧠 Thought: 思考<br/>'拿到数据了，<br/>还需要更多工具吗?'"}
        THINK2 -->|"是，还需更多信息"| THINK1
    end
    
    THINK2 -->|"否，可以回答了"| FINAL["✅ Final Answer<br/>'北京今天晴，气温25°C'"]
    FINAL --> DONE([结束])

    style START fill:#4CAF50,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style THINK1 fill:#E3F2FD
    style ACT1 fill:#FFE0B2
    style OBS1 fill:#C8E6C9
    style FINAL fill:#F3E5F5
```

### ReAct 执行示例

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Agent(LLM)
    participant T as 工具

    U->>A: "北京天气怎么样？3天后呢？"

    Note over A: Thought: 用户问北京天气<br/>需要调用天气工具
    A->>T: get_weather(city="北京", date="今天")
    T-->>A: "晴，25°C"
    Note over A: Observation: 今天北京晴25°C

    Note over A: Thought: 用户还问3天后<br/>需要再次调用
    A->>T: get_weather(city="北京", date="+3天")
    T-->>A: "多云，22°C"
    Note over A: Observation: 3天后多云22°C

    Note over A: Thought: 信息够了<br/>可以回答了
    A-->>U: "北京今天晴，25°C；3天后多云，22°C"
```

## 三、Tool Calling 流程

现代 LLM 原生支持 Tool Calling，流程如下：

```mermaid
sequenceDiagram
    participant U as 用户
    participant L as LLM
    participant AE as AgentExecutor
    participant T as Tool

    U->>AE: "123 * 456 = ?"
    AE->>L: prompt + tools定义
    Note over L: 分析问题<br/>决定调用工具
    L-->>AE: AIMessage(tool_calls=[{name:"calc", args:"123*456"}])

    AE->>T: 执行 calc(expression="123*456")
    T-->>AE: "56088"
    AE->>L: 把工具结果加入对话历史
    Note over L: 看到工具结果<br/>准备最终回答
    L-->>AE: AIMessage(content="123*456=56088")
    AE-->>U: "123 * 456 = 56088"
```

### 工具定义结构

```mermaid
graph TB
    subgraph 工具组成
        N["name: 工具名称<br/>'calculate'"]
        D["description: 工具描述<br/>'计算数学表达式'<br/>(LLM据此决定是否使用)"]
        A["args_schema: 参数结构<br/>{expression: str}"]
        F["func: 实际函数<br/>def calculate(expr): ..."]
    end

    N --> LLM["LLM 通过 name+description<br/>理解工具用途"]
    A --> LLM
    LLM -->|"决定调用"| CALL["生成 tool_call:<br/>{name: 'calculate',<br/> args: {expression: '2+3'}}"]
    CALL --> F

    style 工具组成 fill:#E3F2FD,stroke:#1565C0
    style LLM fill:#FFE0B2
    style CALL fill:#F3E5F5
```

### 工具描述的重要性

```mermaid
graph TB
    subgraph 好的描述 ["✅ 好的工具描述"]
        G1["搜索互联网获取最新信息。<br/>当用户询问新闻、天气、实时数据时使用。<br/>不要用于已有知识能回答的问题。"]
    end

    subgraph 坏的描述 ["❌ 坏的工具描述"]
        B1["搜索"]
        B2["Search the internet."]
        B3["这个工具可以用来搜索东西。"]
    end

    好的描述 --> GA["LLM 准确判断<br/>何时使用此工具"]
    坏的描述 --> BA["LLM 困惑<br/>可能误用或漏用"]

    style 好的描述 fill:#C8E6C9
    style 坏的描述 fill:#FFCDD2
    style GA fill:#C8E6C9
    style BA fill:#FFCDD2
```

## 四、Agent 执行器工作流程

```mermaid
graph TB
    IN["用户输入"] --> INIT["初始化:<br/>messages = [用户消息]<br/>iteration = 0"]

    INIT --> LOOP{"iteration < max?"}
    LOOP -->|"否"| STOP["达到最大次数<br/>强制停止"]
    LOOP -->|"是"| CALL["调用LLM<br/>(传入messages + tools定义)"]

    CALL --> CHECK{"LLM 返回了<br/>tool_calls?"}
    CHECK -->|"是"| EXEC["执行工具调用"]
    EXEC --> ADD["把工具结果<br/>追加到 messages"]
    ADD --> INC["iteration += 1"]
    INC --> LOOP

    CHECK -->|"否"| FINAL["LLM 直接给出<br/>最终回答"]
    FINAL --> OUT["输出结果"]

    STOP --> OUT

    style IN fill:#E3F2FD
    style LOOP fill:#FFF9C4
    style CALL fill:#FFE0B2
    style EXEC fill:#F3E5F5
    style FINAL fill:#C8E6C9
    style STOP fill:#FFCDD2
```

## 五、Agent 类型对比

```mermaid
graph TB
    subgraph ToolCallingAgent ["create_tool_calling_agent（推荐）"]
        T1["使用 LLM 原生<br/>Tool Calling 能力"]
        T2["结构化的工具调用<br/>返回 JSON 参数"]
        T3["支持: GPT-4o, Claude, Gemini 等"]
    end

    subgraph ReActAgent ["旧版 ReAct Agent（了解）"]
        R1["通过 Prompt 引导<br/>让LLM输出文本格式"]
        R2["需要解析文本<br/>提取 Action + Input"]
        R3["兼容性更广<br/>但不够稳定"]
    end

    ToolCallingAgent --> BEST["✅ 新项目推荐"]
    ReActAgent --> LEGACY["⚠️ 仅老项目兼容用"]

    style ToolCallingAgent fill:#C8E6C9
    style ReActAgent fill:#FFF9C4
    style BEST fill:#C8E6C9
    style LEGACY fill:#FFE0B2
```

## 六、多工具 Agent 架构

```mermaid
graph TB
    U["用户: '帮我查北京天气<br/>然后算下明天气温差'"]

    U --> AGENT["Agent (LLM)"]

    subgraph 可用工具
        T1["🌐 搜索工具<br/>web_search(query)"]
        T2["🌤️ 天气工具<br/>get_weather(city)"]
        T3["🧮 计算工具<br/>calculate(expr)"]
        T4["📅 日期工具<br/>get_date()"]
    end

    AGENT -->|"Step1: 需要天气"| T2
    T2 --> R1["结果: 今天25°C"]
    R1 --> AGENT

    AGENT -->|"Step2: 需要明天天气"| T2
    T2 --> R2["结果: 明天20°C"]
    R2 --> AGENT

    AGENT -->|"Step3: 需要计算温差"| T3
    T3 --> R3["结果: 5"]
    R3 --> AGENT

    AGENT -->|"Step4: 信息齐全"| ANS["最终回答:<br/>'北京今天25°C，明天20°C，<br/>温差5°C'"]

    style AGENT fill:#FFE0B2
    style U fill:#E3F2FD
    style T1 fill:#E3F2FD
    style T2 fill:#E3F2FD
    style T3 fill:#E3F2FD
    style T4 fill:#E3F2FD
    style ANS fill:#C8E6C9
```

## 七、Agent 关键参数

```mermaid
graph TB
    subgraph AgentExecutor参数
        P1["verbose=True<br/>打印执行过程<br/>(调试用)"]
        P2["max_iterations=5<br/>最大循环次数<br/>(防止无限循环)"]
        P3["handle_parsing_errors=True<br/>解析失败时自动重试"]
        P4["early_stopping_method='generate'<br/>达上限时让LLM<br/>尽力生成回答"]
    end

    P2 --> WARN["⚠️ max_iterations 太大:<br/>可能无限循环、消耗Token<br/>太小: 复杂任务完不成"]

    style WARN fill:#FFCDD2
```
