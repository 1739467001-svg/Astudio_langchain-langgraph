# Agent 数据安全与加密体系图解

> 传输加密+存储加密+处理加密三层防护。本图解可视化数据安全体系。

---

## 三层防护

```mermaid
graph TB
    SEC["数据安全"]

    SEC --> TRANSIT["传输加密<br/>TLS/HTTPS<br/>网络传输"]
    SEC --> STORAGE["存储加密<br/>AES-256<br/>数据库/文件"]
    SEC --> PROCESS["处理加密<br/>同态/TEE<br/>内存计算"]

    style SEC fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style TRANSIT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style STORAGE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style PROCESS fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 数据脱敏管道

```mermaid
graph LR
    INPUT["原始数据<br/>含PII"] --> MASK["脱敏管道<br/>正则匹配+替换"]
    MASK --> OUTPUT["脱敏数据<br/>安全存储/输出"]

    style MASK fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32
```

---

## 密钥管理

```mermaid
graph TB
    CREATE["创建密钥"] --> ACTIVE["激活使用"]
    ACTIVE --> ROTATE["定期轮换<br/>90天"]
    ROTATE --> DECRYPT["旧密钥仅解密"]
    DECRYPT --> REVOKE["最终吊销"]

    style ACTIVE fill:#C8E6C9,stroke:#2E7D32
    style ROTATE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style REVOKE fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 三层防护 | ☐ |
| TLS传输加密 | ☐ |
| 字段级存储加密 | ☐ |
| 密钥管理+轮换 | ☐ |
| 数据脱敏管道 | ☐ |
| 安全审计链 | ☐ |
