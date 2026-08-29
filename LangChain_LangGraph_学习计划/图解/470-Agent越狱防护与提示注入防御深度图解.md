# Agent 越狱防护与提示注入防御深度图解

> 10种越狱+5级防御+输出防护。本图解可视化攻防体系。

---

## 五级防御

```mermaid
graph TB
    INPUT["用户输入"] --> L1["L1 正则规则<br/>关键词匹配<br/>0ms"]
    L1 --> L2["L2 模式匹配<br/>行为模式<br/>0ms"]
    L2 --> L3["L3 小模型分类<br/>GPT-4o-mini<br/>50ms"]
    L3 --> L4["L4 大模型判断<br/>深度分析<br/>500ms"]
    L4 --> L5["L5 间接注入<br/>文档中藏指令<br/>500ms"]
    L5 --> PASS["✅ 通过"]

    L1 -.->|"拦截"| BLOCK["⛔ 拒绝"]
    L2 -.->|"拦截"| BLOCK
    L3 -.->|"拦截"| BLOCK
    L4 -.->|"拦截"| BLOCK
    L5 -.->|"拦截"| BLOCK

    style L1 fill:#C8E6C9,stroke:#2E7D32
    style L3 fill:#FFF9C4,stroke:#F9A825
    style L4 fill:#FFCCBC,stroke:#D84315
    style PASS fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style BLOCK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 攻击类型

| 攻击 | 检测难度 | 严重度 |
|------|---------|--------|
| 直接覆盖 | 低 | 高 |
| 角色扮演 | 中 | 高 |
| 编码绕过 | 中 | 中 |
| 间接注入 | 极高 | 极高 |
| 分段引导 | 高 | 高 |

---

## 输出防护

```mermaid
graph TB
    OUTPUT["Agent输出"] --> CHECK1{"系统提示泄露?"}
    CHECK1 -->|"否"| CHECK2{"PII泄露?"}
    CHECK2 -->|"否"| CHECK3{"有害内容?"}
    CHECK3 -->|"否"| CHECK4{"越权操作?"}
    CHECK4 -->|"否"| SAFE["✅ 安全输出"]
    CHECK1 -->|"是"| MASK["脱敏/拒绝"]
    CHECK2 -->|"是"| MASK
    CHECK3 -->|"是"| MASK

    style SAFE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style MASK fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 10种越狱模式 | ☐ |
| 5级防御体系 | ☐ |
| 间接注入检测 | ☐ |
| 输出防护 | ☐ |
| 正则规则库 | ☐ |
| 模型分类器 | ☐ |
