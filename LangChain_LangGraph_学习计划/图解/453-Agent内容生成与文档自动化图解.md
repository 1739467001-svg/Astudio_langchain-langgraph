# Agent 内容生成与文档自动化图解

> 报告/文档/文案自动生成+多格式导出+质量检查。本图解可视化内容生成流程。

---

## 生成流程

```mermaid
graph TB
    INPUT["输入需求"] --> PLAN["规划大纲"]
    PLAN --> DRAFT["分段起草"]
    DRAFT --> REVIEW["质量审查"]
    REVIEW --> FORMAT["格式化导出"]
    FORMAT --> OUTPUT["✅ 输出文档"]

    style PLAN fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style REVIEW fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 生成类型

| 类型 | 输入 | 输出 |
|------|------|------|
| 报告生成 | 数据+模板 | 结构化报告 |
| 文档生成 | 主题+大纲 | 完整文档 |
| 内容创作 | 主题+风格 | 创意内容 |
| 文档翻译 | 原文 | 翻译版本 |
| 文档摘要 | 长文档 | 摘要 |
| 模板填充 | 模板+数据 | 定制文档 |

---

## 多格式导出

```mermaid
graph LR
    MD["Markdown<br/>原始内容"] --> HTML["HTML"]
    MD --> PDF["PDF"]
    MD --> DOCX["Word"]
    MD --> PLAIN["纯文本"]

    style MD fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style HTML fill:#C8E6C9,stroke:#2E7D32
    style PDF fill:#FFF9C4,stroke:#F9A825
    style DOCX fill:#F3E5F5,stroke:#7B1FA2
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 六种生成类型 | ☐ |
| 模板系统 | ☐ |
| 多格式导出 | ☐ |
| 质量检查 | ☐ |
| 周报自动化 | ☐ |
| 文档同步 | ☐ |
