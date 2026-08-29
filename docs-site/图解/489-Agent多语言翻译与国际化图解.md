# Agent 多语言翻译与国际化图解

> 语言检测→路由→翻译→术语→文化适配。本图解可视化多语言体系。

---

## 多语言架构

```mermaid
graph TB
    INPUT["用户输入"] --> DETECT["语言检测"]
    DETECT --> ROUTE&#123;"语言路由"&#125;
    ROUTE --> ZH["中文处理"]
    ROUTE --> EN["英文处理"]
    ROUTE --> OTHER["翻译→英文→处理→翻回"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style OTHER fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 翻译质量保障

```mermaid
graph TB
    TEXT["原文"] --> GLOSSARY["术语库<br/>查表"]
    GLOSSARY --> TRANSLATE["LLM翻译"]
    TRANSLATE --> CHECK&#123;"一致性检查"&#125;
    CHECK -->|"不一致"| REWRITE["重新翻译"]
    CHECK -->|"通过"| OUTPUT["输出"]
    OUTPUT --> CULTURE["文化适配"]

    style GLOSSARY fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CULTURE fill:#C8E6C9,stroke:#2E7D32
```

---

## 语言能力

| 语言 | 检测方式 | 布局 | 特殊处理 |
|------|---------|------|---------|
| 中文 | Unicode范围 | LTR | 成语适配 |
| 英文 | 默认 | LTR | - |
| 日文 | 假名范围 | LTR | 敬语 |
| 阿拉伯文 | Unicode范围 | RTL | 右到左 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 语言检测 | ☐ |
| 语言路由 | ☐ |
| 翻译引擎 | ☐ |
| 术语库 | ☐ |
| 文化适配 | ☐ |
| RTL布局 | ☐ |
