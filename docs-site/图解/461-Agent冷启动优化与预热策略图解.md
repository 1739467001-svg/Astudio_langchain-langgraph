# Agent 冷启动优化与预热策略图解

> 启动后第一个请求慢？预热解决。本图解可视化冷启动阶段和预热策略。

---

## 冷启动四阶段

```mermaid
graph LR
    LOAD["模型加载<br/>2-10秒<br/>权重→GPU"] --> CONNECT["连接初始化<br/>1-3秒<br/>DB/向量库"]
    CONNECT --> EMBED["Embedding预热<br/>1-5秒<br/>首次向量化"]
    EMBED --> WARM["预热请求<br/>1-3秒<br/>首次LLM"]
    WARM --> READY["✅ 就绪"]

    style LOAD fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style READY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 预热策略

```mermaid
graph TB
    PRELOAD["启动预热"]

    PRELOAD --> LLM["LLM预热<br/>发送简单请求<br/>建立连接"]
    PRELOAD --> EMB["Embedding预热<br/>首次向量化<br/>加载模型"]
    PRELOAD --> VEC["向量库预热<br/>建立连接<br/>加载索引"]
    PRELOAD --> CACHE["缓存预热<br/>预计算热门查询<br/>加载到缓存"]

    style PRELOAD fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style CACHE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 渐进式就绪

```mermaid
graph TB
    START["启动"] --> MUST["必须组件预热<br/>LLM/Embedding/向量库"]
    MUST --> READY1["✅ 就绪<br/>接受请求"]
    READY1 --> BG["后台预热非必须<br/>缓存/监控"]

    style MUST fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style READY1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style BG fill:#E3F2FD,stroke:#1565C0
```

---

## 冷启动 vs 预热后对比

| 指标 | 无预热 | 有预热 |
|------|--------|--------|
| 首次请求 | 5-40秒 | <2秒 |
| K8s就绪检查 | 可能超时 | 快速通过 |
| 用户体验 | 首次很慢 | 一致体验 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四阶段 | ☐ |
| 模型预加载 | ☐ |
| Embedding预热 | ☐ |
| 向量库预热 | ☐ |
| 缓存预热 | ☐ |
| 渐进式就绪 | ☐ |
| K8s startupProbe | ☐ |
