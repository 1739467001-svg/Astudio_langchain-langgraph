# 多模态文档智能与 OCR Agent 指南

> 现实世界的文档不只是文本——PDF 里有表格、图片、公式、手写批注，扫描件有倾斜和噪点，发票有复杂版式。传统 OCR 只能提取文字，无法理解结构。多模态 LLM（GPT-4o/Claude 3.5/Qwen-VL）可以直接"看"文档图片，理解版式、提取结构化数据。本指南详解多模态文档智能的架构、OCR 与 VLM 方案对比，以及文档处理 Agent 的实现。

---

## 1. 文档智能的演进

### 三代技术

```
第一代：传统 OCR（Tesseract / ABBYY）
  图片 → 字符识别 → 纯文本
  丢失版式、表格、图片信息

第二代：OCR + 规则解析
  图片 → OCR → 文本 → 规则提取字段
  版式理解有限，规则维护成本高

第三代：多模态 LLM（VLM）
  图片 → VLM 直接理解 → 结构化数据
  保留版式语义，零规则，自适应版式
```

### 能力对比

| 能力 | 传统 OCR | OCR+规则 | 多模态 VLM |
|------|---------|---------|-----------|
| 文字提取 | ✅ | ✅ | ✅ |
| 表格还原 | ❌ | 有限 | ✅ |
| 版式理解 | ❌ | 规则 | ✅ |
| 手写识别 | ❌ | 需训练 | ✅ |
| 公式识别 | ❌ | ❌ | ✅ |
| 图表理解 | ❌ | ❌ | ✅ |
| 印章/签名 | ❌ | ❌ | ✅ |
| 布局分析 | ❌ | 规则 | ✅ |
| 速度 | 快 | 中 | 慢 |
| 成本 | 低 | 中 | 高 |

---

## 2. OCR 方案对比

### 主流 OCR 引擎

| 引擎 | 类型 | 中文 | 表格 | 公式 | 部署 |
|------|------|------|------|------|------|
| Tesseract | 开源 | ★★★ | ❌ | ❌ | 本地 |
| PaddleOCR | 开源 | ★★★★★ | ✅ | 有限 | 本地 |
| 讯飞 OCR | 商用 | ★★★★★ | ✅ | ✅ | 云API |
| Azure DI | 商用 | ★★★★ | ✅ | ✅ | 云API |
| Google Vision | 商用 | ★★★★ | ✅ | 有限 | 云API |
| GPT-4o Vision | VLM | ★★★★★ | ✅ | ✅ | 云API |
| Claude 3.5 | VLM | ★★★★★ | ✅ | ✅ | 云API |
| Qwen-VL | VLM | ★★★★★ | ✅ | ✅ | 本地/云 |

### PaddleOCR 基础用法

```python
# pip install paddlepaddle paddleocr

from paddleocr import PaddleOCR

# 初始化（中文+英文）
ocr = PaddleOCR(use_angle_cls=True, lang="ch")

def ocr_document(image_path: str) -> list:
    """OCR 识别文档"""
    result = ocr.ocr(image_path, cls=True)

    extracted = []
    for page in result:
        for line in page:
            box = line[0]        # 坐标 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text = line[1][0]    # 文本
            confidence = line[1][1]  # 置信度
            extracted.append({
                "text": text,
                "box": box,
                "confidence": confidence,
            })

    return extracted

# 使用
results = ocr_document("invoice.png")
for r in results:
    print(f"[{r['confidence']:.2f}] {r['text']}")
```

### VLM 方案（GPT-4o / Claude）

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
import base64

# === 用 GPT-4o 理解文档图片 ===
def extract_with_vlm(image_path: str, instruction: str) -> str:
    """用 VLM 直接理解文档图片"""
    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    model = ChatOpenAI(model="gpt-4o", temperature=0)

    response = model.invoke([
        HumanMessage(content=[
            {"type": "text", "text": instruction},
            {"type": "image_url", "image_url": {
                "url": f"data:image/png;base64,{image_b64}"
            }},
        ])
    ])
    return response.content

# 发票信息提取
invoice_result = extract_with_vlm(
    "invoice.png",
    """请提取这张发票的以下信息，以 JSON 格式返回：
    - 发票号码
    - 开票日期
    - 买方名称
    - 卖方名称
    - 金额（不含税）
    - 税额
    - 价税合计
    - 发票类型"""
)
```

---

## 3. 混合方案：OCR + VLM

### 何时用混合方案

```
纯 OCR：
  - 文本提取快、便宜
  - 但不理解结构和语义
  - 适合：纯文本文档

