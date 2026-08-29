# Agent 多模态交互指南

> 用户不只会打字——他们会发图片、语音、视频。Agent 需要处理文字+图像+音频的多模态输入，也能输出文字+图像+语音。这份指南覆盖多模态输入解析、融合处理和多模态输出。

---

## 一、多模态交互全景

```mermaid
graph TB
    subgraph 输入 {"多模态输入"}
        I1["文本输入"]
        I2["图像输入<br/>截图/照片/图表"]
        I3["语音输入<br/>ASR转文字"]
        I4["视频输入<br/>抽帧分析"]
    end

    subgraph 处理 {"Agent处理"}
        P1["模态识别"]
        P2["模态转换<br/>图像→文字/语音→文字"]
        P3["融合理解"]
    end

    subgraph 输出 {"多模态输出"}
        O1["文本回答"]
        O2["图像生成<br/>DALL-E"]
        O3["语音输出<br/>TTS"]
        O4["图表/可视化"]
    end

    输入 --> 处理 --> 输出

    style 处理 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 二、多模态输入处理

```python
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.language_models import BaseChatModel
import base64
from enum import Enum
from dataclasses import dataclass

class ModalityType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"

@dataclass
class ModalityInput:
    """多模态输入。"""
    modality: ModalityType
    content: bytes | str
    mime_type: str = ""
    text_equivalent: str = ""  # 转换后的文字等价物

class MultimodalInputProcessor:
    """多模态输入处理器。"""

    def __init__(self, llm: BaseChatModel, asr_client=None):
        self.llm = llm
        self.asr = asr_client  # 语音识别客户端

    async def process(self, inputs: list[ModalityInput], query: str = "") -> str:
        """处理多模态输入，返回统一的上下文文本。"""
        parts = []

        for inp in inputs:
            if inp.modality == ModalityType.TEXT:
                parts.append(inp.content if isinstance(inp.content, str) else str(inp.content))

            elif inp.modality == ModalityType.IMAGE:
                desc = await self._describe_image(inp.content, query)
                parts.append(f"[图像描述]\n{desc}")

            elif inp.modality == ModalityType.AUDIO:
                text = await self._transcribe_audio(inp.content)
                parts.append(f"[语音转文字]\n{text}")

            elif inp.modality == ModalityType.VIDEO:
                frames = await self._extract_frames(inp.content)
                for i, frame in enumerate(frames[:3]):  # 最多分析3帧
                    desc = await self._describe_image(frame, query)
                    parts.append(f"[视频帧{i+1}]\n{desc}")

        return "\n\n".join(parts)

    async def _describe_image(self, image_bytes: bytes, context: str = "") -> str:
        """用多模态LLM描述图像。"""
        b64 = base64.b64encode(image_bytes).decode()
        content = [
            {"type": "text", "text": f"请描述这张图片的内容。{f'关注与以下问题相关的信息: {context}' if context else ''}"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]
        response = await self.llm.ainvoke([HumanMessage(content=content)])
        return response.content

    async def _transcribe_audio(self, audio_bytes: bytes) -> str:
        """语音转文字。"""
        if self.asr:
            return await self.asr.transcribe(audio_bytes)
        return "[音频内容需ASR处理]"

    async def _extract_frames(self, video_bytes: bytes) -> list[bytes]:
        """从视频提取关键帧。"""
        # 实际用ffmpeg抽帧
        return [video_bytes]  # 简化
```

---

## 三、多模态输出

```python
class MultimodalOutputGenerator:
    """多模态输出生成器。"""

    def __init__(self, llm: BaseChatModel, image_gen=None, tts_client=None):
        self.llm = llm
        self.image_gen = image_gen
        self.tts = tts_client

    async def generate(self, query: str, context: str = "") -> dict:
        """生成多模态回复。"""
        # 1. 文本回答
        prompt = f"基于以下信息回答问题。\n\n信息:\n{context[:2000]}\n\n问题: {query}"
        response = await self.llm.ainvoke([HumanMessage(content=prompt)])
        text_answer = response.content

        # 2. 判断是否需要生成图像
        if self._needs_image(query, text_answer) and self.image_gen:
            image_prompt = self._extract_image_prompt(text_answer)
            image_url = await self.image_gen.generate(image_prompt)
            return {"text": text_answer, "image_url": image_url}

        # 3. 判断是否需要语音输出
        if self._needs_audio(query) and self.tts:
            audio = await self.tts.synthesize(text_answer)
            return {"text": text_answer, "audio": audio}

        return {"text": text_answer}

    @staticmethod
    def _needs_image(query: str, answer: str) -> bool:
        """判断是否需要生成图像。"""
        triggers = ["画", "图", "可视化", "draw", "diagram", "chart"]
        return any(t in query.lower() or t in answer.lower() for t in triggers)

    @staticmethod
    def _needs_audio(query: str) -> bool:
        """判断是否需要语音输出。"""
        return "读出来" in query or "语音" in query or "说" in query

    @staticmethod
    def _extract_image_prompt(text: str) -> str:
        """从回答中提取图像生成提示。"""
        # 简化：用最后一段作为图像提示
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        return lines[-1] if lines else text[:200]
```

---

## 四、多模态对话管理

```mermaid
graph TB
    subgraph 对话 {"多模态对话流程"}
        U1["用户: 文字+'这张图是什么'"] --> PROCESS["多模态处理"]
        IMG["用户上传图像"] --> PROCESS
        PROCESS --> VISION["GPT-4o视觉分析"]
        VISION --> RESPONSE["文字回答<br/>'这是一张...'"]
        RESPONSE --> TTS_CHECK{"需语音?"}
        TTS_CHECK -->|是| AUDIO["语音输出"]
        TTS_CHECK -->|否| TEXT["文字输出"]
    end

    style PROCESS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 图像先转文字再处理 | 与文本管线统一 | ★★★ |
| ASR结果需校验 | 语音识别有误差 | ★★☆ |
| 输出按需选模态 | 不需要每次都生成图像 | ★★☆ |
| 图像描述要准确 | 影响后续推理 | ★★★ |
| 支持混合输入 | 文字+图片同时发 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有多模态输入处理器 | ☐ |
| 有图像理解 | ☐ |
| 有语音输入(ASR) | ☐ |
| 有多模态输出 | ☐ |
| 有语音输出(TTS) | ☐ |
