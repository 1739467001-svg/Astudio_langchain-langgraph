# LangGraph 子图模式图解

> 用图解理解子图概念、状态映射和常见模式。

---

## 一、为什么需要子图

```mermaid
graph TB
    subgraph 问题 {"单一大图"}
        P1["100+节点<br/>难以理解"]
        P2["状态混杂"]
        P3["无法复用"]
        P4["测试困难"]
    end

    subgraph 解决 {"子图模式"}
        S1["功能拆分"]
        S2["状态隔离"]
        S3["可复用"]
        S4["可独立测试"]
    end

    style 问题 fill:#FFCDD2
    style 解决 fill:#C8E6C9
```

---

## 二、子图结构

```mermaid
graph TB
    subgraph 主图 {"主图"}
        START["START"] → A["节点A"]
        A → SUB["子图节点"]
        SUB → B["节点B"]
        B → END["END"]
    end

    subgraph 子图内部 {"子图内部"}
        S_START["子START"] → S1["子节点1"]
        S1 → S2["子节点2"]
        S2 → S_END["子END"]
    end

    SUB -.-> 子图内部

    style SUB fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 三、状态映射

```mermaid
graph LR
    subgraph 主图State {"主图State"}
        M1["topic"]
        M2["research_summary"]
        M3["final_report"]
    end

    subgraph 子图State {"子图State"}
        S1["query"]
        S2["findings"]
        S3["summary"]
    end

    M1 -.->|"topic→query"| S1
    S3 -.->|"summary→research_summary"| M2

    style 主图State fill:#E3F2FD
    style 子图State fill:#FFF3E0
```

---

## 四、常见子图模式

```mermaid
graph TB
    subgraph 模式 {"三种常见子图"}
        P1["RAG子图<br/>检索+生成<br/>可复用"]
        P2["Agent子图<br/>create_react_agent<br/>可复用"]
        P3["审批子图<br/>interrupt+恢复<br/>可复用"]
    end

    style 模式 fill:#C8E6C9
```

---

## 五、多子图嵌套

```mermaid
graph LR
    P1["准备"] → RAG["RAG子图"]
    RAG → AGENT["Agent子图"]
    AGENT → APPROVAL["审批子图"]
    APPROVAL → FINAL["报告"]

    style RAG fill:#E3F2FD
    style AGENT fill:#FFF3E0
    style APPROVAL fill:#FFCDD2
```

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解子图概念 | ☐ |
| 能创建和调用子图 | ☐ |
| 能做状态映射 | ☐ |
| 能多子图嵌套 | ☐ |
