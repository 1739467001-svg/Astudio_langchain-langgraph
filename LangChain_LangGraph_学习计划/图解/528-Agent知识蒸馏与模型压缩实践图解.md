# Agent 知识蒸馏与模型压缩实践图解

> 大模型→小模型+量化+剪枝。本图解可视化蒸馏压缩。

---

```mermaid
graph TB
    TEACHER["教师模型<br/>GPT-4o (大)"] --> DISTILL["蒸馏训练<br/>KL散度"]
    DISTILL --> STUDENT["学生模型<br/>Qwen-7B (小)"]
    STUDENT --> QUANT["量化<br/>4-bit"]
    QUANT --> PRUNE["剪枝<br/>移除30%"]
    PRUNE --> DEPLOY["部署<br/>单卡/CPU"]

    style TEACHER fill:#FFCCBC,stroke:#D84315
    style STUDENT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DEPLOY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 三种蒸馏方法 | ☐ |
| KL散度实现 | ☐ |
| 量化压缩 | ☐ |
| 剪枝 | ☐ |
