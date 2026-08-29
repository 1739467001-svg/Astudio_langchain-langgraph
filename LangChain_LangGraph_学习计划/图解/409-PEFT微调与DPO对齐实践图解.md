# PEFT 微调与 DPO 对齐实践图解

> LoRA 用 1% 参数达到 95% 效果，DPO 不需要奖励模型就能对齐偏好。本图解可视化微调流程和选型决策。

---

## 增强方式选型

```mermaid
graph TB
    Q["需要什么?"] --> KNOW{"知识增强?"}
    KNOW -->|"是"| RAG["RAG 检索增强"]
    KNOW -->|"否"| STYLE{"风格/格式?"}
    STYLE -->|"是"| PEFT["PEFT 微调"]
    STYLE -->|"否"| PREF{"偏好对齐?"}
    PREF -->|"是"| DPO["DPO 对齐"]
    PREF -->|"否"| PROMPT["Prompt 工程"]

    style RAG fill:#E3F2FD,stroke:#1565C0
    style PEFT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style DPO fill:#F3E5F5,stroke:#7B1FA2
    style PROMPT fill:#C8E6C9,stroke:#2E7D32
```

---

## LoRA 原理

```mermaid
graph LR
    subgraph "全量微调"
        W1["W (冻结)"] --> W1B["ΔW (更新全部)"]
        W1B --> R1["参数量: 100%<br/>显存: 56GB+"]
    end

    subgraph "LoRA"
        W2["W (冻结)"] --> PLUS["+"]
        A["A (r×n)"] --> AB["A×B"]
        B["B (n×r)"] --> AB
        AB --> PLUS
        PLUS --> R2["参数量: 0.4%<br/>显存: 6GB"]
    end

    style R1 fill:#FFCCBC,stroke:#D84315
    style R2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 微调流程

```mermaid
graph LR
    DATA["准备数据<br/>500-5000条"] --> QLORA["QLoRA 微调<br/>4bit量化+LoRA"]
    QLORA --> EVAL["效果评估<br/>对比微调前后"]
    EVAL -->|"效果不够"| DATA
    EVAL -->|"效果OK"| DPO["DPO 偏好对齐<br/>(可选)"]
    DPO --> MERGE["合并LoRA权重"]
    MERGE --> DEPLOY["部署到 vLLM"]
    DEPLOY --> LC["LangChain 集成"]

    style DATA fill:#E3F2FD,stroke:#1565C0
    style QLORA fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style DPO fill:#F3E5F5,stroke:#7B1FA2
    style DEPLOY fill:#C8E6C9,stroke:#2E7D32
```

---

## DPO vs RLHF

| 维度 | RLHF | DPO |
|------|------|-----|
| 奖励模型 | 需要 | 不需要 |
| 强化学习 | PPO | 无 |
| 复杂度 | 高 | 低 |
| 稳定性 | 差 | 好 |
| 效果 | 好 | 接近 |

---

## 显存对比（7B 模型）

```mermaid
graph LR
    FULL["全量微调<br/>56GB+<br/>多卡 A100"] --> LORA["LoRA<br/>16GB<br/>单卡"]
    LORA --> QLORA["QLoRA<br/>6GB<br/>消费级显卡"]

    style FULL fill:#FFCCBC,stroke:#D84315
    style LORA fill:#FFF9C4,stroke:#F9A825
    style QLORA fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解微调 vs Prompt vs RAG | ☐ |
| 理解 LoRA/QLoRA 原理 | ☐ |
| QLoRA 微调实战 | ☐ |
| DPO 偏好对齐 | ☐ |
| 微调模型部署到 vLLM | ☐ |
| LangChain 集成微调模型 | ☐ |
