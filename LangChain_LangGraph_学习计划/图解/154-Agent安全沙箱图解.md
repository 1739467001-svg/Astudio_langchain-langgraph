# Agent 安全沙箱图解

> 用图解理解三层隔离、权限控制和SQL过滤。

---

## 一、安全风险

```mermaid
graph TB
    ROOT["风险"] --> R1["文件系统"]
    ROOT --> R2["网络"]
    ROOT --> R3["数据库"]
    ROOT --> R4["代码执行"]
    ROOT --> R5["命令执行"]

    style ROOT fill:#1565C0,color:#fff
    style R4 fill:#FFCDD2
```

---

## 二、三层隔离

```mermaid
graph TB
    L1["工具级: 权限策略"]
    L2["进程级: 子进程隔离"]
    L3["容器级: Docker隔离"]

    style L3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 三、工具权限

```mermaid
graph TB
    subgraph 权限 {"工具权限模型"}
        P1["search_web: 仅网络白名单"]
        P2["execute_code: 仅/tmp目录"]
        P3["send_email: 需人工审批"]
        P4["database: 仅SELECT"]
    end

    style 权限 fill:#E3F2FD
```

---

## 四、SQL过滤

```mermaid
graph TB
    SQL["SQL语句"] --> CHECK{"安全检查"}
    CHECK -->|有DROP/TRUNCATE| BLOCK["❌ 阻止"]
    CHECK -->|有注释/UNION| BLOCK
    CHECK -->|纯SELECT| PASS["✅ 通过"]

    style CHECK fill:#FFF9C4
    style BLOCK fill:#FFCDD2
```

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有工具安全策略 | ☐ |
| 有权限检查 | ☐ |
| 有SQL过滤 | ☐ |
| 有审计日志 | ☐ |
