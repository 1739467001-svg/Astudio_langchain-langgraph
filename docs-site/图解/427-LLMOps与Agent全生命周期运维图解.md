# LLMOps 与 Agent 全生命周期运维图解

> DevOps→MLOps→LLMOps 的演进。本图解可视化 LLMOps 全生命周期闭环。

---

## 三者对比

```mermaid
graph TB
    subgraph "DevOps"
        D1["代码"] --> D2["测试"] --> D3["部署"] --> D4["监控"]
    end
    subgraph "MLOps"
        M1["数据+代码"] --> M2["训练+测试"] --> M3["模型服务"] --> M4["漂移监控"]
    end
    subgraph "LLMOps"
        L1["Prompt+模型+Agent"] --> L2["语义测试"] --> L3["多模型路由+灰度"] --> L4["质量+成本+延迟监控"]
    end

    style L1 fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style L4 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 生命周期闭环

```mermaid
graph LR
    DEV["开发<br/>Prompt设计"] --> TEST["测试<br/>语义断言"]
    TEST --> DEPLOY["部署<br/>灰度发布"]
    DEPLOY --> MONITOR["监控<br/>质量/成本/延迟"]
    MONITOR --> OPT["优化<br/>数据飞轮"]
    OPT --> DEV

    style DEV fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style MONITOR fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style OPT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 数据飞轮

```mermaid
graph TB
    USER["用户使用"] --> FEEDBACK["收集反馈"]
    FEEDBACK --> ANALYZE["分析差评"]
    ANALYZE --> DATA["优化数据集"]
    DATA --> PROMPT["调优Prompt"]
    PROMPT --> BETTER["更好的服务"]
    BETTER --> USER

    style FEEDBACK fill:#E3F2FD,stroke:#1565C0
    style DATA fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style BETTER fill:#FFF9C4,stroke:#F9A825
```

---

## 灰度发布阶段

```mermaid
graph LR
    S1["内部测试<br/>0%"] --> S2["1%灰度"] --> S3["5%"] --> S4["25%"] --> S5["50%"] --> S6["全量"]
    S2 -.->|"质量不达标"| S1
    S3 -.->|"质量不达标"| S2

    style S1 fill:#C8E6C9,stroke:#2E7D32
    style S6 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解LLMOps vs MLOps | ☐ |
| Prompt版本管理 | ☐ |
| 模型AB测试 | ☐ |
| 线上质量监控 | ☐ |
| 数据飞轮 | ☐ |
| 灰度发布 | ☐ |
