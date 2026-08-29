# Agent 可解释性与 XAI 图解

> "为什么 AI 做了这个决定？"——可解释性让决策过程透明可审计。本图解可视化推理链、置信度评分和审计报告。

---

## 三个层次

```mermaid
graph TB
    Q["可解释性层次"]
    Q --> GLOBAL["全局解释<br/>模型整体如何工作?<br/>架构图/特征重要性"]
    Q --> LOCAL["局部解释<br/>这次决策为什么?<br/>推理链/SHAP"]
    Q --> PROCESS["过程解释<br/>决策过程是什么?<br/>步骤回放/调用链"]

    style GLOBAL fill:#E3F2FD,stroke:#1565C0
    style LOCAL fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style PROCESS fill:#C8E6C9,stroke:#2E7D32
```

---

## 推理链展示

```mermaid
graph TB
    Q["用户问题"] --> S1["Step1: 分析问题类型"]
    S1 --> S2["Step2: 确定需要检索"]
    S2 --> S3["Step3: 检索相关文档"]
    S3 --> S4["Step4: 评估文档质量"]
    S4 --> S5["Step5: 生成回答"]
    S5 --> S6["Step6: 事实校验"]
    S6 --> A["✅ 最终答案"]
    S6 --> CONF["置信度: 0.85<br/>依据: 文档覆盖度高"]

    style S1 fill:#E3F2FD,stroke:#1565C0
    style A fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style CONF fill:#FFF9C4,stroke:#F9A825
```

---

## 置信度评分维度

```mermaid
graph LR
    SCORE["综合置信度"]

    SCORE --> COV["来源覆盖度<br/>0.3权重<br/>是否有足够证据"]
    SCORE --> SPEC["答案具体性<br/>0.2权重<br/>是否具体"]
    SCORE --> FACT["事实性<br/>0.3权重<br/>是否基于来源"]
    SCORE --> COMP["完整性<br/>0.2权重<br/>是否完整回答"]

    style SCORE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FACT fill:#FFF9C4,stroke:#F9A825
```

---

## 置信度展示

```mermaid
graph LR
    HIGH["🟢 高置信度<br/>>85%<br/>可信赖"] --> MED["🟡 中等<br/>60-85%<br/>需说明"]
    MED --> LOW["🟠 低<br/>40-60%<br/>需备选"]
    LOW --> VLOW["🔴 极低<br/><40%<br/>需人工"]

    style HIGH fill:#C8E6C9,stroke:#2E7D32
    style MED fill:#FFF9C4,stroke:#F9A825
    style LOW fill:#FFCCBC,stroke:#D84315
    style VLOW fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 审计报告结构

| 章节 | 内容 |
|------|------|
| 基本信息 | 时间/用户/查询 |
| 推理步骤 | 逐步思考过程 |
| 工具使用 | 工具名+选择理由 |
| 结果 | 答案+置信度 |
| 评估 | 完整性/合理性 |
| 审计结论 | 可信赖/需审查 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三个层次 | ☐ |
| 推理链展示 | ☐ |
| 多维度置信度 | ☐ |
| 工具选择解释 | ☐ |
| LangSmith 追踪 | ☐ |
| 审计报告 | ☐ |
