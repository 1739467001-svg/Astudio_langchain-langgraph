# Agent 工具选择与智能编排图解

> 20个工具怎么选？动态过滤+工具链编排。本图解可视化工具选择优化。

---

## 动态工具过滤

```mermaid
graph TB
    Q["用户查询"] --> CLS["快速分类<br/>GPT-4o-mini"]
    CLS --> FILTER["相关工具过滤<br/>20个→3-5个"]
    FILTER --> AGENT["Agent + 精选工具<br/>上下文精简"]
    AGENT --> RESULT["回答"]

    style FILTER fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style AGENT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 工具链编排

```mermaid
graph LR
    CHAIN["工具链"]
    CHAIN --> RESEARCH["研究链<br/>搜索→分析→总结"]
    CHAIN --> ANALYSIS["分析链<br/>查询→分析→图表→报告"]
    CHAIN --> CREATE["创作链<br/>搜索→起草→审查→发布"]

    style CHAIN fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style RESEARCH fill:#C8E6C9,stroke:#2E7D32
```

---

## 工具描述优化

| 要素 | ❌ 模糊 | ✅ 清晰 |
|------|--------|--------|
| 功能 | "搜索" | "搜索互联网网页" |
| 输入 | "查询" | "输入搜索关键词" |
| 区分 | 无 | "不适合内部文档" |
| 适用 | 无 | "适合查找新闻" |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 工具描述优化 | ☐ |
| 动态过滤 | ☐ |
| 工具链编排 | ☐ |
| 自动链选择 | ☐ |
| 调用监控 | ☐ |