纯 VLM：
  - 理解全面、零规则
  - 但慢、贵
  - 适合：复杂版式、少量文档

混合方案：
  1. OCR 快速提取所有文字（便宜）
  2. VLM 只处理需要理解的页面/区域（精准）
  3. 合并结果
  适合：大量文档，部分需要深度理解
```

### 混合实现

```python
@dataclass
class HybridDocumentProcessor:
    """OCR + VLM 混合文档处理器"""

    async def process(self, image_path: str, doc_type: str = "auto") -> dict:
        """处理文档"""
        # Step 1: OCR 快速提取
        ocr_result = await self.ocr_extract(image_path)

        # Step 2: 判断文档类型
        if doc_type == "auto":
            doc_type = await self.classify_doc_type(ocr_result, image_path)

        # Step 3: 根据类型选择策略
        if doc_type in ["invoice", "receipt", "contract"]:
            # 复杂文档 → VLM 深度理解
            vlm_result = await self.vlm_extract(image_path, doc_type)
            return {**ocr_result, "structured": vlm_result}
        else:
            # 简单文档 → OCR 足够
            return ocr_result

    async def ocr_extract(self, image_path: str) -> dict:
        """OCR 快速提取"""
        results = ocr_document(image_path)
        return {
            "text_blocks": [r["text"] for r in results],
            "full_text": "\n".join(r["text"] for r in results),
            "block_count": len(results),
            "avg_confidence": sum(r["confidence"] for r in results) / len(results),
        }

    async def vlm_extract(self, image_path: str, doc_type: str) -> dict:
        """VLM 深度理解"""
        prompts = {
            "invoice": "提取发票信息，返回 JSON：发票号、日期、买卖方、金额、税额",
            "receipt": "提取收据信息，返回 JSON：日期、金额、项目明细、总计",
            "contract": "提取合同关键条款，返回 JSON：甲乙方、金额、期限、条款摘要",
        }

        prompt = prompts.get(doc_type, "提取文档中的关键信息，返回 JSON")
        result = extract_with_vlm(image_path, prompt)
        return {"structured_data": result, "doc_type": doc_type}

    async def classify_doc_type(self, ocr_result: dict, image_path: str) -> str:
        """分类文档类型"""
        text = ocr_result["full_text"][:200]
        classifier = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await classifier.ainvoke(
            f"根据以下文本判断文档类型。只回答：invoice/receipt/contract/report/other\n\n{text}"
        )
        return response.content.strip().lower()
```

---

## 4. PDF 处理管线

### 多页 PDF 处理

```python
import fitz  # PyMuPDF

@dataclass
class PDFProcessor:
    """PDF 文档处理器"""

    async def process_pdf(self, pdf_path: str) -> dict:
        """处理多页 PDF"""
        doc = fitz.open(pdf_path)
        pages = []

        for page_num, page in enumerate(doc):
            page_data = {
                "page_num": page_num + 1,
                "text": page.get_text(),  # 原生文本提取
                "images": [],
                "tables": [],
            }

            # 提取图片
            images = page.get_images()
            for img_idx, img in enumerate(images):
                xref = img[0]
                pix = fitz.Pixmap(doc, xref)
                img_path = f"/tmp/page_{page_num}_img_{img_idx}.png"
                pix.save(img_path)
                page_data["images"].append(img_path)

            # 如果是扫描件（无文本），用 OCR
            if not page_data["text"].strip():
                # 渲染为图片
                pix = page.get_pixmap(dpi=300)
                img_path = f"/tmp/page_{page_num}.png"
                pix.save(img_path)
                ocr_result = ocr_document(img_path)
                page_data["text"] = "\n".join(r["text"] for r in ocr_result)

            pages.append(page_data)

        doc.close()

        return {
            "total_pages": len(pages),
            "pages": pages,
            "full_text": "\n\n--- Page Break ---\n\n".join(p["text"] for p in pages),
        }

    async def extract_tables_from_pdf(self, pdf_path: str) -> list:
        """提取 PDF 中的表格"""
        import camelot  # pip install camelot-py

        tables = camelot.read_pdf(pdf_path, pages="all", flavor="lattice")
        extracted = []
        for table in tables:
            extracted.append({
                "page": table.page,
                "data": table.df.to_dict(),  # DataFrame 转字典
                "rows": len(table.df),
                "cols": len(table.df.columns),
            })
        return extracted
