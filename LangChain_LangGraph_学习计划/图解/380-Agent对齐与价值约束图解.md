# Agent 对齐与价值约束图解

> 通过输入护栏 → 价值约束 → 输出护栏三层防线，确保 Agent 行为符合人类意图和安全边界。

---

```mermaid
graph TB
    U["用户输入"] --> IG["输入护栏<br/>注入检测 + 关键词过滤"]
    IG -->|安全| PLAN["Agent 规划<br/>决定操作"]
    IG -->|危险| BLOCK1["拦截"]
    
    PLAN --> CC{"价值约束检查"}
    CC -->|BLOCK 级| BLOCK2["硬性拦截"]
    CC -->|APPROVAL 级| APPROVAL["⏸️ 人工审批"]
    CC -->|通过| EXEC["执行操作"]
    
    APPROVAL -->|批准| EXEC
    APPROVAL -->|拒绝| BLOCK3["取消"]
    
    EXEC --> OG["输出护栏<br/>敏感信息过滤"]
    OG -->|安全| RESP["返回结果"]
    OG -->|不安全| FILTER["过滤后返回"]

    style IG fill:#FFCDD2,stroke:#C62828,stroke-width:2px
    style CC fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OG fill:#FFCDD2,stroke:#C62828,stroke-width:2px
    style EXEC fill:#E8F5E9,stroke:#2E7D32
```

---

## 对齐三个层次

| 层次 | 目标 | 示例 |
|------|------|------|
| 意图对齐 | 理解用户真正想要什么 | "删测试数据"→删开发环境不是生产 |
| 行为对齐 | 行动符合预期 | DELETE WHERE env='test'，不 DROP TABLE |
| 价值对齐 | 不确定时保守安全 | 先确认范围再执行，保留回滚 |

---

## 约束级别

```
BLOCK         → 直接拦截（DROP TABLE / 数据泄露）
APPROVAL      → 人工审批（资金操作 / 大范围修改）
WARN          → 警告但允许（低风险非常规操作）
LOG           → 仅记录（一切操作默认记录）
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有输入护栏 | ☐ |
| 有输出护栏 | ☐ |
| 有价值约束注册 | ☐ |
| 有 BLOCK 级约束 | ☐ |
| 有 APPROVAL 级约束 | ☐ |
| 有对齐评估测试集 | ☐ |
| 有审计日志 | ☐ |
