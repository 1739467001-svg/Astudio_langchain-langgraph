# OpenAI Realtime API 与语音 Agent 指南

> 2024 年 10 月 OpenAI 发布 Realtime API：通过 WebSocket 实现低延迟语音对话，用户说话、AI 听懂、AI 说话，全流程不到 1 秒。不再需要"语音转文字 → LLM → 文字转语音"三段式架构。本指南详解 Realtime API 架构、语音 Agent 实现，以及与 LangGraph 的集成方案。

---

## 1. 从三段式到 Realtime

### 传统语音 Agent 架构

```
用户说话 → [STT] → 文字 → [LLM] → 文字回复 → [TTS] → 语音输出

问题：
  - 三段串行，延迟 2-5 秒
  - STT 和 TTS 是两个不同模型，音色不统一
  - 无法打断（必须等 TTS 播完）
  - 无法感知语气/情感
  - 三段各自计费
```

### Realtime API 架构

```
用户说话 ←→ WebSocket ←→ OpenAI Realtime Model ←→ AI 说话

优势：
  - 端到端延迟 < 1 秒
  - 原生语音输入输出，不经过文字中转
  - 支持打断（检测到用户说话时停止输出）
  - 能感知语气和情感
  - 统一计费
```

### 延迟对比

| 架构 | 端到端延迟 | 组件数 | 可打断 |
|------|-----------|--------|--------|
| 三段式（STT+LLM+TTS） | 2-5 秒 | 3 | 困难 |
| 流式三段式 | 1-2 秒 | 3 | 有限 |
| Realtime API | 0.3-1 秒 | 1 | 原生支持 |
| 本地 Realtime（端侧） | < 0.5 秒 | 1 | 原生支持 |

---

## 2. Realtime API 核心概念

### 事件驱动模型

```python
# Realtime API 通过 WebSocket 通信
# 所有交互都是"事件"（event）

# === 核心事件类型 ===

# 客户端 → 服务器（client events）：
# session.update       → 更新会话配置
# input_audio_buffer.append    → 发送音频数据
# input_audio_buffer.commit    → 提交音频（手动模式）
# input_audio_buffer.clear     → 清空音频缓冲
# conversation.item.create     → 添加对话项（文本/音频）
# response.create      → 请求生成回复

# 服务器 → 客户端（server events）：
# session.created      → 会话已创建
# session.updated      → 会话配置已更新
# input_audio_buffer.speech_started   → 检测到用户开始说话
# input_audio_buffer.speech_stopped    → 检测到用户停止说话
# input_audio_buffer.committed        → 音频已提交
# conversation.item.created           → 对话项已创建
# response.audio.delta               → 音频输出增量（流式）
# response.audio_transcript.delta     → 文字转录增量
# response.text.delta                 → 文本输出增量
# response.function_call_arguments.delta → 函数调用参数增量
# response.done                       → 回复完成
```

### 会话配置

```python
import json
from websockets.asyncio.client import connect

async def create_realtime_session():
    """创建 Realtime API 会话"""
    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"

    async with connect(
        url,
        additional_headers={
            "Authorization": "Bearer sk-...",
            "OpenAI-Beta": "realtime=v1"
        }
    ) as ws:

        # 配置会话
        session_config = {
            "type": "session.update",
            "session": {
                # 语音输入输出配置
                "modalities": ["text", "audio"],

                # 语音选择
                "voice": "alloy",  # alloy, echo, shimmer, sage, ash, coral

                # 输入音频格式
                "input_audio_format": "pcm16",  # 16-bit PCM, 24kHz, mono

                # 输出音频格式
                "output_audio_format": "pcm16",

                # VAD（语音活动检测）配置
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,        # 检测阈值 0-1
                    "prefix_padding_ms": 300, # 开始说话前保留的音频
                    "silence_duration_ms": 500, # 停止说话的静默时长
                },

                # 工具（函数调用）
                "tools": [
                    {
                        "type": "function",
                        "name": "get_weather",
                        "description": "获取指定城市的天气",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "city": {"type": "string", "description": "城市名"}
                            },
                            "required": ["city"]
                        }
                    }
                ],

                # 工具选择策略
                "tool_choice": "auto",  # auto, none, required, specific

                # 温度
                "temperature": 0.8,

                # 最大输出 Token
                "max_response_output_tokens": 4096,

                # 系统指令
                "instructions": "你是一个友好的中文语音助手。回答简洁，适合语音交互。"
            }
        }

        await ws.send(json.dumps(session_config))

        # 等待确认
        response = await ws.recv()
        session_created = json.loads(response)
        print(f"会话已创建: {session_created['session']['id']}")

        return ws
```

