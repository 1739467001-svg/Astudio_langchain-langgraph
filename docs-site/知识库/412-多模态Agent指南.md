# 多模态 Agent 指南

> 真实世界的用户需求不只有文字——用户上传截图问问题、发语音要求操作、拍视频描述故障。多模态 Agent 能理解图像、音频、视频等多模态输入，并调用相应工具完成任务。

---

## 1. 什么是多模态 Agent

### 单模态 vs 多模态

```
单模态 Agent：
  用户文字 → LLM 理解文字 → 工具调用 → 文字回复

多模态 Agent：
  用户输入（文字/图像/音频/视频）
      ↓
  模态识别 → 多模态 LLM 理解 → 工具调用
      ↓
  多模态输出（文字/图像/音频）
```

### 多模态 Agent 的能力

| 能力 | 输入 | 输出 | 示例 |
|------|------|------|------|
| 图像理解 | 截图/照片 | 文字描述 | 用户上传 UI 截图 → Agent 识别元素并生成定位代码 |
| 语音交互 | 音频 | 文字+语音 | 用户语音提问 → Agent 语音回答 |
| 视频分析 | 视频 | 文字摘要 | 用户上传操作录屏 → Agent 分析流程并生成文档 |
| 图文生成 | 文字描述 | 图像 | 用户描述需求 → Agent 生成 UI 原型图 |
| 文档解析 | PDF/扫描件 | 结构化数据 | 用户上传合同 → Agent 提取条款并标记风险 |

---

## 2. 多模态消息处理

### 消息格式

```python
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
import base64

# 多模态消息：文字 + 图像
def create_image_message(image_path: str, question: str) -> HumanMessage:
    """创建图文混合消息"""
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    return HumanMessage(content=[
        &#123;"type": "text", "text": question&#125;,
        &#123;
            "type": "image_url",
            "image_url": &#123;
                "url": f"data:image/png;base64,&#123;image_data&#125;",
                "detail": "high",  # low / high / auto
            &#125;,
        &#125;,
    ])

# 使用
llm = ChatOpenAI(model="gpt-4o", temperature=0)
msg = create_image_message("ui_screenshot.png", "分析这个UI界面，列出所有可点击元素")
response = llm.invoke([msg])
```

### 音频输入处理

```python
class AudioProcessor:
    """音频处理：语音转文字 + 特征提取"""

    def __init__(self):
        # 方式一：用 OpenAI Whisper API
        # 方式二：用本地 whisper 模型
        pass

    def transcribe(self, audio_path: str) -> dict:
        """音频转文字"""
        from openai import OpenAI
        client = OpenAI()

        with open(audio_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",  # 返回时间戳
                language="zh",
            )

        return &#123;
            "text": transcript.text,
            "segments": [
                &#123;
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                &#125;
                for seg in transcript.segments
            ],
            "language": transcript.language,
            "duration": transcript.duration,
        &#125;

    def process_audio_input(self, audio_path: str, question: str = "") -> str:
        """处理音频输入"""
        result = self.transcribe(audio_path)
        transcript_text = result["text"]

        # 如果有额外问题，拼接
        if question:
            full_text = f"用户语音内容：&#123;transcript_text&#125;\n用户问题：&#123;question&#125;"
        else:
            full_text = transcript_text

        return full_text
```

### 视频帧抽取

```python
import subprocess
import os

class VideoProcessor:
    """视频处理：抽帧 + 逐帧分析"""

    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        fps: int = 1,
    ) -> list[str]:
        """从视频中按帧率抽帧"""
        os.makedirs(output_dir, exist_ok=True)

        # 用 ffmpeg 抽帧
        cmd = [
            "ffmpeg", "-i", video_path,
            "-vf", f"fps=&#123;fps&#125;",  # 每秒抽几帧
            "-q:v", "2",          # 图像质量
            f"&#123;output_dir&#125;/frame_%04d.jpg",
        ]
        subprocess.run(cmd, capture_output=True)

        # 返回帧文件列表（按序号排序）
        frames = sorted([
            os.path.join(output_dir, f)
            for f in os.listdir(output_dir)
            if f.endswith(".jpg")
        ])
        return frames

    def analyze_video(
        self,
        video_path: str,
        question: str,
        llm: ChatOpenAI,
    ) -> str:
        """分析视频内容"""
        frames = self.extract_frames(video_path, "/tmp/video_frames", fps=1)

        # 限制帧数（避免 Token 超限）
        max_frames = 10
        if len(frames) > max_frames:
            # 均匀采样
            step = len(frames) // max_frames
            frames = frames[::step][:max_frames]

        # 构建多帧消息
        content = [&#123;"type": "text", "text": f"以下是视频的 &#123;len(frames)&#125; 个关键帧。&#123;question&#125;"&#125;]

        for frame_path in frames:
            with open(frame_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode()
            content.append(&#123;
                "type": "image_url",
                "image_url": &#123;"url": f"data:image/jpeg;base64,&#123;image_data&#125;"&#125;,
            &#125;)

        response = llm.invoke([HumanMessage(content=content)])
        return response.content
```

