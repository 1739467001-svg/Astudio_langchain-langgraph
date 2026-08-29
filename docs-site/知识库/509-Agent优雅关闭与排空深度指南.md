# Agent 优雅关闭与排空深度指南

> K8s 滚动更新时，旧 Pod 被杀——正在处理的 Agent 请求怎么办？直接 kill 丢失用户对话、检查点不完整。优雅关闭让 Agent 完成正在处理的请求、保存状态、安全退出。本指南深度讲解优雅关闭流程、排空策略、超时处理。

---

## 1. 优雅关闭流程

### 关闭阶段

```mermaid
graph TB
    SIGTERM["收到 SIGTERM"] --> STOP_ACCEPT["停止接受新请求"]
    STOP_ACCEPT --> DRAIN["排空：等待进行中请求"]
    DRAIN --> SAVE_STATE["保存状态<br/>检查点/会话"]
    SAVE_STATE --> CLEANUP["清理资源<br/>连接/缓存"]
    CLEANUP --> TIMEOUT&#123;"超时?"&#125;
    TIMEOUT -->|"否"| EXIT["安全退出 ✅"]
    TIMEOUT -->|"是"| FORCE["强制终止 ❌"]

    style SIGTERM fill:#FFCCBC,stroke:#D84315
    style EXIT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style FORCE fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

### 超时时间线

```
K8s 优雅关闭时间线：

  0s: Pod 收到 SIGTERM
  0s: 从负载均衡器摘除（preStop hook + 10s 延迟）
  0s: 停止接受新请求
  0-30s: 等待进行中请求完成
  30s: 保存状态/检查点
  35s: 清理资源
  40s: 安全退出
  60s: terminationGracePeriodSeconds 到期 → SIGKILL

  关键：terminationGracePeriodSeconds 必须 > 排空时间 + 保存时间
```

---

## 2. 实现

### FastAPI 优雅关闭

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
import signal

# 全局状态
active_requests = 0
shutdown_event = asyncio.Event()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动
    print("Agent 服务启动")
    yield

    # 关闭（收到 SIGTERM 后执行）
    print("收到关闭信号，开始排空...")

    # 1. 停止接受新请求（FastAPI 自动处理）
    shutdown_event.set()

    # 2. 等待进行中请求完成
    wait_start = time.time()
    while active_requests > 0:
        elapsed = time.time() - wait_start
        if elapsed > 30:
            print(f"⚠️ 排空超时，仍有 &#123;active_requests&#125; 个请求")
            break
        print(f"等待 &#123;active_requests&#125; 个请求完成... (&#123;elapsed:.0f&#125;s)")
        await asyncio.sleep(1)

    # 3. 保存状态
    print("保存检查点...")
    await checkpointer.flush()

    # 4. 保存会话状态
    print("保存会话状态...")
    await session_store.flush()

    # 5. 清理资源
    print("清理资源...")
    await vectorstore.close()
    await db.close()
    await redis.close()

    print("✅ 优雅关闭完成")

app = FastAPI(lifespan=lifespan)

# 请求计数中间件
@app.middleware("http")
async def count_requests(request, call_next):
    global active_requests

    # 关闭中不接新请求
    if shutdown_event.is_set():
        from fastapi import Response
        return Response(status_code=503, content="服务正在关闭")

    active_requests += 1
    try:
        response = await call_next(request)
        return response
    finally:
        active_requests -= 1
```

### K8s 配置

```yaml
# K8s 优雅关闭配置
spec:
  containers:
    - name: agent
      # 优雅关闭
      lifecycle:
        preStop:
          exec:
            # 等待负载均衡器摘除
            command: ["sleep", "10"]
      # 优雅终止宽限期
      terminationGracePeriodSeconds: 60
```

---

## 3. 排空策略

```python
@dataclass
class DrainManager:
    """排空管理器"""

    max_drain_time: int = 30  # 最大排空时间

    async def drain(self) -> dict:
        """排空"""
        start = time.time()
        stats = &#123;"drained": 0, "remaining": 0, "timeout": False&#125;

        while True:
            pending = await self._get_pending_requests()

            if pending == 0:
                break

            elapsed = time.time() - start
            if elapsed > self.max_drain_time:
                stats["timeout"] = True
                stats["remaining"] = pending
                break

            stats["drained"] = pending
            await asyncio.sleep(1)

        stats["drain_time"] = time.time() - start
        return stats

    async def graceful_drain(self):
        """友好排空：通知客户端"""
        # 1. 发送 "服务即将关闭" 通知
        await self._notify_clients("shutting_down")

        # 2. 对长连接发送提前通知
        await self._notify_websockets("服务器将在 30 秒后关闭，请重连")

        # 3. 等待请求自然完成
        await self.drain()

    async def _get_pending_requests(self) -> int:
        return 0

    async def _notify_clients(self, message: str):
        pass

    async def _notify_websockets(self, message: str):
        pass
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了 FastAPI lifespan 优雅关闭 | ☐ |
| 实现了请求计数中间件 | ☐ |
| 配置了 K8s preStop hook | ☐ |
| 配置了 terminationGracePeriodSeconds | ☐ |
| 实现了排空管理器 | ☐ |
| 关闭时保存检查点 | ☐ |
| 关闭时保存会话状态 | ☐ |
| 关闭时清理资源 | ☐ |
| 关闭时通知客户端 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 59 | 优雅关闭与重启 | 关闭 |
| 84 | 优雅关闭与重启 | 关闭 |
| 109 | 流量整形 | 整形 |
| 244 | 优雅关闭图解 | 图解 |
| 444 | 优雅关闭与重启 | 重启 |
| 479 | Agent 自动扩缩容 | 扩缩容 |
| 489 | Agent 容器化与 K8s | K8s |
