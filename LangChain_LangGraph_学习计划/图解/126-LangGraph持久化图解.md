# LangGraph 持久化图解

> 用图解理解 Checkpointer 四种类型、thread_id 隔离、中断恢复和两层存储。

---

## 一、Checkpointer价值

```mermaid
graph TB
    subgraph 没有 {"没有检查点"}
        N1["崩溃→从头执行"]
        N2["无法回到历史"]
        N3["多用户状态混淆"]
    end

    subgraph 有 {"有检查点"}
        Y1["崩溃→从断点恢复"]
        Y2["时间旅行"]
        Y3["thread_id隔离"]
    end

    style 没有 fill:#FFCDD2
    style 有 fill:#C8E6C9
```

---

## 二、四种类型

```mermaid
graph TB
    ROOT["Checkpointer"] --> C1["MemorySaver<br/>内存/开发"]
    ROOT --> C2["SqliteSaver<br/>SQLite/单机"]
    ROOT --> C3["PostgresSaver<br/>PG/生产推荐"]
    ROOT --> C4["RedisSaver<br/>Redis/高速"]

    style ROOT fill:#1565C0,color:#fff
    style C3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 三、thread_id隔离

```mermaid
graph TB
    U1["用户A thread=1"] --> CP["Checkpointer"]
    U2["用户B thread=2"] --> CP
    CP --> S1["State(thread=1)"]
    CP --> S2["State(thread=2)"]

    style CP fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 四、中断恢复

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Agent
    participant CP as Checkpointer

    U->>A: 请求
    A->>CP: 保存checkpoint-1
    A->>A: 执行步骤1
    A->>CP: 保存checkpoint-2
    A->>A: interrupt()暂停
    U->>A: Command(resume=data)
    A->>CP: 加载checkpoint-2
    A->>A: 从断点继续
    A-->>U: 完成
```

---

## 五、两层存储

```mermaid
graph TB
    subgraph 两层 {"两层存储"}
        CP["Checkpointer<br/>短期记忆<br/>线程内<br/>对话历史"]
        ST["Store<br/>长期记忆<br/>跨线程<br/>用户画像"]
    end

    style CP fill:#E3F2FD
    style ST fill:#FFF3E0
```

---

## 六、时间旅行

```mermaid
graph LR
    CP1["checkpoint-1"] --> CP2["checkpoint-2"] --> CP3["checkpoint-3"] --> CP4["checkpoint-4"]
    CP4 -.->|"回退到2"| CP2
    CP2 -.->|"从2重新执行"| CP3_NEW["checkpoint-3'"]

    style CP2 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CP3_NEW fill:#C8E6C9
```

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种Checkpointer | ☐ |
| 配置了PostgresSaver | ☐ |
| 理解thread_id隔离 | ☐ |
| 能中断恢复 | ☐ |
| 理解Store长期记忆 | ☐ |
