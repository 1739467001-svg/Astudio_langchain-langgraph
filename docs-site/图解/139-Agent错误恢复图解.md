# Agent 错误恢复图解

> 用图解理解错误分类、三级重试和降级策略。

---

## 一、错误分类

```mermaid
graph TB
    ROOT["错误类型"] --> T1["瞬时错误<br/>可重试"]
    ROOT --> T2["持久错误<br/>不重试"]
    ROOT --> T3["格式错误<br/>带修正重试"]
    ROOT --> T4["超时错误<br/>重试"]
    ROOT --> T5["逻辑错误<br/>需人工"]

    style T1 fill:#C8E6C9
    style T2 fill:#FFCDD2
    style T3 fill:#FFF9C4
```

---

## 二、三级重试

```mermaid
graph TB
    L1["Level1: 立即重试<br/>网络抖动"] -->|"失败"| L2["Level2: 指数退避<br/>1s→2s→4s"]
    L2 -->|"失败"| L3["Level3: 降级重试<br/>换模型/换参数"]
    L3 -->|"失败"| FAIL["返回失败"]

    style L1 fill:#C8E6C9
    style L2 fill:#FFF9C4
    style L3 fill:#FFCDD2
```

---

## 三、降级策略

```mermaid
graph TB
    FAIL["主流程失败"] --> F1["模型降级<br/>4o→mini"]
    FAIL --> F2["功能降级<br/>无RAG简单回答"]
    FAIL --> F3["缓存降级<br/>返回最近缓存"]
    FAIL --> F4["人工降级<br/>转人工"]

    style F1 fill:#C8E6C9
    style F4 fill:#FFF9C4
```

---

## 四、格式错误恢复

```mermaid
graph TB
    TEXT["LLM输出"] --> P1["策略1: 直接JSON.parse"]
    P1 -->|"失败"| P2["策略2: 提取JSON片段"]
    P2 -->|"失败"| P3["策略3: 修复常见问题"]
    P3 -->|"失败"| P4["策略4: LLM修正"]

    style P1 fill:#E3F2FD
    style P4 fill:#C8E6C9
```

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有错误分类 | ☐ |
| 有指数退避重试 | ☐ |
| 有降级链 | ☐ |
| 有格式错误恢复 | ☐ |
