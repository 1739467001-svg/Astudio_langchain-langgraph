# Agent 任务分解图解

> 用图解理解 5 种分解策略和执行流程。

---

## 一、5种策略

```mermaid
graph TB
    ROOT["分解策略"] --> S1["顺序分解"]
    ROOT --> S2["并行分解"]
    ROOT --> S3["树形分解"]
    ROOT --> S4["条件分解"]
    ROOT --> S5["递归分解"]

    style ROOT fill:#1565C0,color:#fff
    style S1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、顺序分解

```mermaid
graph LR
    S1["子任务1"] --> S2["子任务2"] --> S3["子任务3"] --> OUT["完成"]

    style S1 fill:#E3F2FD
    style OUT fill:#C8E6C9
```

---

## 三、并行分解

```mermaid
graph TB
    T["任务"] --> S1["子任务1"]
    T --> S2["子任务2"]
    T --> S3["子任务3"]
    S1 & S2 & S3 --> MERGE["合并"]

    style MERGE fill:#C8E6C9
```

---

## 四、树形分解

```mermaid
graph TB
    ROOT["根任务"] --> A["分支A"]
    ROOT --> B["分支B"]
    A --> A1["A1"]
    A --> A2["A2"]
    B --> B1["B1"]

    style ROOT fill:#1565C0,color:#fff
```

---

## 五、条件分解

```mermaid
graph TB
    EXEC["执行第一步"] --> RESULT&#123;"结果?"&#125;
    RESULT -->|A| SA["子任务集A"]
    RESULT -->|B| SB["子任务集B"]

    style RESULT fill:#FFF9C4
```

---

## 六、策略对比

| 策略 | 关系 | 适合 | 复杂度 |
|------|------|------|--------|
| 顺序 | 线性依赖 | 有步骤 | 低 |
| 并行 | 独立 | 多源采集 | 中 |
| 树形 | 层级 | 超复杂 | 高 |
| 条件 | 动态 | 不确定 | 中 |
| 递归 | 自相似 | 可再分 | 高 |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有任务分解器 | ☐ |
| 能顺序/并行分解 | ☐ |
| 能条件分解 | ☐ |
| 与LangGraph集成 | ☐ |
