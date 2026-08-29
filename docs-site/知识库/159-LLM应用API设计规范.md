# LLM 应用 API 设计规范

> LLM 应用不是普通 Web 服务——响应可能几十秒、输出可能流式、需要传递对话历史、Token 消耗要计费。这些特殊性使得 API 设计需要专门规范。这份指南覆盖 LLM 应用的 API 设计模式、版本管理和文档规范。

---

## 一、LLM API 的特殊性

```mermaid
graph TB
    subgraph 传统API &#123;"传统REST API"&#125;
        T1["同步请求-响应"]
        T2["响应时间<1s"]
        T3["固定JSON结构"]
        T4["无状态"]
    end

    subgraph LLMAPI &#123;"LLM应用API特殊性"&#125;
        L1["可能流式(SSE)"]
        L2["响应1-30秒"]
        L3["输出不确定"]
        L4["有状态(对话历史)"]
        L5["Token计费"]
        L6["可能需人工审批"]
    end

    style 传统API fill:#E3F2FD
    style LLMAPI fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 二、API 端点设计

```mermaid
graph TB
    subgraph 端点 &#123;"LLM应用核心端点"&#125;
        E1["POST /chat<br/>同步对话"]
        E2["POST /chat/stream<br/>流式对话(SSE)"]
        E3["POST /threads<br/>创建对话线程"]
        E4["GET /threads/&#123;id&#125;/history<br/>获取对话历史"]
        E5["POST /threads/&#123;id&#125;/runs<br/>在线程中运行"]
        E6["POST /feedback<br/>提交反馈"]
        E7["GET /health<br/>健康检查"]
        E8["GET /metrics<br/>Prometheus指标"]
    end

    style E2 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style E5 fill:#C8E6C9
```

---

## 三、请求/响应规范

### 3.1 同步对话

```python
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional
import time, uuid

app = FastAPI(title="LLM应用API", version="1.0.0")

class ChatRequest(BaseModel):
    """对话请求。"""
    message: str = Field(..., description="用户消息", max_length=10000)
    thread_id: Optional[str] = Field(None, description="对话线程ID，空则创建新对话")
    model: Optional[str] = Field(None, description="指定模型（可选）")
    temperature: Optional[float] = Field(0.7, ge=0, le=2, description="温度参数")
    max_tokens: Optional[int] = Field(1000, ge=1, le=4000, description="最大输出Token")
    metadata: Optional[dict] = Field(None, description="自定义元数据")

    class Config:
        json_schema_extra = &#123;
            "example": &#123;
                "message": "什么是RAG？",
                "thread_id": "conv-001",
                "max_tokens": 500,
            &#125;
        &#125;

class ChatResponse(BaseModel):
    """对话响应。"""
    response: str = Field(..., description="AI回答")
    thread_id: str = Field(..., description="对话线程ID")
    message_id: str = Field(..., description="消息ID")
    model: str = Field(..., description="使用的模型")
    usage: dict = Field(..., description="Token使用")
    latency_ms: float = Field(..., description="延迟(毫秒)")
    cached: bool = Field(False, description="是否命中缓存")

@app.post("/v1/chat", response_model=ChatResponse, tags=["对话"])
async def chat(request: ChatRequest):
    """同步对话接口。

    适合需要完整结果的场景。流式场景请用 /v1/chat/stream。
    """
    thread_id = request.thread_id or str(uuid.uuid4())[:8]
    start = time.time()

    # 调用Agent...
    answer = f"关于'&#123;request.message&#125;'的回答"
    latency = (time.time() - start) * 1000

    return ChatResponse(
        response=answer,
        thread_id=thread_id,
        message_id=str(uuid.uuid4())[:8],
        model="gpt-4o",
        usage=&#123;"prompt_tokens": 150, "completion_tokens": 80, "total_tokens": 230&#125;,
        latency_ms=round(latency, 2),
        cached=False,
    )
```

### 3.2 流式对话

```python
from fastapi.responses import StreamingResponse
import json

