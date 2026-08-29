# Agent 多模态输入输出处理指南

> 用户发一张图片问"这个表格里有多少行"——Agent 需要理解图像并回答。这篇指南讲透多模态输入（图片+文本）、多模态输出（文本+图片生成）和混合内容的处理流程。

---

## 一、多模态处理架构

```mermaid
graph TB
    INPUT["用户输入"] --> CLASSIFY&#123;"输入类型?"&#125;
    CLASSIFY -->|纯文本| TEXT["文本处理"]
    CLASSIFY -->|图文混合| IMAGE["图像理解<br/>提取文本+描述"]
    CLASSIFY -->|多图| MULTI["多图关联<br/>对比+组合"]

    TEXT & IMAGE & MULTI --> LLM["多模态LLM<br/>GPT-4o/Vision"]
    LLM --> RESPONSE&#123;"输出类型?"&#125;
    RESPONSE -->|纯文本| TEXT_OUT["文本回答"]
    RESPONSE -->|图文回答| GEN_IMAGE["图像生成<br/>DALL-E/SD"]
    TEXT_OUT & GEN_IMAGE --> RESULT["返回用户"]

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style LLM fill:#E3F2FD,stroke:#1565C0
    style GEN_IMAGE fill:#F3E5F5,stroke:#6A1B9A
```

---

## 二、多模态输入处理

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Union
import base64
import json
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o", temperature=0)

class MediaType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    IMAGE_URL = "image_url"
    IMAGE_BASE64 = "image_base64"

