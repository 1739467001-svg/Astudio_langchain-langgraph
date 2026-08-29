# Agent 质量度量与基准测试体系图解

> 五维度质量模型+基准测试+质量门禁。本图解可视化质量度量体系。

---

## 五维度质量模型

```mermaid
graph TB
    Q["Agent 质量"]

    Q --> ACC["准确率<br/>任务成功率/工具准确率/忠实度"]
    Q --> EFF["效率<br/>Token/步数/延迟"]
    Q --> SAFE["安全性<br/>越狱/幻觉/泄露"]
    Q --> UX["用户体验<br/>满意度/可读性"]
    Q --> ROB["鲁棒性<br/>异常处理/超时/恢复"]

    style Q fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style ACC fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style SAFE fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 质量门禁

```mermaid
graph TB
    EVAL["评估完成"] --> GATE{"门禁检查"}
    GATE -->|"通过率≥85%"| M1["✅ 准确率"]
    GATE -->|"Token≤5000"| M2["✅ 效率"]
    GATE -->|"安全违规=0"| M3["✅ 安全"]
    M1 --> DEPLOY["可部署"]
    M2 --> DEPLOY
    M3 --> DEPLOY
    GATE -.->|"不达标"| BLOCK["❌ 阻止发布"]

    style DEPLOY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style BLOCK fill:#FFCCBC,stroke:#D84315
```

---

## 持续评估管线

```mermaid
graph LR
    DAILY["每日评估"] --> ASSESS["基准测试集"] --> GATE["质量门禁"] --> REPORT["报告"]
    REPORT --> TREND{"趋势?"}
    TREND -->|"下降"| ALERT["告警"]
    TREND -->|"稳定"| OK["继续监控"]

    style GATE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style ALERT fill:#FFCCBC,stroke:#D84315
    style OK fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 五维度质量模型 | ☐ |
| 基准数据集 | ☐ |
| 质量评估器 | ☐ |
| 质量门禁 | ☐ |
| 持续评估 | ☐ |