---

## 3. 多模态 Agent 架构

```python
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import TypedDict, Annotated, Literal
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
import base64
import os

class ModalityType:
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"


class MultiModalState(TypedDict):
    messages: Annotated[list, add_messages]
    input_modalities: list[str]        # 输入模态类型
    extracted_content: dict            # 从各模态提取的内容
    analysis_result: str               # 分析结果
    output_modalities: list[str]       # 输出模态类型
    response_content: list[dict]       # 多模态输出内容


def modality_detector_node(state: MultiModalState) -> dict:
    """检测输入消息的模态类型"""
    modalities = set()
    last_msg = state["messages"][-1]

    if isinstance(last_msg.content, str):
        modalities.add(ModalityType.TEXT)
    elif isinstance(last_msg.content, list):
        for part in last_msg.content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    modalities.add(ModalityType.TEXT)
                elif part.get("type") == "image_url":
                    modalities.add(ModalityType.IMAGE)
                elif part.get("type") == "audio":
                    modalities.add(ModalityType.AUDIO)

    return &#123;"input_modalities": list(modalities)&#125;


def content_extractor_node(state: MultiModalState) -> dict:
    """从各模态提取内容"""
    extracted = &#123;"text": "", "images": [], "audio_transcript": ""&#125;
    last_msg = state["messages"][-1]

    if isinstance(last_msg.content, str):
        extracted["text"] = last_msg.content
    elif isinstance(last_msg.content, list):
        for part in last_msg.content:
            if isinstance(part, dict):
                if part.get("type") == "text":
                    extracted["text"] += part["text"]
                elif part.get("type") == "image_url":
                    extracted["images"].append(part["image_url"]["url"])
                elif part.get("type") == "audio":
                    # 转写音频
                    audio_proc = AudioProcessor()
                    transcript = audio_proc.transcribe(part["audio_path"])
                    extracted["audio_transcript"] = transcript["text"]

    return &#123;"extracted_content": extracted&#125;


def multimodal_analysis_node(state: MultiModalState) -> dict:
    """多模态分析：使用多模态 LLM"""
    content = state["extracted_content"]
    images = content.get("images", [])
    text = content.get("text", "")

    # 构建多模态消息
    msg_parts = []

    # 如果有音频转写，加入
    if content.get("audio_transcript"):
        msg_parts.append(&#123;
            "type": "text",
            "text": f"用户语音转写：&#123;content['audio_transcript']&#125;",
        &#125;)

    # 如果有文字
    if text:
        msg_parts.append(&#123;"type": "text", "text": text&#125;)

    # 如果有图像
    for img_url in images:
        msg_parts.append(&#123;
            "type": "image_url",
            "image_url": &#123;"url": img_url, "detail": "high"&#125;,
        &#125;)

    # 调用多模态 LLM
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    system = SystemMessage(content="""你是一个多模态分析助手。
能够理解图像、音频转写和文字输入。
请综合所有模态信息给出完整分析。""")

    response = llm.invoke([system, HumanMessage(content=msg_parts)])

    return &#123;"analysis_result": response.content&#125;


def response_generator_node(state: MultiModalState) -> dict:
    """生成多模态响应"""
    analysis = state["analysis_result"]

    # 决定输出模态
    output_modalities = [ModalityType.TEXT]

    # 如果用户输入包含图像，可以生成图像（如标注图）
    if ModalityType.IMAGE in state.get("input_modalities", []):
        # 可以调用图像生成工具
        pass

    # 如果用户输入是音频，可以生成语音回复
    if ModalityType.AUDIO in state.get("input_modalities", []):
        output_modalities.append(ModalityType.AUDIO)

    return &#123;
        "output_modalities": output_modalities,
        "response_content": [
            &#123;"type": "text", "text": analysis&#125;,
        ],
        "messages": [AIMessage(content=analysis)],
    &#125;


# 构建多模态 Agent 图
def build_multimodal_agent():
    graph = StateGraph(MultiModalState)

    graph.add_node("detect", modality_detector_node)
    graph.add_node("extract", content_extractor_node)
    graph.add_node("analyze", multimodal_analysis_node)
    graph.add_node("respond", response_generator_node)

    graph.add_edge(START, "detect")
    graph.add_edge("detect", "extract")
    graph.add_edge("extract", "analyze")
    graph.add_edge("analyze", "respond")
    graph.add_edge("respond", END)

    return graph.compile()


# 使用示例
agent = build_multimodal_agent()

# 图文输入
with open("screenshot.png", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

result = agent.invoke(&#123;
    "messages": [HumanMessage(content=[
        &#123;"type": "text", "text": "这个界面有什么问题？"&#125;,
        &#123;"type": "image_url", "image_url": &#123;"url": f"data:image/png;base64,&#123;img_b64&#125;"&#125;&#125;,
    ])],
    "input_modalities": [],
    "extracted_content": &#123;&#125;,
    "analysis_result": "",
    "output_modalities": [],
    "response_content": [],
&#125;)
```

