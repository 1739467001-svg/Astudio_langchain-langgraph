# Agent 协商与共识机制图解

> 多 Agent 意见分歧时，通过协商讨论、加权投票或仲裁者裁决达成共识。

---

```mermaid
graph TB
    Q["用户问题"] --> A1["技术Agent<br/>买入(75%)"]
    Q --> A2["基本面Agent<br/>卖出(80%)"]
    Q --> A3["情绪Agent<br/>持有(60%)"]
    
    A1 --> NEG&#123;"一致?"&#125;
    A2 --> NEG
    A3 --> NEG
    NEG -->|否| DISC["第1轮协商<br/>各Agent看其他意见后重新评估"]
    DISC --> NEG2&#123;"一致?"&#125;
    NEG2 -->|否| DISC2["第2轮协商"]
    NEG2 -->|是| DONE["达成共识"]
    DISC2 --> NEG3&#123;"一致?"&#125;
    NEG3 -->|否| VOTE["加权投票<br/>按置信度加权"]
    NEG3 -->|是| DONE
    VOTE --> ARB&#123;"僵局?"&#125;
    ARB -->|是| ARBIT["仲裁者裁决"]
    ARB -->|否| DONE

    style NEG fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style VOTE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style ARBIT fill:#FFCDD2,stroke:#C62828
    style DONE fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
```

---

## 协商方式对比

| 方式 | 速度 | 质量 | 适用 |
|------|------|------|------|
| 一致同意 | 快 | 高 | 意见一致时 |
| 加权投票 | 快 | 中 | 专业度不同 |
| 多轮协商 | 慢 | 高 | 复杂分歧 |
| 仲裁者 | 中 | 取决于仲裁者 | 协商失败 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有多轮讨论 | ☐ |
| 有加权投票 | ☐ |
| 有仲裁者 | ☐ |
| 有僵局检测 | ☐ |
