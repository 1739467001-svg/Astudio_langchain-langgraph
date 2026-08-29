# LLM 应用架构案例研究

> 从真实应用场景中学习架构设计。每个案例研究一个典型应用的架构选型和设计决策。

---

## 一、案例1：企业知识库问答系统

### 1.1 需求

```mermaid
graph TB
    subgraph 需求 {"企业知识库问答系统需求"}
        R1["10,000+篇企业文档<br/>(PDF/Word/Confluence)"]
        R2["500个内部用户"]
        R3["需要引用来源"]
        R4["需要权限控制<br/>(不同部门看不同文档)"]
        R5["日查询量~2000次"]
    end

    style 需求 fill:#E3F2FD
```

### 1.2 架构设计

```mermaid
graph TB
    subgraph 架构 {"企业知识库问答系统架构"}
        U["用户(浏览器)"] --> LB["Nginx"]
        LB --> API["FastAPI服务"]
        API --> AUTH["鉴权+权限<br/>(部门级过滤)"]
        AUTH --> ROUTER{"问题路由"}
        ROUTER -->|"知识查询"| RAG["RAG Chain<br/>检索+生成"]
        ROUTER -->|"闲聊"| CHAT["Chat Chain"]
        RAG --> VDB["向量数据库<br/>(按部门分区)"]
        RAG --> LLM["LLM API"]
        API --> PG["PostgreSQL<br/>(对话历史)"]
        API --> REDIS["Redis<br/>(缓存+限流)"]
    end

    style RAG fill:#FFE0B2
    style VDB fill:#F3E5F5
    style PG fill:#E3F2FD
```

### 1.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 向量库 | Milvus | 10000+文档，需要按部门分区 |
| 模型 | GPT-4o-mini | 性价比好，日2000次可控 |
| 检索策略 | 混合检索(向量+关键词) | 企业文档有大量专有术语 |
| 权限控制 | 向量库按部门分区 | 数据隔离 |
| 缓存 | Redis语义缓存 | 员工问题相似度高 |
| 对话历史 | PostgreSQL+截断 | 持久化+Token控制 |

## 二、案例2：智能客服机器人

### 2.1 需求

```mermaid
graph TB
    subgraph 需求2 {"智能客服需求"}
        R1["日对话量10,000+"]
        R2["多种意图(订单/产品/投诉)"]
        R3["需要调用业务系统API"]
        R4["夜间无人值守"]
        R5["满意度≥85%"]
    end

    style 需求2 fill:#FFF3E0
```

### 2.2 架构设计

```mermaid
graph TB
    U["用户消息"] --> GUARD["🛡️ 输入护栏"]
    GUARD --> CLASSIFY["意图分类"]
    CLASSIFY -->|"订单"| ORDER["订单Agent<br/>+订单API工具"]
    CLASSIFY -->|"产品"| PRODUCT["产品Agent<br/>+FAQ检索"]
    CLASSIFY -->|"投诉"| COMPLAINT["投诉Agent<br/>+工单系统"]
    CLASSIFY -->|"闲聊"| CHAT["通用Agent"]
    ORDER & PRODUCT & COMPLAINT & CHAT --> ESC{"解决了吗?"}
    ESC -->|"否"| HUMAN["转人工"]
    ESC -->|"是"| OUT_GUARD["🛡️ 输出护栏"]
    OUT_GUARD --> OUT["回复用户"]

    style GUARD fill="#FFCDD2"
    style CLASSIFY fill="#FFF9C4"
    style OUT_GUARD fill="#FFCDD2"
    style HUMAN fill="#FFE0B2"
```

### 2.3 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 架构模式 | Router + Agent | 多意图需要路由 |
| Agent类型 | create_tool_calling_agent | 需要调用业务API |
| 转人工 | 条件路由 | 无法解决时转人工 |
| 安全 | 双层护栏 | 面向用户必须安全 |
| 缓存 | Redis精确缓存 | 订单查询重复度高 |
| 监控 | LangSmith | 追踪每次对话 |

