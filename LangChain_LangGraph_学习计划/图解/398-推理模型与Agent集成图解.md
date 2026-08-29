# 推理模型与 Agent 集成图解

> 推理模型在回答前先"想"再"说"，擅长复杂推理。本图解可视化推理模型与传统 LLM 的差异、混合模型路由和成本管理。

---

## 推理模型 vs 传统 LLM

```mermaid
graph LR
    subgraph "传统 LLM"
        A1["Prompt"] --> A2["直接生成<br/>（思考隐含）"] --> A3["回答"]
    end

    subgraph "推理模型"
        B1["Prompt"] --> B2["内部推理<br/>（hidden thinking）"] --> B3["回答"]
        B2 -.->|"消耗 Token<br/>不可见"| B2T["reasoning_tokens"]
    end

    style A2 fill:#E3F2FD,stroke:#1565C0
    style B2 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style B3 fill:#C8E6C9,stroke:#2E7D32
    style B2T fill:#FFCCBC,stroke:#D84315
```

---

## 混合模型路由

```mermaid
graph TB
    Q["用户提问"] --> CLS["复杂度分类<br/>（GPT-4o-mini ~100ms）"]
    CLS -->|"简单<br/>翻译/摘要/闲聊"| FAST["GPT-4o-mini<br/>$0.15/M<br/>秒级响应"]
    CLS -->|"中等<br/>代码/分析"| MED["o3-mini medium<br/>$1.10/M<br/>10秒级"]
    CLS -->|"复杂<br/>数学/证明/架构"| DEEP["o3 / R1 high<br/>$8/M<br/>分钟级"]

    style CLS fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FAST fill:#C8E6C9,stroke:#2E7D32
    style MED fill:#FFF9C4,stroke:#F9A825
    style DEEP fill:#FFCCBC,stroke:#D84315
```

---

## reasoning_effort 选择

```mermaid
graph LR
    EFFORT["reasoning_effort"]

    EFFORT --> LOW["low<br/>快速推理<br/>2-5秒<br/>简单数学/基础逻辑"]
    EFFORT --> MED["medium<br/>标准推理<br/>5-15秒<br/>代码/算法分析"]
    EFFORT --> HIGH["high<br/>深度推理<br/>15-60秒<br/>复杂证明/架构"]

    style LOW fill:#C8E6C9,stroke:#2E7D32
    style MED fill:#FFF9C4,stroke:#F9A825
    style HIGH fill:#FFCCBC,stroke:#D84315
```

---

## 思考过程可视化

```mermaid
graph TB
    REQ["调用推理模型"] --> START["开始流式"]

    START --> PHASE1{"阶段判断"}
    PHASE1 -->|"reasoning_content"| THINK["💭 思考中...<br/>显示推理过程"]
    PHASE1 -->|"content"| ANSWER["✍️ 回答中...<br/>显示最终回答"]

    THINK --> PHASE1
    ANSWER --> DONE["完成"]

    style THINK fill:#FFF9C4,stroke:#F9A825
    style ANSWER fill:#C8E6C9,stroke:#2E7D32
    style DONE fill:#E3F2FD,stroke:#1565C0
```

---

## 推理模型 + RAG 评估

```mermaid
graph TB
    Q["RAG 查询"] --> RET["检索文档"]
    RET --> GEN["传统模型生成回答"]
    GEN --> JUDGE["推理模型评估<br/>（LLM-as-Judge）"]

    JUDGE --> J1["相关性 1-5"]
    JUDGE --> J2["忠实性 1-5"]
    JUDGE --> J3["完整性 1-5"]
    Judge --> J4["推理质量 1-5"]

    style JUDGE fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px
    style GEN fill:#E3F2FD,stroke:#1565C0
```

---

## 成本对比

```mermaid
graph LR
    subgraph "成本对比（同等任务）"
        G4["GPT-4o-mini<br/>$0.001/次"] --> O3L["o3-mini low<br/>$0.005/次"]
        O3L --> O3M["o3-mini medium<br/>$0.012/次"]
        O3M --> O3H["o3-mini high<br/>$0.030/次"]
        O3H --> O3["o3 high<br/>$0.150/次"]
    end

    style G4 fill:#C8E6C9,stroke:#2E7D32
    style O3L fill:#C8E6C9,stroke:#2E7D32
    style O3M fill:#FFF9C4,stroke:#F9A825
    style O3H fill:#FFCCBC,stroke:#D84315
    style O3 fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解推理模型差异 | ☐ |
| 能调用 o3-mini / R1 | ☐ |
| 实现混合模型路由 | ☐ |
| LangGraph Agent 集成 | ☐ |
| 能展示思考过程 | ☐ |
| reasoning_effort 调优 | ☐ |
| 成本追踪 | ☐ |
| 超时与降级处理 | ☐ |
