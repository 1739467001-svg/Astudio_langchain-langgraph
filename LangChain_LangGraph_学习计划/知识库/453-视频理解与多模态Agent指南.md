# 视频理解与多模态 Agent 指南

> 图片理解已经成熟，但视频呢？一个 30 秒的产品演示视频、一段监控录像、一场会议录屏——Agent 能看懂吗？2024 年 Gemini 1.5 Pro 支持 1 小时视频输入，GPT-4o 可以理解视频帧序列，Qwen-VL 支持视频问答。视频理解 Agent 正在从实验室走向生产。本指南详解视频理解的技术方案、帧采样策略、视频 RAG，以及实际应用场景。

---

## 1. 视频理解的挑战

### 与图片理解的区别

```
图片理解：
  1 张图片 → VLM 理解 → 回答
  Token 消耗：~1000-2000/图片

视频理解：
  30秒视频 = 30fps × 30s = 900帧
  如果每帧都送 VLM：
  Token 消耗：900 × 1500 = 135万 Token（爆炸！）
  
  问题：
  1. Token 消耗巨大
  2. 时间维度信息如何表示
  3. 帧间关系如何理解
  4. 音频轨道如何处理
  5. 实时性要求
```

### 视频理解方案分类

| 方案 | 原理 | 优势 | 劣势 |
|------|------|------|------|
| 逐帧采样 | 抽帧→每帧当图片→VLM | 简单 | Token 多、丢时间信息 |
| 关键帧提取 | 检测场景切换→关键帧→VLM | 省 Token | 可能漏重要信息 |
| 视频编码模型 | 端到端视频理解（Gemini） | 最佳效果 | 模型限制 |
| 帧采样+时序描述 | 采样+LLM总结时序 | 平衡 | 依赖 LLM 质量 |
| 视频 RAG | 抽帧索引→检索相关帧 | 大视频可处理 | 检索质量 |

---

## 2. 帧采样策略

### 采样方法

```python
import cv2
import base64
from dataclasses import dataclass

@dataclass
class FrameSampler:
    """视频帧采样器"""

    def uniform_sample(self, video_path: str, num_frames: int = 10) -> list:
        """均匀采样：从视频中均匀抽取 N 帧"""
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps if fps > 0 else 0

        # 计算采样间隔
        interval = total_frames // num_frames if num_frames > 0 else 1

        frames = []
        for i in range(num_frames):
            frame_num = i * interval
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if ret:
                timestamp = frame_num / fps if fps > 0 else 0
                frames.append({
                    "frame": frame,
                    "timestamp": timestamp,
                    "frame_num": frame_num,
                })
        cap.release()

        return frames

    def scene_change_sample(self, video_path: str, threshold: float = 30.0) -> list:
        """场景切换采样：只在画面变化大时抽帧"""
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)

        frames = []
        prev_frame = None
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            if prev_frame is not None:
                diff = cv2.absdiff(gray, prev_frame)
                score = diff.mean()

                if score > threshold:
                    timestamp = frame_num / fps if fps > 0 else 0
                    frames.append({
                        "frame": frame,
                        "timestamp": timestamp,
                        "frame_num": frame_num,
                        "change_score": score,
                    })

            prev_frame = gray
            frame_num += 1

        cap.release()

        # 限制最大帧数
        if len(frames) > 20:
            # 按变化分数排序，取 Top 20
            frames.sort(key=lambda x: x["change_score"], reverse=True)
            frames = frames[:20]
            frames.sort(key=lambda x: x["timestamp"])

        return frames

    def smart_sample(self, video_path: str, target_frames: int = 10) -> list:
        """智能采样：均匀+场景切换结合"""
        # 先均匀采样
        uniform = self.uniform_sample(video_path, target_frames)
        # 再补充关键变化帧
        scene = self.scene_change_sample(video_path, threshold=50.0)

        # 去重合并（时间戳接近的合并）
        all_frames = uniform + scene
        all_frames.sort(key=lambda x: x["timestamp"])

        # 限制数量
        if len(all_frames) > target_frames:
            step = len(all_frames) / target_frames
            all_frames = [all_frames[int(i * step)] for i in range(target_frames)]

        return all_frames

    def frame_to_base64(self, frame) -> str:
        """帧转 base64"""
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buffer).decode()
```

