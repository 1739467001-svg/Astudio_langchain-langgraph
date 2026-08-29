# NeMo Guardrails 与 Agent 护栏系统图解

> 输入检查、输出脱敏、主题控制、越狱防护——Guardrails 是 LLM 的安全带。本图解可视化四层防护体系和分级策略。

---

## 四层防护体系

```mermaid
graph TB
    USER["用户输入"] --> L1["第1层: 输入验证<br/>注入检测/格式检查"]
    L1 -->|"不通过"| B1["⛔ 拒绝"]
    L1 -->|"通过"| L2["第2层: 主题控制<br/>是否在业务范围"]
    L2 -->|"不在范围"| RD["🔄 引导回主题"]
    L2 -->|"在范围"| L3["第3层: LLM 处理<br/>生成回答"]
    L3 --> L4["第4层: 输出检查<br/>事实核查/PII/毒性"]
    L4 -->|"不通过"| FIX["🔧 脱敏/重写"]
    L4 -->|"通过"| OUT["✅ 返回用户"]

    style L1 fill:#FFCCBC,stroke:#D84315
    style L2 fill:#FFF9C4,stroke:#F9A825
    style L3 fill:#E3F2FD,stroke:#1565C0
    style L4 fill:#F3E5F5,stroke:#7B1FA2
    style OUT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 分级护栏策略

```mermaid
graph LR
    INPUT["输入文本"] --> T1["第1级: 正则/关键词<br/>免费、极快"]
    T1 -->|"通过"| T2["第2级: 小模型分类<br/>便宜、快"]
    T2 -->|"通过"| T3["第3级: 大模型判断<br/>贵、精确"]
    T3 -->|"通过"| SAFE["✅ 安全"]
    T1 -.->|"不通过"| BLOCK["⛔ 拦截"]
    T2 -.->|"不通过"| BLOCK
    T3 -.->|"不通过"| BLOCK

    style T1 fill:#C8E6C9,stroke:#2E7D32
    style T2 fill:#FFF9C4,stroke:#F9A825
    style T3 fill:#FFCCBC,stroke:#D84315
    style SAFE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 护栏类型对照

| 护栏 | 位置 | 检查内容 | 不通过处理 |
|------|------|---------|-----------|
| 注入防护 | 输入 | Prompt注入检测 | 拒绝 |
| 主题控制 | 输入 | 业务范围检查 | 引导 |
| PII检测 | 输入 | 敏感信息输入 | 脱敏/拒绝 |
| 事实核查 | 输出 | 回答是否基于文档 | 标注/重写 |
| 毒性检测 | 输出 | 有害内容检测 | 拒绝 |
| PII脱敏 | 输出 | 敏感信息输出 | 脱敏 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四层防护体系 | ☐ |
| NeMo Guardrails 配置 | ☐ |
| 输入护栏实现 | ☐ |
| 输出护栏实现 | ☐ |
| LangGraph 集成 | ☐ |
| 分级护栏策略 | ☐ |
