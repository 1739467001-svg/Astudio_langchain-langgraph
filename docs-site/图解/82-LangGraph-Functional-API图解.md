# LangGraph Functional API 图解

> 用图解理解 Functional API 的两个核心装饰器、控制流模式、与 StateGraph 的选型决策。

---

## 一、两种编程范式

```mermaid
graph TB
    subgraph StateGraph &#123;"StateGraph 声明式"&#125;
        SG1["定义State"] --> SG2["写Node函数"]
        SG2 --> SG3["add_node注册"]
        SG3 --> SG4["add_edge/add_conditional_edges"]
        SG4 --> SG5["compile()"]
        SG5 --> SG6["invoke()"]
    end

    subgraph Functional &#123;"Functional API 函数式"&#125;
        F1["@task装饰子任务"] --> F2["@entrypoint装饰入口"]
        F2 --> F3["入口内编排<br/>if/else/for/while"]
        F3 --> F4["自动管理检查点"]
        F4 --> F5["invoke()"]
    end

    style StateGraph fill:#E3F2FD,stroke:#1565C0
    style Functional fill:#FFF3E0,stroke:#E65100
```

---

## 二、核心装饰器

```mermaid
graph TB
    subgraph 核心 &#123;"两个核心装饰器"&#125;
        EP["@entrypoint<br/>流程入口<br/>= StateGraph的编译图"]
        TK["@task<br/>可检查点子任务<br/>= StateGraph的Node"]
    end

    EP --> E1["入口函数内编排<br/>所有task调用顺序"]
    TK --> T1["task可被入口或其他task调用"]
    TK --> T2["task执行自动持久化<br/>中断后可恢复"]

    style 核心 fill:#E3F2FD
    style EP fill:#1565C0,color:#fff
    style TK fill:#E65100,color:#fff
```

---

## 三、调用模式：task返回future

```mermaid
graph LR
    subgraph 调用模式 &#123;"task调用模式（重要！）"&#125;
        S1["task函数调用<br/>返回future（不阻塞）"] --> S2["await future<br/>获取实际执行结果"]
    end

    subgraph 示例 &#123;"代码示例"&#125;
        C1["data = await (await fetch_data(query))<br/>     ↑ await获取实际值<br/>  ↑ await触发执行"]
    end

    style 调用模式 fill:#FFF9C4
    style 示例 fill:#E3F2FD
```

---

## 四、条件分支

```mermaid
graph TB
    START["入口"] --> CLASSIFY["分类task"]
    CLASSIFY -->|简单| SIMPLE["simple_answer task"]
    CLASSIFY -->|复杂| COMPLEX["complex_reasoning task"]
    SIMPLE --> END["返回"]
    COMPLEX --> END

    subgraph 代码 &#123;"Python代码天然支持"&#125;
        C1["complexity = await classify()<br/>if complexity == 'simple':<br/>    result = await simple()<br/>else:<br/>    result = await complex()"]
    end

    style CLASSIFY fill:#FFF9C4
    style 代码 fill:#E3F2FD
```

---

## 五、循环重试

```mermaid
graph TB
    START["入口"] --> GEN["生成task"]
    GEN --> CHECK&#123;"质量检查task"&#125;
    CHECK -->|通过| END["返回"]
    CHECK -->|不通过| FIX["收集反馈"]
    FIX --> GEN
    CHECK -->|超过3次| FAIL["返回最终结果"]

    subgraph 代码 &#123;"用for循环实现"&#125;
        C1["for attempt in range(max_retries):<br/>    answer = await generate(query, feedback)<br/>    if quality_check(answer):<br/>        return answer<br/>    feedback = get_feedback(answer)"]
    end

    style CHECK fill:#FFF9C4
    style GEN fill:#E3F2FD
    style FIX fill:#FFCDD2
```

---

## 六、并行执行

