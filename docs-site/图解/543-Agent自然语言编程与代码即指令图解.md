# Agent 自然语言编程与代码即指令图解

> NL→代码→执行→测试→部署。本图解可视化自然语言编程。

---

```mermaid
graph TB
    NL["自然语言"] --> GEN["代码生成"]
    GEN --> EXEC["沙箱执行"]
    EXEC --> TEST["自动测试"]
    TEST --> OK&#123;"通过?"&#125;
    OK -->|"是"| DEPLOY["部署"]
    OK -->|"否"| FIX["自动修复"]
    FIX --> GEN

    style GEN fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style EXEC fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style DEPLOY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 代码生成 | ☐ |
| 沙箱执行 | ☐ |
| 自动修复 | ☐ |
| 安全限制 | ☐ |
