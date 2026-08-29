# LangGraph 架构图解

> 用图解理解设计理念和核心抽象。

---

## 一、设计理念

```mermaid
graph TB
    I1["图即程序"]
    I2["状态显式"]
    I3["可恢复"]
    I4["可观测"]
    I5["人机协作"]

    style I2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、执行模型

```mermaid
graph TB
    START --> NODE1["节点1"] --> CP["检查点"]
    CP --> ROUTE&#123;"路由"&#125; --> NODE2["节点2"]
    ROUTE --> NODE3["节点3"]
    NODE2 & NODE3 --> END

    style CP fill:#FFF9C4
```

---

## 三、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解设计理念 | ☐ |
| 理解核心抽象 | ☐ |
