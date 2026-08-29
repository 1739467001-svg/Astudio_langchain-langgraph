# Agent API 设计与 OpenAPI 规范指南

> 把 Agent 包装成 API 服务，其他系统才能调用。但 Agent API 不是传统 REST API——它有流式输出、异步任务、长耗时操作、多轮对话状态。本指南系统讲解 Agent API 设计模式、OpenAPI 规范、认证鉴权、版本管理，以及 SDK 自动生成。

---

## 1. Agent API 设计模式

### 四种 API 模式

```mermaid
graph TB
    API["Agent API 模式"]

    API --> SYNC["同步 API<br/>请求→等待→响应<br/>适合快速问答"]
    API --> STREAM["流式 API<br/>SSE/WebSocket<br/>打字机效果"]
    API --> ASYNC["异步 API<br/>提交任务→轮询/Webhook<br/>长耗时任务"]
    API --> WS["WebSocket<br/>双向通信<br/>实时交互"]

    style API fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style STREAM fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ASYNC fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

### 模式选择

| 模式 | 响应时间 | 适合场景 | 复杂度 |
|------|---------|---------|--------|
| 同步 | <5秒 | 简单问答、工具调用 | 低 |
| 流式 SSE | 逐步输出 | 对话、报告生成 | 中 |
| 异步任务 | 分钟-小时 | 批量处理、深度分析 | 中 |
| WebSocket | 实时 | 语音、协作 | 高 |

---

## 2. API 端点设计

### 标准 REST 端点

```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import uuid

app = FastAPI(title="Agent API", version="1.0.0")

# === 请求/响应模型 ===
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: str
    model: Optional[str] = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 4096
    tools: Optional[list[str]] = None
    stream: bool = False

class ChatResponse(BaseModel):
    request_id: str
    session_id: str
    answer: str
    model: str
    tokens_used: int
    latency_ms: float
    citations: Optional[list] = None

class TaskRequest(BaseModel):
    task_type: str          # analyze / summarize / extract / generate
    input: dict
    user_id: str
    callback_url: Optional[str] = None
    priority: str = "normal"

class TaskResponse(BaseModel):
    task_id: str
    status: str             # queued / running / completed / failed
    estimated_time_seconds: int

# === 同步端点 ===
@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """同步对话"""
    start = time.time()
    request_id = str(uuid.uuid4())
    session_id = request.session_id or str(uuid.uuid4())

    result = await agent.ainvoke(request.message, session_id=session_id)

    return ChatResponse(
        request_id=request_id,
        session_id=session_id,
        answer=result.content,
        model=request.model,
        tokens_used=result.usage_metadata.get("total_tokens", 0),
        latency_ms=(time.time() - start) * 1000,
    )

# === 流式端点（SSE）===
@app.post("/v1/chat/stream")
async def chat_stream(request: ChatRequest):
    """流式对话（SSE）"""
    async def generate():
        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": request.message}]},
            version="v2",
        ):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield f"data: {json.dumps({'token': chunk.content})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# === 异步任务端点 ===
@app.post("/v1/tasks", response_model=TaskResponse)
async def create_task(request: TaskRequest):
    """创建异步任务"""
    task_id = str(uuid.uuid4())

    # 入队
    await task_queue.enqueue(task_id, request.dict())

    # 如果有回调，任务完成后自动通知
    if request.callback_url:
        asyncio.create_task(process_and_callback(task_id, request.callback_url))

    return TaskResponse(
        task_id=task_id,
        status="queued",
        estimated_time_seconds=120,
    )

