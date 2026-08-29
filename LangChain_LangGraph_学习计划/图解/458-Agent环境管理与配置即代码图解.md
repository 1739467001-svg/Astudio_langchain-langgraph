# Agent 环境管理与配置即代码图解

> 开发→测试→生产三环境隔离+配置文件化。本图解可视化多环境管理。

---

## 三环境分层

```mermaid
graph LR
    DEV["开发<br/>本地模型/SQLite<br/>DEBUG日志<br/>无限流"]
    DEV --> STAGING["测试<br/>生产配置<br/>完整测试<br/>模拟限流"]
    STAGING --> PROD["生产<br/>GPT-4o/Postgres<br/>WARN日志<br/>严格限流"]

    style DEV fill:#C8E6C9,stroke:#2E7D32
    style STAGING fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style PROD fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 配置加载

```mermaid
graph TB
    BASE["base.yaml<br/>通用配置"] --> MERGE["合并"]
    ENV["production.yaml<br/>环境覆盖"] --> MERGE
    SECRET["环境变量/KMS<br/>密钥"] --> MERGE
    MERGE --> CONFIG["AgentConfig<br/>最终配置"]

    style MERGE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CONFIG fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 密钥分离原则

```mermaid
graph TB
    CODE["代码仓库<br/>config/*.yaml<br/>无密钥"] --> GIT["Git 提交"]
    SECRETS["密钥<br/>.env/KMS/Vault<br/>不提交"] --> DEPLOY["部署时注入"]

    style GIT fill:#C8E6C9,stroke:#2E7D32
    style SECRETS fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 多环境配置文件 | ☐ |
| 配置加载器 | ☐ |
| 密钥不硬编码 | ☐ |
| .env不入Git | ☐ |
| 密钥轮换 | ☐ |
| 环境隔离 | ☐ |