```

### 在 LangGraph 中构建文档处理 Agent

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class DocAgentState(TypedDict):
    file_path: str
    file_type: str           # pdf, image, scan
    ocr_result: dict
    vlm_result: dict
    structured_data: dict
    summary: str
    errors: list

async def detect_file_type(state: DocAgentState):
    """检测文件类型"""
    path = state["file_path"]
    if path.endswith(".pdf"):
        return {"file_type": "pdf"}
    elif path.endswith((".png", ".jpg", ".jpeg", ".tiff")):
        return {"file_type": "image"}
    return {"file_type": "unknown"}

async def ocr_node(state: DocAgentState):
    """OCR 提取"""
    if state["file_type"] == "pdf":
        result = await PDFProcessor().process_pdf(state["file_path"])
    else:
        result = await HybridDocumentProcessor().ocr_extract(state["file_path"])
    return {"ocr_result": result}

async def vlm_node(state: DocAgentState):
    """VLM 深度理解"""
    ocr = state.get("ocr_result", {})
    avg_conf = ocr.get("avg_confidence", 1.0)

    # 置信度低 → 用 VLM 补充
    if avg_conf < 0.8 or not ocr.get("full_text", "").strip():
        result = await HybridDocumentProcessor().vlm_extract(
            state["file_path"], "auto"
        )
        return {"vlm_result": result}

    return {"vlm_result": {}}

async def structure_node(state: DocAgentState):
    """结构化提取"""
    ocr_text = state.get("ocr_result", {}).get("full_text", "")
    vlm_data = state.get("vlm_result", {}).get("structured_data", "")

    combined = f"OCR 文本:\n{ocr_text}\n\nVLM 结果:\n{vlm_data}"

    model = ChatOpenAI(model="gpt-4o", temperature=0)
    response = await model.ainvoke(
        f"从以下文档内容中提取结构化信息，返回 JSON：\n\n{combined}"
    )
    return {"structured_data": response.content}

async def summarize_node(state: DocAgentState):
    """生成摘要"""
    text = state.get("ocr_result", {}).get("full_text", "")
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    response = await model.ainvoke(f"用 200 字以内总结以下文档：\n\n{text[:3000]}")
    return {"summary": response.content}

def needs_vlm(state: DocAgentState):
    ocr = state.get("ocr_result", {})
    if ocr.get("avg_confidence", 1.0) < 0.8:
        return "vlm"
    if not ocr.get("full_text", "").strip():
        return "vlm"
    return "structure"

# 构建图
graph = StateGraph(DocAgentState)
graph.add_node("detect", detect_file_type)
graph.add_node("ocr", ocr_node)
graph.add_node("vlm", vlm_node)
graph.add_node("structure", structure_node)
graph.add_node("summarize", summarize_node)

graph.add_edge(START, "detect")
graph.add_edge("detect", "ocr")
graph.add_conditional_edges("ocr", needs_vlm, {
    "vlm": "vlm",
    "structure": "structure",
})
graph.add_edge("vlm", "structure")
graph.add_edge("structure", "summarize")
graph.add_edge("summarize", END)

doc_agent = graph.compile()
```

---

## 5. 表格识别深度

### 表格提取方案对比

```python
# === 方案1：camelot（规则化表格）===
import camelot
tables = camelot.read_pdf("report.pdf", flavor="lattice")  # 有线表格
tables = camelot.read_pdf("report.pdf", flavor="stream")    # 无线表格

# === 方案2：pdfplumber（精细控制）===
import pdfplumber
with pdfplumber.open("report.pdf") as pdf:
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            # table = [[row1_col1, row1_col2], [row2_col1, row2_col2]]

# === 方案3：VLM（复杂/不规则表格）===
def extract_table_with_vlm(image_path: str) -> list:
    """用 VLM 提取表格"""
    result = extract_with_vlm(image_path,
        """提取图片中的表格，返回 JSON 数组格式：
        [{"列1": "值1", "列2": "值2"}, ...]"""
    )
    return json.loads(result)
```

