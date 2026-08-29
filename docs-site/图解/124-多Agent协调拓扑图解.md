# 多 Agent 协调拓扑图解

> 用图解理解四种协调模式的拓扑结构和选型决策。

---

## 一、四种模式

```mermaid
graph TB
    ROOT["协调模式"] --> M1["Supervisor<br/>中心化"]
    ROOT --> M2["Hierarchical<br/>层级化"]
    ROOT --> M3["Network<br/>去中心化"]
    ROOT --> M4["Pipeline<br/>流水线"]

    style ROOT fill:#1565C0,color:#fff
    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、Supervisor模式

```mermaid
graph TB
    SUP["Supervisor<br/>中心调度"] --> A1["Agent A"]
    SUP --> A2["Agent B"]
    SUP --> A3["Agent C"]
    A1 & A2 & A3 --> SUP

    style SUP fill:#1565C0,color:#fff,stroke-width:3px
```

---

## 三、Hierarchical模式

```mermaid
graph TB
    TOP["顶层Supervisor"] --> M1["中层A"]
    TOP --> M2["中层B"]
    M1 --> A1["搜索Agent"]
    M1 --> A2["检索Agent"]
    M2 --> A3["分析Agent"]
    M2 --> A4["写作Agent"]

    style TOP fill:#1565C0,color:#fff,stroke-width:3px
    style M1 fill:#E3F2FD
    style M2 fill:#E3F2FD
```

---

## 四、Network模式

```mermaid
graph TB
    A1["Agent A"] <--> A2["Agent B"]
    A2 <--> A3["Agent C"]
    A1 <--> A3

    style A1 fill:#FFF3E0
```

---

## 五、Pipeline模式

```mermaid
graph LR
    A["收集"] --> B["分析"] --> C["写作"] --> D["审查"] --> E["输出"]

    style A fill:#E3F2FD
    style C fill:#FFF3E0
    style D fill:#C8E6C9
```

---

## 六、选型决策

```mermaid
graph TB
    Q1["Agent数量？"] -->|≤5| Q2["有明确步骤？"]
    Q2 -->|是| PIPE["Pipeline"]
    Q2 -->|否| SUP["Supervisor"]
    Q1 -->|5-15| HIER["Hierarchical"]
    Q1 -->|需辩论| NET["Network"]

    style SUP fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style PIPE fill:#E3F2FD
    style HIER fill:#FFF3E0
    style NET fill:#FFCDD2
```

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种模式 | ☐ |
| 能实现Supervisor | ☐ |
| 能实现Pipeline | ☐ |
| 能根据场景选模式 | ☐ |
