# LangSmith 可观测性图解

> 用图解方式理解 LangSmith 的追踪、评估和监控能力。

---

## 一、LangSmith 在开发流程中的位置

```mermaid
graph LR
    subgraph 开发流程
        DEV["开发<br/>写Chain/Agent"] --> DEPLOY["部署<br/>上线运行"]
        DEPLOY --> MONITOR["监控<br/>持续观测"]
        MONITOR --> ITERATE["迭代<br/>优化改进"]
        ITERATE --> DEV
    end

    subgraph LangSmith ["LangSmith 覆盖"]
        LS1["🔍 追踪调试"]
        LS2["📊 评估对比"]
        LS3["📈 生产监控"]
        LS4["🧪 A/B测试"]
    end

    DEV -.-> LS1
    ITERATE -.-> LS2
    DEPLOY -.-> LS3
    MONITOR -.-> LS4

    style LangSmith fill:#E3F2FD,stroke:#1565C0
    style 开发流程 fill:#C8E6C9,stroke:#2E7D32
```

## 二、Trace 追踪层级

```mermaid
graph TB
    subgraph Trace结构 ["一次 Chain 调用的 Trace 结构"]
        ROOT["Root Run<br/>chain.invoke()<br/>总耗时: 3.2s<br/>总Token: 1850"]
        ROOT --> R1["Run: PromptTemplate<br/>类型: prompt<br/>耗时: 1ms<br/>输入: dict<br/>输出: ChatPromptValue"]
        ROOT --> R2["Run: ChatOpenAI<br/>类型: llm<br/>耗时: 2.8s<br/>输入: ChatPromptValue<br/>输出: AIMessage<br/>Token: 1850"]
        ROOT --> R3["Run: StrOutputParser<br/>类型: output_parser<br/>耗时: 0.5ms<br/>输入: AIMessage<br/>输出: str"]
    end

    style ROOT fill:#E3F2FD,stroke-width:3px
    style R2 fill:#FFE0B2
```

### LangGraph 的 Trace

```mermaid
graph TB
    subgraph LangGraph Trace ["LangGraph 调用的 Trace"]
        ROOT["Root: app.invoke()"]
        ROOT --> N1["Node: classify<br/>耗时: 0.8s<br/>输出: query_type='tech'"]
        N1 --> N2["Node: tech_agent<br/>耗时: 2.3s"]
        N2 --> LLM_CALL["LLM Call (ChatOpenAI)<br/>耗时: 2.1s<br/>Token: 1200<br/>输入: 系统提示+用户问题<br/>输出: 工具调用结果"]
        N2 --> TOOL_CALL["Tool Call (search_faq)<br/>耗时: 0.2s<br/>输出: FAQ结果"]
        N1 -.->|"条件路由"| N2
    end

    style ROOT fill:#E3F2FD,stroke-width:3px
    style LLM_CALL fill:#FFE0B2
    style TOOL_CALL fill:#F3E5F5
```

## 三、评估工作流

```mermaid
graph TB
    subgraph 评估流程 ["LangSmith 评估完整流程"]
        S1["1. 创建数据集<br/>手动准备或从Trace导入<br/>20-50个问答对"]
        S2["2. 运行应用<br/>对数据集中每个问题<br/>执行Chain/Agent"]
        S3["3. 评估器打分<br/>规则/LLM/人工<br/>对每个回答评分"]
        S4["4. 查看报告<br/>总体分数<br/>每个用例详情"]
        S5["5. 对比版本<br/>A/B测试<br/>看哪个版本更好"]
    end

    S1 --> S2 --> S3 --> S4 --> S5

    style S1 fill:#E3F2FD
    style S2 fill:#FFF9C4
    style S3 fill:#FFE0B2
    style S4 fill:#C8E6C9
    style S5 fill:#F3E5F5
```

### 从生产 Trace 创建测试用例

