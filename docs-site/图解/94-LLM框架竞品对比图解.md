# LLM 框架竞品对比图解

> 用图解理解四大 LLM 框架的定位、架构理念和选型决策。

---

## 一、四大框架定位

```mermaid
graph TB
    LC["LangChain<br/>通用框架<br/>生态最大"]
    LG["LangGraph<br/>图编排<br/>状态管理"]
    CA["CrewAI<br/>角色协作<br/>简单直观"]
    AG["AutoGen<br/>Agent对话<br/>代码执行"]
    LI["LlamaIndex<br/>数据连接<br/>RAG最强"]

    style LC fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style LG fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style CA fill:#FFF3E0
    style AG fill:#C8E6C9
    style LI fill:#F3E5F5
```

---

## 二、架构理念

```mermaid
graph TB
    subgraph LC &#123;"LangChain: 组件化积木"&#125;
        L1["可组合组件<br/>Model/Prompt/Tool"] --> L2["LangGraph编排<br/>State→Node→Edge"]
    end

    subgraph CA &#123;"CrewAI: 模拟人类团队"&#125;
        C1["Agent(角色)<br/>+Task(任务)"] --> C2["Crew(团队)<br/>Sequential/Hierarchical"]
    end

    subgraph AG &#123;"AutoGen: Agent对话"&#125;
        A1["ConversableAgent"] --> A2["GroupChat<br/>自由协商"]
    end

    subgraph LI &#123;"LlamaIndex: 数据→索引→查询"&#125;
        I1["Document<br/>100+加载器"] --> I2["Index<br/>向量/树/关键词"] --> I3["QueryEngine"]
    end

    style LC fill:#E3F2FD
    style CA fill:#FFF3E0
    style AG fill:#C8E6C9
    style LI fill:#F3E5F5
```

---

## 三、CrewAI三要素

```mermaid
graph TB
    AGENT["Agent<br/>角色: 研究员<br/>目标: 收集信息<br/>工具: 搜索"]
    TASK["Task<br/>描述: 研究AI趋势<br/>期望输出: 报告"]
    CREW["Crew<br/>团队组装<br/>流程: 顺序/层级"]

    AGENT --> CREW
    TASK --> CREW
    CREW --> RESULT["执行结果"]

    style CREW fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 四、AutoGen对话模式

```mermaid
graph TB
    U["UserProxy<br/>代表用户<br/>可执行代码"]
    A1["Assistant<br/>AI助手<br/>推理写作"]
    M["GroupChatManager<br/>管理轮次"]

    U --> M
    A1 --> M
    M -->|"轮流发言"| U
    M -->|"轮流发言"| A1

    style M fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 五、LlamaIndex数据管线

```mermaid
graph LR
    D["Documents<br/>100+数据源"] --> IDX["Index<br/>向量/树/关键词"]
    IDX --> QE["QueryEngine<br/>路由/子查询"]
    QE --> R["回答+引用"]

    style D fill:#F3E5F5
    style IDX fill:#E3F2FD
    style R fill:#C8E6C9
```

---

## 六、核心能力对比

```mermaid
graph TB
    subgraph 对比 &#123;"能力雷达"&#125;
        M1["多Agent: LC=✅ CA=✅ AG=✅ LI=⚠️"]
        M2["RAG: LC=✅ CA=⚠️ AG=⚠️ LI=✅✅"]
        M3["状态管理: LC=✅✅ CA=⚠️ AG=⚠️ LI=⚠️"]
        M4["代码执行: LC=✅ CA=✅ AG=✅✅ LI=✅"]
        M5["可观测: LC=✅✅ CA=⚠️ AG=⚠️ LI=✅"]
    end

    style 对比 fill:#E3F2FD
```

---

## 七、选型决策

```mermaid
graph TB
    Q1["多Agent协作？"] -->|是| Q2["Agent间自由对话？"]
    Q2 -->|是,自主协商| AG["AutoGen"]
    Q2 -->|否,角色分工| CA["CrewAI"]
    Q1 -->|否| Q3["RAG/数据为核心？"]
    Q3 -->|是| LI["LlamaIndex"]
    Q3 -->|否| Q4["复杂状态管理？"]
    Q4 -->|是| LG["LangGraph"]
    Q4 -->|否| LC["LangChain"]

    style AG fill:#C8E6C9
    style CA fill:#FFF3E0
    style LI fill:#F3E5F5
    style LG fill:#E3F2FD
    style LC fill:#E3F2FD
```

---

## 八、混合使用

```mermaid
graph LR
    subgraph 混合 &#123;"取长补短"&#125;
        LI2["LlamaIndex<br/>检索+索引"] --> LG2["LangGraph<br/>编排+状态"]
        LG2 --> LC2["LangChain<br/>工具+组件"]
    end

    style 混合 fill:#C8E6C9
```

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四大框架定位 | ☐ |
| 知道CrewAI角色+任务模型 | ☐ |
| 知道AutoGen对话+代码执行 | ☐ |
| 知道LlamaIndex索引优势 | ☐ |
| 能根据场景选框架 | ☐ |
