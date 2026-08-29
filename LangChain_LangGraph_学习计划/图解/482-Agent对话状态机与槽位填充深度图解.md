# Agent 对话状态机与槽位填充深度图解

> 多轮对话如何管理状态和收集信息。本图解可视化对话状态机和槽位填充流程。

---

## 对话状态机

```mermaid
graph TB
    IDLE["空闲"] -->|"用户发起"| INTENT["意图识别"]
    INTENT -->|"订票"| SLOTS["槽位填充"]
    SLOTS -->|"信息完整"| CONFIRM["确认"]
    CONFIRM -->|"确认"| EXEC["执行"]
    CONFIRM -->|"修改"| SLOTS
    EXEC -->|"成功"| DONE["✅ 完成"]
    EXEC -->|"失败"| ERROR["错误重试"]
    SLOTS -->|"取消"| CANCEL["取消"]

    style INTENT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style SLOTS fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DONE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 槽位填充流程

```mermaid
graph LR
    INPUT["用户输入"] --> EXTRACT["LLM提取槽位"]
    EXTRACT --> CHECK{"必须槽位<br/>完整?"}
    CHECK -->|"否"| ASK["追问缺失槽位"]
    ASK --> INPUT
    CHECK -->|"是"| CONFIRM["确认信息"]

    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CONFIRM fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 槽位定义示例

| 槽位 | 描述 | 必须 | 追问示例 |
|------|------|------|---------|
| origin | 出发城市 | 是 | "从哪个城市出发？" |
| destination | 目的地 | 是 | "要去哪个城市？" |
| date | 日期 | 是 | "哪天出发？" |
| cabin | 舱位 | 否(默认经济舱) | "需要什么舱位？" |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 对话状态机 | ☐ |
| 槽位定义 | ☐ |
| LLM槽位提取 | ☐ |
| 主动追问 | ☐ |
| 确认机制 | ☐ |
| 话题切换 | ☐ |