@app.get("/v1/tasks/{task_id}")
async def get_task_status(task_id: str):
    """查询任务状态"""
    task = await task_queue.get(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    return task

@app.delete("/v1/tasks/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    await task_queue.cancel(task_id)
    return {"task_id": task_id, "status": "cancelled"}

# === 会话管理 ===
@app.post("/v1/sessions")
async def create_session(user_id: str):
    """创建会话"""
    session_id = str(uuid.uuid4())
    await session_store.create(session_id, user_id)
    return {"session_id": session_id}

@app.get("/v1/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    """获取会话消息历史"""
    messages = await session_store.get_messages(session_id)
    return {"session_id": session_id, "messages": messages}

@app.delete("/v1/sessions/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    await session_store.delete(session_id)
    return {"status": "deleted"}
```

---

## 3. OpenAPI 规范

### 自动生成文档

```python
# FastAPI 自动生成 OpenAPI 文档
# 访问 /docs 查看 Swagger UI
# 访问 /redoc 查看 ReDoc

# 自定义 OpenAPI Schema
@app.openapi()
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    from fastapi.openapi.utils import get_openapi
    openapi_schema = get_openapi(
        title="Agent Service API",
        version="1.0.0",
        description="LangGraph Agent 的 REST API",
        routes=app.routes,
    )

    # 添加认证方案
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
        },
    }

    # 添加全局安全
    openapi_schema["security"] = [{"BearerAuth": []}]

    # 添加标签分组
    openapi_schema["tags"] = [
        {"name": "chat", "description": "对话接口"},
        {"name": "tasks", "description": "异步任务"},
        {"name": "sessions", "description": "会话管理"},
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema
```

### 认证中间件

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, APIKeyHeader

bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)

async def authenticate(
    bearer: str = Security(bearer_scheme),
    api_key: str = Security(api_key_scheme),
):
    """双重认证：JWT 或 API Key"""
    if bearer:
        # JWT 验证
        payload = verify_jwt(bearer.credentials)
        if payload:
            return {"user_id": payload["user_id"], "roles": payload["roles"], "auth_type": "jwt"}

    if api_key:
        # API Key 验证
        key_info = await verify_api_key(api_key)
        if key_info:
            return {"user_id": key_info["agent_id"], "roles": ["agent"], "auth_type": "api_key"}

    raise HTTPException(401, "未认证")

# 在端点中使用
@app.post("/v1/chat")
async def chat(request: ChatRequest, user = Depends(authenticate)):
    request.user_id = user["user_id"]
    # ...
```

---

## 4. 版本管理

```python
# API 版本策略

# URL 版本（推荐）
# /v1/chat
# /v2/chat

# Header 版本
# Accept-Version: v1

# 版本路由
from fastapi import APIRouter

v1_router = APIRouter(prefix="/v1")
v2_router = APIRouter(prefix="/v2")

@v1_router.post("/chat")
async def chat_v1(request: dict):
    """v1: 基础对话"""
    return {"answer": "..."}

@v2_router.post("/chat")
async def chat_v2(request: dict):
    """v2: 增加流式+工具"""
    return {"answer": "...", "tools": [], "citations": []}

app.include_router(v1_router)
app.include_router(v2_router)

# 版本废弃管理
deprecated_versions = {"v1": {"deprecated_at": "2025-06-01", "sunset": "2025-12-01"}}

@app.middleware("http")
async def version_deprecation(request, call_next):
    version = request.url.path.split("/")[1] if "/" in request.url.path else ""
    if version in deprecated_versions:
        response = await call_next(request)
        response.headers["Deprecation"] = deprecated_versions[version]["deprecated_at"]
        response.headers["Sunset"] = deprecated_versions[version]["sunset"]
        response.headers["Link"] = '</v2/chat>; rel="successor-version"'
        return response
    return await call_next(request)
```

---

## 5. 限流与配额

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# 按用户限流
@app.post("/v1/chat")
@limiter.limit("100/minute")
async def chat(request: Request, body: ChatRequest, user = Depends(authenticate)):
    # 每分钟 100 次
    pass

# 按计划限流
RATE_LIMITS = {
    "free": "10/minute",
    "pro": "100/minute",
    "enterprise": "1000/minute",
}

async def dynamic_rate_limit(request: Request, user = Depends(authenticate)):
    plan = await get_user_plan(user["user_id"])
    limit = RATE_LIMITS.get(plan, "10/minute")
    # 应用动态限流
```

---

## 6. SDK 自动生成

```python
# OpenAPI Schema 导出后，可自动生成多语言 SDK

"""
# 生成 Python SDK
openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json \
  -g python \
  -o ./agent-sdk-python

# 生成 TypeScript SDK
openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json \
  -g typescript-fetch \
  -o ./agent-sdk-ts

# 生成 Go SDK
openapi-generator-cli generate \
  -i http://localhost:8000/openapi.json \
  -g go \
  -o ./agent-sdk-go
"""

# 使用自动生成的 Python SDK
# from agent_sdk import Client
# client = Client(base_url="http://localhost:8000")
# result = client.chat(message="你好", user_id="user_001")
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种 API 模式 | ☐ |
| 实现了同步+流式+异步端点 | ☐ |
| 实现了会话管理端点 | ☐ |
| 配置了 OpenAPI 自动文档 | ☐ |
| 实现了 JWT+API Key 认证 | ☐ |
| 配置了 API 版本管理 | ☐ |
| 配置了限流与配额 | ☐ |
| 能自动生成 SDK | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 24 | 前后端集成教程 | 前后端 |
| 98 | 流式输出前端集成 | 前端流式 |
| 127 | LangGraph API | LangGraph API |
| 130 | 流式输出前端集成指南 | 前端集成 |
| 159 | LLM 应用 API 设计规范 | API 规范 |
| 166 | API 限流与流量管理 | 限流 |
| 198 | API 限流与流量管理 | 限流 |
| 200 | LangGraph API 参考 | API 参考 |
| 232 | LangGraph API 参考 | API 速查 |
| 353 | Agent 流式输出与 SSE | SSE |
| 383 | Agent 流式输出与 SSE | SSE 实现 |
| 440 | Agent 前端与聊天 UI | 前端 |
| 441 | LangGraph Platform 部署 | Platform |
| 461 | 企业 Agent 集成 | 集成 |
