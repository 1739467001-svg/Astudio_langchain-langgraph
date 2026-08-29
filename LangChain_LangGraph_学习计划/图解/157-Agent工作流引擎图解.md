# Agent 工作流引擎图解

> 用图解理解工作流定义、步骤类型和引擎架构。

---

## 一、引擎核心能力

```mermaid
graph TB
    ROOT["工作流引擎"] --> C1["步骤编排"]
    ROOT --> C2["状态管理"]
    ROOT --> C3["中断恢复"]
    ROOT --> C4["错误处理"]
    ROOT --> C5["可观测性"]

    style ROOT fill:#1565C0,color:#fff
    style C3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、步骤类型

```mermaid
graph TB
    subgraph 类型 {"6种步骤"}
        S1["LLM调用"]
        S2["工具调用"]
        S3["条件判断"]
        S4["人工审批"]
        S5["并行执行"]
        S6["等待"]
    end

    style S4 fill:#FFF9C4
```

---

## 三、审批工作流

```mermaid
graph LR
    SUBMIT["提交"] --> APPROVE{"审批?"}
    APPROVE -->|通过| EXECUTE["执行"] --> NOTIFY["通知"]
    APPROVE -->|拒绝| NOTIFY

    style APPROVE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有工作流定义 | ☐ |
| 有引擎实现 | ☐ |
| 有模板 | ☐ |
