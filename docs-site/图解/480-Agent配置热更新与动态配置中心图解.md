# Agent 配置热更新与动态配置中心图解

> 不重启即可变更配置。本图解可视化动态配置中心和Feature Flag。

---

## 配置层级

```mermaid
graph TB
    CC["配置中心"]

    CC --> STATIC["静态配置<br/>环境变量<br/>启动加载"]
    CC --> DYNAMIC["动态配置<br/>运行时可改<br/>热更新"]
    CC --> FLAG["Feature Flag<br/>功能开关<br/>即时切换"]

    DYNAMIC --> P["Prompt"]
    DYNAMIC --> M["模型路由"]
    DYNAMIC --> L["限流参数"]
    DYNAMIC --> T["工具配置"]

    style CC fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style DYNAMIC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 热更新流程

```mermaid
graph LR
    CHANGE["配置变更"] --> NOTIFY["通知监听器"]
    NOTIFY --> UPDATE["Agent自动更新<br/>下次调用生效"]
    UPDATE --> NO_RESTART["✅ 无需重启"]

    style NO_RESTART fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## Feature Flag

```mermaid
graph TB
    FLAG["Feature Flag"]

    FLAG --> ON["ON 100%<br/>全量启用"]
    FLAG --> GRAY["ON 50%<br/>按用户灰度"]
    FLAG --> OFF["OFF<br/>关闭"]

    style ON fill:#C8E6C9,stroke:#2E7D32
    style GRAY fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OFF fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 动态配置中心 | ☐ |
| 热更新监听 | ☐ |
| Feature Flag | ☐ |
| 紧急配置 | ☐ |
| 配置版本管理 | ☐ |
