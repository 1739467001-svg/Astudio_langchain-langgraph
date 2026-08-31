# 附录 AV：多模态代码模板库

> **附录编号：AV** | **阶段：19** | **用途：可复用的多模态代码模板**
>
> 本附录提供 8 个完整的、可直接复制使用的多模态代码模板，覆盖视觉问答、文档解析、多模态RAG、语音Agent等核心场景。

---

## 模板1：视觉问答系统

```python
"""
模板1：视觉问答系统
功能：对图片提问，获取回答
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import base64

class VisualQA:
    def __init__(self, model="gpt-4o"):
        self.llm = ChatOpenAI(model=model, temperature=0)
    
    def encode(self, path):
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    
    def ask(self, image_path, question):
        b64 = self.encode(image_path)
        system = SystemMessage(content=(
            "你是视觉问答助手。仔细看图片，准确回答。"
            "不确定时说明不确定性。"
        ))
        user = HumanMessage(content=[
            {"type": "text", "text": question},
            {"type": "image_url", 
             "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ])
        return self.llm.invoke([system, user]).content
    
    def batch_ask(self, image_path, questions):
        return [{"q": q, "a": self.ask(image_path, q)} for q in questions]

# 使用
qa = VisualQA()
answer = qa.ask("photo.jpg", "图中有几个人？")
```

---

## 模板2：混合PDF解析器

```python
"""
模板2：混合PDF解析器
功能：自动判断数字/扫描页，选择最优解析方案
"""
import pdfplumber
from pdf2image import convert_from_path
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
import base64, io

class SmartPDFParser:
    def __init__(self, model="gpt-4o"):
        self.llm = ChatOpenAI(model=model, temperature=0)
    
    def parse(self, pdf_path):
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and len(text.strip()) > 50:
                    pages.append({
                        "page": i+1, "type": "digital",
                        "text": text,
                        "tables": page.extract_tables(),
                    })
                else:
                    b64 = self._to_img(pdf_path, i)
                    content = self._vlm(b64, i+1)
                    pages.append({
                        "page": i+1, "type": "scanned",
                        "text": content,
                    })
        return pages
    
    def _to_img(self, pdf_path, page_num):
        imgs = convert_from_path(
            pdf_path, first_page=page_num+1,
            last_page=page_num+1, dpi=200
        )
        buf = io.BytesIO()
        imgs[0].save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    
    def _vlm(self, b64, page):
        msg = HumanMessage(content=[
            {"type": "text", "text": f"提取第{page}页全部内容，表格转Markdown"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ])
        return self.llm.invoke([msg]).content
```

---

## 模板3：多模态RAG系统

```python
"""
模板3：多模态RAG系统
功能：图文混合知识库的检索增强生成
"""
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
import base64

class MultiModalRAG:
    def __init__(self, model="gpt-4o", persist_dir="./mm_rag"):
        self.llm = ChatOpenAI(model=model, temperature=0)
        embedder = OpenAIEmbeddings(model="text-embedding-3-small")
        self.text_store = Chroma("rag_text", embedder, persist_dir)
        self.image_store = Chroma("rag_image", embedder, persist_dir)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200
        )
    
    def add_text(self, text, source=""):
        chunks = self.splitter.split_text(text)
        self.text_store.add_documents([
            Document(page_content=c, metadata={"source": source})
            for c in chunks
        ])
    
    def add_image(self, path, description, source=""):
        self.image_store.add_documents([
            Document(page_content=description, 
                     metadata={"image_path": path, "source": source})
        ])
    
    def query(self, question, k=3):
        texts = self.text_store.similarity_search(question, k=k)
        images = self.image_store.similarity_search(question, k=k)
        
        ctx = "\n\n".join(d.page_content for d in texts)
        parts = [{"type": "text", 
                  "text": f"文本:\n{ctx}\n\n问题: {question}"}]
        
        for d in images:
            parts.append({"type": "text", "text": f"[图: {d.page_content}]"})
            img_path = d.metadata.get("image_path")
            if img_path:
                with open(img_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
                parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"}
                })
        
        msg = HumanMessage(content=parts)
        sys = SystemMessage(content="基于检索结果回答，标注来源。")
        return self.llm.invoke([sys, msg]).content
```

---

## 模板4：语音多模态Agent

```python
"""
模板4：语音多模态Agent
功能：语音输入 -> Agent推理 -> 语音输出
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from openai import OpenAI
import whisper, base64

class VoiceAgent:
    def __init__(self, model="gpt-4o"):
        self.asr_model = whisper.load_model("base")
        self.tts_client = OpenAI()
        self.llm = ChatOpenAI(model=model, temperature=0)
        
        @tool
        def analyze_image(image_path: str, question: str) -> str:
            """分析图片并回答问题"""
            with open(image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            msg = HumanMessage(content=[
                {"type": "text", "text": question},
                {"type": "image_url", 
                 "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ])
            return ChatOpenAI(model="gpt-4o").invoke([msg]).content
        
        @tool
        def calculate(expr: str) -> str:
            """数学计算"""
            try: return str(eval(expr))
            except: return "无法计算"
        
        self.agent = create_react_agent(self.llm, [analyze_image, calculate])
    
    def chat(self, audio_path=None, text=None, image_path=None):
        # 1. ASR
        if audio_path:
            user_text = self.asr_model.transcribe(audio_path, language="zh")["text"]
        else:
            user_text = text
        
        # 2. Agent
        if image_path:
            user_text += f"\n(图片: {image_path})"
        
        result = self.agent.invoke({
            "messages": [
                SystemMessage(content=(
                    "你是语音助手。回答简洁口语化，"
                    "每段不超过3句。"
                )),
                HumanMessage(content=user_text),
            ]
        })
        answer = result["messages"][-1].content
        
        # 3. TTS
        resp = self.tts_client.audio.speech.create(
            model="tts-1", voice="nova", input=answer
        )
        resp.write_to_file("response.mp3")
        
        return {"text": user_text, "answer": answer, "audio": "response.mp3"}
```

