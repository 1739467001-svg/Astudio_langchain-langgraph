# 事件溯源与 CQRS 图解

> 写入只追加事件、读取走预投影视图，读写模型彻底分离。

---

```mermaid
graph TB
    CMD["命令 Command"] --> HANDLER{"命令处理器"}
    HANDLER --> APPEND["追加事件<br/>EventStore"]
    APPEND --> BUS["事件总线"]
    BUS --> PROJ["投影 → 读模型"]
    QUERY["查询 Query"] --> READ["只读视图"]

    style HANDLER fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style APPEND fill:#E3F2FD,stroke:#1565C0
    style READ fill:#C8E6C9
    style BUS fill:#FFE0B2
```

---

## 读写分离对比

| 模式 | 写入侧 | 读取侧 | 特点 |
|------|--------|--------|------|
| 传统CRUD | 直接覆盖 | 直接读 | 简单但丢历史 |
| 事件溯源 | 追加事件 | 投影视图 | 可重放可审计 |
| CQRS | 命令处理 | 读模型 | 读写独立优化 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有不可变事件 | ☐ |
| 有EventStore | ☐ |
| 有命令处理器 | ☐ |
| 有投影读模型 | ☐ |
| 有事件重放 | ☐ |
