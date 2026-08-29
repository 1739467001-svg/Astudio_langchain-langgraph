# Agent 规划策略图解

> 用图解理解三种规划模式和推理链管理。

---

## 一、三种规划模式

```mermaid
graph TB
    M1["前向规划<br/>先出完整计划"] 
    M2["反应式<br/>边做边决定"]
    M3["混合规划<br/>粗规划+动态调整"]

    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style M3 fill:#FFF9C4
```

---

## 二、混合规划流程

```mermaid
graph TB
    GOAL["目标"] --> PLAN["粗略规划"]
    PLAN --> EXEC["执行"] --> OBSERVE["观察"]
    OBSERVE --> ADJUST&#123;"需要调整?"&#125;
    ADJUST -->|是| REPLAN["重新规划"]
    ADJUST -->|否| NEXT["下一步"]
    REPLAN --> NEXT

    style PLAN fill:#FFF9C4
    style ADJUST fill:#E3F2FD
```

---

## 三、检查清单

| 检查项 | 状态 |
|--------|------|
| 有前向规划器 | ☐ |
| 有推理链管理 | ☐ |
| 有重新规划 | ☐ |
