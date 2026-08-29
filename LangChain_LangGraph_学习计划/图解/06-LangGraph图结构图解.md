# LangGraph 图结构图解

> 用图解方式理解 LangGraph 的 State、Node、Edge 和条件路由机制。

---

## 一、LangGraph 核心三要素

```mermaid
graph TB
    subgraph 三要素
        S["📦 State（状态）<br/>在所有节点间共享的数据容器"]
        N["🔷 Node（节点）<br/>处理步骤，读取State返回更新"]
        E["➡️ Edge（边）<br/>节点间的连接，决定执行顺序"]
    end

    S -->|传递给| N
    N -->|更新| S
    N -->|通过| E
    E -->|到达| N

    style S fill:#E3F2FD,stroke:#1565C0
    style N fill:#FFE0B2,stroke:#E65100
    style E fill:#C8E6C9,stroke:#2E7D32
```

## 二、State 与 Reducer 机制

### 默认行为 vs Reducer

```mermaid
graph TB
    subgraph 默认-替换 ["不指定 Reducer（默认替换）"]
        direction TB
        D_BEFORE["当前 State:<br/>{answer: '旧答案'}"]
        D_NODE["节点返回:<br/>{answer: '新答案'}"]
        D_AFTER["结果 State:<br/>{answer: '新答案'} ✅ 替换"]

        D_BEFORE --> D_NODE --> D_AFTER
    end

    subgraph Reducer-add ["指定 Annotated[list, add]"]
        direction TB
        A_BEFORE["当前 State:<br/>{messages: [msg1, msg2]}"]
        A_NODE["节点返回:<br/>{messages: [msg3]}"]
        A_AFTER["结果 State:<br/>{messages: [msg1, msg2, msg3]} ✅ 追加"]

        A_BEFORE --> A_NODE --> A_AFTER
    end

    style 默认-替换 fill:#E3F2FD
    style Reducer-add fill:#C8E6C9
```

### Reducer 的工作流程

```mermaid
sequenceDiagram
    participant S as 当前State
    participant N as Node函数
    participant R as Reducer

    S->>N: 传入完整State
    Note over N: 处理数据<br/>返回部分更新
    N->>R: 返回 {messages: [new_msg]}
    Note over R: 对每个字段:<br/>messages字段用add合并器<br/>answer字段用默认替换
    R-->>S: 合并后的新State
```

### 最常用的 State 模式

```mermaid
graph TB
    subgraph 经典AgentState
        S1["messages: Annotated[list[AnyMessage], add]<br/>消息自动追加"]
        S2["current_step: str<br/>当前步骤（替换）"]
        S3["retry_count: int<br/>重试次数（替换）"]
    end

    style S1 fill:#C8E6C9
    style S2 fill:#E3F2FD
    style S3 fill:#FFE0B2
```

## 三、Node 节点详解

```mermaid
graph TB
    subgraph 节点函数签名
        IN["输入: 当前 State"] --> FUNC["def my_node(state: State) -> dict:"]
        FUNC --> READ["读取: state['field_name']"]
        READ --> PROCESS["处理: 调用LLM / 执行工具 / 任意逻辑"]
        PROCESS --> RETURN["返回: {更新的字段: 新值}"]
    end

    subgraph 关键规则
        R1["✅ 只返回需要更新的字段"]
        R2["✅ 返回值通过Reducer合并"]
        R3["✅ 不需要返回整个State"]
        R4["❌ 不要修改State中的原始对象"]
    end

    style 节点函数签名 fill:#E3F2FD
    style 关键规则 fill:#FFF9C4
```

### 节点类型

```mermaid
graph TB
    subgraph 节点类型
        direction LR
        NT1["📄 普通函数节点<br/>def node(state) -> dict"]
        NT2["🤖 LLM调用节点<br/>内部调用ChatOpenAI"]
        NT3["🔧 工具执行节点<br/>执行tool_calls"]
        NT4["🔀 路由节点<br/>返回路由字符串"]
        NT5["📊 子图节点<br/>一个完整的子图作为节点"]
    end

    style NT1 fill:#E3F2FD
    style NT2 fill:#FFE0B2
    style NT3 fill:#F3E5F5
    style NT4 fill:#FFF9C4
    style NT5 fill:#C8E6C9
```

## 四、Edge 类型详解

### 普通边 vs 条件边

```mermaid
graph TB
    subgraph 普通边 ["普通边（固定连接）"]
        E1["节点A"] -->|"必定执行"| E2["节点B"]
    end

    subgraph 条件边 ["条件边（根据状态路由）"]
        C1["节点A"] --> C_FUNC["路由函数(state) → 'path1' or 'path2'"]
        C_FUNC -->|"返回'path1'"| C2["节点B"]
        C_FUNC -->|"返回'path2'"| C3["节点C"]
    end

    style 普通边 fill:#E3F2FD
    style 条件边 fill:#FFF3E0
```

### 条件边实现循环

```mermaid
graph TB
    START([START]) --> GEN["generate<br/>生成回答"]
    GEN --> REV["review<br/>审查质量"]
    REV --> ROUTE{"should_retry?"}

    ROUTE -->|"质量不合格<br/>retry_count < 3"| GEN
    ROUTE -->|"质量合格"| END1([END])
    ROUTE -->|"超过最大重试次数"| END1

    style START fill:#4CAF50,color:#fff
    style END1 fill:#4CAF50,color:#fff
    style GEN fill:#E3F2FD
    style REV fill:#FFF9C4
    style ROUTE fill:#FFE0B2
```

## 五、经典图模式

### 模式一：线性流程

```mermaid
graph LR
    S([START]) --> A["节点A<br/>加载"]
    A --> B["节点B<br/>处理"]
    B --> C["节点C<br/>输出"]
    C --> E([END])

    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
    style A fill:#E3F2FD
    style B fill:#E3F2FD
    style C fill:#E3F2FD
```

