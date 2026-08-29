# Agent 流式架构与实时通信工程化指南

> 用户不想等 30 秒看到完整回答——流式输出让第一个 Token 在 1 秒内出现。本指南深度讲解 SSE/WebSocket 架构、打字机效果、中断恢复、心跳保活。

---

## 1. 流式通信对比

| 方案 | 延迟 | 双向 | 复杂度 | 适用 |
|------|------|------|--------|------|
| SSE | 低 | 单向 | 低 | 文本流 |
| WebSocket | 低 | 双向 | 中 | 实时交互 |
| HTTP 轮询 | 高 | - | 低 | 简单场景 |
| gRPC Stream | 极低 | 双向 | 高 | 高性能 |

---

## 2. SSE 流式实现

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI()

@app.post("/chat/stream")
async def stream_chat(request: dict):
    """SSE 流式对话"""
    async def generate():
        # 1. 发送开始事件
        yield f"data: &#123;json.dumps(&#123;'type': 'start', 'request_id': 'req_001'&#125;)&#125;\n\n"

        # 2. 逐 Token 流式
        async for chunk in llm.astream_events(
            &#123;"messages": [&#123;"role": "user", "content": request["message"]&#125;]&#125;,
            version="v2",
        ):
            if chunk["event"] == "on_chat_model_stream":
                token = chunk["data"]["chunk"].content
                if token:
                    yield f"data: &#123;json.dumps(&#123;'type': 'token', 'token': token&#125;)&#125;\n\n"
            elif chunk["event"] == "on_tool_start":
                yield f"data: &#123;json.dumps(&#123;'type': 'tool_start', 'tool': chunk['data'].get('name', '')&#125;)&#125;\n\n"
            elif chunk["event"] == "on_tool_end":
                yield f"data: &#123;json.dumps(&#123;'type': 'tool_end', 'tool': chunk['data'].get('name', '')&#125;)&#125;\n\n"

        # 3. 发送结束事件
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

async def heartbeat():
    """心跳保活"""
    while True:
        yield ": heartbeat\n\n"
        await asyncio.sleep(15)
```

---

## 3. 中断与恢复

```python
@dataclass
class StreamResumable:
    """可恢复的流式输出"""

    async def stream_with_checkpoint(self, query: str, thread_id: str):
        """带检查点的流式输出"""
        sent_tokens = 0

        async for chunk in agent.astream_events(
            &#123;"messages": [&#123;"role": "user", "content": query&#125;]&#125;,
            version="v2",
            config=&#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;,
        ):
            if chunk["event"] == "on_chat_model_stream":
                token = chunk["data"]["chunk"].content
                if token:
                    sent_tokens += 1
                    yield token

            # 每 100 Token 保存进度
            if sent_tokens % 100 == 0:
                await self._save_progress(thread_id, sent_tokens)
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种流式方案 | ☐ |
| 实现了 SSE 流式 | ☐ |
| 实现了工具调用事件 | ☐ |
| 实现了心跳保活 | ☐ |
| 实现了中断恢复 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 10 | 流式输出原理 | 原理 |
| 130 | 流式输出前端集成 | 前端 |
| 353 | Agent 流式输出与 SSE | SSE |
| 440 | Agent 前端与聊天 UI | UI |
| 570 | 实时决策与流式处理 | 实时 |