@app.post("/v1/chat/stream", tags=["对话"])
async def chat_stream(request: ChatRequest):
    """流式对话接口（SSE）。

    返回Server-Sent Events流，逐Token输出。
    """
    thread_id = request.thread_id or str(uuid.uuid4())[:8]

    async def generate():
        # 发送元数据
        meta = json.dumps(&#123;"type": "meta", "thread_id": thread_id, "model": "gpt-4o"&#125;)
        yield f"data: &#123;meta&#125;\n\n"

        # 模拟Token流
        tokens = ["这", "是", "流", "式", "回", "答"]
        for token in tokens:
            data = json.dumps(&#123;"type": "token", "content": token&#125;)
            yield f"data: &#123;data&#125;\n\n"

        # 发送使用统计
        usage = json.dumps(&#123;"type": "usage", "usage": &#123;"total_tokens": 230&#125;&#125;)
        yield f"data: &#123;usage&#125;\n\n"

        # 结束
        yield f"data: &#123;json.dumps(&#123;'type': 'done'&#125;)&#125;\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=&#123;
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        &#125;,
    )
```

---

## 四、版本管理

```python
# API版本前缀: /v1/, /v2/
# 向后兼容：新版本增加字段不删字段

class APIVersionManager:
    """API版本管理器。"""

    VERSIONS = &#123;
        "v1": &#123;
            "endpoints": ["/v1/chat", "/v1/chat/stream", "/v1/threads"],
            "deprecated": False,
            "sunset": None,
        &#125;,
        "v2": &#123;
            "endpoints": ["/v2/chat", "/v2/chat/stream", "/v2/threads", "/v2/feedback"],
            "deprecated": False,
            "sunset": None,
            "changes": ["新增/feedback端点", "支持model参数", "新增cached字段"],
        &#125;,
    &#125;

    @classmethod
    def get_version_info(cls, version: str) -> dict:
        return cls.VERSIONS.get(version, &#123;"error": "版本不存在"&#125;)

    @classmethod
    def deprecate(cls, version: str, sunset_date: str):
        """标记版本废弃。"""
        if version in cls.VERSIONS:
            cls.VERSIONS[version]["deprecated"] = True
            cls.VERSIONS[version]["sunset"] = sunset_date
```

---

## 五、错误规范

```python
from fastapi import HTTPException
from pydantic import BaseModel

class ErrorResponse(BaseModel):
    """统一错误响应。"""
    error: dict = Field(..., description="错误信息")

    class Config:
        json_schema_extra = &#123;
            "example": &#123;
                "error": &#123;
                    "code": "RATE_LIMITED",
                    "message": "请求过于频繁，请稍后再试",
                    "retry_after": 30,
                &#125;
            &#125;
        &#125;

# 标准错误码
ERROR_CODES = &#123;
    "INVALID_REQUEST": (400, "请求参数无效"),
    "UNAUTHORIZED": (401, "未授权"),
    "FORBIDDEN": (403, "禁止访问"),
    "NOT_FOUND": (404, "资源不存在"),
    "RATE_LIMITED": (429, "请求过于频繁"),
    "MODEL_ERROR": (502, "模型调用失败"),
    "TIMEOUT": (504, "请求超时"),
    "CONTENT_FILTERED": (422, "内容被安全策略过滤"),
    "THREAD_NOT_FOUND": (404, "对话线程不存在"),
&#125;

def create_error(code: str, detail: str = "", extra: dict = None) -> HTTPException:
    """创建标准错误。"""
    status, message = ERROR_CODES.get(code, (500, "内部错误"))
    error_detail = &#123;"code": code, "message": message&#125;
    if detail:
        error_detail["detail"] = detail
    if extra:
        error_detail.update(extra)
    return HTTPException(status_code=status, detail=&#123;"error": error_detail&#125;)
```

---

## 六、OpenAPI 文档

```python
# FastAPI自动生成OpenAPI文档
# 访问 /docs (Swagger UI) 或 /redoc (ReDoc)

app = FastAPI(
    title="LLM应用API",
    description="""
    LLM应用的标准API接口。

    ## 功能
    * 同步对话
    * 流式对话（SSE）
    * 对话线程管理
    * 反馈收集

    ## 认证
    使用Bearer Token: `Authorization: Bearer <api_key>`
    """,
    version="1.0.0",
    contact=&#123;"name": "API支持", "email": "api@example.com"&#125;,
    license_info=&#123;"name": "MIT"&#125;,
)

# 自动文档包含所有端点的请求/响应schema
# 前端可根据OpenAPI spec自动生成SDK
```

---

## 七、限流与配额

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/v1/chat", tags=["对话"])
@limiter.limit("10/minute")  # 每分钟10次
async def chat(request: ChatRequest):
    pass

# 分级限流
@app.post("/v1/chat/stream", tags=["对话"])
@limiter.limit("5/minute")   # 流式更严格
async def chat_stream(request: ChatRequest):
    pass
```

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| API路径加/v1/前缀 | 为未来版本升级留空间 | ★★★ |
| 流式用SSE | LLM场景标准方案 | ★★★ |
| 统一错误格式 | error.code + message | ★★★ |
| 返回Token使用 | 前端展示成本 | ★★☆ |
| 返回thread_id | 前端管理对话 | ★★☆ |
| 自动OpenAPI文档 | Swagger/ReDoc | ★★☆ |
| 分级限流 | 流式比同步更严格 | ★★☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 有同步对话端点 | ☐ |
| 有流式对话端点(SSE) | ☐ |
| 有线程管理端点 | ☐ |
| 有统一错误格式 | ☐ |
| 有版本前缀(/v1/) | ☐ |
| 有OpenAPI文档 | ☐ |
| 有限流 | ☐ |
