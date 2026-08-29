# LangGraph 检查点与时间旅行图解

> LangGraph 最强大的特性之一：检查点持久化、中断恢复和时间旅行。

---

## 一、检查点（Checkpoint）是什么

```mermaid
graph LR
    subgraph 无检查点 ["无检查点"]
        N1["执行节点A"] --> N2["执行节点B"] --> N3["执行节点C"]
        N3 --> N4["程序崩溃 💥"]
        N4 --> N5["从头重新执行 ❌"]
    end

    subgraph 有检查点 ["有检查点"]
        C1["执行节点A"] --> |"保存State"| CP1[("Checkpoint1")]
        C1 --> C2["执行节点B"] --> |"保存State"| CP2[("Checkpoint2")]
        C2 --> C3["执行节点C"] --> |"保存State"| CP3[("Checkpoint3")]
        C3 --> C4["程序崩溃 💥"]
        C4 --> C5["从Checkpoint3恢复 ✅"]
    end

    style N4 fill:#FFCDD2
    style N5 fill:#FFCDD2
    style C4 fill:#FFE0B2
    style C5 fill:#C8E6C9
    style CP1 fill:#F3E5F5
    style CP2 fill:#F3E5F5
    style CP3 fill:#F3E5F5
```

### 检查点的四项能力

```mermaid
graph TB
    CP["Checkpoint 能力"]

    CP --> P1["📦 持久化<br/>程序重启后恢复对话"]
    CP --> P2["⏸️ 中断<br/>在指定节点暂停<br/>等待外部输入"]
    CP --> P3["⏪ 时间旅行<br/>回到历史状态<br/>从那里重新开始"]
    CP --> P4["📜 历史审计<br/>查看每一步的State<br/>调试和追踪"]

    style CP fill:#F3E5F5,stroke:#6A1B9A,stroke-width:3px
    style P1 fill:#E3F2FD
    style P2 fill:#FFF9C4
    style P3 fill:#FFE0B2
    style P4 fill:#C8E6C9
```

## 二、检查点的工作机制

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as App (编译后的图)
    participant C as Checkpointer
    participant S as 存储后端

    U->>A: invoke(input, config={thread_id: "1"})
    A->>C: 保存初始State
    C->>S: 写入 checkpoint[1]
    
    Note over A: 执行节点A
    A->>C: 保存State (节点A完成后)
    C->>S: 写入 checkpoint[2]
    
    Note over A: 执行节点B
    A->>C: 保存State (节点B完成后)
    C->>S: 写入 checkpoint[3]
    
    Note over A: 执行节点C (遇到interrupt)
    A-->>U: 返回当前State (暂停)
    
    Note over U: 此时可以修改State

    U->>A: invoke(None, config) 继续
    A->>C: 加载最新checkpoint
    C->>S: 读取 checkpoint[3]
    S-->>C: 返回State
    C-->>A: 恢复State
    Note over A: 从暂停处继续执行
```

## 三、中断与恢复（Human-in-the-Loop）

```mermaid
graph TB
    S([START]) --> A["节点A<br/>生成草稿"]
    A --> |"保存Checkpoint"| CP1[("CP1")]
    CP1 --> PAUSE["⏸️ interrupt_before<br/>='review'"]
    PAUSE --> B["节点B<br/>人工审查"]
    B --> DECISION{"通过?"}
    DECISION -->|"是"| C["节点C<br/>继续"]
    DECISION -->|"否"| A
    C --> E([END])

    style PAUSE fill:#FF6F00,color:#fff
    style CP1 fill:#F3E5F5
    style S fill:#4CAF50,color:#fff
    style E fill:#4CAF50,color:#fff
```

### 完整中断恢复流程

```python
from langgraph.checkpoint.memory import MemorySaver

app = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["review"]  # 在 review 节点之前暂停
)

config = {"configurable": {"thread_id": "session_001"}}

# 第一次调用：执行到 review 之前暂停
result = app.invoke({"input": "生成报告"}, config=config)
# result 包含到暂停为止的 State

# --- 此时可以检查和修改 State ---

# 查看当前状态
state = app.get_state(config)
print(state.values)  # 当前的 State 值
print(state.next)    # 下一个要执行的节点

# 修改 State（模拟人工输入）
app.update_state(config, {
    "human_feedback": "请重点修改第二段"
})

# 继续执行
result = app.invoke(None, config=config)
# None 表示"从上次暂停处继续"
```

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as App
    participant C as Checkpointer

    U->>A: invoke(input, config)
    A->>A: 执行节点A (生成)
    A->>C: 保存State
    Note over A: 到达 interrupt_before['review']<br/>暂停 ⏸️
    A-->>U: 返回当前State

    U->>A: get_state(config)
    A->>C: 读取最新checkpoint
    C-->>U: 当前State值 + 下一步信息

    U->>A: update_state(config, {feedback: "修改意见"})
    A->>C: 更新State
    Note over C: checkpoint被修改

    U->>A: invoke(None, config)
    A->>C: 读取checkpoint
    C-->>A: 恢复State (含修改)
    A->>A: 执行节点B (审查)
    A->>A: 执行节点C (继续)
    A-->>U: 返回最终结果
```

## 四、时间旅行