```mermaid
graph TB
    START["入口"] --> A["search_web task"]
    START --> B["search_kb task"]
    START --> C["translate task"]
    A --> WAIT["await全部完成"]
    B --> WAIT
    C --> WAIT
    WAIT --> MERGE["merge_results task"]
    MERGE --> END["返回"]

    subgraph 要点 &#123;"并行要点"&#125;
        P1["1. 不await直接调用task<br/>获取所有future"]
        P2["2. 分别await获取结果<br/>自动并行执行"]
    end

    style WAIT fill:#FFF9C4
    style MERGE fill:#C8E6C9
    style 要点 fill:#E3F2FD
```

---

## 七、人机交互 interrupt

```mermaid
graph TB
    START["入口"] --> GEN["生成草稿"]
    GEN --> INT["interrupt()<br/>暂停等待人工输入"]
    INT -->|approve| SEND["发送"]
    INT -->|edit| EDIT["使用修改后内容<br/>发送"]
    INT -->|reject| END1["返回拒绝"]
    SEND --> END2["返回成功"]
    EDIT --> END2

    subgraph 恢复 &#123;"恢复执行"&#125;
        R1["调用方收到interrupt<br/>展示给用户"]
        R2["用户决定后<br/>invoke(Command(resume=决策))"]
        R3["从断点继续执行"]
    end

    style INT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style 恢复 fill:#E3F2FD
```

---

## 八、检查点持久化

```mermaid
graph TB
    subgraph 执行 &#123;"带检查点的执行流程"&#125;
        E1["invoke开始"] --> E2["执行task1"]
        E2 --> E3["✅ 持久化到checkpointer"]
        E3 --> E4["执行task2"]
        E4 --> E5["✅ 持久化"]
        E5 --> E6["执行task3"]
        E6 -->|中断| E7["状态已保存"]
        E7 --> E8["恢复时从task3继续<br/>task1和task2不重复执行"]
    end

    style E3 fill:#FFF9C4
    style E5 fill:#FFF9C4
    style E8 fill:#C8E6C9
```

---

## 九、StateGraph vs Functional 选型

```mermaid
graph TB
    Q["选择范式"] --> Q1&#123;"需要可视化<br/>拓扑图？"&#125;
    Q1 -->|是| SG["StateGraph"]
    Q1 -->|否| Q2&#123;"复杂if/else<br/>分支多？"&#125;
    Q2 -->|是| FA["Functional API"]
    Q2 -->|否| Q3&#123;"多Agent协作<br/>需消息传递？"&#125;
    Q3 -->|是| SG
    Q3 -->|否| Q4&#123;"需要运行时<br/>动态改拓扑？"&#125;
    Q4 -->|是| FA
    Q4 -->|否| Q5&#123;"快速原型<br/>开发？"&#125;
    Q5 -->|是| FA
    Q5 -->|否| SG

    style SG fill:#E3F2FD,stroke:#1565C0
    style FA fill:#FFF3E0,stroke:#E65100
```

---

## 十、混合使用

```mermaid
graph TB
    subgraph 混合 &#123;"Functional API + StateGraph子图"&#125;
        EP["@entrypoint入口"] --> CALL["调用编译好的<br/>StateGraph子图"]
        CALL --> CONT["继续编排"]
        CONT --> END["返回"]
    end

    subgraph 优势 &#123;"混合优势"&#125;
        A1["复杂拓扑用StateGraph<br/>可可视化"]
        A2["编排逻辑用Functional<br/>代码灵活"]
        A3["两者通过compile()衔接"]
    end

    style 混合 fill:#E3F2FD
    style 优势 fill:#FFF9C4
```

---

## 十一、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 @entrypoint 和 @task 作用 | ☐ |
| 知道 task 返回 future 需两次 await | ☐ |
| 能用 if/else 实现条件分支 | ☐ |
| 能用 for 循环实现重试 | ☐ |
| 能并行启动多个 task | ☐ |
| 理解 interrupt 人机交互 | ☐ |
| 知道何时选 Functional vs StateGraph | ☐ |
