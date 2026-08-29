# 多 Agent 架构图解

> 理解多 Agent 系统的协作模式、通信方式和编排策略。

---

## 一、为什么需要多 Agent

```mermaid
graph TB
    subgraph 单Agent ["单 Agent 问题"]
        S1["一个Agent做所有事<br/>Prompt越来越长"]
        S2["工具越来越多<br/>LLM选择困难"]
        S3["角色不清晰<br/>既当研究员又当写手"]
    end

    subgraph 多Agent ["多 Agent 优势"]
        M1["每个Agent专注一个角色<br/>Prompt简洁高效"]
        M2["工具按角色分配<br/>LLM选择更准确"]
        M3["可独立调试<br/>可并行执行"]
    end

    单Agent -.->|"演化为"| 多Agent

    style 单Agent fill:#FFCDD2
    style 多Agent fill:#C8E6C9
```

## 二、四种经典架构模式

### 模式一：串联式（流水线）

```mermaid
graph LR
    U([用户输入]) --> A1["🔬 研究员Agent<br/>收集资料"]
    A1 --> A2["✍️ 写手Agent<br/>撰写报告"]
    A2 --> A3["📝 审稿人Agent<br/>审查质量"]
    A3 --> O([最终输出])

    style U fill:#4CAF50,color:#fff
    style O fill:#4CAF50,color:#fff
    style A1 fill:#E3F2FD
    style A2 fill:#FFF3E0
    style A3 fill:#F3E5F5
```

特点：顺序执行，前一个的输出是后一个的输入

### 模式二：路由式（分发器）

```mermaid
graph TB
    U([用户输入]) --> R&#123;"路由器Agent<br/>判断问题类型"&#125;
    R -->|"技术问题"| A1["技术支持Agent"]
    R -->|"账单问题"| A2["财务Agent"]
    R -->|"一般咨询"| A3["客服Agent"]
    R -->|"投诉"| A4["投诉处理Agent"]
    A1 --> O([输出])
    A2 --> O
    A3 --> O
    A4 --> O

    style U fill:#4CAF50,color:#fff
    style O fill:#4CAF50,color:#fff
    style R fill:#FFF9C4
```

特点：根据输入类型分派给不同专家 Agent

### 模式三：协作式（互相交流）

```mermaid
graph TB
    subgraph 协作循环
        A1["🎯 规划Agent<br/>制定计划"] --> A2["💻 编码Agent<br/>写代码"]
        A2 --> A3["🧪 测试Agent<br/>找Bug"]
        A3 -->|"有Bug"| A2
        A3 -->|"通过"| A4["📦 部署Agent<br/>上线"]
        A4 --> DONE([完成])
    end

    style DONE fill:#4CAF50,color:#fff
    style A1 fill:#E3F2FD
    style A2 fill:#FFF3E0
    style A3 fill:#F3E5F5
    style A4 fill:#C8E6C9
```

特点：Agent 之间可以反复交流，形成协作循环

### 模式四：Supervisor 模式（层级调度）

```mermaid
graph TB
    U([用户输入]) --> SUP["👔 Supervisor<br/>主控Agent<br/>决定下一步交给谁"]

    SUP -->|"任务1: 搜索资料"| W1["🔍 研究Agent"]
    W1 --> SUP
    SUP -->|"任务2: 写初稿"| W2["✍️ 写作Agent"]
    W2 --> SUP
    SUP -->|"任务3: 审查质量"| W3["📝 审稿Agent"]
    W3 --> SUP
    SUP -->|"所有任务完成"| O([最终输出])

    style U fill:#4CAF50,color:#fff
    style O fill:#4CAF50,color:#fff
    style SUP fill:#FFE0B2
    style W1 fill:#E3F2FD
    style W2 fill:#E3F2FD
    style W3 fill:#E3F2FD
```

特点：主控 Agent 动态调度子 Agent，子 Agent 完成后回到主控

## 三、Agent 通信方式

```mermaid
graph TB
    subgraph 方式一 ["方式一：共享 State"]
        S["State<br/>&#123;messages: [...], <br/>research: '...', <br/>draft: '...'&#125;"]
        A1["Agent A"] -->|写入| S
        A2["Agent B"] -->|读取| S
        A3["Agent C"] -->|读取+写入| S
    end

    subgraph 方式二 ["方式二：消息传递"]
        A_B["Agent A"] -->|"AIMessage"| A_C["Agent B"]
        A_C -->|"AIMessage"| A_D["Agent C"]
    end

    subgraph 方式三 ["方式三：Supervisor 转发"]
        SUP2["Supervisor"]
        SUB1["Agent A"] -->|结果| SUP2
        SUP2 -->|转发结果| SUB2["Agent B"]
    end

    style 方式一 fill:#E3F2FD
    style 方式二 fill:#FFF3E0
    style 方式三 fill:#F3E5F5
```

## 四、完整示例：研究-写作-审稿系统

