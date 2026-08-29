# Agent 搜索增强与网页信息提取图解

> 搜索→抓取→提取→验证→总结。本图解可视化搜索增强流程。

---

## 搜索增强流程

```mermaid
graph TB
    Q["用户查询"] --> VARIANT["查询变体生成"]
    VARIANT --> SEARCH["并行搜索"]
    SEARCH --> RANK["结果排序<br/>相关性+权威性"]
    RANK --> FETCH["并发抓取Top5"]
    FETCH --> EXTRACT["内容提取<br/>正文/表格/链接"]
    EXTRACT --> VERIFY["交叉验证"]
    VERIFY --> SUMM["LLM总结<br/>标注引用"]
    SUMM --> OUTPUT["回答+来源"]

    style RANK fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 内容提取能力

| 提取类型 | 方法 | 示例 |
|---------|------|------|
| 正文 | BeautifulSoup | 文章主体 |
| 表格 | HTML table解析 | 数据表 |
| 链接 | a标签 | 相关链接 |
| 代码块 | pre标签 | 示例代码 |
| 结构化 | JSON-LD/OG | 元数据 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 查询变体 | ☐ |
| 并发搜索 | ☐ |
| 结果排序 | ☐ |
| 网页抓取 | ☐ |
| 内容提取 | ☐ |
| 信息验证 | ☐ |
| 引用标注 | ☐ |
