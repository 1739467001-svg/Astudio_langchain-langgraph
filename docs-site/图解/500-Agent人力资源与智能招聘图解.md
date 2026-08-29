# Agent 人力资源与智能招聘图解

> 简历解析→智能匹配→面试生成→评估→Offer。本图解可视化 HR Agent。

---

## 招聘流程

```mermaid
graph TB
    JD["职位需求"] --> RESUME["简历收集"]
    RESUME --> PARSE["简历解析"]
    PARSE --> MATCH["智能匹配<br/>4维度评分"]
    MATCH --> INTERVIEW["面试安排"]
    INTERVIEW --> QUESTIONS["面试题生成"]
    QUESTIONS --> EVAL["候选人评估"]
    EVAL --> OFFER["Offer建议"]

    style PARSE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style MATCH fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style EVAL fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 评分维度

| 维度 | 说明 |
|------|------|
| 技能匹配 | 必需/加分技能 |
| 经验匹配 | 行业/年限/项目 |
| 学历匹配 | 学校/专业/学位 |
| 稳定性 | 跳槽频率 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 简历解析 | ☐ |
| 智能匹配 | ☐ |
| 面试题生成 | ☐ |
| 回答评估 | ☐ |
| 员工服务 | ☐ |