```mermaid
graph TB
    subgraph 执行历史
        T0["T0: 初始State<br/>{draft: '', count: 0}"]
        T1["T1: 节点A完成后<br/>{draft: '版本1', count: 1}"]
        T2["T2: 节点B完成后<br/>{draft: '版本1改', count: 2}"]
        T3["T3: 节点A第二次<br/>{draft: '版本2', count: 3}"]
        T4["T4: 最终<br/>{draft: '版本2改', count: 4}"]
        
        T0 --> T1 --> T2 --> T3 --> T4
    end

    subgraph 时间旅行
        TT["从T1恢复<br/>(回到第一次生成后)"]
        TT --> NEW["从T1重新开始<br/>{draft: '版本1', count: 1}"]
        NEW --> NEW2["走不同的路径<br/>{draft: '新版本', count: 2}"]
    end

    T1 -.->|"恢复到这个点"| TT

    style T1 fill:#FFE0B2
    style TT fill:#F3E5F5
    style NEW fill:#C8E6C9
```

### 时间旅行代码

```python
app = graph.compile(checkpointer=MemorySaver())
config = {"configurable": {"thread_id": "thread_1"}}

# 执行图
result = app.invoke({"input": "hello"}, config=config)

# 查看历史状态
for state in app.get_state_history(config):
    print(f"Step: {state.config['configurable']['checkpoint_id']}")
    print(f"  Values: {state.values}")
    print(f"  Next: {state.next}")
    print(f"  Timestamp: {state.metadata.get('created_at')}")
    print()

# 从某个历史状态恢复
# 选择一个历史的 checkpoint_id
target_checkpoint_id = "历史checkpoint的ID"

# 从那个点重新执行
config_resume = {
    "configurable": {
        "thread_id": "thread_1",
        "checkpoint_id": target_checkpoint_id,
    }
}
result = app.invoke(None, config=config_resume)
# 从选定的历史状态开始，重新执行后续节点
```

## 五、存储后端对比

```mermaid
graph TB
    subgraph 存储后端
        M["MemorySaver<br/>内存存储<br/>重启丢失"]
        S["SqliteSaver<br/>SQLite文件<br/>持久化"]
        P["PostgresSaver<br/>PostgreSQL<br/>持久化+高可用"]
    end

    M -->|"适用"| U1["学习/调试<br/>原型开发"]
    S -->|"适用"| U2["单机应用<br/>中小型项目"]
    P -->|"适用"| U3["生产环境<br/>多实例部署"]

    style M fill:#C8E6C9
    style S fill:#FFE0B2
    style P fill:#F3E5F5
```

```python
# MemorySaver（内存，开发用）
from langgraph.checkpoint.memory import MemorySaver
app = graph.compile(checkpointer=MemorySaver())

# SqliteSaver（SQLite文件，持久化）
from langgraph.checkpoint.sqlite import SqliteSaver
checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
app = graph.compile(checkpointer=checkpointer)

# PostgresSaver（生产环境）
from langgraph.checkpoint.postgres import PostgresSaver
# checkpointer = PostgresSaver.from_conn_string("postgresql://...")
# app = graph.compile(checkpointer=checkpointer)
```

## 六、检查点与对话隔离

```mermaid
graph TB
    subgraph 多线程隔离
        T1["thread_id='user_001'<br/>用户A的对话"]
        T2["thread_id='user_002'<br/>用户B的对话"]
        T3["thread_id='user_003'<br/>用户C的对话"]
    end

    subgraph 存储结构
        DB[("Checkpointer存储")]
        DB --> D1["thread_1 checkpoints:<br/>[cp1, cp2, cp3]"]
        DB --> D2["thread_2 checkpoints:<br/>[cp1, cp2]"]
        DB --> D3["thread_3 checkpoints:<br/>[cp1, cp2, cp3, cp4]"]
    end

    T1 --> DB
    T2 --> DB
    T3 --> DB

    style DB fill:#F3E5F5,stroke:#6A1B9A
```

每个 `thread_id` 拥有独立的检查点序列，不同用户/对话之间完全隔离。

## 七、实际应用场景

```mermaid
graph TB
    subgraph 场景1 ["场景1: 长流程中断恢复"]
        SC1["Agent执行多步任务<br/>(5个节点)"]
        SC1 --> SC1A["执行到第3步时<br/>用户关闭了浏览器"]
        SC1A --> SC1B["用户重新打开<br/>从第3步继续"]
    end

    subgraph 场景2 ["场景2: 人工审批"]
        SC2["Agent生成报告草稿"]
        SC2 --> SC2A["暂停，等待经理审批"]
        SC2A --> SC2B["经理批准/修改"]
        SC2B --> SC2C["继续执行"]
    end

    subgraph 场景3 ["场景3: A/B 测试"]
        SC3["执行到某步骤"]
        SC3 --> SC3A["回到历史某点"]
        SC3A --> SC3B["用不同参数重试"]
        SC3B --> SC3C["对比两条路径的结果"]
    end

    subgraph 场景4 ["场景4: 调试"]
        SC4["图执行结果不符合预期"]
        SC4 --> SC4A["查看历史State"]
        SC4A --> SC4B["定位哪一步出了问题"]
        SC4B --> SC4C["从那一步开始调试"]
    end

    style 场景1 fill:#E3F2FD
    style 场景2 fill:#FFF3E0
    style 场景3 fill:#F3E5F5
    style 场景4 fill:#C8E6C9
```