### 表格识别效果

| 表格类型 | camelot | pdfplumber | VLM |
|---------|---------|------------|-----|
| 有线表格 | ★★★★★ | ★★★★ | ★★★★ |
| 无线表格 | ★★ | ★★★ | ★★★★ |
| 合并单元格 | ★★★ | ★★★ | ★★★★★ |
| 跨页表格 | ★★ | ★★ | ★★★ |
| 图片中表格 | ❌ | ❌ | ★★★★★ |

---

## 6. 实际场景实践

### 发票自动化处理

```python
async def process_invoice(image_path: str) -> dict:
    """发票自动化处理"""
    # 1. VLM 提取结构化信息
    result = extract_with_vlm(image_path,
        """提取发票信息，返回 JSON：
        {
          "invoice_number": "发票号",
          "date": "开票日期",
          "buyer": {"name": "", "tax_id": ""},
          "seller": {"name": "", "tax_id": ""},
          "items": [{"name": "", "qty": 0, "price": 0, "amount": 0}],
          "subtotal": 0, "tax": 0, "total": 0
        }"""
    )

    # 2. 解析 JSON
    try:
        data = json.loads(result)
    except json.JSONDecodeError:
        # JSON 解析失败，用结构化输出重试
        data = await retry_with_structured_output(image_path)

    # 3. 验证数据
    validated = validate_invoice_data(data)

    return validated
```

### 合同条款提取

```python
async def extract_contract_clauses(pdf_path: str) -> dict:
    """合同条款提取"""
    pdf_data = await PDFProcessor().process_pdf(pdf_path)
    full_text = pdf_data["full_text"]

    model = ChatOpenAI(model="gpt-4o", temperature=0)

    # 分段提取（合同可能很长）
    clauses = []
    pages = full_text.split("--- Page Break ---")

    for i, page_text in enumerate(pages):
        response = await model.ainvoke(
            f"""从以下合同内容中提取关键条款，返回 JSON：
            - 条款名称
            - 条款内容摘要
            - 风险等级（高/中/低）
            - 建议关注点

            合同内容（第{i+1}页）：
            {page_text[:3000]}"""
        )
        clauses.append({"page": i + 1, "clauses": response.content})

    return {"total_pages": len(pages), "clauses": clauses}
```

---

## 7. 成本与性能

### 方案成本对比

| 方案 | 单页成本 | 单页耗时 | 准确率 |
|------|---------|---------|--------|
| PaddleOCR | ¥0 | 0.5s | ~85% |
| 讯飞 OCR | ¥0.01 | 1s | ~95% |
| GPT-4o Vision | $0.01 | 3-5s | ~98% |
| 混合方案 | $0.005 | 2-3s | ~95% |

### 优化策略

```
1. 分级处理
   第一级：PaddleOCR（免费）→ 置信度高就完成
   第二级：置信度低 → VLM 补充（只处理低质量页面）

2. 缓存
   相同文档缓存 OCR/VLM 结果
   增量处理只处理变更页

3. 批量处理
   多页 PDF 批量 OCR
   VLM 请求合并

4. 分辨率优化
   OCR: 300 DPI（足够识别）
   VLM: 150 DPI（降低 Token 消耗）
```

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三代文档智能技术 | ☐ |
| 能用 PaddleOCR 提取文字 | ☐ |
| 能用 GPT-4o Vision 理解文档 | ☐ |
| 实现了 OCR+VLM 混合方案 | ☐ |
| 在 LangGraph 中构建了文档 Agent | ☐ |
| 能处理多页 PDF | ☐ |
| 能提取表格 | ☐ |
| 实现了发票/合同等实际场景 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 多模态应用开发 | 多模态基础 |
| 23 | 文档处理管线 | 文档处理 |
| 31 | 文档处理管线 | 文档管线 |
| 113 | 多模态 RAG 实践指南 | 多模态 RAG |
| 142 | 多模态生成 | 多模态生成 |
| 191 | Agent 多模态交互指南 | 多模态交互 |
| 368 | 多模态检索与跨模态对齐 | 跨模态检索 |
| 386 | Agent 多模态处理 | 多模态处理 |
| 412 | 多模态 Agent 指南 | 多模态 Agent |
| 432 | Computer Use 与浏览器自动化 | 视觉理解 |
