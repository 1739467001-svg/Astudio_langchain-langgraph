# Agent 工作流模式图解

> 用图解理解 6 种 Agent 推理模式的原理、流程和选型决策。

---

## 一、6种模式总览

```mermaid
graph TB
    ROOT["Agent工作流模式"] --> M1["ReAct<br/>推理+行动交替"]
    ROOT --> M2["Plan-and-Execute<br/>先规划再执行"]
    ROOT --> M3["Reflection<br/>自我反思纠错"]
    ROOT --> M4["ReWOO<br/>规划-填充-求解"]
    ROOT --> M5["LATS<br/>树搜索探索"]
    ROOT --> M6["Self-Ask<br/>自问自答分解"]

    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style ROOT fill:#1565C0,color:#fff
```

---

## 二、ReAct循环

```mermaid
graph TB
    T["Thought: 推理"] --> A["Action: 调用工具"]
    A --> O["Observation: 观察结果"]
    O --> T2["Thought: 继续推理"]
    T2 --> A2["Action: 下一步"]
    A2 --> O2["Observation"]
    O2 --> T3["Thought: 可以回答了"]
    T3 --> F["Final Answer"]

    style T fill:#E3F2FD
    style A fill:#FFF3E0
    style O fill:#C8E6C9
```

---

## 三、Plan-and-Execute

```mermaid
graph TB
    Q["问题"] --> PLANNER["Planner<br/>生成完整计划"]
    PLANNER --> S1["步骤1"]
    PLANNER --> S2["步骤2"]
    PLANNER --> S3["步骤3"]
    S1 --> EXEC["Executor<br/>逐步执行"]
    S2 --> EXEC
    S3 --> EXEC
    EXEC --> REPLAN&#123;"需要重新规划？"&#125;
    REPLAN -->|是| PLANNER
    REPLAN -->|否| FINAL["综合输出"]

    style PLANNER fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPLAN fill:#FFF3E0
```

---

## 四、Reflection循环

```mermaid
graph TB
    Q["问题"] --> GEN["生成初始回答"]
    GEN --> REFLECT["反思评估"]
    REFLECT --> CHECK&#123;"有问题？"&#125;
    CHECK -->|是| REVISE["改进回答"]
    REVISE --> REFLECT
    CHECK -->|否| FINAL["输出"]
    CHECK -->|超过N次| FINAL

    style REFLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REVISE fill:#FFCDD2
    style FINAL fill:#C8E6C9
```

---

## 五、ReWOO

```mermaid
graph LR
    Q["问题"] --> PLAN["一次性生成<br/>完整计划+工具模板"]
    PLAN --> E1["填充工具1"]
    PLAN --> E2["填充工具2"]
    PLAN --> E3["填充工具3"]
    E1 & E2 & E3 --> SOLVE["一次LLM调用<br/>综合所有结果"]
    SOLVE --> A["最终答案"]

    style PLAN fill:#FFF9C4
    style SOLVE fill:#C8E6C9
```

---

## 六、LATS树搜索

```mermaid
graph TB
    ROOT["根节点"] --> C1["行动1"]
    ROOT --> C2["行动2"]
    ROOT --> C3["行动3"]
    C1 --> C1A["行动1a"]
    C1 --> C1B["行动1b"]
    C2 --> C2A["行动2a"]
    EVAL["LLM评估叶子节点"] --> C1A
    EVAL --> C1B
    EVAL --> C2A
    C1A -->|最优| SELECT["继续探索"]

    style EVAL fill:#FFF9C4
    style SELECT fill:#C8E6C9
```

---

## 七、Self-Ask

```mermaid
graph LR
    Q["复合问题"] --> SQ1["子问题1<br/>搜索→答案1"]
    Q --> SQ2["子问题2<br/>搜索→答案2"]
    SQ1 & SQ2 --> COMBINE["综合计算"]
    COMBINE --> A["最终答案"]

    style SQ1 fill:#FFF9C4
    style COMBINE fill:#C8E6C9
```

---

## 八、选型决策

```mermaid
graph TB
    Q1["复杂度？"] -->|简单| M1["ReAct(默认)"]
    Q1 -->|复杂多步| Q2["需全局规划？"]
    Q2 -->|是| M2["Plan-Execute"]
    Q2 -->|否| Q3["需自我纠错？"]
    Q3 -->|是| M3["Reflection"]
    Q3 -->|否| Q4["预算有限？"]
    Q4 -->|是| M4["ReWOO"]
    Q4 -->|否| M1
    Q5["需探索多路径？"] -->|是| M5["LATS"]
    Q5 -->|否| M1

    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 九、模式对比

| 模式 | LLM调用 | 规划 | 纠错 | 场景 |
|------|---------|------|------|------|
| ReAct | 多 | 无 | 无 | 通用 |
| Plan-Execute | 中 | 全局 | 有 | 复杂任务 |
| Reflection | 多 | 无 | 强 | 高质量 |
| ReWOO | 少(2次) | 全局 | 无 | 预算有限 |
| LATS | 最多 | 全局 | 强 | 需最优解 |
| Self-Ask | 中 | 分解 | 无 | 事实问答 |

---

## 十、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解6种模式区别 | ☐ |
| 能用ReAct(默认) | ☐ |
| 能实现Plan-Execute | ☐ |
| 能实现Reflection | ☐ |
| 知道何时选哪种 | ☐ |