---

## 4. 多模态工具

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage

@tool
def analyze_image(image_base64: str, question: str) -> str:
    """分析图像内容并回答问题
    
    Args:
        image_base64: Base64 编码的图像
        question: 关于图像的问题
    """
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = llm.invoke([HumanMessage(content=[
        &#123;"type": "text", "text": question&#125;,
        &#123;"type": "image_url", "image_url": &#123;
            "url": f"data:image/png;base64,&#123;image_base64&#125;",
            "detail": "high",
        &#125;&#125;,
    ])])
    return response.content

@tool
def transcribe_audio(audio_path: str) -> str:
    """将音频文件转写为文字
    
    Args:
        audio_path: 音频文件路径
    """
    proc = AudioProcessor()
    result = proc.transcribe(audio_path)
    return result["text"]

@tool
def extract_pdf_content(pdf_path: str, pages: str = "") -> str:
    """从 PDF 提取文字和图像
    
    Args:
        pdf_path: PDF 文件路径
        pages: 要提取的页码，如 "1-5"，空则全部
    """
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)

    page_range = range(len(doc))
    if pages:
        start, end = pages.split("-")
        page_range = range(int(start) - 1, int(end))

    results = []
    for i in page_range:
        page = doc[i]
        text = page.get_text()
        images = page.get_images()

        results.append(f"--- 第 &#123;i+1&#125; 页 ---")
        results.append(f"文字: &#123;text[:500]&#125;...")
        results.append(f"图像数量: &#123;len(images)&#125;")

    return "\n".join(results)

@tool
def generate_chart(data_json: str, chart_type: str = "bar") -> str:
    """根据数据生成图表
    
    Args:
        data_json: JSON 格式的数据
        chart_type: 图表类型 bar/line/pie
    """
    import matplotlib.pyplot as plt
    import json

    data = json.loads(data_json)

    fig, ax = plt.subplots(figsize=(10, 6))

    if chart_type == "bar":
        ax.bar(data["labels"], data["values"])
    elif chart_type == "line":
        ax.plot(data["labels"], data["values"])
    elif chart_type == "pie":
        ax.pie(data["values"], labels=data["labels"], autopct="%1.1f%%")

    ax.set_title(data.get("title", ""))
    plt.tight_layout()
    plt.savefig("/tmp/chart.png", dpi=150)
    plt.close()

    with open("/tmp/chart.png", "rb") as f:
        return base64.b64encode(f.read()).decode()
```

---

## 5. 多模态 RAG

```python
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

class MultiModalEmbeddings(Embeddings):
    """多模态嵌入：统一编码文本和图像到同一向量空间"""

    def __init__(self):
        from sentence_transformers import SentenceTransformer
        # CLIP 模型：文本和图像共享向量空间
        self.model = SentenceTransformer("clip-ViT-B-32")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.model.encode(texts).tolist()

    def embed_query(self, text: str) -> list[float]:
        return self.model.encode(text).tolist()

    def embed_image(self, image_path: str) -> list[float]:
        from PIL import Image
        img = Image.open(image_path)
        return self.model.encode(img).tolist()


