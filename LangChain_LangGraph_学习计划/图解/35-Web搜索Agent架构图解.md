# Web 搜索 Agent 架构图解

> 用图解理解 Web 搜索 Agent 的工作流程和工具选择。

---

## 一、搜索 Agent 工作流程

```mermaid
graph TB
    U["用户问题"] --> SEARCH["搜索节点<br/>调用搜索工具"]
    SEARCH --> RESULTS["搜索结果<br/>(多个摘要)"]
    RESULTS --> NEED{"需要深入?"}
    NEED -->|"是"| BROWSE["浏览网页<br/>获取详细内容"]
    BROWSE --> GEN["LLM生成回答"]
    NEED -->|"否"| GEN
    GEN --> OUT["输出回答+来源"]

    style SEARCH fill:'#E3F2FD'
    style BROWSE fill:'#FFF9C4'
    style GEN fill:'#C8E6C9'
```

## 二、搜索工具对比

```mermaid
graph TB
    subgraph 工具选择 {"搜索工具选择"}
        DDG["DuckDuckGo<br/>✅ 免费 ✅ 无需Key<br/>❌ 质量一般<br/>适合: 学习/原型"]
        TAVILY["Tavily<br/>✅ AI优化 ✅ 质量高<br/>❌ 有费用<br/>适合: 生产"]
        BRAVE["BraveSearch<br/>✅ 隐私好<br/>❌ 有费用<br/>适合: 隐私场景"]
        SERP["SerpAPI<br/>✅ Google结果<br/>❌ 付费<br/>适合: 精确搜索"]
    end

    style DDG fill:'#C8E6C9'
    style TAVILY fill:'#E3F2FD'
```

## 三、多查询搜索

```mermaid
graph TB
    Q["原始问题<br/>'2025最热AI技术'"] --> LLM["LLM改写"]
    LLM --> Q1["变体1: '2025 AI趋势'"]
    LLM --> Q2["变体2: '最新人工智能技术'"]
    LLM --> Q3["变体3: 'AI technology 2025'"]

    Q1 --> S1["搜索"]
    Q2 --> S2["搜索"]
    Q3 --> S3["搜索"]

    S1 & S2 & S3 --> MERGE["合并去重"]
    MERGE --> GEN["LLM综合回答"]

    style LLM fill:'#FFF9C4'
    style MERGE fill:'#C8E6C9'
```

## 四、搜索+浏览组合

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Agent
    participant S as 搜索工具
    participant W as 网页加载器

    U->>A: "深入研究量子计算最新进展"
    A->>S: 搜索"量子计算 2025"
    S-->>A: 3个搜索结果(摘要)
    A->>W: 获取第1个结果的完整网页
    W-->>A: 网页内容(1000字)
    A->>W: 获取第2个结果的完整网页
    W-->>A: 网页内容(800字)
    Note over A: 综合搜索结果和网页内容
    A-->>U: "量子计算最新进展：1.量子纠错... 2.量子优势..."
```

## 五、选型决策

```mermaid
graph TD
    Q{"场景?"}
    Q -->|"学习/原型"| DDG["✅ DuckDuckGo + Agent"]
    Q -->|"生产"| TAV["✅ Tavily + Agent"]
    Q -->|"需要网页详情"| BOTH["✅ 搜索+WebBaseLoader"]
    Q -->|"批量研究"| MULTI["✅ 多查询搜索"]
    Q -->|"实时监控"| CRON["✅ 定时搜索+摘要"]

    style DDG fill:'#C8E6C9'
    style TAV fill:'#E3F2FD'
```
