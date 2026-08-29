# Agent 最佳实践与反模式深度图解

> 20条最佳实践+15个反模式。本图解可视化核心原则和常见陷阱。

---

## 最佳实践分层

```mermaid
graph TB
    BEST["最佳实践"]

    BEST --> ARCH["架构层<br/>职责单一/状态显式/迭代限制"]
    BEST --> PROMPT["Prompt层<br/>版本管理/结构化输出/精选Few-shot"]
    BEST --> TOOL["工具层<br/>描述清晰/结果截断/参数校验"]
    BEST --> PROD["生产层<br/>超时重试/成本追踪/流式输出"]

    style BEST fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style ARCH fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style PROD fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 反模式速查

```mermaid
graph TB
    ANTI["常见反模式"]

    ANTI --> A1["上帝Agent<br/>20+工具一个Agent"]
    ANTI --> A2["无限制递归<br/>死循环"]
    ANTI --> A3["超长Prompt<br/>5000字System"]
    ANTI --> A4["工具返回大对象<br/>Token爆炸"]
    ANTI --> A5["不处理错误<br/>API挂了就崩"]
    ANTI --> A6["不缓存<br/>重复调用"]
    ANTI --> A7["生产用debug模式<br/>高随机性"]

    style ANTI fill:#FFCCBC,stroke:#D84315,stroke-width:3px
```

---

## 好 vs 坏对比

| 维度 | ✅ 最佳实践 | ❌ 反模式 |
|------|-----------|---------|
| Agent设计 | 职责单一 | 上帝Agent |
| System Prompt | <500字精简 | 5000字冗长 |
| 工具结果 | 截断到2000字符 | 返回50KB |
| 错误处理 | 重试+降级 | 不处理 |
| 成本监控 | 每次追踪 | 无监控 |
| 输出方式 | 流式优先 | 同步阻塞 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 架构层实践 | ☐ |
| Prompt层实践 | ☐ |
| 工具层实践 | ☐ |
| 生产层实践 | ☐ |
| 知道15个反模式 | ☐ |
