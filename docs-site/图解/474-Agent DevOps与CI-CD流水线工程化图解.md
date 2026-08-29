# Agent DevOps 与 CI/CD 流水线工程化图解

> 代码提交→测试→构建→部署全自动化。本图解可视化CI/CD流水线。

---

## CI/CD 流水线

```mermaid
graph LR
    C["提交"] --> L["Lint"] --> U["单元测试"] --> B["构建镜像"]
    B --> I["集成测试"] --> S["安全扫描"] --> E["LLM评估"]
    E --> ST["部署测试"] --> E2E["端到端"] --> CA["金丝雀"]
    CA --> P["生产部署"]

    style E fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CA fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 测试金字塔

```mermaid
graph TB
    TOP["端到端测试<br/>少量 慢 最真实"]
    MID["集成测试<br/>中等 验证交互"]
    BOT["单元测试<br/>大量 快 隔离"]

    TOP --> MID --> BOT

    style BOT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style TOP fill:#FFCCBC,stroke:#D84315
```

---

## 质量门禁

| 门禁 | 阈值 | 阻止部署 |
|------|------|---------|
| 单元覆盖率 | >70% | 是 |
| LLM评估通过率 | >80% | 是 |
| 安全漏洞 | 0 | 是 |
| 注入测试 | 0失败 | 是 |
| 性能回归 | <10% | 否 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| CI/CD流水线 | ☐ |
| 测试金字塔 | ☐ |
| LLM评估 | ☐ |
| 安全扫描 | ☐ |
| 质量门禁 | ☐ |
| 金丝雀发布 | ☐ |
| 自动回滚 | ☐ |