---

## 3. 完整语音 Agent 实现

### 音频采集与发送

```python
import pyaudio
import asyncio
import json
import base64

# 音频参数
CHUNK_SIZE = 1024
SAMPLE_RATE = 24000  # OpenAI Realtime 要求 24kHz
CHANNELS = 1
FORMAT = pyaudio.paInt16

class RealtimeVoiceAgent:
    """完整的 Realtime 语音 Agent"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.ws = None
        self.audio_output_buffer = asyncio.Queue()
        self.conversation_history = []
        self.is_speaking = False
        self.is_listening = True

    async def connect(self, instructions: str = "你是中文语音助手"):
        """连接 Realtime API"""
        url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17"

        self.ws = await connect(url, additional_headers={
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1"
        })

        # 配置会话
        await self.ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "modalities": ["text", "audio"],
                "voice": "alloy",
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
                "instructions": instructions,
                "temperature": 0.8,
                "max_response_output_tokens": 4096,
            }
        }))

        # 等待会话创建确认
        event = json.loads(await self.ws.recv())
        assert event["type"] == "session.created"
        print(f"Realtime 会话已建立")

    async def send_audio(self, audio_data: bytes):
        """发送音频数据"""
        audio_b64 = base64.b64encode(audio_data).decode()
        await self.ws.send(json.dumps({
            "type": "input_audio_buffer.append",
            "audio": audio_b64
        }))

    async def listen_events(self):
        """监听服务器事件"""
        async for message in self.ws:
            event = json.loads(message)
            event_type = event["type"]

            # 用户开始说话
            if event_type == "input_audio_buffer.speech_started":
                self.is_speaking = False
                print("\r[用户说话中...]", end="", flush=True)

            # 用户停止说话
            elif event_type == "input_audio_buffer.speech_stopped":
                print("\r[处理中...]", end="", flush=True)

            # AI 开始回复（音频流）
            elif event_type == "response.audio.delta":
                audio_data = base64.b64decode(event["delta"])
                await self.audio_output_buffer.put(audio_data)
                self.is_speaking = True

            # AI 回复的文字转录
            elif event_type == "response.audio_transcript.delta":
                print(f"\rAI: {event['delta']}", end="", flush=True)

            # 回复完成
            elif event_type == "response.done":
                self.is_speaking = False
                print()  # 换行

            # 函数调用
            elif event_type == "response.function_call_arguments.done":
                await self.handle_function_call(event)

    async def handle_function_call(self, event):
        """处理函数调用"""
        func_name = event.get("name", "")
        call_id = event.get("call_id", "")
        args = json.loads(event.get("arguments", "{}"))

        result = ""
        if func_name == "get_weather":
            result = f"{args.get('city', '')}今天晴，25度"

        # 返回函数结果
        await self.ws.send(json.dumps({
            "type": "conversation.item.create",
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": result
            }
        }))

        # 请求模型基于函数结果继续回复
        await self.ws.send(json.dumps({"type": "response.create"}))

    async def run(self):
        """运行 Agent"""
        # 启动事件监听
        listen_task = asyncio.create_task(self.listen_events())

        # 音频采集
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=FORMAT, channels=CHANNELS,
            rate=SAMPLE_RATE, input=True,
            frames_per_buffer=CHUNK_SIZE
        )

        print("开始说话...（Ctrl+C 退出）")

        try:
            while True:
                audio_data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                await self.send_audio(audio_data)
                await asyncio.sleep(0.01)  # 让出控制权
        except KeyboardInterrupt:
            print("\n退出")
        finally:
            stream.stop_stream()
            stream.close()
            pa.terminate()
            listen_task.cancel()
```

---

## 4. LangGraph + Realtime 集成

### 架构设计

```
用户语音
  ↓
Realtime API（WebSocket）
  ↓ 函数调用事件
LangGraph Agent（工具编排）
  ↓ 工具结果
Realtime API（返回给用户）
  ↓
用户听到回复
```