### 采样策略选择

```python
def choose_sampling_strategy(video_duration: float, content_type: str) -> str:
    """根据视频特征选择采样策略"""
    # 短视频（< 30秒）：均匀采样足够
    if video_duration < 30:
        return "uniform"

    # 会议录屏：场景变化少，均匀即可
    if content_type == "meeting":
        return "uniform"

    # 监控视频：关键事件在变化点
    if content_type == "surveillance":
        return "scene_change"

    # 产品演示：混合采样
    if content_type == "demo":
        return "smart"

    # 默认智能采样
    return "smart"
```

---

## 3. VLM 视频理解实现

### Gemini 方案（原生视频支持）

```python
# Gemini 1.5 Pro 原生支持视频输入
# pip install google-generativeai

import google.generativeai as genai

genai.configure(api_key="your-api-key")

def understand_video_gemini(video_path: str, question: str) -> str:
    """用 Gemini 理解视频"""
    # 上传视频文件
    video_file = genai.upload_file(path=video_path)

    # 等待处理完成
    import time
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai.get_file(video_file.name)

    # 提问
    model = genai.GenerativeModel("gemini-1.5-pro")
    response = model.generate_content(
        [video_file, question],
        generation_config={"temperature": 0},
    )

    return response.text

# 使用
result = understand_video_gemini(
    "product_demo.mp4",
    "这个视频展示了什么产品？主要功能有哪些？按时间顺序列出。"
)
```

### GPT-4o 帧序列方案

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

async def understand_video_gpt4o(frames: list, question: str) -> str:
    """用 GPT-4o 理解视频帧序列"""
    model = ChatOpenAI(model="gpt-4o", temperature=0)

    # 构建多图消息
    content = [{"type": "text", "text": f"以下是一个视频的 {len(frames)} 个关键帧，按时间顺序排列。\n\n问题: {question}"}]

    for i, frame in enumerate(frames):
        b64 = frame_to_base64(frame["frame"])
        content.append({
            "type": "text",
            "text": f"[时间 {frame['timestamp']:.1f}s]"
        })
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"}
        })

    response = await model.ainvoke([HumanMessage(content=content)])
    return response.content
```

### 帧描述+LLM 方案（省 Token）

```python
async def video_to_text_then_reason(frames: list, question: str) -> str:
    """先用 VLM 描述每帧，再用 LLM 推理（省 Token）"""
    vlm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # Step 1: 用便宜 VLM 描述每帧
    frame_descriptions = []
    for frame in frames:
        b64 = frame_to_base64(frame["frame"])
        response = await vlm.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": "用一句话描述这帧画面中的关键内容。"},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ])
        ])
        frame_descriptions.append({
            "timestamp": frame["timestamp"],
            "description": response.content,
        })

    # Step 2: 用 LLM 综合推理
    timeline = "\n".join([
        f"[{d['timestamp']:.1f}s] {d['description']}"
        for d in frame_descriptions
    ])

    response = await llm.ainvoke(
        f"以下是一个视频的帧描述时间线：\n\n{timeline}\n\n问题: {question}"
    )

    return response.content
