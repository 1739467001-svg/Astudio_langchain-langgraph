# Agent 工具动态发现与绑定图解

> Agent 运行时自动发现可用工具，按权限和需求动态绑定，无需重新部署。

---

```mermaid
graph TB
    SESSION["新会话"] --> QUERY["查询工具注册中心<br/>'有哪些工具可用?'"]
    QUERY --> FILTER&#123;"权限+分类过滤"&#125;
    FILTER --> BIND["绑定到会话"]
    BIND --> AGENT["Agent 使用绑定工具"]
    
    REG["工具注册中心"] --> QUERY
    REG2["新工具注册"] --> REG
    REG3["工具下线"] --> REG
    
    HEALTH["健康检查"] -.-> REG
    HEALTH --> DISABLE&#123;"连续失败?"&#125;
    DISABLE -->|是| OFF["自动禁用"]

    style QUERY fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style BIND fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style DISABLE fill:#FFCDD2,stroke:#C62828
    style REG fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 静态 vs 动态

| 方式 | 新增工具 | 权限控制 | 下线处理 |
|------|---------|---------|---------|
| 静态 | 改代码部署 | 无法区分 | 报错 |
| 动态 | 注册即用 | 按权限过滤 | 自动禁用 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有工具注册中心 | ☐ |
| 有动态绑定 | ☐ |
| 有权限过滤 | ☐ |
| 有健康检查 | ☐ |