### 实现方案

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class VoiceAgentState(TypedDict):
    transcript: str           # 用户说话的文字转录
    function_calls: list      # 待处理的函数调用
    tool_results: dict         # 工具结果
    response_text: str         # AI 回复文字
    ws_ref: object             # WebSocket 引用
    call_id: str              # 当前函数调用 ID

# 当 Realtime API 发起函数调用时，转到 LangGraph 处理
async def process_tool_call_node(state: VoiceAgentState):
    """处理 Realtime API 发来的函数调用"""
    func_name = state["function_calls"][0]["name"]
    args = state["function_calls"][0]["arguments"]

    # 执行工具
    result = await execute_tool(func_name, args)

    return {"tool_results": {func_name: result}}

async def execute_tool(name: str, args: dict) -> str:
    """工具执行器"""
    tools = {
        "get_weather": lambda args: f"{args['city']}晴，25度",
        "search_knowledge": lambda args: search_kb(args["query"]),
        "create_ticket": lambda args: create_ticket(args),
    }
    return await tools.get(name, lambda a: "未知工具")(args)

async def send_result_node(state: VoiceAgentState):
    """把工具结果发回 Realtime API"""
    ws = state["ws_ref"]
    call_id = state["call_id"]

    await ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {
            "type": "function_call_output",
            "call_id": call_id,
            "output": json.dumps(state["tool_results"], ensure_ascii=False)
        }
    }))

    # 请求 Realtime API 继续回复
    await ws.send(json.dumps({"type": "response.create"}))

    return {}

# 构建 LangGraph
graph = StateGraph(VoiceAgentState)
graph.add_node("process_tool", process_tool_call_node)
graph.add_node("send_result", send_result_node)
graph.add_edge(START, "process_tool")
graph.add_edge("process_tool", "send_result")
graph.add_edge("send_result", END)

voice_tool_agent = graph.compile()
```

---

## 5. 打断处理

### 中断与恢复

```python
class InterruptionHandler:
    """处理用户打断 AI 说话"""

    def __init__(self):
        self.is_ai_speaking = False
        self.response_id = None
        self.audio_queue = asyncio.Queue()

    async def on_speech_started(self):
        """用户开始说话时触发"""
        if self.is_ai_speaking:
            # 清空音频输出队列
            while not self.audio_queue.empty():
                self.audio_queue.get_nowait()

            self.is_ai_speaking = False

            # 取消当前响应（发送给 Realtime API）
            await self.ws.send(json.dumps({
                "type": "response.cancel",
                "response_id": self.response_id
            }))

    async def on_audio_delta(self, delta: bytes):
        """收到 AI 音频增量"""
        if self.is_ai_speaking:
            await self.audio_queue.put(delta)

    async def play_audio(self, audio_output):
        """播放音频"""
        while True:
            chunk = await self.audio_queue.get()
            if chunk is None:  # 停止信号
                break
            audio_output.write(chunk)
```

---

## 6. 替代方案对比

### 语音 Agent 方案全景

| 方案 | 延迟 | 成本 | 灵活性 | 适用场景 |
|------|------|------|--------|----------|
| OpenAI Realtime API | < 1s | 高 | 中 | 高质量实时对话 |
| Deepgram + LLM + ElevenLabs | 1-2s | 中 | 高 | 自定义语音/模型 |
| AssemblyAI + LLM + Azure TTS | 1-2s | 中 | 高 | 企业级 |
| 本地 Whisper + LLM + Coqui TTS | 2-4s | 低 | 极高 | 隐私敏感/离线 |
| 讯飞语音 + LLM + 讯飞合成 | 1-2s | 中 | 中 | 中文场景 |

### 三段式流式方案（Realtime 不可用时的替代）

```python
# 三段式流式语音 Agent
async def streaming_voice_agent():
    """三段式流式语音 Agent"""
    import speech_recognition as sr
    from openai import AsyncOpenAI

    client = AsyncOpenAI()
    recognizer = sr.Recognizer()

    # 1. STT: 流式语音识别
    with sr.Microphone(sample_rate=16000) as source:
        audio = recognizer.listen(source)

    text = recognizer.recognize_google(audio, language="zh-CN")

    # 2. LLM: 流式文本生成
    stream = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": text}],
        stream=True,
    )

    # 3. TTS: 边生成边合成
    # 按句子切分，每句立即合成播放
    buffer = ""
    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        buffer += delta

        # 遇到标点就合成播放
        if any(p in buffer for p in "。！？.!?"):
            audio_data = await synthesize_speech(buffer)
            play_audio(audio_data)
            buffer = ""
