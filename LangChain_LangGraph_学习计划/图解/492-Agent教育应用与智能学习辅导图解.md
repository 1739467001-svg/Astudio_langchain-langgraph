# Agent 教育应用与智能学习辅导图解

> 学情评估→自适应路径→智能出题→自动批改→实时辅导。本图解可视化教育 Agent。

---

## 教育流程

```mermaid
graph TB
    ASSESS["学情评估<br/>知识掌握度"] --> PATH["学习路径<br/>个性化推荐"]
    PATH --> QUIZ["智能出题<br/>难度自适应"]
    QUIZ --> GRADE["自动批改<br/>语义评分"]
    GRADE --> TUTOR["实时辅导<br/>苏格拉底式"]
    TUTOR --> UPDATE["更新掌握度"]
    UPDATE --> ASSESS

    style ASSESS fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style QUIZ fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style UPDATE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 学情分析 | ☐ |
| 知识点追踪(BKT) | ☐ |
| 自适应路径 | ☐ |
| 智能出题 | ☐ |
| 自动批改 | ☐ |
| 实时辅导 | ☐ |
| 隐私合规 | ☐ |
