# Agent 推理链优化与思维链工程化图解

> 五种推理模式+深度控制。本图解可视化思维链工程化。

---

## 五种推理模式

```mermaid
graph TB
    COT["推理模式"]

    COT --> Z["Zero-shot CoT<br/>'一步一步想'<br/>简单有效"]
    COT --> F["Few-shot CoT<br/>给推理示例<br/>稳定可控"]
    COT --> S["Self-Consistency<br/>多路径取多数<br/>准确但贵"]
    COT --> T["Tree of Thoughts<br/>树搜索<br/>最强最贵"]
    COT --> R["推理模型<br/>o3/R1内置<br/>无需Prompt"]

    style COT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style R fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style T fill:#FFCCBC,stroke:#D84315
```

---

## 推理深度控制

```mermaid
graph TB
    Q["用户问题"] --> CLS["复杂度分类"]
    CLS -->|"简单"| DIRECT["直接回答<br/>低成本"]
    CLS -->|"中等"| ZCOT["Zero-shot CoT<br/>中成本"]
    CLS -->|"复杂"| SC["Self-Consistency<br/>高成本"]

    style CLS fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DIRECT fill:#C8E6C9,stroke:#2E7D32
    style SC fill:#FFCCBC,stroke:#D84315
```

---

## 效果对比

| 模式 | 准确率 | 成本 | 延迟 |
|------|--------|------|------|
| 直接回答 | 70% | 1x | 快 |
| Zero-shot CoT | 80% | 1.2x | 中 |
| Few-shot CoT | 85% | 1.3x | 中 |
| Self-Consistency | 90% | 3-5x | 慢 |
| Tree of Thoughts | 92% | 10x+ | 很慢 |
| 推理模型 | 95% | 5-10x | 慢 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 五种推理模式 | ☐ |
| Zero-shot CoT | ☐ |
| Self-Consistency | ☐ |
| Tree of Thoughts | ☐ |
| 推理深度控制 | ☐ |
