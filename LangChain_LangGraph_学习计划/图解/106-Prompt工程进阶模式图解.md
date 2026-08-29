# Prompt 工程进阶模式图解

> 用图解理解 6 种进阶 Prompt 模式的原理、流程和选型。

---

## 一、6种模式总览

```mermaid
graph TB
    ROOT["Prompt进阶"] --> M1["Zero-Shot CoT<br/>加'一步步思考'"]
    ROOT --> M2["Few-Shot CoT<br/>给推理示例"]
    ROOT --> M3["Self-Consistency<br/>多次采样投票"]
    ROOT --> M4["Tree of Thoughts<br/>树搜索"]
    ROOT --> M5["Chain-of-Verification<br/>自我验证"]
    ROOT --> M6["Decomposition<br/>问题分解"]

    style ROOT fill:#1565C0,color:#fff
    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、CoT对比

```mermaid
graph TB
    subgraph 普通 {"普通Prompt"}
        N["问题→直接猜答案<br/>可能跳过推理"]
    end

    subgraph CoT {"CoT Prompt"}
        C["问题+'一步步思考'<br/>→逐步推理→答案<br/>准确率+15-25%"]
    end

    style 普通 fill:#FFCDD2
    style CoT fill:#C8E6C9
```

---

## 三、Self-Consistency

```mermaid
graph TB
    Q["问题"] --> S1["采样1<br/>temp=0.7→答案A"]
    Q --> S2["采样2<br/>temp=0.7→答案B"]
    Q --> S3["采样3<br/>temp=0.7→答案A"]
    Q --> S4["采样4<br/>temp=0.7→答案A"]
    S1 & S2 & S3 & S4 --> VOTE["多数投票"]
    VOTE --> FINAL["答案A(3票)"]

    style VOTE fill:#FFF9C4
    style FINAL fill:#C8E6C9
```

---

## 四、Tree of Thoughts

```mermaid
graph TB
    Q["问题"] --> T1["思路1"] --> E1["评估"]
    Q --> T2["思路2"] --> E2["评估"]
    Q --> T3["思路3"] --> E3["评估"]
    E1 -->|好| C1["继续展开→解法1"]
    E2 -->|好| C2["继续展开→解法2"]
    E3 -->|差| SKIP["剪枝"]
    C1 & C2 --> BEST["选最优"]

    style E1 fill:#FFF9C4
    style BEST fill:#C8E6C9
    style SKIP fill:#FFCDD2
```

---

## 五、Chain-of-Verification

```mermaid
graph TB
    Q["问题"] --> DRAFT["生成初始答案"]
    DRAFT --> VERIFY["生成验证问题"]
    VERIFY --> CHECK["逐一验证"]
    CHECK --> OK{"一致？"}
    OK -->|是| FINAL["输出"]
    OK -->|否| REVISE["修正→输出"]

    style VERIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style FINAL fill:#C8E6C9
    style REVISE fill:#FFCDD2
```

---

## 六、选型决策

```mermaid
graph TB
    Q1["数学/逻辑推理？"] -->|是| Q2["需高准确率？"]
    Q2 -->|是| SC["Self-Consistency"]
    Q2 -->|否| COT["Zero-Shot CoT"]
    Q1 -->|否| Q3["问题复杂多步？"]
    Q3 -->|是| DEC["Decomposition"]
    Q3 -->|否| Q4["需验证？"]
    Q4 -->|是| COV["Chain-of-Verification"]
    Q4 -->|否| FS["Few-Shot CoT"]

    style COT fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 七、效果对比

| 模式 | LLM调用 | 准确率提升 | 成本 |
|------|---------|-----------|------|
| Zero-Shot CoT | 1次 | +15-25% | 低 |
| Few-Shot CoT | 1次 | +20-30% | 低 |
| Self-Consistency | N次 | +25-40% | 高 |
| Tree of Thoughts | 多次 | +30-50% | 高 |
| Chain-of-Verification | 3次 | +15-25% | 中 |
| Decomposition | 多次 | +20-30% | 中 |

---

## 八、检查清单

| 检查项 | 状态 |
|--------|------|
| 理解6种模式 | ☐ |
| 会用CoT触发词 | ☐ |
| 实现了Self-Consistency | ☐ |
| 理解ToT | ☐ |
| 能选模式 | ☐ |
