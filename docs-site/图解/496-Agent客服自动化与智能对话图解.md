# Agent 客服自动化与智能对话图解

> 意图→FAQ→情绪→工单→转人工→满意度。本图解可视化客服 Agent。

---

## 客服流程

```mermaid
graph TB
    MSG["用户消息"] --> INTENT["意图识别"]
    INTENT --> FAQ&#123;"FAQ?"&#125;
    FAQ -->|"是"| ANSWER["知识库回答"]
    FAQ -->|"否"| EMOTION["情绪检测"]
    EMOTION --> ANGRY&#123;"愤怒?"&#125;
    ANGRY -->|"是"| HUMAN["转人工"]
    ANGRY -->|"否"| SOLVE["尝试解决"]
    SOLVE --> OK&#123;"解决?"&#125;
    OK -->|"是"| SURVEY["满意度调查"]
    OK -->|"否"| TICKET["创建工单"]
    TICKET --> HUMAN

    style INTENT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style EMOTION fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style HUMAN fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style SURVEY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 转人工触发

| 触发条件 | 说明 |
|---------|------|
| 愤怒(intensity≥4) | 立即转人工 |
| 重试≥3次 | 转人工 |
| 用户要求 | 直接转 |
| 超出能力范围 | 转人工 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 意图识别 | ☐ |
| 情绪检测 | ☐ |
| FAQ回答 | ☐ |
| 工单创建 | ☐ |
| 人工转接 | ☐ |
| 满意度追踪 | ☐ |
