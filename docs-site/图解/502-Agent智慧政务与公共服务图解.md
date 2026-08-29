# Agent 智慧政务与公共服务图解

> 政策库→咨询→引导→预审→审批。本图解可视化政务 Agent。

---

## 政务流程

```mermaid
graph TB
    USER["市民提问"] --> KB&#123;"政策库"&#125;
    KB -->|"有"| ANSWER["自动回答<br/>引用政策"]
    KB -->|"无"| GUIDE["办事引导"]
    GUIDE --> PRECHECK["材料预审"]
    PRECHECK --> APPROVE&#123;"自动审批?"&#125;
    APPROVE -->|"是"| RESULT["出证"]
    APPROVE -->|"否"| HUMAN["人工审核"]

    style ANSWER fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style HUMAN fill:#FFF9C4,stroke:#F9A825
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 政策知识库 | ☐ |
| 带引用回答 | ☐ |
| 办事引导 | ☐ |
| 材料预审 | ☐ |
| 数据安全 | ☐ |
