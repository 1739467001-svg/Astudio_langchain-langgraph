# Agent 性能调优与延迟优化图解

> 首 Token 快+吞吐量高。本图解可视化延迟拆解和优化策略。

---

## 延迟拆解

```mermaid
graph LR
    NET["网络 5%"] --> CTX["上下文构建 3%"]
    CTX --> LLM["LLM推理 30%<br/>首Token"]
    LLM --> TOOL["工具调用 20%"]
    TOOL --> LLM2["LLM推理 35%<br/>生成"]
    LLM2 --> OUT["输出 7%"]

    style LLM fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style LLM2 fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style TOOL fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 优化策略

```mermaid
graph TB
    OPT["性能优化"]

    OPT --> TTFT["首Token优化<br/>快模型/Prompt缓存/预取"]
    OPT --> PARALLEL["并行化<br/>工具并行/多路检索"]
    OPT --> CACHE["多级缓存<br/>精确/语义/Prompt前缀"]
    OPT --> CTX_OPT["上下文优化<br/>裁剪/压缩/截断"]
    OPT --> STREAM["流式输出<br/>立即可见"]

    style OPT fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style TTFT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style PARALLEL fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style CACHE fill:#F3E5F5,stroke:#7B1FA2
```

---

## 瓶颈诊断

```mermaid
graph TB
    SLOW["延迟高"] --> WHERE{"瓶颈在哪?"}
    WHERE -->|"TTFT>2s"| LLM_B["LLM推理<br/>换模型/减上下文/缓存"]
    WHERE -->|"工具>3s"| TOOL_B["工具调用<br/>并行化/缓存/超时"]
    WHERE -->|"检索>1s"| RET_B["检索<br/>优化索引/减TopK"]
    WHERE -->|"Token>5K"| CTX_B["上下文<br/>压缩/截断"]

    style SLOW fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style LLM_B fill:#E3F2FD,stroke:#1565C0
    style TOOL_B fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 延迟拆解 | ☐ |
| TTFT 优化 | ☐ |
| 并行化 | ☐ |
| 多级缓存 | ☐ |
| 上下文优化 | ☐ |
| 瓶颈诊断 | ☐ |
