# RAG 分块策略图解

> 用图解理解 7 种分块策略的原理、适用场景和选型决策。

---

## 一、分块为什么重要

```mermaid
graph TB
    subgraph 问题 {"分块不当的后果"}
        TOO_BIG["太大<br/>信号稀释<br/>上下文被无关内容占据"]
        TOO_SMALL["太小<br/>上下文丢失<br/>检索需要更多块"]
        BAD_CUT["截断位置不对<br/>句子/表格被拆散"]
    end

    style TOO_BIG fill:#FFCDD2
    style TOO_SMALL fill:#FFE0B2
    style BAD_CUT fill:#FFCDD2
```

---

## 二、7种策略总览

```mermaid
graph TB
    ROOT["分块策略"] --> S1["固定大小<br/>按字符数切分"]
    ROOT --> S2["递归字符<br/>按分隔符层级"]
    ROOT --> S3["语义分块<br/>按相似度切分"]
    ROOT --> S4["文档感知<br/>按结构切分"]
    ROOT --> S5["父子分块<br/>小块检索大块返回"]
    ROOT --> S6["滑动窗口<br/>重叠保留上下文"]
    ROOT --> S7["自纠正<br/>LLM优化边界"]

    style ROOT fill:#1565C0,color:#fff
    style S2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 三、递归字符分块（最常用）

```mermaid
graph TB
    DOC["文档"] --> S1{"按\\n\\n<br/>段落切分？"}
    S1 -->|能| C1["段落级块"]
    S1 -->|太长| S2{"按\\n<br/>行切分？"}
    S2 -->|能| C2["行级块"]
    S2 -->|太长| S3{"按句号<br/>句子切分？"}
    S3 -->|能| C3["句子级块"]
    S3 -->|太长| S4{"按空格<br/>词切分？"}

    style S1 fill:#FFF9C4
    style S2 fill:#FFF9C4
    style S3 fill:#FFF9C4
```

---

## 四、语义分块

```mermaid
graph LR
    S1["句子1: Python是语言"] -->|相似度高| S2["句子2: 支持面向对象"]
    S2 -->|相似度低✂️| S3["句子3: 今天天气好"]
    S3 -->|相似度高| S4["句子4: 温度25度"]

    S1 & S2 --> B1["块1: Python主题"]
    S3 & S4 --> B2["块2: 天气主题"]

    style B1 fill:#E3F2FD
    style B2 fill:#FFF3E0
```

---

## 五、文档感知分块

```mermaid
graph TB
    subgraph Markdown {"按标题层级切分"}
        H1["# 第一章"] --> C1["块1<br/>metadata: H1=第一章"]
        H2["## 1.1 背景"] --> C2["块2<br/>metadata: H1+H2"]
        H3["### 历史"] --> C3["块3<br/>metadata: H1+H2+H3"]
    end

    subgraph 代码 {"按语法结构切分"}
        F1["def func_a():"] --> CF1["块1: 完整函数"]
        F2["class MyClass:"] --> CF2["块2: 完整类"]
    end

    style Markdown fill:#C8E6C9
    style 代码 fill:#E3F2FD
```

---

## 六、父子分块

```mermaid
graph TB
    subgraph 离线 {"离线建库"}
        DOC["文档"] --> PARENT["切大块(父块)<br/>1000字符"]
        PARENT --> CHILD["切小块(子块)<br/>200字符"]
        CHILD --> INDEX["子块→嵌入向量库"]
        PARENT --> STORE["父块→文档库"]
    end

    subgraph 在线 {"在线检索"}
        Q["查询"] --> SEARCH["用子块检索"]
        SEARCH --> MAP["映射到父块"]
        MAP --> RET["返回父块<br/>更大上下文"]
    end

    style 离线 fill:#E3F2FD
    style 在线 fill:#FFF3E0
    style SEARCH fill:#FFF9C4
```

---

## 七、滑动窗口

```mermaid
graph LR
    W1["窗口1<br/>字符1-500"]
    W2["窗口2<br/>字符400-900<br/>重叠100"]
    W3["窗口3<br/>字符800-1300<br/>重叠100"]

    W1 -.->|"重叠区<br/>保留上下文"| W2
    W2 -.->|"重叠区"| W3

    style W1 fill:#E3F2FD
    style W2 fill:#FFF3E0
    style W3 fill:#E3F2FD
```

---

## 八、选型决策树

```mermaid
graph TB
    Q1["文档类型？"] -->|纯文本| Q2{"语义边界敏感？"}
    Q1 -->|Markdown| S3["文档感知分块"]
    Q1 -->|代码| S4["代码感知分块"]
    Q1 -->|含表格| S5["表格感知分块"]

    Q2 -->|一般| R1["递归字符分块<br/>(最常用)"]
    Q2 -->|高度敏感| R2["语义分块"]

    Q3{"需要精确检索<br/>+大上下文？"} -->|是| R3["父子分块"]
    Q3 -->|否| R4["递归+重叠"]

    style R1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 九、参数建议

```mermaid
graph TB
    subgraph 参数 {"分块参数建议"}
        P1["块大小: 300-1000字符<br/>太小丢上下文<br/>太大稀释信号"]
        P2["重叠率: 10-20%<br/>防止跨块概念丢失"]
        P3["分隔符: 中英文都加<br/>。和. ，和,"]
    end

    style 参数 fill:#E3F2FD
```

---

## 十、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解分块对RAG的影响 | ☐ |
| 掌握递归字符分块 | ☐ |
| 了解语义分块原理 | ☐ |
| 能按文档结构分块 | ☐ |
| 理解父子分块 | ☐ |
| 能选择分块策略 | ☐ |
| 有分块评估方法 | ☐ |
