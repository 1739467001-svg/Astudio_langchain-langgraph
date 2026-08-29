# LangGraph 测试图解

> 用图解理解 LangGraph 工作流的三层测试策略。

---

## 一、三层测试

```mermaid
graph TB
    subgraph 三层 {"LangGraph 三层测试"}
        L1["Layer 1: 节点单元测试<br/>测试单个节点函数<br/>Mock LLM<br/>✅ 快 ✅ 不消耗Token"]
        L2["Layer 2: 路由测试<br/>测试条件边返回值<br/>✅ 快 ✅ 不消耗Token"]
        L3["Layer 3: 端到端测试<br/>测试完整工作流<br/>真实LLM<br/>⚠️ 慢 ⚠️ 消耗Token"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L3 fill:'#F3E5F5'
```

## 二、节点单元测试

```mermaid
graph LR
    subgraph 单元测试 {"节点单元测试"}
        S1["Mock LLM<br/>(返回固定结果)"] --> N1["被测节点"]
        N1 --> R1["断言输出<br/>(内容/类型/字段)"]
    end

    style S1 fill:'#FFF9C4'
    style R1 fill:'#C8E6C9'
```

## 三、路由测试

```mermaid
graph TB
    subgraph 路由测试 {"条件边路由测试"}
        T1["输入: query_type='tech'"] --> R1{"route_by_type()"}
        R1 -->|"返回'tech_agent'"| A1["✅ 正确"]
        T2["输入: query_type='chat'"] --> R1
        R1 -->|"返回'chat_agent'"| A2["✅ 正确"]
        T3["输入: retry_count=3"] --> R2{"should_retry()"}
        R2 -->|"返回'done'"| A3["✅ 超限停止"]
    end

    style 路由测试 fill:'#E3F2FD'
```

## 四、端到端测试

```mermaid
graph LR
    subgraph E2E {"端到端测试"}
        I["完整输入State"] --> APP["编译后的图"]
        APP --> O["完整输出State"]
        O --> AS["断言:<br/>所有字段有值<br/>answer非空<br/>无错误"]
    end

    style E2E fill:'#F3E5F5'
```

## 五、CI 集成

```mermaid
graph LR
    subgraph CI流程 {"CI 中的测试分层"}
        PUSH["代码提交"] --> U["单元测试(-m unit)<br/>节点+路由+State<br/>秒级 ✅"]
        U --> PR["创建PR"]
        PR --> E["端到端测试(-m llm)<br/>真实LLM<br/>分钟级 ⚠️"]
        E --> MERGE["允许合并 ✅"]
    end

    style U fill:'#C8E6C9'
    style E fill:'#FFF9C4'
```
