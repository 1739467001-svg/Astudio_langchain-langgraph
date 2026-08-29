# LLM 应用优雅关闭与重启

> 生产环境不能直接kill进程——正在处理的用户请求怎么办？这份指南覆盖优雅关闭和零停机重启。

---

## 一、为什么需要优雅关闭

```mermaid
graph TB
    subgraph 强制关闭 &#123;"❌ 强制kill"&#125;
        K1["kill -9 PID"] --> K2["正在处理的请求中断"]
        K2 --> K3["用户看到500错误"]
        K3 --> K4["对话历史可能损坏"]
    end

    subgraph 优雅关闭 &#123;"✅ 优雅关闭"&#125;
        G1["收到SIGTERM"] --> G2["停止接收新请求"]
        G2 --> G3["等待正在处理的请求完成"]
        G3 --> G4["保存状态→退出"]
    end

    style 强制关闭 fill:'#FFCDD2'
    style 优雅关闭 fill:'#C8E6C9'
```

## 二、FastAPI 优雅关闭实现

```python
import signal
import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager

app = FastAPI()

# 全局状态
shutdown_event = asyncio.Event()
active_requests = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    print("🚀 应用启动")

    # 注册信号处理
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: shutdown_event.set())
    loop.add_signal_handler(signal.SIGINT, lambda: shutdown_event.set())

    yield

    # 关闭时
    print("💤 等待活跃请求完成...")
    while active_requests > 0:
        print(f"  活跃请求: &#123;active_requests&#125;")
        await asyncio.sleep(1)
    print("✅ 所有请求已完成，安全退出")

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def track_requests(request, call_next):
    """追踪活跃请求数"""
    global active_requests
    active_requests += 1
    try:
        response = await call_next(request)
    finally:
        active_requests -= 1
    return response

@app.get("/health")
async def health():
    """健康检查端点"""
    if shutdown_event.is_set():
        return &#123;"status": "draining"&#125;  # 正在排水
    return &#123;"status": "healthy"&#125;

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """聊天端点"""
    if shutdown_event.is_set():
        return &#123;"error": "服务正在关闭，请稍后重试"&#125;

    # 正常处理
    result = await chain.ainvoke(&#123;"input": request.message&#125;)
    return &#123;"answer": result&#125;
```

## 三、零停机重启

```mermaid
graph TB
    subgram 零停机 &#123;"零停机重启流程"&#125;
        S1["旧实例收到SIGTERM"] --> S2["旧实例: 停止接收新请求<br/>继续处理已有请求"]
        S3["Nginx: 流量切到新实例"] --> S4["新实例: 启动并接收请求"]
        S2 --> S5["旧实例: 处理完→退出"]
        S4 --> S6["✅ 用户无感知"]
    end

    style 零停机 fill:'#C8E6C9'
```

### Nginx 配置

```nginx
upstream llm_app &#123;
    server 127.0.0.1:8000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8001 max_fails=3 fail_timeout=30s;  # 备用
&#125;

server &#123;
    location /api/ &#123;
        proxy_pass http://llm_app;
        proxy_read_timeout 60s;
    &#125;

    location /health &#123;
        proxy_pass http://llm_app;
        access_log off;
    &#125;
&#125;
```

### 重启脚本

```bash
#!/bin/bash
# scripts/rolling_restart.sh

OLD_PORT=8000
NEW_PORT=8001

# 1. 启动新实例
echo "启动新实例..."
uvicorn server:app --port $NEW_PORT &
NEW_PID=$!

# 2. 等待新实例就绪
sleep 3
curl -s http://localhost:$NEW_PORT/health | grep -q "healthy"
if [ $? -ne 0 ]; then
    echo "❌ 新实例启动失败"
    kill $NEW_PID
    exit 1
fi

# 3. 优雅关闭旧实例
echo "关闭旧实例..."
kill -SIGTERM $(lsof -t -i:$OLD_PORT)

# 4. 等待旧实例退出
wait $NEW_PID
echo "✅ 重启完成"
```

## 四、状态保存与恢复

```python
import pickle
from langgraph.checkpoint.memory import MemorySaver

def save_state(app, config, backup_path: str):
    """保存应用状态"""
    state = app.get_state(config)
    with open(backup_path, "wb") as f:
        pickle.dump(&#123;
            "state": state.values,
            "next": state.next,
        &#125;, f)
    print(f"✅ 状态已保存到 &#123;backup_path&#125;")

def restore_state(app, config, backup_path: str):
    """恢复应用状态"""
    with open(backup_path, "rb") as f:
        data = pickle.load(f)
    app.update_state(config, data["state"])
    print(f"✅ 状态已从 &#123;backup_path&#125; 恢复")
```

## 五、关闭检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| SIGTERM处理 | 捕获信号不强制退出 | ☐ |
| 请求排水 | 等待活跃请求完成 | ☐ |
| 健康检查 | /health返回draining | ☐ |
| Nginx切换 | 流量切到新实例 | ☐ |
| 状态保存 | 保存对话历史 | ☐ |
| 超时退出 | 最长等待60秒 | ☐ |
