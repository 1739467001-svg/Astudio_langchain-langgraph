# LangGraph 部署架构图解

> 用图解理解四种部署方式、Studio 开发流程、Docker 生产架构和 API 设计。

---

## 一、四种部署方式

```mermaid
graph TB
    ROOT["LangGraph部署"] --> D1["Studio<br/>本地开发可视化"]
    ROOT --> D2["Cloud<br/>官方托管"]
    ROOT --> D3["自托管<br/>Docker/自建"]
    ROOT --> D4["CLI<br/>命令行工具"]

    D1 --> D1D["可视化调试<br/>交互式测试"]
    D2 --> D2D["零运维<br/>自动扩缩容"]
    D3 --> D3D["完全控制<br/>数据不出内网"]
    D4 --> D4D["本地模拟<br/>CI/CD测试"]

    style ROOT fill:#1565C0,color:#fff
    style D1 fill:#E3F2FD
    style D2 fill:#C8E6C9
    style D3 fill:#FFF3E0
    style D4 fill:#F3E5F5
```

---

## 二、Studio开发流程

```mermaid
graph LR
    DEV["编写图代码"] --> CONFIG["写langgraph.json"]
    CONFIG --> CLI["langgraph dev"]
    CLI --> STUDIO["Studio UI<br/>可视化+调试"]
    STUDIO -->|发现问题| DEV
    STUDIO -->|调试通过| DEPLOY["部署"]

    style STUDIO fill:#FFF9C4
    style DEPLOY fill:#C8E6C9
```

---

## 三、Studio功能

```mermaid
graph TB
    subgraph Studio &#123;"LangGraph Studio功能"&#125;
        F1["图结构可视化<br/>看到节点和边"]
        F2["交互式运行<br/>输入→运行→看结果"]
        F3["状态检查<br/>每步State快照"]
        F4["时间旅行<br/>回到任意步骤"]
        F5["断点调试<br/>节点前后暂停"]
        F6["对话测试<br/>多轮对话+记忆"]
    end

    style Studio fill:#E3F2FD
```

---

## 四、Docker生产架构

```mermaid
graph TB
    LB["负载均衡<br/>Nginx"] --> API1["LangGraph API<br/>容器1"]
    LB --> API2["LangGraph API<br/>容器2"]
    LB --> API3["LangGraph API<br/>容器3"]
    API1 --> PG["PostgreSQL<br/>检查点存储"]
    API2 --> PG
    API3 --> PG
    API1 --> REDIS["Redis<br/>队列/缓存"]
    API2 --> REDIS
    API3 --> REDIS

    style LB fill:#E3F2FD
    style PG fill:#FFF3E0
    style REDIS fill:#FFCDD2
```

---

## 五、API端点

```mermaid
graph TB
    subgraph API &#123;"核心API端点"&#125;
        E1["POST /threads<br/>创建对话线程"]
        E2["POST /threads/&#123;id&#125;/runs<br/>运行图"]
        E3["GET /threads/&#123;id&#125;/state<br/>获取状态"]
        E4["POST /runs/stream<br/>流式运行(SSE)"]
        E5["GET /health<br/>健康检查"]
    end

    style API fill:#E3F2FD
```

---

## 六、流式API流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant API as API层
    participant AGENT as Agent
    participant LLM as LLM

    C->>API: POST /chat/stream
    API->>AGENT: 启动Agent
    AGENT->>LLM: 推理（流式）
    LLM-->>API: Token流
    API-->>C: SSE: data &#123;content&#125;
    LLM-->>API: Token流
    API-->>C: SSE: data &#123;content&#125;
    AGENT-->>API: 完成
    API-->>C: SSE: &#123;done: true&#125;
```

---

## 七、部署选型

```mermaid
graph TB
    Q1&#123;"开发阶段？"&#125; -->|原型| STUDIO["Studio"]
    Q1 -->|生产| Q2&#123;"数据敏感？"&#125;
    Q2 -->|可上云| Q3&#123;"有运维团队？"&#125;
    Q3 -->|无| CLOUD["Cloud<br/>零运维"]
    Q3 -->|有| SELF["自托管"]
    Q2 -->|敏感| SELF

    style STUDIO fill:#E3F2FD
    style CLOUD fill:#C8E6C9
    style SELF fill:#FFF3E0
```

---

## 八、监控体系

```mermaid
graph TB
    subgraph 监控 &#123;"部署后监控"&#125;
        M1["健康检查<br/>LLM/向量库/DB"]
        M2["指标<br/>延迟/吞吐/错误率"]
        M3["日志<br/>结构化+请求ID"]
        M4["追踪<br/>LangSmith自动采集"]
        M5["告警<br/>错误率/延迟/队列"]
    end

    style 监控 fill:#E3F2FD
```

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 能配置langgraph.json | ☐ |
| 能用Studio调试 | ☐ |
| 理解四种部署方式 | ☐ |
| 能用Docker部署 | ☐ |
| 配置了PostgreSQL | ☐ |
| 有健康检查 | ☐ |
| 有流式API | ☐ |