```

---

## 4. 视频 RAG

### 大视频检索架构

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings

@dataclass
class VideoRAG:
    """视频 RAG：对长视频建立帧索引"""

    def __init__(self):
        self.vectorstore = Chroma(
            collection_name="video_frames",
            embedding_function=OpenAIEmbeddings(),
        )

    async def index_video(self, video_path: str, metadata: dict = None):
        """索引视频帧"""
        sampler = FrameSampler()
        frames = sampler.smart_sample(video_path, target_frames=50)

        # 为每帧生成描述
        vlm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        texts = []
        metadatas = []
        for frame in frames:
            b64 = sampler.frame_to_base64(frame["frame"])
            response = await vlm.ainvoke([
                HumanMessage(content=[
                    {"type": "text", "text": "详细描述这帧画面内容。"},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ])
            ])

            texts.append(response.content)
            metadatas.append({
                "video_path": video_path,
                "timestamp": frame["timestamp"],
                "frame_num": frame["frame_num"],
                **(metadata or {}),
            })

        # 存入向量库
        self.vectorstore.add_texts(texts=texts, metadatas=metadatas)

    async def search_video(self, query: str, top_k: int = 5) -> list:
        """检索相关视频帧"""
        results = self.vectorstore.similarity_search(query, k=top_k)

        return [{
            "description": doc.page_content,
            "video_path": doc.metadata["video_path"],
            "timestamp": doc.metadata["timestamp"],
        } for doc in results]

    async def answer_video_question(self, video_path: str, question: str) -> str:
        """视频问答"""
        # 检索相关帧
        relevant = await self.search_video(question, top_k=3)

        # 获取这些帧的图片
        sampler = FrameSampler()
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)

        frame_images = []
        for r in relevant:
            frame_num = int(r["timestamp"] * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if ret:
                frame_images.append({
                    "frame": frame,
                    "timestamp": r["timestamp"],
                    "description": r["description"],
                })
        cap.release()

        # 用 VLM 回答
        return await understand_video_gpt4o(frame_images, question)
```

---

## 5. 音频轨道处理

```python
@dataclass
class AudioTrackProcessor:
    """视频音频轨道处理"""

    async def extract_audio(self, video_path: str) -> str:
        """从视频提取音频"""
        audio_path = video_path.replace(".mp4", ".wav")
        import subprocess
        subprocess.run([
            "ffmpeg", "-i", video_path, "-vn", "-acodec",
            "pcm_s16le", "-ar", "16000", "-ac", "1", audio_path
        ], capture_output=True)
        return audio_path

    async def transcribe_audio(self, audio_path: str) -> str:
        """音频转文字"""
        # 使用 Whisper 或讯飞 ASR
        from langchain_community.document_loaders import WhisperTranscriber
        transcriber = WhisperTranscriber(model_name="base")
        result = await transcriber.atranscribe(audio_path)
        return result

    async def process_video_with_audio(self, video_path: str, question: str) -> str:
        """视频+音频综合理解"""
        # 1. 视频帧
        sampler = FrameSampler()
        frames = sampler.smart_sample(video_path, 10)

        # 2. 音频转文字
        audio_path = await self.extract_audio(video_path)
        transcript = await self.transcribe_audio(audio_path)

        # 3. 综合理解
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        frame_descriptions = []
        for frame in frames:
            b64 = sampler.frame_to_base64(frame["frame"])
            frame_descriptions.append(f"[{frame['timestamp']:.1f}s] 见图片")

        # 构建多模态消息（帧+文字转录）
        content = [
            {"type": "text", "text": f"视频帧: {len(frames)}个\n音频转录:\n{transcript}\n\n问题: {question}"}
        ]
        for frame in frames:
            b64 = sampler.frame_to_base64(frame["frame"])
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})

        response = await llm.ainvoke([HumanMessage(content=content)])
        return response.content
```

---

## 6. 应用场景

### 场景实践

| 场景 | 输入 | 输出 | 技术方案 |
|------|------|------|---------|
| 会议纪要 | 会议录屏 | 议题+决议+待办 | 音频转录+帧描述 |
| 产品演示分析 | 演示视频 | 功能列表+亮点 | 关键帧+VLM |
| 监控异常检测 | 监控视频 | 异常事件报告 | 场景切换+VLM |
| 教学视频索引 | 课程视频 | 知识点索引+时间戳 | 视频 RAG |
| 广告合规审查 | 广告视频 | 合规报告 | 帧+音频综合 |
| 直播实时分析 | 直播流 | 实时弹幕/标注 | 流式帧采样 |

