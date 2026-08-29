# RAG 全流程图解

> 用图解完整展示检索增强生成（RAG）的离线建库和在线问答两个阶段。

---

## 一、RAG 全局架构

```mermaid
graph TB
    subgraph 离线阶段 ["离线阶段：构建知识库"]
        D1[原始文档<br/>PDF/TXT/MD] --> L1[文档加载器<br/>DocumentLoader]
        L1 --> D2[Document 对象<br/>page_content + metadata]
        D2 --> S1[文本分割器<br/>TextSplitter]
        S1 --> D3[文档块列表<br/>多个小块]
        D3 --> E1[向量化模型<br/>Embeddings]
        E1 --> D4[向量数组<br/>每块一个向量]
        D4 --> VS[向量数据库<br/>FAISS/Chroma]
    end

    subgraph 在线阶段 ["在线阶段：问答检索"]
        Q[用户问题] --> E2[向量化<br/>同一Embeddings模型]
        E2 --> QV[问题向量]
        QV --> VS
        VS --> SR[相似度检索<br/>Top-K 相关块]
        SR --> CTX[上下文文本]
        CTX --> P[Prompt组装<br/>上下文+问题]
        P --> LLM[LLM 生成回答]
        LLM --> ANS[最终回答]
    end

    VS -.->|存储| VS_DB[(向量数据库)]

    style 离线阶段 fill:#E3F2FD,stroke:#1565C0
    style 在线阶段 fill:#FFF3E0,stroke:#E65100
    style VS fill:#F3E5F5,stroke:#6A1B9A
```

## 二、离线阶段详解

### Step 1：文档加载

```mermaid
graph LR
    subgraph 输入
        F1[report.pdf]
        F2[notes.txt]
        F3[guide.md]
        F4[网页URL]
    end

    subgraph 加载器
        L1["PyPDFLoader"]
        L2["TextLoader"]
        L3["UnstructuredMarkdownLoader"]
        L4["WebBaseLoader"]
    end

    subgraph 输出
        D1["Document(page_content='...', metadata=&#123;'source': 'report.pdf', 'page': 0&#125;)"]
        D2["Document(page_content='...', metadata=&#123;'source': 'notes.txt'&#125;)"]
        D3["Document(page_content='...', metadata=&#123;'source': 'guide.md'&#125;)"]
        D4["Document(page_content='...', metadata=&#123;'source': 'https://...'&#125;)"]
    end

    F1 --> L1 --> D1
    F2 --> L2 --> D2
    F3 --> L3 --> D3
    F4 --> L4 --> D4

    style 输入 fill:#E3F2FD
    style 加载器 fill:#FFF9C4
    style 输出 fill:#C8E6C9
```

### Step 2：文档分割

为什么需要分割？LLM 的上下文窗口有限，且检索时只需要最相关的片段，不需要整篇文档。

```mermaid
graph TB
    subgraph 分割前
        DOC["长文档<br/>(10000字)"]
    end

    subgraph 分割后
        C1["块1 (500字)<br/>chunk_overlap=50"]
        C2["块2 (500字)<br/>与前一块重叠50字"]
        C3["块3 (500字)"]
        C4["块4 (500字)"]
        C5["..."]
        CN["块N (剩余)"]
    end

    DOC --> S["RecursiveCharacterTextSplitter<br/>chunk_size=500, chunk_overlap=50"]
    S --> C1
    S --> C2
    S --> C3
    S --> C4
    S --> C5
    S --> CN

    style 分割前 fill:#FFCDD2
    style 分割后 fill:#C8E6C9
```

### chunk_size 和 overlap 的效果

```mermaid
graph LR
    subgraph 小chunk ["chunk_size=300"]
        S1["块更小<br/>检索更精准<br/>但上下文可能不足"]
    end

    subgraph 大chunk ["chunk_size=1000"]
        L1["块更大<br/>上下文更完整<br/>但可能包含无关信息"]
    end

    subgraph 有overlap ["overlap=50"]
        O1["相邻块有重叠<br/>确保上下文不断裂<br/>但消耗更多Token"]
    end

    style 小chunk fill:#FFE0B2
    style 大chunk fill:#FFE0B2
    style 有overlap fill:#C8E6C9
```

### Step 3：向量化

```mermaid
graph TB
    subgraph 输入文本
        T1["猫是哺乳动物"]
        T2["猫属于哺乳类"]
        T3["今天天气不错"]
    end

    subgraph Embedding模型
        E["OpenAIEmbeddings<br/>text-embedding-3-small<br/>输出1536维向量"]
    end

    subgraph 向量空间
        direction TB
        V1["[0.12, -0.34, 0.56, ...]<br/>← 猫是哺乳动物"]
        V2["[0.11, -0.33, 0.55, ...]<br/>← 猫属于哺乳类<br/>(与V1非常接近)"]
        V3["[0.87, 0.21, -0.43, ...]<br/>← 今天天气不错<br/>(与V1/V2很远)"]
    end

    T1 --> E --> V1
    T2 --> E --> V2
    T3 --> E --> V3

    style 输入文本 fill:#E3F2FD
    style Embedding模型 fill:#FFF9C4
    style 向量空间 fill:#F3E5F5
```

### Step 4：存入向量数据库

```mermaid
graph TB
    subgraph 写入
        C1["文档块1 + 向量1"] --> DB[(向量数据库)]
        C2["文档块2 + 向量2"] --> DB
        C3["文档块3 + 向量3"] --> DB
        CN["文档块N + 向量N"] --> DB
    end

    DB --- META["每条记录包含:<br/>1. 原始文本 (page_content)<br/>2. 向量 (embedding)<br/>3. 元数据 (metadata)"]

    style DB fill:#F3E5F5,stroke:#6A1B9A
    style META fill:#FFF9C4
```