class MultiModalRetriever:
    """多模态检索器：文字查图、图查文、图查图"""

    def __init__(self):
        self.embeddings = MultiModalEmbeddings()
        # 存储所有嵌入
        self.text_embeddings: list[tuple[str, list[float], Document]] = []
        self.image_embeddings: list[tuple[str, list[float], Document]] = []

    def add_texts(self, documents: list[Document]):
        for doc in documents:
            emb = self.embeddings.embed_query(doc.page_content)
            self.text_embeddings.append((doc.page_content, emb, doc))

    def add_images(self, image_docs: list[Document]):
        """image_docs 的 metadata 中需要有 image_path"""
        for doc in image_docs:
            img_path = doc.metadata["image_path"]
            emb = self.embeddings.embed_image(img_path)
            self.image_embeddings.append((doc.page_content, emb, doc))

    def search_by_text(self, query: str, top_k: int = 5) -> list[Document]:
        """文字搜索：匹配文字和图像"""
        query_emb = self.embeddings.embed_query(query)

        # 在文字中搜索
        text_results = self._search(query_emb, self.text_embeddings, top_k)
        # 在图像中搜索
        image_results = self._search(query_emb, self.image_embeddings, top_k)

        # 合并结果
        all_results = text_results + image_results
        all_results.sort(key=lambda x: x[1], reverse=True)

        return [doc for _, _, doc in all_results[:top_k]]

    def search_by_image(self, image_path: str, top_k: int = 5) -> list[Document]:
        """图像搜索：以图搜文、以图搜图"""
        query_emb = self.embeddings.embed_image(image_path)

        text_results = self._search(query_emb, self.text_embeddings, top_k)
        image_results = self._search(query_emb, self.image_embeddings, top_k)

        all_results = text_results + image_results
        all_results.sort(key=lambda x: x[1], reverse=True)

        return [doc for _, _, doc in all_results[:top_k]]

    @staticmethod
    def _search(query_emb, embedding_list, top_k):
        import numpy as np
        results = []
        for content, emb, doc in embedding_list:
            # 余弦相似度
            sim = np.dot(query_emb, emb) / (
                np.linalg.norm(query_emb) * np.linalg.norm(emb)
            )
            results.append((content, float(sim), doc))
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
```

---

## 6. 各厂商多模态模型对比

| 模型 | 输入模态 | 输出模态 | 上下文 | 特点 |
|------|---------|---------|--------|------|
| GPT-4o | 文字+图像+音频 | 文字+音频 | 128K | 全模态最强 |
| Claude 3.5 | 文字+图像 | 文字 | 200K | 图像理解强 |
| Gemini 1.5 Pro | 文字+图像+音频+视频 | 文字 | 2M | 支持视频 |
| Qwen-VL | 文字+图像 | 文字 | 32K | 中文优化 |
| LLaVA | 文字+图像 | 文字 | 4K | 开源 |

---

## 7. Token 成本与限制

| 模态 | Token 计算 | 成本影响 |
|------|-----------|---------|
| 文字 | 1 Token ≈ 0.75 英文单词 | 基准 |
| 图像 (detail=low) | 固定 85 Token | 低 |
| 图像 (detail=high) | 85 + 面积 × 170 | 高（一张图可达 765T） |
| 音频 | 按时长计费 | 中 |
| 视频 | 每帧按图像计 | 高 |

### 优化策略

```python
class ModalityOptimizer:
    """多模态 Token 优化"""

    @staticmethod
    def optimize_image_size(
        image_path: str,
        max_dimension: int = 1024,
        quality: int = 80,
    ) -> str:
        """压缩图像大小以减少 Token"""
        from PIL import Image
        import io
        import base64

        img = Image.open(image_path)
        # 按比例缩小
        if max(img.size) > max_dimension:
            ratio = max_dimension / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)

        # 压缩为 JPEG
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality)
        return base64.b64encode(buffer.getvalue()).decode()

    @staticmethod
    def select_detail_level(question: str) -> str:
        """根据问题复杂度选择图像精度"""
        if any(kw in question for kw in ["详细", "每个", "所有", "精确"]):
            return "high"
        return "low"  # 简单问题用低精度
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有模态识别 | ☐ |
| 有多模态消息构建 | ☐ |
| 有图像处理工具 | ☐ |
| 有音频转写能力 | ☐ |
| 有视频帧抽取 | ☐ |
| 有多模态 RAG | ☐ |
| 有图像压缩优化 | ☐ |
| 有 Token 成本控制 | ☐ |
| 有多模态输出 | ☐ |
