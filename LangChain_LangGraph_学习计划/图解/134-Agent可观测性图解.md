# Agent 可观测性图解

> 用图解理解推理链追踪、工具决策审计和循环检测。

---

## 一、Agent特有可观测性

```mermaid
graph TB
    subgraph 特有 {"Agent特有"}
        A1["推理链追踪"]
        A2["工具决策审计"]
        A3["状态变化记录"]
        A4["循环检测"]
        A5["多Agent通信"]
    end

    style 特有 fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 二、推理链追踪

```mermaid
graph TB
    S1["Thought: 需搜索<br/>Action: search('RAG')<br/>Observation: 结果"]
    S2["Thought: 需总结<br/>Action: summarize()<br/>Observation: 总结"]
    S3["Thought: 可回答<br/>Final: 答案"]
    S1 --> S2 --> S3

    style S1 fill:#E3F2FD
    style S2 fill:#FFF9C4
    style S3 fill:#C8E6C9
```

---

## 三、循环检测

```mermaid
graph TB
    subgraph 重复 {"重复行动检测"}
        R1["步骤N: search('X')"]
        R2["步骤N+1: search('X')"]
        R3["步骤N+2: search('X')"]
        R1 & R2 & R3 --> ALERT["⚠️ 循环!"]
    end

    style ALERT fill:#FFCDD2
```

---

## 四、工具决策审计

```mermaid
graph TB
    D["决策记录:<br/>可用工具[search,calc,write]<br/>选了: search<br/>原因: 需要信息<br/>置信度: 0.8"]
    D --> ANALYZE["分析: 工具选择模式<br/>低置信度步骤标记"]

    style D fill:#FFF9C4
```

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有推理链追踪 | ☐ |
| 有循环检测 | ☐ |
| 有工具决策审计 | ☐ |
| 有状态变化追踪 | ☐ |