```mermaid
graph LR
    subgraph Trace转数据集
        T["生产环境Trace<br/>用户实际问题和模型回答"] --> REVIEW["人工审查<br/>这个案例好不好?"]
        REVIEW -->|"好"| DATASET["加入数据集<br/>作为回归测试用例"]
        REVIEW -->|"不好"| FIX["修改期望答案<br/>再加入数据集"]
        REVIEW -->|"差"| DISCARD["丢弃"]

        T --> BAD["发现模型回答差<br/>标注问题"] --> DATASET2["加入数据集<br/>标注期望的更好回答"]
    end

    style DATASET fill:#C8E6C9
    style DATASET2 fill:#FFF9C4
    style DISCARD fill:#FFCDD2
```

## 四、监控面板

```mermaid
graph TB
    subgraph 监控指标 ["LangSmith 生产监控面板"]
        M1["调用统计<br/>总次数/日<br/>QPS<br/>趋势图"]
        M2["延迟分布<br/>P50: 1.2s<br/>P95: 3.5s<br/>P99: 5.8s"]
        M3["Token消耗<br/>日总量<br/>按模型分布<br/>按功能分布"]
        M4["错误率<br/>总错误率: 2.1%<br/>按错误类型:<br/>超时/限流/格式"]
        M5["成本<br/>日成本估算<br/>月累计<br/>预算告警"]
    end

    style M1 fill:#E3F2FD
    style M2 fill:#FFF9C4
    style M3 fill:#FFE0B2
    style M4 fill:#FFCDD2
    style M5 fill:#F3E5F5
```

## 五、A/B 测试流程

```mermaid
graph TB
    subgraph AB测试 ["LangSmith A/B 测试"]
        DS["共享数据集<br/>(同一批测试问题)"]
        DS --> A["版本A<br/>Prompt V1<br/>temperature=0"]
        DS --> B["版本B<br/>Prompt V2<br/>temperature=0.3"]

        A --> EA["评估A<br/>准确性: 85%<br/>延迟: 2.1s<br/>Token: 1200"]
        B --> EB["评估B<br/>准确性: 91%<br/>延迟: 2.5s<br/>Token: 1500"]

        EA --> COMPARE["对比报告"]
        EB --> COMPARE

        COMPARE --> DECISION&#123;"B更准确但更慢更贵<br/>选哪个?"&#125;
        DECISION -->|"准确性优先"| CHOOSE_B["选B"]
        DECISION -->|"成本优先"| CHOOSE_A["选A"]
    end

    style DS fill:#E3F2FD
    style EA fill:#C8E6C9
    style EB fill:#C8E6C9
    style COMPARE fill:#FFF9C4
```

## 六、自定义元数据与标签

```mermaid
graph TB
    subgraph 元数据体系 ["通过元数据组织追踪"]
        T1["按功能分组<br/>tag: 'chat' / 'rag' / 'agent'"]
        T2["按环境分组<br/>tag: 'dev' / 'staging' / 'prod'"]
        T3["按版本分组<br/>tag: 'v1.0' / 'v1.1'"]
        T4["按用户分组<br/>metadata: &#123;user_id: 'xxx'&#125;"]
    end

    T1 --> FILTER["在LangSmith界面<br/>按tag/metadata筛选<br/>快速定位问题"]

    style FILTER fill:#C8E6C9
```

```python
# 生产环境中的元数据标记
response = chain.invoke(
    &#123;"input": "用户问题"&#125;,
    config=&#123;
        "tags": ["prod", "rag", "v2.1"],
        "metadata": &#123;
            "user_id": "user_12345",
            "session_id": "sess_abc",
            "feature": "knowledge_base_qa",
            "model": "gpt-4o-mini",
        &#125;
    &#125;
)

# 在 LangSmith 中可以：
# 1. 按 tag="prod" 筛选所有生产调用
# 2. 按 metadata.user_id 筛选特定用户
# 3. 按 tag="v2.1" 对比版本
```