---

## 模板5：CLIP跨模态检索

```python
"""
模板5：CLIP跨模态检索
功能：用文本查询检索相关图片
"""
from transformers import CLIPModel, CLIPProcessor, CLIPTokenizer
from PIL import Image
import torch, numpy as np, os

class CLIPRetriever:
    def __init__(self, model_name="openai/clip-vit-base-patch32"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.tokenizer = CLIPTokenizer.from_pretrained(model_name)
        self.image_features = []
        self.image_paths = []
    
    def index_images(self, directory):
        files = [f for f in os.listdir(directory) 
                 if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        for f in files:
            path = os.path.join(directory, f)
            img = Image.open(path)
            inputs = self.processor(images=[img], return_tensors="pt").to(self.device)
            with torch.no_grad():
                feat = self.model.get_image_features(**inputs)
                feat = feat / feat.norm(dim=-1, keepdim=True)
            self.image_features.append(feat.cpu().numpy()[0])
            self.image_paths.append(path)
        print(f"已索引 {len(self.image_paths)} 张图片")
    
    def search(self, query, top_k=5):
        inputs = self.tokenizer([query], padding=True, return_tensors="pt").to(self.device)
        with torch.no_grad():
            text_feat = self.model.get_text_features(**inputs)
            text_feat = text_feat / text_feat.norm(dim=-1, keepdim=True)
        
        text_vec = text_feat.cpu().numpy()[0]
        sims = [np.dot(text_vec, f) for f in self.image_features]
        top_idx = np.argsort(sims)[::-1][:top_k]
        return [(self.image_paths[i], sims[i]) for i in top_idx]

# 使用
retriever = CLIPRetriever()
retriever.index_images("./images")
results = retriever.search("一只猫")
for path, score in results:
    print(f"{score:.4f} {path}")
```

---

## 模板6：图像预处理流水线

```python
"""
模板6：图像预处理流水线
功能：扫描件增强（纠偏+去噪+增强+阴影去除）
"""
import cv2, numpy as np

class DocPreprocessor:
    @staticmethod
    def deskew(img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(gray > 0))
        angle = cv2.minAreaRect(coords)[-1]
        angle = -(90 + angle) if angle < -45 else -angle
        h, w = img.shape[:2]
        M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
        return cv2.warpAffine(img, M, (w, h),
                               flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REPLICATE)
    
    @staticmethod
    def denoise(img):
        return cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
    
    @staticmethod
    def enhance(img):
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    
    @staticmethod
    def remove_shadow(img):
        rgb = cv2.split(img)
        result = []
        for p in rgb:
            dilated = cv2.dilate(p, np.ones((7,7), np.uint8))
            bg = cv2.medianBlur(dilated, 21)
            diff = 255 - cv2.absdiff(p, bg)
            result.append(diff)
        return cv2.merge(result)
    
    def process(self, img_path):
        img = cv2.imread(img_path)
        img = self.deskew(img)
        img = self.denoise(img)
        img = self.enhance(img)
        img = self.remove_shadow(img)
        return img

# 使用
proc = DocPreprocessor()
clean = proc.process("scan.png")
cv2.imwrite("clean.png", clean)
```

---

## 模板7：表格提取器

```python
"""
模板7：VLM表格提取器
功能：从图片中提取表格为Markdown格式
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import base64

class TableExtractor:
    def __init__(self, model="gpt-4o"):
        self.llm = ChatOpenAI(model=model, temperature=0)
    
    def extract(self, image_path):
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        
        system = SystemMessage(content=(
            "你是表格识别专家。将图片中的表格转为Markdown。"
            "保持结构，表头加粗，空单元格用空字符串。"
        ))
        user = HumanMessage(content=[
            {"type": "text", "text": "识别所有表格，输出Markdown。"},
            {"type": "image_url", 
             "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ])
        return self.llm.invoke([system, user]).content

# 使用
ext = TableExtractor()
md = ext.extract("table_image.png")
print(md)
```

---

## 模板8：图像优化器

```python
"""
模板8：图像优化器
功能：压缩图片大小以降低API Token消耗
"""
from PIL import Image
import io, base64

class ImageOptimizer:
    @staticmethod
    def optimize(path, max_size=768, quality=85):
        """压缩图片，返回Base64"""
        img = Image.open(path)
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            img = img.resize(
                tuple(int(d * ratio) for d in img.size),
                Image.LANCZOS
            )
        buf = io.BytesIO()
        # 统一转JPEG（除非有透明通道）
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(buf, format="JPEG", quality=quality)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    
    @staticmethod
    def batch_optimize(directory, max_size=768, quality=85):
        """批量优化"""
        import os
        results = {}
        for f in os.listdir(directory):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                path = os.path.join(directory, f)
                results[f] = ImageOptimizer.optimize(
                    path, max_size, quality
                )
        return results

# 使用
b64 = ImageOptimizer.optimize("big_photo.jpg", max_size=512)
print(f"优化后大小: {len(b64)} bytes (Base64)")
```
