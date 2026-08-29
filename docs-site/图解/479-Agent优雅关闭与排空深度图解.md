# Agent 优雅关闭与排空深度图解

> SIGTERM→排空→保存→退出。本图解可视化优雅关闭流程。

---

## 关闭流程

```mermaid
graph TB
    SIG["收到SIGTERM"] --> STOP["停止接受新请求"]
    STOP --> DRAIN["排空：等待进行中请求"]
    DRAIN --> SAVE["保存状态<br/>检查点/会话"]
    SAVE --> CLEAN["清理资源<br/>连接/缓存"]
    CLEAN --> TO&#123;"超时?"&#125;
    TO -->|"否"| EXIT["✅ 安全退出"]
    TO -->|"是"| KILL["❌ 强制终止"]

    style SIG fill:#FFCCBC,stroke:#D84315
    style EXIT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style KILL fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## K8s 时间线

```
0s   Pod收到SIGTERM
0s   preStop: sleep 10 (等负载均衡摘除)
10s  停止接受新请求
10-40s 等待请求完成
40s  保存检查点
45s  清理资源
50s  安全退出
60s  terminationGracePeriod到期→SIGKILL
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| FastAPI lifespan | ☐ |
| 请求计数中间件 | ☐ |
| K8s preStop hook | ☐ |
| 排空管理器 | ☐ |
| 保存检查点 | ☐ |
| 通知客户端 | ☐ |