@dataclass
class MultiModalInput:
    """多模态输入。"""
    text: str = ""
    images: list[dict] = field(default_factory=list)  # [&#123;type, data/url&#125;]
    metadata: dict = field(default_factory=dict)

    def has_images(self) -> bool:
        return len(self.images) > 0

    def to_message_content(self) -> list[dict]:
        """转为OpenAI消息内容格式。"""
        content = []
        if self.text:
            content.append(&#123;"type": "text", "text": self.text&#125;)
        for img in self.images:
            if img["type"] == MediaType.IMAGE_URL:
                content.append(&#123;"type": "image_url", "image_url": &#123;"url": img["data"]&#125;&#125;)
            elif img["type"] == MediaType.IMAGE_BASE64:
                content.append(&#123;
                    "type": "image_url",
                    "image_url": &#123;"url": f"data:image/jpeg;base64,&#123;img['data']&#125;"&#125;,
                &#125;)
        return content


class MultiModalProcessor:
    """多模态处理器。"""

    def __init__(self, llm):
        self.llm = llm

    async def analyze_image(self, image_url: str, question: str = "描述这张图片的内容") -> dict:
        """分析图片。"""
        message = HumanMessage(content=[
            &#123;"type": "text", "text": question&#125;,
            &#123;"type": "image_url", "image_url": &#123;"url": image_url&#125;&#125;,
        ])
        response = await self.llm.ainvoke([message])
        return &#123;"question": question, "answer": response.content, "image_url": image_url&#125;

    async def extract_text_from_image(self, image_url: str) -> dict:
        """从图片提取文本（OCR）。"""
        message = HumanMessage(content=[
            &#123;"type": "text", "text": "请提取图片中的所有文字内容，保持原有格式。如果没有文字，回答'无文字'。"&#125;,
            &#123;"type": "image_url", "image_url": &#123;"url": image_url&#125;&#125;,
        ])
        response = await self.llm.ainvoke([message])
        return &#123;"extracted_text": response.content, "image_url": image_url&#125;

    async def compare_images(self, images: list[str], question: str = "对比这些图片的异同") -> dict:
        """对比多张图片。"""
        content = [&#123;"type": "text", "text": question&#125;]
        for url in images:
            content.append(&#123;"type": "image_url", "image_url": &#123;"url": url&#125;&#125;)

        message = HumanMessage(content=content)
        response = await self.llm.ainvoke([message])
        return &#123;"question": question, "answer": response.content, "image_count": len(images)&#125;

    async def answer_with_context(self, query: str, images: list[str], system_prompt: str = "") -> dict:
        """基于图片上下文回答问题。"""
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))

        content = [&#123;"type": "text", "text": query&#125;]
        for url in images:
            content.append(&#123;"type": "image_url", "image_url": &#123;"url": url&#125;&#125;)
        messages.append(HumanMessage(content=content))

        response = await self.llm.ainvoke(messages)
        return &#123;"query": query, "answer": response.content, "images_used": len(images)&#125;

    async def classify_image(self, image_url: str, categories: list[str]) -> dict:
        """图片分类。"""
        prompt = f"请将这张图片分类为以下类别之一：&#123;', '.join(categories)&#125;\n只返回类别名称。"
        message = HumanMessage(content=[
            &#123;"type": "text", "text": prompt&#125;,
            &#123;"type": "image_url", "image_url": &#123;"url": image_url&#125;&#125;,
        ])
        response = await self.llm.ainvoke([message])
        return &#123;
            "image_url": image_url,
            "categories": categories,
            "classification": response.content.strip(),
        &#125;
```

### 多模态输出（图像生成）

```python
@dataclass
class ImageGenerationResult:
    """图像生成结果。"""
    image_url: str
    prompt: str
    model: str = "dall-e-3"
    revised_prompt: str = ""

class ImageGenerator:
    """图像生成器。"""

    def __init__(self):
        self._available = True  # 实际应检查API可用性

    async def generate(self, prompt: str, size: str = "1024x1024", quality: str = "standard") -> ImageGenerationResult:
        """生成图片。"""
        # 实际调用 OpenAI DALL-E API
        # from openai import AsyncOpenAI
        # client = AsyncOpenAI()
        # response = await client.images.generate(model="dall-e-3", prompt=prompt, size=size, quality=quality, n=1)

        # 模拟返回
        return ImageGenerationResult(
            image_url=f"https://example.com/generated/&#123;hash(prompt)%10000&#125;.png",
            prompt=prompt,
            revised_prompt=prompt,
        )

    async def describe_and_generate(self, text_description: str) -> dict:
        """先优化描述再生成图片。"""
        # 用LLM优化图像描述
        optimize_prompt = ChatPromptTemplate.from_messages([
            ("system", "你是图像描述优化器。将用户描述优化为适合DALL-E的英文描述，包含风格、构图、光线细节。"),
            ("human", "&#123;description&#125;"),
        ])
        chain = optimize_prompt | self.llm | StrOutputParser() if hasattr(self.llm, 'invoke') else None

        if chain:
            optimized = await chain.ainvoke(&#123;"description": text_description&#125;)
        else:
            optimized = text_description

        result = await self.generate(optimized)
        return &#123;
            "original_prompt": text_description,
            "optimized_prompt": optimized,
            "image_url": result.image_url,
        &#125;
```

### Agent 集成

```python
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

@tool
async def analyze_image_tool(image_url: str, question: str) -> dict:
    """分析图片内容。

    Args:
        image_url: 图片URL
        question: 关于图片的问题
    """
    processor = MultiModalProcessor(llm)
    return await processor.analyze_image(image_url, question)

@tool
async def extract_text_tool(image_url: str) -> dict:
    """从图片提取文字。

    Args:
        image_url: 图片URL
    """
    processor = MultiModalProcessor(llm)
    return await processor.extract_text_from_image(image_url)

@tool
async def generate_image_tool(description: str) -> dict:
    """根据描述生成图片。

    Args:
        description: 图片描述
    """
    generator = ImageGenerator()
    result = await generator.generate(description)
    return &#123;"image_url": result.image_url, "prompt": result.prompt&#125;

multimodal_agent = create_react_agent(
    llm,
    [analyze_image_tool, extract_text_tool, generate_image_tool],
    prompt="你是多模态智能助手。你可以分析图片、提取图片文字和生成图片。",
)
```

### 使用示例

```python
import asyncio

async def main():
    processor = MultiModalProcessor(llm)

    # 场景1: 图片问答
    result = await processor.analyze_image(
        "https://example.com/table.png",
        "这个表格有多少行数据？数据内容是什么？"
    )
    print(f"图片分析: &#123;result['answer'][:200]&#125;")

    # 场景2: 多图对比
    result = await processor.compare_images(
        ["https://example.com/v1.png", "https://example.com/v2.png"],
        "这两张设计图有什么区别？"
    )
    print(f"对比结果: &#123;result['answer'][:200]&#125;")

    # 场景3: 文档OCR
    result = await processor.extract_text_from_image("https://example.com/document.png")
    print(f"提取文字: &#123;result['extracted_text'][:200]&#125;")

asyncio.run(main())
```

---

## 三、多模态场景对比

| 场景 | 输入 | 输出 | 模型 | 难度 |
|------|------|------|------|------|
| 图片问答 | 图+文本 | 文本 | GPT-4o | 中 |
| 图片OCR | 图 | 文本 | GPT-4o | 中 |
| 多图对比 | 多图+文本 | 文本 | GPT-4o | 高 |
| 文生图 | 文本 | 图 | DALL-E | 中 |
| 图文混合生成 | 图+文本 | 图+文本 | 多模型组合 | 高 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 输入分类 | 先判断有无图片再路由 | ★★★ |
| 图片压缩 | base64太大需压缩 | ★★★ |
| 多图限制 | 最多4-6张 | ★★☆ |
| 输出分离 | 文本和图片分开返回 | ★★☆ |
| 降级策略 | 图片理解失败时转文本 | ★★☆ |
| Token预算 | 图片Token消耗大 | ★★★ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有图片问答 | ☐ |
| 有OCR提取 | ☐ |
| 有多图对比 | ☐ |
| 有图像生成 | ☐ |
| 有输入分类 | ☐ |
| 有降级策略 | ☐ |
