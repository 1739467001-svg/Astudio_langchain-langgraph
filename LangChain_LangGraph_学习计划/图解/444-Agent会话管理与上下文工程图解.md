# Agent 会话管理与上下文工程图解

> 上下文窗口有限——System Prompt 10%、历史 35%、检索 30%、工具 15%、记忆 10%。本图解可视化预算分配和压缩策略。

---

## 上下文组成与优先级

```mermaid
graph TB
    CTX["Token 预算 8000"]

    CTX --> SYS["系统指令 10%<br/>优先级最高"]
    CTX --> HIST["对话历史 35%<br/>保留最近N轮"]
    CTX --> RET["检索文档 30%<br/>RAG 结果"]
    CTX --> TOOL["工具结果 15%<br/>截断长输出"]
    CTX --> MEM["记忆 10%<br/>用户偏好"]

    style CTX fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style SYS fill:#FFCCBC,stroke:#D84315
    style HIST fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style RET fill:#FFF9C4,stroke:#F9A825
```

---

## 上下文压缩

```mermaid
graph TB
    FULL["完整历史<br/>30K Token"] --> COMPRESS{"超出预算?"}
    COMPRESS -->|"是"| SUMMARIZE["摘要旧消息<br/>LLM 总结"]
    COMPRESS -->|"否"| KEEP["保留全部"]
    SUMMARIZE --> RESULT["System: 摘要<br/>+ 最近4条消息<br/>~3K Token"]

    style FULL fill:#FFCCBC,stroke:#D84315
    style RESULT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 多会话管理

```mermaid
graph LR
    USER["用户"] --> S1["会话1: 技术问答<br/>活跃"]
    USER --> S2["会话2: 写作助手<br/>活跃"]
    USER --> S3["会话3: 数据分析<br/>已归档"]

    style S1 fill:#C8E6C9,stroke:#2E7D32
    style S2 fill:#C8E6C9,stroke:#2E7D32
    style S3 fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 上下文五大组成 | ☐ |
| Token 预算分配 | ☐ |
| 上下文压缩 | ☐ |
| 多会话管理 | ☐ |
| 优先级排序 | ☐ |