```mermaid
graph TB
    START([用户: '写一篇关于AI的报告']) --> INIT

    subgraph 状态初始化
        INIT["State:<br/>&#123;topic: 'AI', research: '',<br/>draft: '', review: '',<br/>revision_count: 0&#125;"]
    end

    INIT --> R

    subgraph 研究阶段
        R["🔬 研究Agent<br/>收集AI相关要点"]
        R --> R_OUT["State更新:<br/>&#123;research: 'AI的3个要点...'&#125;"]
    end

    R_OUT --> W

    subgraph 写作阶段
        W["✍️ 写作Agent<br/>基于research写报告"]
        W --> W_OUT["State更新:<br/>&#123;draft: '报告内容...',<br/>revision_count: +1&#125;"]
    end

    W_OUT --> RV

    subgraph 审稿阶段
        RV["📝 审稿Agent<br/>审查报告质量"]
        RV --> RV_OUT["State更新:<br/>&#123;review: 'APPROVED' or 'NEEDS_REVISION'&#125;"]
    end

    RV_OUT --> DECISION&#123;"审查通过?"&#125;

    DECISION -->|"NEEDS_REVISION<br/>且 revision_count < 3"| W
    DECISION -->|"APPROVED"| F

    subgraph 定稿阶段
        F["📦 定稿Agent<br/>输出最终报告"]
    end

    F --> END([完成])
    DECISION -->|"超过最大修改次数"| F

    style START fill:#4CAF50,color:#fff
    style END fill:#4CAF50,color:#fff
    style R fill:#E3F2FD
    style W fill:#FFF3E0
    style RV fill:#F3E5F5
    style F fill:#C8E6C9
    style DECISION fill:#FFF9C4
```

## 五、Supervisor 调度详解

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as Supervisor
    participant R as 研究Agent
    participant W as 写作Agent
    participant RV as 审稿Agent

    U->>S: "写一篇AI报告"
    Note over S: 分析任务<br/>决定先交给研究员

    S->>R: "研究AI的要点"
    R-->>S: "找到5个关键要点"
    Note over S: 收到研究结果<br/>决定交给写手

    S->>W: "基于这些要点写报告"
    Note over W: 接收research + instruction
    W-->>S: "报告初稿完成"
    Note over S: 收到初稿<br/>决定交给审稿人

    S->>RV: "审查这份报告"
    RV-->>S: "质量不达标，建议修改第2段"
    Note over S: 审稿未通过<br/>决定让写手修改

    S->>W: "修改第2段"
    W-->>S: "修改完成"
    Note over S: 再次交给审稿人

    S->>RV: "重新审查"
    RV-->>S: "APPROVED"

    S-->>U: "报告已完成"
```

## 六、子图组织复杂系统

```mermaid
graph TB
    subgraph 主图
        START([START]) --> RSG["研究子图"]
        RSG --> WSG["写作子图"]
        WSG --> END([END])
    end

    subgraph 研究子图 ["研究子图（内部结构）"]
        RS["搜索"] --> RO["整理"]
        RO --> RV2["验证"]
    end

    subgraph 写作子图 ["写作子图（内部结构）"]
        WD["写初稿"] --> WR2["润色"]
        WR2 --> WC["字数检查"]
    end

    style START fill:#4CAF50,color:#fff
    style END fill:#4CAF50,color:#fff
    style RSG fill:#E3F2FD
    style WSG fill:#FFF3E0
    style 研究子图 fill:#E3F2FD,stroke:#1565C0
    style 写作子图 fill:#FFF3E0,stroke:#E65100
```

## 七、模式选择决策

```mermaid
graph TD
    Q1&#123;"任务类型?"&#125;
    Q1 -->|"固定步骤、顺序执行"| S1["串联式"]
    Q1 -->|"不同类型的问题"| S2["路由式"]
    Q1 -->|"需要反复修改优化"| S3["协作式"]
    Q1 -->|"步骤不确定、需动态调度"| S4["Supervisor模式"]

    Q2&#123;"Agent数量?"&#125;
    Q2 -->|"2-3个"| S1 & S3
    Q2 -->|"4个以上"| S2 & S4

    Q3&#123;"是否需要并行?"&#125;
    Q3 -->|"是"| P1["用并行边<br/>多个Agent同时工作"]
    Q3 -->|"否"| P2["用串联边<br/>顺序执行"]

    style S1 fill:#E3F2FD
    style S2 fill:#FFF9C4
    style S3 fill:#FFE0B2
    style S4 fill:#F3E5F5
```

## 八、多 Agent 通信数据流

```mermaid
graph TB
    subgraph Agent间消息流转
        U["用户消息"] --> AG1["Agent A<br/>(规划)"]
        AG1 -->|"'我已经规划好了<br/>方案1...' "| AG2["Agent B<br/>(执行)"]
        AG2 -->|"'执行完成<br/>结果如下...' "| AG3["Agent C<br/>(验证)"]
        AG3 -->|"'发现2个问题<br/>需要修改...' "| AG2
        AG3 -->|"'验证通过'"| O["最终输出"]
    end

    subgraph State变化
        S1["初始State:<br/>&#123;messages: [用户消息]&#125;"]
        S2["Agent A后:<br/>&#123;messages: [用户, AI-A]&#125;"]
        S3["Agent B后:<br/>&#123;messages: [用户, AI-A, AI-B]&#125;"]
        S4["Agent C后:<br/>&#123;messages: [用户, AI-A, AI-B, AI-C]&#125;"]
        S5["循环后:<br/>&#123;messages: [用户, AI-A, AI-B,<br/>AI-C, AI-B', AI-C']&#125;"]

        S1 --> S2 --> S3 --> S4
        S4 --> S5
    end

    style U fill:#E3F2FD
    style O fill:#C8E6C9
    style S1 fill:#FFF9C4
    style S5 fill:#FFE0B2
```