### 会议纪要 Agent

```python
async def meeting_minutes_agent(video_path: str) -> dict:
    """会议纪要生成 Agent"""
    # 1. 提取音频转录
    audio_proc = AudioTrackProcessor()
    audio_path = await audio_proc.extract_audio(video_path)
    transcript = await audio_proc.transcribe_audio(audio_path)

    # 2. 抽取关键帧（PPT 切换帧）
    sampler = FrameSampler()
    frames = sampler.scene_change_sample(video_path, threshold=25.0)

    # 3. 用 LLM 生成纪要
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    response = await llm.ainvoke(
        f"""根据以下会议信息生成结构化纪要。

音频转录:
{transcript}

视频帧时间点:
{chr(10).join(f"[{f['timestamp']:.1f}s] 画面变化" for f in frames)}

输出格式：
## 会议主题
## 参与者
## 讨论议题（按时间顺序）
## 关键决议
## 待办事项（负责人+截止日期）
## 下次会议时间"""
    )

    return {"minutes": response.content, "transcript": transcript}
```

---

## 7. 成本与性能

### Token 消耗模型

```python
@dataclass
class VideoUnderstandingCost:
    """视频理解成本估算"""

    # GPT-4o 视觉 Token
    image_tokens: int = 765  # 每帧约 765 Token（853x480）

    # GPT-4o 定价
    input_price: float = 2.50  # $/M tokens
    output_price: float = 10.00

    def estimate(self, num_frames: int, output_tokens: int = 500) -> float:
        """估算成本"""
        input_tokens = num_frames * self.image_tokens + 200  # 200 文字描述
        input_cost = input_tokens / 1_000_000 * self.input_price
        output_cost = output_tokens / 1_000_000 * self.output_price
        return input_cost + output_cost

# 使用
cost = VideoUnderstandingCost()
print(f"5帧: ${cost.estimate(5):.4f}")     # ~$0.015
print(f"10帧: ${cost.estimate(10):.4f}")   # ~$0.025
print(f"20帧: ${cost.estimate(20):.4f}")   # ~$0.045
```

### 成本优化

```
1. 分级处理
   帧描述用 GPT-4o-mini（便宜）
   综合推理用 GPT-4o（贵但少调一次）

2. 帧数控制
   短视频（<1分钟）：5-10帧
   中视频（1-10分钟）：10-15帧
   长视频（>10分钟）：视频RAG检索

3. 分辨率优化
   分析用 480p（省 Token）
   需要细节时 720p

4. 缓存
   相同视频的帧描述缓存
   常见问题的回答缓存
```

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解视频理解的挑战 | ☐ |
| 能区分四种采样策略 | ☐ |
| 实现了帧采样（均匀/场景切换/智能） | ☐ |
| 能用 Gemini 原生视频理解 | ☐ |
| 能用 GPT-4o 帧序列理解 | ☐ |
| 实现了帧描述+LLM 省 Token 方案 | ☐ |
| 实现了视频 RAG | ☐ |
| 能处理音频轨道 | ☐ |
| 实现了实际应用场景 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 多模态应用开发 | 多模态基础 |
| 113 | 多模态 RAG 实践指南 | 多模态 RAG |
| 142 | 多模态生成 | 图像理解 |
| 191 | Agent 多模态交互指南 | 多模态交互 |
| 368 | 多模态检索与跨模态对齐 | 跨模态 |
| 386 | Agent 多模态处理 | 多模态处理 |
| 412 | 多模态 Agent 指南 | 多模态 Agent |
| 433 | OpenAI Realtime API 与语音 | 音频处理 |
| 443 | 多模态文档智能与 OCR | 文档视觉 |
