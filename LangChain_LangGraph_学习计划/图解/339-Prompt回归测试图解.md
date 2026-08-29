# Prompt 回归测试图解

> 旧版和新版Prompt在同一测试集上跑→逐条对比→改善/退化/持平。

---

```mermaid
graph TB
    OLD["旧版Prompt"] --> RUN1["测试集运行"]
    NEW["新版Prompt"] --> RUN2["测试集运行"]
    RUN1 & RUN2 --> DIFF["逐条对比"]
    DIFF --> C{"变化?"}
    C -->|改善| UP["✅ 新版更好"]
    C -->|退化| DOWN["❌ 新版退化"]
    C -->|持平| SAME["⬜ 持平"]
    UP & DOWN & SAME --> REPORT["回归报告"]

    style DIFF fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style DOWN fill:#FFCDD2,stroke:#C62828
    style UP fill:#C8E6C9
    style REPORT fill:#E3F2FD,stroke:#1565C0
```

---

## 测试集设计

| 类别 | 说明 | 优先级 |
|------|------|--------|
| 核心场景 | 最常见用例 | ★★★ |
| 边界用例 | 空输入/超长 | ★★★ |
| 退化陷阱 | 易退化用例 | ★★★ |
| 格式验证 | 输出格式 | ★★☆ |
| 安全用例 | 越狱防护 | ★★☆ |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有版本对比 | ☐ |
| 有退化检测 | ☐ |
| 有回归报告 | ☐ |
| 支持CI集成 | ☐ |
