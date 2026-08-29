# Agent 红队测试与对抗攻防深度图解

> 上线前有人试过越狱你的 Agent 吗？本图解可视化攻击面分类、攻击用例和纵深防御体系。

---

## 攻击面全景

```mermaid
graph TB
    A["Agent 攻击面"]

    A --> INPUT["输入层<br/>Prompt注入/越狱<br/>间接注入/多语言绕过"]
    A --> TOOL["工具层<br/>参数注入/结果投毒<br/>权限提升/SSRF"]
    A --> OUTPUT["输出层<br/>PII泄露/有害内容<br/>System Prompt泄露"]
    A --> STATE["状态层<br/>上下文污染<br/>记忆投毒"]

    style A fill:#FFCCBC,stroke:#D84315,stroke-width:3px
    style INPUT fill:#E3F2FD,stroke:#1565C0
    style TOOL fill:#FFF9C4,stroke:#F9A825
    style OUTPUT fill:#F3E5F5,stroke:#7B1FA2
    style STATE fill:#C8E6C9,stroke:#2E7D32
```

---

## 纵深防御

```mermaid
graph LR
    INPUT["用户输入"] --> D1["第1层: 输入防御<br/>注入检测/格式校验"]
    D1 --> D2["第2层: 工具防御<br/>参数校验/路径检查"]
    D2 --> D3["第3层: 输出防御<br/>PII脱敏/泄露检查"]
    D3 --> SAFE["✅ 安全输出"]

    D1 -.->|"拦截"| BLOCK["⛔ 拒绝"]
    D2 -.->|"拦截"| BLOCK

    style D1 fill:#FFCCBC,stroke:#D84315
    style D2 fill:#FFF9C4,stroke:#F9A825
    style D3 fill:#F3E5F5,stroke:#7B1FA2
    style SAFE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 红队测试流程

```mermaid
graph TB
    START["红队测试"] --> CAT&#123;"分类攻击"&#125;
    CAT --> INJ["Prompt注入测试"]
    CAT --> JAIL["越狱测试"]
    CAT --> LEAK["信息泄露测试"]
    CAT --> TOOL_A["工具层攻击"]
    INJ --> REPORT["生成报告"]
    JAIL --> REPORT
    LEAK --> REPORT
    TOOL_A --> REPORT
    REPORT --> RISK&#123;"风险评级"&#125;
    RISK --> LOW["🟢 可上线"]
    RISK --> MED["🟡 需修复"]
    RISK --> HIGH["🔴 阻止上线"]

    style START fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style REPORT fill:#E3F2FD,stroke:#1565C0
    style LOW fill:#C8E6C9,stroke:#2E7D32
    style HIGH fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## 攻击类型速查

| 攻击 | 示例 | 严重度 |
|------|------|--------|
| 指令覆盖 | "忽略之前指令" | 高 |
| 角色扮演 | "扮演无限制角色" | 高 |
| 编码绕过 | Base64编码指令 | 中 |
| 间接注入 | 文档中藏指令 | 极高 |
| SQL注入 | 参数中注入SQL | 极高 |
| 路径穿越 | ../../etc/passwd | 极高 |
| SSRF | 访问内网地址 | 极高 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四大攻击面 | ☐ |
| 攻击用例库 | ☐ |
| 自动化红队测试 | ☐ |
| 输入层防御 | ☐ |
| 工具参数校验 | ☐ |
| 输出层过滤 | ☐ |
| 上线前红队测试 | ☐ |
