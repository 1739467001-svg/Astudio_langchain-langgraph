# Agent 身份认证与授权体系图解

> Agent 不能匿名操作，也不能拥有无限权限。本图解可视化认证、授权、审计三道防线和 RBAC/ABAC 模型。

---

## 三道防线

```mermaid
graph LR
    REQ["请求"] --> AUTH["认证: 你是谁?<br/>JWT/API Key/OAuth"]
    AUTH --> AUTHZ["授权: 你能做什么?<br/>RBAC/ABAC"]
    AUTHZ --> EXEC["执行操作"]
    EXEC --> AUDIT["审计: 你做了什么?<br/>日志/追踪"]

    style AUTH fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style AUTHZ fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style AUDIT fill:#C8E6C9,stroke:#2E7D32
```

---

## RBAC 角色权限

```mermaid
graph TB
    ADMIN["Admin<br/>全部权限"]
    OPERATOR["Operator<br/>读写+工具执行"]
    USER["User<br/>只读自己的"]
    GUEST["Guest<br/>有限只读"]

    style ADMIN fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style OPERATOR fill:#FFF9C4,stroke:#F9A825
    style USER fill:#E3F2FD,stroke:#1565C0
    style GUEST fill:#C8E6C9,stroke:#2E7D32
```

---

## LangGraph 认证流程

```mermaid
graph TB
    START["请求进入"] --> AUTH_N["认证节点<br/>验证 JWT"]
    AUTH_N -->|"有效"| CHECK["权限检查<br/>RBAC/ABAC"]
    AUTH_N -->|"无效"| REJECT["拒绝"]
    CHECK -->|"有权限"| FILTER["工具过滤<br/>按角色裁剪"]
    CHECK -->|"无权限"| DENY["拒绝"]
    FILTER --> EXEC["执行"]
    EXEC --> LOG["审计日志"]

    style AUTH_N fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style REJECT fill:#FFCCBC,stroke:#D84315
    style EXEC fill:#C8E6C9,stroke:#2E7D32
```

---

## 多租户隔离

```mermaid
graph LR
    subgraph "租户 A"
        A1["用户"] --> A2["Agent"] --> A3["数据A<br/>filter: tenant=A"]
    end
    subgraph "租户 B"
        B1["用户"] --> B2["Agent"] --> B3["数据B<br/>filter: tenant=B"]
    end

    A2 -.->|"❌ 跨租户"| B3

    style A3 fill:#C8E6C9,stroke:#2E7D32
    style B3 fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解认证/授权/审计 | ☐ |
| JWT 认证实现 | ☐ |
| RBAC 角色权限 | ☐ |
| ABAC 属性级授权 | ☐ |
| LangGraph 认证节点 | ☐ |
| 动态工具过滤 | ☐ |
| 多租户隔离 | ☐ |
| 审计日志 | ☐ |