### 模式二：条件分支

```mermaid
graph TB
    S([START]) --> R["路由判断"]
    R -->|"数学问题"| M["数学Agent"]
    R -->|"翻译问题"| T["翻译Agent"]
    R -->|"闲聊"| C["闲聊Agent"]
    M --> E([END])
    T --> E
    C --> E

    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
    style R fill:#FFF9C4
    style M fill:#E3F2FD
    style T fill:#E3F2FD
    style C fill:#E3F2FD
```

### 模式三：循环（迭代优化）

```mermaid
graph TB
    S([START]) --> G["generate<br/>生成草稿"]
    G --> CK["check<br/>质量检查"]
    CK --> RT{"通过?"}
    RT -->|"否"| R["revise<br/>修改"]
    R --> G
    RT -->|"是"| F["finalize<br/>定稿"]
    F --> E([END])

    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
    style G fill:#E3F2FD
    style CK fill:#FFF9C4
    style RT fill:#FFE0B2
    style R fill:#F3E5F5
    style F fill:#C8E6C9
```

### 模式四：并行执行

```mermaid
graph TB
    S([START]) --> A["研究A<br/>(中文资料)"]
    S --> B["研究B<br/>(英文资料)"]
    S --> C["研究C<br/>(视频资料)"]
    A --> M["merge<br/>合并结果"]
    B --> M
    C --> M
    M --> E([END])

    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
    style A fill:#E3F2FD
    style B fill:#E3F2FD
    style C fill:#E3F2FD
    style M fill:#C8E6C9
```

### 模式五：Supervisor 模式

```mermaid
graph TB
    S([START]) --> SUP["Supervisor<br/>主控Agent"]

    SUP -->|"分配给研究员"| A1["研究员Agent"]
    SUP -->|"分配给写手"| A2["写手Agent"]
    SUP -->|"分配给审稿人"| A3["审稿人Agent"]

    A1 --> SUP
    A2 --> SUP
    A3 --> SUP

    SUP -->|"任务完成"| E([END])

    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
    style SUP fill:#FFE0B2
    style A1 fill:#E3F2FD
    style A2 fill:#E3F2FD
    style A3 fill:#E3F2FD
```

## 六、图的编译与运行

```mermaid
graph LR
    subgraph 构建阶段
        B1["定义State"] --> B2["add_node"]
        B2 --> B3["add_edge"]
        B3 --> B4["add_conditional_edges"]
    end

    B4 --> COMPILE["compile()"]

    subgraph 编译选项
        COMPILE --> O1["基础编译"]
        COMPILE --> O2["+ checkpointer<br/>持久化+中断"]
        COMPILE --> O3["+ interrupt_before<br/>Human-in-Loop"]
    end

    O1 & O2 & O3 --> RUN

    subgraph 运行阶段
        RUN["invoke / stream / ainvoke"]
    end

    style COMPILE fill:#FFF9C4
    style RUN fill:#C8E6C9
```

## 七、Human-in-the-Loop 机制

```mermaid
sequenceDiagram
    participant U as 用户
    participant G as Graph
    participant C as Checkpointer

    U->>G: invoke(input, config)
    Note over G: 执行节点A → 节点B...

    G->>C: 保存当前State
    Note over G: 到达 interrupt_before='review'<br/>暂停执行 ⏸️

    G-->>U: 返回当前State (草稿)

    U->>C: update_state(config, {draft: '人工修改'})
    Note over C: 更新State中的草稿

    U->>G: invoke(None, config) 继续
    Note over G: 从暂停处恢复<br/>执行 review 节点 → END

    G-->>U: 返回最终结果
```

### 中断点的工作方式

```mermaid
graph LR
    S([START]) --> A["节点A<br/>生成草稿"]
    A -.->|⏸️ 暂停| PAUSE["interrupt_before<br/>='review'"]
    PAUSE --> R["节点B<br/>人工审查"]
    R --> C["节点C<br/>继续执行"]
    C --> E([END])

    style PAUSE fill:#FF6F00,color:#fff
    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
```

## 八、State 在图中的生命周期

```mermaid
graph TB
    INIT["初始化 State<br/>{messages: [], answer: ''}"]

    INIT --> N1

    subgraph N1 ["节点1: 接收"]
        N1_IN["读取: state.messages (空)"]
        N1_IN --> N1_PROC["处理: 添加用户消息"]
        N1_PROC --> N1_OUT["返回: {messages: [HumanMessage]}"]
    end

    N1 --> R1["Reducer合并<br/>messages: [] + [HumanMessage] = [HumanMessage]"]

    R1 --> N2

    subgraph N2 ["节点2: LLM回复"]
        N2_IN["读取: state.messages ([HumanMessage])"]
        N2_IN --> N2_PROC["处理: 调用LLM生成回复"]
        N2_PROC --> N2_OUT["返回: {messages: [AIMessage], answer: '回复'}"]
    end

    N2 --> R2["Reducer合并<br/>messages: [HumanMessage] + [AIMessage] = [HumanMessage, AIMessage]<br/>answer: '' → '回复'"]

    R2 --> N3

    subgraph N3 ["节点3: 输出"]
        N3_IN["读取: state.answer ('回复')"]
        N3_IN --> N3_PROC["处理: 格式化输出"]
        N3_PROC --> N3_OUT["返回: {answer: '格式化后的回复'}"]
    end

    N3 --> FINAL["最终 State<br/>{messages: [Human, AI], answer: '格式化回复'}"]

    style INIT fill:#E3F2FD
    style R1 fill:#FFF9C4
    style R2 fill:#FFF9C4
    style FINAL fill:#C8E6C9
```
