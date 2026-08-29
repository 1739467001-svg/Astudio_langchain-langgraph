# Agent 数据迁移与零停机搬迁图解

> 双写过渡+渐进切流+数据校验+回滚保障。本图解可视化零停机迁移流程。

---

## 零停机迁移流程

```mermaid
graph LR
    SCHEMA["1.结构迁移"] --> BULK["2.全量复制"] --> CDC["3.CDC增量同步"]
    CDC --> DUAL["4.双写"] --> CUTOVER["5.渐进读切流"]
    CUTOVER --> STOP["6.停止旧库"] --> VERIFY["7.验证清理"]

    style DUAL fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CUTOVER fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style VERIFY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 双写过渡

```mermaid
graph TB
    NEW_DATA["新数据写入"] --> OLD["旧库"]
    NEW_DATA --> NEW["新库"]
    OLD <-->|"CDC同步"| NEW
    READ["读取请求"] -->|"渐进切流"| NEW

    style NEW_DATA fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style READ fill:#FFF9C4,stroke:#F9A825
```

---

## 向量库迁移

```mermaid
graph TB
    OLD_VEC["旧向量库<br/>Chroma"] --> BACKFILL["回填历史数据"]
    BACKFILL --> NEW_VEC["新向量库<br/>Qdrant"]
    NEW_WRITE["新写入"] --> OLD_VEC
    NEW_WRITE --> NEW_VEC
    VERIFY["一致性校验"] -->|"99%+"| CUTOVER["✅ 切换"]

    style BACKFILL fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CUTOVER fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 零停机原则 | ☐ |
| 双写迁移 | ☐ |
| 全量+增量 | ☐ |
| 渐进切流 | ☐ |
| 一致性校验 | ☐ |
| 回滚保障 | ☐ |
