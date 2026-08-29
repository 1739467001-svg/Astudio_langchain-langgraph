# Agent 工具编排与动态工具链图解

> 顺序/并行/条件/DAG四种编排+动态发现。本图解可视化工具编排体系。

---

## 四种编排模式

```mermaid
graph TB
    ORCH["工具编排"]

    ORCH --> SEQ["顺序编排<br/>A→B→C<br/>结果链式传递"]
    ORCH --> PAR["并行编排<br/>A,B,C同时<br/>结果聚合"]
    ORCH --> COND["条件编排<br/>根据结果<br/>动态路由"]
    ORCH --> DAG["DAG编排<br/>有向无环图<br/>复杂依赖"]

    style ORCH fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style DAG fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 顺序编排示例

```mermaid
graph LR
    SEARCH["搜索"] --> ANALYZE["分析"]
    ANALYZE --> REPORT["生成报告"]

    style SEARCH fill:#C8E6C9,stroke:#2E7D32
    style REPORT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 动态工具发现

```mermaid
graph TB
    QUERY["用户查询"] --> SELECT["LLM选择相关工具<br/>20个→3-5个"]
    SELECT --> EXECUTE["执行精选工具"]
    EXECUTE --> RESULT["结果"]

    style SELECT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 四种编排模式 | ☐ |
| 顺序编排器 | ☐ |
| 动态工具发现 | ☐ |
| 工具依赖图 | ☐ |
| 拓扑排序 | ☐ |
| 结果传递 | ☐ |