```

---

## 7. 成本分析

### Realtime API 定价

```python
@dataclass
class RealtimeCost:
    """Realtime API 成本模型"""

    # 音频 Token 定价
    audio_input_per_m: float = 40.0    # $/百万音频 Token
    audio_output_per_m: float = 80.0  # $/百万音频 Token
    text_input_per_m: float = 5.00    # $/百万文本 Token
    text_output_per_m: float = 20.0   # $/百万文本 Token

    # 每分钟音频约 12000 音频 Token
    tokens_per_minute = 12_000

    def conversation_cost(self, duration_minutes: float,
                          ai_talk_ratio: float = 0.4) -> float:
        """对话成本"""
        ai_minutes = duration_minutes * ai_talk_ratio
        user_minutes = duration_minutes * (1 - ai_talk_ratio)

        input_cost = user_minutes * self.tokens_per_minute / 1_000_000 * self.audio_input_per_m
        output_cost = ai_minutes * self.tokens_per_minute / 1_000_000 * self.audio_output_per_m

        return input_cost + output_cost

    def daily_cost(self, conversations_per_day: int, avg_duration: float) -> float:
        """日成本"""
        return self.conversation_cost(avg_duration) * conversations_per_day


cost = RealtimeCost()
# 5 分钟对话
print(f"5分钟对话: ${cost.conversation_cost(5):.4f}")  # ~$1.44
# 每天 100 次对话，每次 3 分钟
print(f"日成本(100次×3分钟): ${cost.daily_cost(100, 3):.2f}")  # ~$17.28
```

### 成本优化

```
1. 混合模式
   - 简单问题用文本交互
   - 复杂/实时场景才用语音

2. 会话管理
   - 设置 max_response_output_tokens 避免冗长
   - 合理设置 silence_duration_ms 减少空转

3. 模型选择
   - gpt-4o-realtime-preview: 高质量
   - gpt-4o-mini-realtime: 低成本（如果可用）

4. 缓存常见回复
   - 固定话术用预录制音频
   - 动态内容才用 Realtime
```

---

## 8. 中文场景适配

### 讯飞语音方案对比

```python
# 讯飞实时语音方案（中文场景）

# 讯飞优势：
# - 中文识别率更高
# - 支持方言
# - 国内部署延迟低
# - 支持自定义发音人

# 讯飞 + LangChain 集成架构
"""
用户说话 → 讯飞RTASR（实时语音识别）→ 文字
→ LangChain Agent（工具调用/推理）
→ 讯飞TTS（语音合成）→ 用户听到回复

延迟: 1-2秒（中文场景）
成本: 约 ¥0.01-0.05/分钟（比 OpenAI 便宜 10x+）
"""

# 混合方案：讯飞 STT + OpenAI LLM + 讯飞 TTS
async def hybrid_voice_agent():
    """混合方案"""
    # 1. 讯飞实时识别
    text = await xfyun_stt(audio_stream)

    # 2. OpenAI/本地 LLM 处理
    response = await llm.ainvoke(text)

    # 3. 讯飞语音合成
    audio = await xfyun_tts(response)

    return audio
```

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Realtime API 与三段式的区别 | ☐ |
| 知道 Realtime API 的事件驱动模型 | ☐ |
| 能配置会话（voice/VAD/tools） | ☐ |
| 实现了完整的语音 Agent 循环 | ☐ |
| 处理了打断（speech_started → cancel） | ☐ |
| 能集成 LangGraph 处理函数调用 | ☐ |
| 理解成本模型和优化策略 | ☐ |
| 了解中文场景的替代方案 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 流式输出与异步编程 | 流式处理基础 |
| 17 | 中文 LLM 集成指南 | 中文语音场景 |
| 34 | 音频语音处理 | 音频处理基础 |
| 98 | 流式输出前端集成 | 前端音频处理 |
| 114 | LangGraph 流式 API 深度 | LangGraph 流式 |
| 130 | 流式输出前端集成指南 | SSE/WebSocket 集成 |
| 211 | 流式输出图解 | 流式架构 |
| 353 | Agent 流式输出与 SSE | 流式推送 |
