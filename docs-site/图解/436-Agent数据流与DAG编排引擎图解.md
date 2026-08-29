# Agent 数据流与 DAG 编排引擎图解

> LangGraph 本质是 DAG——拓扑排序决定执行顺序，并行扇出提升效率。本图解可视化 DAG 执行模型。

---

## DAG 执行模型

```mermaid
graph TB
    START["START"] --> SEARCH["检索"]
    SEARCH --> ANALYZE["分析"]
    SEARCH --> VERIFY["验证"]
    ANALYZE --> REPORT["生成报告"]
    VERIFY --> REPORT
    REPORT --> END["END"]

    style SEARCH fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style ANALYZE fill:#FFF9C4,stroke:#F9A825
    style VERIFY fill:#FFF9C4,stroke:#F9A825
    style REPORT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 拓扑排序层级

```mermaid
graph TB
    L1["层级1: search<br/>串行"] --> L2["层级2: analyze + verify<br/>并行"]
    L2 --> L3["层级3: report<br/>串行"]

    style L1 fill:#E3F2FD,stroke:#1565C0
    style L2 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style L3 fill:#C8E6C9,stroke:#2E7D32
```

---

## 扇出扇入

```mermaid
graph TB
    INPUT["输入"] --> FO["扇出<br/>并行分发"]
    FO --> T1["任务1"]
    FO --> T2["任务2"]
    FO --> T3["任务3"]
    FO --> T4["任务4"]
    T1 --> FI["扇入<br/>聚合结果"]
    T2 --> FI
    T3 --> FI
    T4 --> FI
    FI --> OUTPUT["输出"]

    style FO fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FI fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 子图嵌套

```mermaid
graph TB
    subgraph "主图"
        R["研究子图"] --> REP["报告子图"]
    end
    subgraph "研究子图"
        S["检索"] --> A["分析"] --> SUM["总结"]
    end
    subgraph "报告子图"
        G["生成"] --> REV["审核"]
    end

    style R fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style REP fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 引擎对比

| 引擎 | 定位 | 适用 |
|------|------|------|
| LangGraph | Agent编排 | LLM Agent |
| Temporal | 微服务工作流 | 跨服务编排 |
| Airflow | 数据管道 | ETL/定时 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解DAG模型 | ☐ |
| 拓扑排序 | ☐ |
| 扇出扇入 | ☐ |
| 动态编排 | ☐ |
| 子图嵌套 | ☐ |
| 数据依赖追踪 | ☐ |
