# Agent 边界防护图解

> 用图解理解输入验证、5层边界保护和优雅降级。

---

## 一、输入风险

```mermaid
graph TB
    ROOT["输入风险"] --> R1["超长输入"]
    ROOT --> R2["恶意指令"]
    ROOT --> R3["格式异常"]
    ROOT --> R4["资源消耗"]
    ROOT --> R5["内容风险"]

    style ROOT fill:#1565C0,color:#fff
    style R1 fill:#FFCDD2
```

---

## 二、5层边界

```mermaid
graph TB
    L1["1.长度限制"] --> L2["2.注入检测"]
    L2 --> L3["3.速率限制"]
    L3 --> L4["4.内容审查"]
    L4 --> L5["5.资源限制"]

    style L2 fill:#FFCDD2
    style L5 fill:#C8E6C9
```

---

## 三、验证流程

```mermaid
graph TB
    INPUT["用户输入"] --> VALIDATE&#123;"验证"&#125;
    VALIDATE -->|安全| NORMAL["正常处理"]
    VALIDATE -->|警告| WARN["清洗后处理"]
    VALIDATE -->|危险| REJECT["拒绝"]
    VALIDATE -->|空| EMPTY["提示输入"]

    style VALIDATE fill:#FFF9C4
    style NORMAL fill:#C8E6C9
    style REJECT fill:#FFCDD2
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有输入验证 | ☐ |
| 有长度限制 | ☐ |
| 有注入检测 | ☐ |
| 有输出边界 | ☐ |
