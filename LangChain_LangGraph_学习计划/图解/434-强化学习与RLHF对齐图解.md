# 强化学习与 RLHF 对齐图解

> SFT→RM→PPO 三阶段让模型对齐人类偏好。本图解可视化 RLHF 全流程和 DPO 简化方案。

---

## RLHF 三阶段

```mermaid
graph LR
    SFT["阶段1: SFT<br/>监督微调<br/>学会基本格式"] --> RM["阶段2: RM<br/>奖励模型<br/>学会评分"]
    RM --> PPO["阶段3: PPO<br/>强化学习<br/>对齐偏好"]

    style SFT fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style RM fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style PPO fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## DPO 简化

```mermaid
graph TB
    subgraph "RLHF"
        S1["SFT"] --> R1["训练奖励模型"] --> P1["PPO 强化学习"]
    end
    subgraph "DPO"
        S2["SFT"] --> D2["直接偏好优化<br/>跳过 RM+PPO"]
    end

    style P1 fill:#FFCCBC,stroke:#D84315
    style D2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 方法对比

| 维度 | RLHF | DPO | ORPO |
|------|------|-----|------|
| 奖励模型 | 需要 | 不需要 | 不需要 |
| 参考模型 | 需要 | 需要 | 不需要 |
| 复杂度 | 高 | 中 | 低 |
| 显存 | 最高 | 中 | 最低 |
| 效果 | 略好 | 接近 | 接近 |

---

## RLHF 副作用

```mermaid
graph TB
    RLHF["RLHF 后"] --> SAFE["✅ 更安全<br/>更礼貌"]
    RLHF --> REJECT["❌ 过度拒绝<br/>无害请求被拒"]
    RLHF --> TEMPL["❌ 模板化<br/>回答千篇一律"]
    RLHF --> LESS_C["❌ 创意下降<br/>过于保守"]

    style SAFE fill:#C8E6C9,stroke:#2E7D32
    style REJECT fill:#FFCCBC,stroke:#D84315
    style TEMPL fill:#FFCCBC,stroke:#D84315
```

---

## 选型决策

```mermaid
graph TB
    Q["有偏好数据?"] --> PAIR{"成对数据?"}
    PAIR -->|"是"| DPO["DPO<br/>推荐"]
    PAIR -->|"只有好/坏"| KTO["KTO"]
    Q --> ONE_STEP{"想一步完成?"}
    ONE_STEP -->|"是"| ORPO["ORPO"]
    Q --> RES{"有充足资源?"}
    RES -->|"是"| RLHF["RLHF"]

    style DPO fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style RLHF fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解RL三阶段 | ☐ |
| 理解PPO原理 | ☐ |
| 理解DPO简化 | ☐ |
| 方法选型 | ☐ |
| 理解RLHF副作用 | ☐ |
| 偏好数据质量 | ☐ |
