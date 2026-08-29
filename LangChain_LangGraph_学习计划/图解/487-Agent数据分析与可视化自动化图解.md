# Agent 数据分析与可视化自动化图解

> 数据→分析→图表→洞察。本图解可视化数据分析全流程。

---

## 分析流程

```mermaid
graph TB
    DATA["数据上传"] --> PROFILE["数据画像<br/>行列/类型/缺失"]
    PROFILE --> CLEAN["数据清洗"]
    CLEAN --> ANALYZE["统计分析<br/>趋势/异常/相关"]
    ANALYZE --> VIZ["生成图表<br/>6种类型"]
    VIZ --> INSIGHT["提取洞察<br/>自然语言"]
    INSIGHT --> REPORT["分析报告"]

    style PROFILE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style VIZ fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style REPORT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 分析能力

| 分析类型 | 方法 | 输出 |
|---------|------|------|
| 趋势分析 | 月度汇总+环比 | 上升/下降/平稳 |
| 异常检测 | IQR/Z-Score | 异常值列表 |
| 相关性 | Pearson | 强相关对 |
| 分布 | 直方图 | 分布形状 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 数据解析 | ☐ |
| 数据画像 | ☐ |
| 趋势分析 | ☐ |
| 异常检测 | ☐ |
| 图表生成 | ☐ |
| 洞察提取 | ☐ |