## 三、案例3：数据分析助手

### 3.1 架构

```mermaid
graph TB
    subgraph 数据分析架构 {"数据分析助手架构"}
        U["用户: '分析销售趋势'"] --> UNDERSTAND["理解+确认"]
        UNDERSTAND --> CODE["LLM生成Python代码"]
        CODE --> SANDBOX["安全沙箱执行<br/>(超时+模块过滤)"]
        SANDBOX --> CHECK{"执行成功?"}
        CHECK -->|"是"| CHART["生成图表"]
        CHECK -->|"否"| FIX["LLM分析错误<br/>重新生成"]
        FIX --> CODE
        CHART --> REPORT["生成报告<br/>(文字+图表)"]
    end

    style CODE fill="#FFF9C4"
    style SANDBOX fill="#FFCDD2"
    style CHART fill="#C8E6C9"
```

### 3.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 执行方式 | subprocess沙箱 | 安全隔离 |
| 代码安全 | 关键词过滤+超时 | 防止危险操作 |
| 模型 | GPT-4o-mini | 代码生成够用 |
| 图表 | matplotlib Agg | 非交互，可保存 |
| 自纠错 | LangGraph循环 | 最多重试3次 |

## 四、案例4：内容审核系统

### 4.1 架构

```mermaid
graph LR
    CONTENT["用户发布内容"] --> STT1["规则预过滤<br/>(关键词/正则)"]
    STT1 --> LLM_CHECK["LLM审核<br/>(违规/有害/广告)"]
    LLM_CHECK --> DECIDE{"审核结果"}
    DECIDE -->|"通过"| PUBLISH["发布 ✅"]
    DECIDE -->|"违规"| BLOCK["拦截 ❌"]
    DECIDE -->|"存疑"| REVIEW["人工复审 ⚠️"]

    style STT1 fill="#E3F2FD"
    style LLM_CHECK fill="#FFF9C4"
    style PUBLISH fill="#C8E6C9"
    style BLOCK fill="#FFCDD2"
    style REVIEW fill="#FFE0B2"
```

### 4.2 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 双重审核 | 规则+LLM | 规则快，LLM准确 |
| 模型 | GPT-4o-mini | 审核不需要强推理 |
| temperature | 0 | 审核必须一致 |
| 输出 | 结构化{violation, type, severity} | 程序化处理 |

## 五、案例对比总结

```mermaid
graph TB
    subgraph 对比 {"四个案例的架构对比"}
        C1["企业知识库<br/>核心: RAG<br/>复杂度: ★★★<br/>模式: Router+RAG"]
        C2["智能客服<br/>核心: Agent+Tools<br/>复杂度: ★★★★<br/>模式: Router+Agent+Guardrail"]
        C3["数据分析<br/>核心: 代码执行<br/>复杂度: ★★★★<br/>模式: Plan-Execute+沙箱"]
        C4["内容审核<br/>核心: 分类<br/>复杂度: ★★<br/>模式: Chain+Guardrail"]
    end

    style C1 fill="#E3F2FD"
    style C2 fill="#FFF3E0"
    style C3 fill="#F3E5F5"
    style C4 fill="#C8E6C9"
```

## 六、架构设计原则

```mermaid
graph TB
    subgraph 原则 {"LLM应用架构设计五原则"}
        P1["1. 从简单开始<br/>先Chain，需要时再Agent"]
        P2["2. 关注成本<br/>小模型优先，缓存必须"]
        P3["3. 安全优先<br/>面向用户的必须加护栏"]
        P4["4. 可观测<br/>LangSmith追踪+日志"]
        P5["5. 渐进式复杂化<br/>简单方案→遇到瓶颈→升级"]
    end

    style P1 fill="#C8E6C9"
    style P5 fill="#F3E5F5"
```
