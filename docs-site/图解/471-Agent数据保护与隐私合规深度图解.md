# Agent 数据保护与隐私合规深度图解

> PII全链路脱敏+被遗忘权+数据保留。本图解可视化数据保护体系。

---

## PII 生命周期

```mermaid
graph LR
    COLLECT["采集"] --> PROCESS["处理<br/>脱敏"]
    PROCESS --> STORE["存储<br/>加密"]
    STORE --> USE["使用"]
    USE --> DELETE["删除<br/>被遗忘权"]

    style PROCESS fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style STORE fill:#E3F2FD,stroke:#1565C0
    style DELETE fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 全链路脱敏

```mermaid
graph TB
    INPUT["用户输入"] --> MASK_IN["输入脱敏<br/>手机→1**-****"]
    MASK_IN --> AGENT["Agent处理"]
    AGENT --> MASK_OUT["输出脱敏<br/>API Key→sk-***"]
    MASK_OUT --> USER["返回用户"]
    AGENT --> MASK_LOG["日志脱敏"]
    AGENT --> MASK_STORE["存储加密<br/>AES-256"]

    style MASK_IN fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style MASK_OUT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style MASK_STORE fill:#C8E6C9,stroke:#2E7D32
```

---

## 数据主体权利

```mermaid
graph TB
    RIGHT["数据主体权利"]

    RIGHT --> DELETE["被遗忘权<br/>删除所有数据"]
    RIGHT --> ACCESS["访问权<br/>导出所有数据"]
    RIGHT --> CORRECT["更正权<br/>修改错误数据"]
    RIGHT --> PORT["可携带权<br/>导出标准格式"]
    RIGHT --> OBJECT["反对权<br/>停止处理"]

    style RIGHT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style DELETE fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 数据保留策略

| 数据类型 | 保留期 | 操作 |
|---------|--------|------|
| 对话 | 90天 | 自动删除 |
| 向量索引 | 180天 | 重建 |
| 审计日志 | 365天 | 归档 |
| 用户反馈 | 365天 | 保留 |
| 错误日志 | 30天 | 删除 |
| 会话数据 | 7天 | 删除 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 全链路脱敏 | ☐ |
| 被遗忘权 | ☐ |
| 数据访问权 | ☐ |
| 数据保留策略 | ☐ |
| LLM检测PII | ☐ |
| 合规审计 | ☐ |