## 三、在线阶段详解

### 检索过程

```mermaid
sequenceDiagram
    participant U as 用户
    participant E as Embeddings
    participant DB as 向量数据库
    participant L as LLM

    U->>E: "LangChain是什么？"
    Note over E: 将问题转为向量<br/>[0.15, -0.28, 0.42, ...]
    E->>DB: 用问题向量搜索最相似的块
    Note over DB: 计算余弦相似度<br/>返回Top-K=3个最相似块
    DB-->>U: [块1: "LangChain是..."],<br/>[块2: "核心组件包括..."],<br/>[块3: "LCEL是..."]

    U->>L: 上下文(3个块) + 原始问题
    Note over L: 基于上下文生成回答
    L-->>U: "LangChain是一个用于构建..."
```

### 相似度搜索原理

```mermaid
graph TB
    subgraph 向量空间示意
        QV["⭐ 问题向量<br/>'LangChain是什么'"]
        D1["● 块1: 'LangChain是框架' (相似度: 0.95)"]
        D2["● 块2: '核心组件有Models' (相似度: 0.82)"]
        D3["● 块3: 'LCEL管道语法' (相似度: 0.75)"]
        D4["○ 块4: 'Python基础' (相似度: 0.31)"]
        D5["○ 块5: '天气数据' (相似度: 0.12)"]
    end

    QV ---|近| D1
    QV ---|近| D2
    QV ---|较近| D3
    QV ---|远| D4
    QV ---|很远| D5

    D1 --> K["Top-3 选中 ✓"]
    D2 --> K
    D3 --> K
    D4 -.->|未选中| X["✗"]
    D5 -.->|未选中| X

    style QV fill:#FF6F00,color:#fff
    style K fill:#C8E6C9
    style X fill:#FFCDD2
```

### 生成回答

```mermaid
graph LR
    subgraph 组装Prompt
        CTX["检索到的上下文<br/>(3个文档块)"]
        Q["用户原始问题"]
    end

    CTX --> P["PromptTemplate<br/>组装模板"]
    Q --> P

    P --> LLM["LLM<br/>基于上下文生成回答"]
    LLM --> ANS["回答: 'LangChain是...'"]

    style CTX fill:#E3F2FD
    style Q fill:#FFF3E0
    style P fill:#FFF9C4
    style LLM fill:#FFE0B2
    style ANS fill:#C8E6C9
```

## 四、RAG 数据流完整链路

```mermaid
graph LR
    subgraph 离线建库
        direction LR
        A1["📄 文档"] --> A2["加载"] --> A3["分割"] --> A4["向量化"] --> A5[("🗄️ 向量库")]
    end

    subgraph 在线问答
        direction LR
        B1["❓ 问题"] --> B2["向量化"]
        B5[("🗄️ 向量库")] --> B3["检索Top-K"]
        B2 --> B3
        B3 --> B4["组装上下文"]
        B4 --> B6["LLM生成"]
        B6 --> B7["✅ 回答"]
    end

    A5 -.-> B5

    style 离线建库 fill:#E3F2FD,stroke:#1565C0
    style 在线问答 fill:#FFF3E0,stroke:#E65100
    style A5 fill:#F3E5F5,stroke:#6A1B9A
```

## 五、检索优化策略对比

```mermaid
graph TB
    subgraph 基础检索 ["基础：向量相似度"]
        B_Q["问题 → 向量"] --> B_S["Top-K 相似块"]
        B_S --> B_O["拼接为上下文"]
    end

    subgraph 多查询检索 ["进阶：Multi-Query"]
        M_Q["原始问题"] --> M_LLM["LLM改写"]
        M_LLM --> M_Q1["问题变体1"]
        M_LLM --> M_Q2["问题变体2"]
        M_LLM --> M_Q3["问题变体3"]
        M_Q1 --> M_S1["检索"]
        M_Q2 --> M_S2["检索"]
        M_Q3 --> M_S3["检索"]
        M_S1 --> M_M["合并去重"]
        M_S2 --> M_M
        M_S3 --> M_M
        M_M --> M_O["更全面的上下文"]
    end

    subgraph 元数据过滤 ["进阶：Metadata过滤"]
        F_Q["问题"] --> F_S["检索+过滤"]
        F_F["filter: source=python_guide"] --> F_S
        F_S --> F_O["只返回指定来源的块"]
    end

    style 基础检索 fill:#E3F2FD
    style 多查询检索 fill:#FFF3E0
    style 元数据过滤 fill:#F3E5F5
```

## 六、chunk_size 调参决策

```mermaid
graph TD
    Q&#123;"检索效果不好?"&#125;
    Q -->|"结果不相关<br/>包含太多无关信息"| S1["减小 chunk_size<br/>300-400"]
    Q -->|"结果太碎片化<br/>上下文不完整"| S2["增大 chunk_size<br/>800-1000"]
    Q -->|"句子在中间断裂"| S3["增大 overlap<br/>50-100"]
    Q -->|"Token消耗太大"| S4["减小 chunk_size<br/>或减小 k 值"]
    Q -->|"中文效果差"| S5["调整分隔符<br/>加入中文标点"]

    style S1 fill:#FFE0B2
    style S2 fill:#FFE0B2
    style S3 fill:#C8E6C9
    style S4 fill:#FFCDD2
    style S5 fill:#F3E5F5
```
