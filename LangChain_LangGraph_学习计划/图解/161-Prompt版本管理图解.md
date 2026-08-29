# Prompt 版本管理图解

> 用图解理解版本生命周期、A/B实验和回滚。

---

## 一、版本生命周期

```mermaid
graph LR
    DRAFT["草稿"] --> TEST["测试"] --> ACTIVE["活跃"] --> ARCHIVE["归档"]
    ARCHIVE -.->|"回滚"| ACTIVE

    style ACTIVE fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、版本对比

```mermaid
graph TB
    V1["v1.0<br/>'你是助手'"] --> DIFF["版本对比"]
    V2["v1.1<br/>'你是专业客服助手'"]
    DIFF --> RESULT["新增: '专业客服'<br/>移除: 无"]

    style DIFF fill:#FFF9C4
```

---

## 三、A/B实验

```mermaid
graph TB
    PROMPT_A["Prompt v1"] --> SCORE_A["评分: 7.2"]
    PROMPT_B["Prompt v2"] --> SCORE_B["评分: 8.1"]
    SCORE_A & SCORE_B --> WINNER["v2更好<br/>采用v2"]

    style WINNER fill:#C8E6C9
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有版本注册表 | ☐ |
| 有回滚能力 | ☐ |
| 有版本对比 | ☐ |
| 有A/B实验 | ☐ |
