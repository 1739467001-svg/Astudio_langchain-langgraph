# 自动 Prompt 优化与元学习图解

> 不写 Prompt，写签名；不手动调，用优化器搜索。本图解可视化 DSPy 和 APO 流程。

---

## 手工 vs 自动

```mermaid
graph TB
    subgraph "手工调 Prompt"
        M1["凭直觉改"] --> M2["跑测试"] --> M3["看效果"] --> M1
    end
    subgraph "自动优化"
        A1["定义任务+评估"] --> A2["优化器搜索"] --> A3["自动评估"] --> A4["最优Prompt"]
    end

    style M1 fill:#FFCCBC,stroke:#D84315
    style A4 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## DSPy 流程

```mermaid
graph LR
    SIG["定义签名<br/>输入→输出"] --> MOD["定义模块<br/>ChainOfThought"]
    MOD --> OPT["优化器编译<br/>BootstrapFewShot"]
    OPT --> RESULT["优化后模块<br/>自动选Prompt+Few-shot"]

    style SIG fill:#E3F2FD,stroke:#1565C0
    style OPT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style RESULT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 自我改进循环

```mermaid
graph TB
    EXEC["执行任务"] --> FEED["获取反馈"]
    FEED --> ANALYZE["分析不足"]
    ANALYZE --> IMPROVE["改进Prompt"]
    IMPROVE --> EXEC

    style EXEC fill:#E3F2FD,stroke:#1565C0
    style IMPROVE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解自动优化价值 | ☐ |
| DSPy 签名+模块 | ☐ |
| DSPy 优化器 | ☐ |
| APO 元Prompt | ☐ |
| 自我改进循环 | ☐ |
