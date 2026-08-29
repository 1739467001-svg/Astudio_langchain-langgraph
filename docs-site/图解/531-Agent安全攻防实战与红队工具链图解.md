# Agent 安全攻防实战与红队工具链图解

> 5类攻击+自动化红队+纵深防御。本图解可视化安全攻防。

---

```mermaid
graph TB
    ATTACK["攻击技术"]
    ATTACK --> P1["Prompt注入"]
    ATTACK --> P2["越狱"]
    ATTACK --> P3["信息提取"]
    ATTACK --> P4["工具滥用"]
    ATTACK --> P5["间接注入"]

    DEFENSE["纵深防御"]
    DEFENSE --> D1["输入防护"]
    DEFENSE --> D2["输出防护"]
    DEFENSE --> D3["工具防护"]
    DEFENSE --> D4["限流防护"]

    style ATTACK fill:#FFCCBC,stroke:#D84315,stroke-width=3px
    style DEFENSE fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 5类攻击技术 | ☐ |
| 自动化红队 | ☐ |
| Garak扫描 | ☐ |
| 纵深防御 | ☐ |
