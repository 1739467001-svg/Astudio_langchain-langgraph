# Agent 推理链图解

> 用图解理解推理链的模式和实现方式。

---

## 一、直接回答 vs 推理链

```mermaid
graph TB
    subgraph 直接 {"❌ 直接回答"}
        U1["问题"] --> L1["LLM直接回答"]
        L1 --> A1["可能出错"]
    end

    subgraph 推理链 {"✅ 推理链"}
        U2["问题"] --> S1["Step1推理"]
        S1 --> S2["Step2推理"]
        S2 --> S3["Step3推理"]
        S3 --> A2["正确答案"]
    end

    style 直接 fill:'#FFCDD2'
    style 推理链 fill:'#C8E6C9'
```

## 二、四种推理模式

```mermaid
graph TB
    subgraph 四种模式 {"推理链四种模式"}
        M1["1.线性推理<br/>Step→Step→Step→答案"]
        M2["2.树形推理<br/>多分支→评估→选最优"]
        M3["3.自我反思<br/>生成→评价→改进"]
        M4["4.工具增强<br/>推理+工具交替"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#FFF9C4'
    style M4 fill:'#F3E5F5'
```

## 三、线性推理链流程

```mermaid
graph TB
    START([问题]) --> R1["推理Step1"]
    R1 --> R2["推理Step2"]
    R2 --> CHECK{"有结论了?"}
    CHECK -->|"否"| R2
    CHECK -->|"是"| ANSWER([最终答案])
    CHECK -->|"超过5步"| ANSWER

    style CHECK fill:'#FFF9C4'
    style ANSWER fill:'#C8E6C9'
```

## 四、树形推理

```mermaid
graph TB
    Q["问题"] --> T1["思路1"] & T2["思路2"] & T3["思路3"]
    T1 --> E1["评估: 7分"]
    T2 --> E2["评估: 9分 ✓"]
    T3 --> E3["评估: 5分"]
    E2 --> A["基于最优思路生成答案"]

    style E2 fill:'#C8E6C9'
    style E1 fill:'#FFE0B2'
    style E3 fill:'#FFCDD2'
```

## 五、工具增强推理

```mermaid
graph LR
    R1["推理: 需要计算"] --> T1["工具: calculator"]
    T1 --> R2["推理: 继续分析"]
    R2 --> R3["推理: 需要搜索"]
    R3 --> T2["工具: search"]
    T2 --> R4["推理: 信息齐全"]
    R4 --> A["答案 ✅"]

    style R1 fill:'#E3F2FD'
    style T1 fill:'#FFF9C4'
```

## 六、模式选择

```mermaid
graph TD
    Q{"问题类型?"}
    Q -->|"多步逻辑"| LINEAR["线性推理"]
    Q -->|"多种方案"| TOT["树形推理"]
    Q -->|"高质量输出"| REFLECT["自我反思"]
    Q -->|"需要外部数据"| TOOLS["工具增强"]
    Q -->|"简单事实"| DIRECT["直接回答"]

    style LINEAR fill:'#C8E6C9'
```
