# Tool 缓存与工具结果复用图解

> 相同参数的工具调用直接返回缓存结果，延迟从秒级降到毫秒级。

---

```mermaid
graph TB
    CALL["工具调用<br/>tool=search<br/>args={city: 北京}"] --> CHECK{"缓存命中?"}
    
    CHECK -->|是| HIT["返回缓存结果<br/>0ms<br/>hit_count++"]
    CHECK -->|否| MISS["执行工具<br/>300ms"]
    MISS --> STORE["结果写入缓存<br/>key=hash(tool+args)"]
    STORE --> RETURN["返回结果"]

    HIT --> RETURN

    style CHECK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style HIT fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style MISS fill:#E3F2FD,stroke:#1565C0
    style STORE fill:#E3F2FD,stroke:#1565C0
```

---

## 缓存策略对比

| 策略 | 适用 | TTL | 示例 |
|------|------|-----|------|
| TTL 过期 | 数据变化慢 | 5min | 天气/汇率 |
| 事件触发 | 数据可变 | — | 数据库查询 |
| 永不缓存 | 结果不确定 | — | 代码执行 |
| LRU 淘汰 | 通用 | — | 控制内存 |

---

## 多级缓存

```mermaid
graph LR
    REQ["查找请求"] --> L1{"L1 内存<br/>TTL=60s"}
    L1 -->|命中| R1["返回 0ms"]
    L1 -->|未命中| L2{"L2 Redis<br/>TTL=1h"}
    L2 -->|命中| R2["返回 2ms<br/>回填 L1"]
    L2 -->|未命中| SRC["源工具<br/>300ms"]
    SRC --> FILL["回填 L1+L2"]

    style L1 fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style L2 fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style SRC fill:#FFCDD2,stroke:#C62828
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有精确参数缓存 | ☐ |
| 有 TTL 过期 | ☐ |
| 有失效策略 | ☐ |
| 有不可缓存判断 | ☐ |
| 有命中率统计 | ☐ |
| 有缓存监控 | ☐ |
