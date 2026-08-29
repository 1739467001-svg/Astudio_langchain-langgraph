# LLM 应用数据血缘与溯源

> LLM 的回答基于哪些数据？追踪从原始文档到最终回答的完整链路。

---

## 一、数据血缘的价值

```mermaid
graph TB
    subgraph 无血缘 &#123;"❌ 无数据溯源"&#125;
        U["用户: '这个回答基于什么？'"]
        U --> A1["AI: '基于我的训练数据' ❌"]
    end

    subgraph 有血缘 &#123;"✅ 有数据溯源"&#125;
        U2["用户: '这个回答基于什么？'"]
        U2 --> A2["AI: '基于产品手册.pdf第3页 <br/>+ FAQ.md第2节'"]
        Note1["✅ 可验证 ✅ 可审计 ✅ 可信任"]
    end

    style 无血缘 fill:'#FFCDD2'
    style 有血缘 fill:'#C8E6C9'
```

## 二、数据血缘链路

```mermaid
graph LR
    subgraph 血缘链路 &#123;"完整数据血缘链路"&#125;
        D1["📄 原始文档<br/>product_manual.pdf"] --> D2["✂️ 分割<br/>第3章/第4节"]
        D2 --> D3["🔢 向量化<br/>向量索引"]
        D3 --> D4["🔍 检索<br/>Top-3片段"]
        D4 --> D5["📝 上下文组装<br/>拼接到Prompt"]
        D5 --> D6["🤖 LLM生成<br/>最终回答"]
        D6 --> D7["📋 回答+引用来源"]
    end

    style 血缘链路 fill:'#E3F2FD'
```

## 三、实现数据血缘

### 3.1 文档级元数据

```python
from langchain_core.documents import Document
from datetime import datetime

def create_document_with_lineage(content: str, source: str, **kwargs) -> Document:
    """创建带血缘元数据的文档"""
    return Document(
        page_content=content,
        metadata=&#123;
            "source": source,
            "ingested_at": datetime.now().isoformat(),
            **kwargs,
        &#125;
    )
```

### 3.2 检索结果溯源

```python
def retrieve_with_lineage(vectorstore, query: str, k: int = 3) -> list[dict]:
    """检索并记录每个结果的来源"""
    results = vectorstore.similarity_search(query, k=k)

    lineage_records = []
    for rank, doc in enumerate(results, 1):
        lineage_records.append(&#123;
            "rank": rank,
            "source": doc.metadata.get("source", "未知"),
            "page": doc.metadata.get("page", "?"),
            "section": doc.metadata.get("section", ""),
            "content_preview": doc.page_content[:100],
            "chunk_id": doc.metadata.get("chunk_id", f"chunk_&#123;rank&#125;"),
        &#125;)

    return lineage_records
```

### 3.3 回答级溯源

```python
from pydantic import BaseModel, Field
from typing import List

class AnswerLineage(BaseModel):
    """回答的数据血缘记录"""
    question: str
    answer: str
    sources: List[dict] = []       # 引用的文档来源
    model: str = ""                # 使用的模型
    prompt_template: str = ""      # 使用的Prompt模板版本
    timestamp: str = ""

def rag_with_lineage(question: str, vectorstore, llm, retriever_k: int = 3) -> AnswerLineage:
    """带完整数据血缘的RAG"""
    # Step 1: 检索（记录来源）
    results = vectorstore.similarity_search(question, k=retriever_k)
    sources = [
        &#123;
            "source": doc.metadata.get("source", "未知"),
            "page": doc.metadata.get("page", "?"),
            "preview": doc.page_content[:80],
        &#125;
        for doc in results
    ]

    # Step 2: 组装上下文（带来源标注）
    context_parts = []
    for i, doc in enumerate(results, 1):
        source = doc.metadata.get("source", "未知")
        context_parts.append(f"[来源&#123;i&#125;: &#123;source&#125;]\n&#123;doc.page_content&#125;")
    context = "\n\n".join(context_parts)

    # Step 3: 生成回答
    from langchain_core.prompts import ChatPromptTemplate
    prompt = ChatPromptTemplate.from_template(
        "基于以下知识回答。每条信息后标注来源。\n&#123;context&#125;\n问题：&#123;question&#125;"
    )
    answer = (prompt | llm).invoke(&#123;"context": context, "question": question&#125;).content

    # Step 4: 记录血缘
    lineage = AnswerLineage(
        question=question,
        answer=answer,
        sources=sources,
        model=getattr(llm, "model", "unknown"),
        prompt_template="rag_v1.0",
    )

    return lineage
```

## 四、血缘展示

```python
def format_lineage(lineage: AnswerLineage) -> str:
    """格式化血缘信息供用户查看"""
    report = f"=== 回答溯源 ===\n"
    report += f"问题: &#123;lineage.question&#125;\n"
    report += f"模型: &#123;lineage.model&#125;\n\n"
    report += f"引用来源:\n"
    for i, src in enumerate(lineage.sources, 1):
        report += f"  &#123;i&#125;. 📄 &#123;src['source']&#125; (第&#123;src.get('page', '?')&#125;页)\n"
        report += f"     预览: &#123;src['preview'][:60]&#125;...\n"
    return report

# 使用
lineage = rag_with_lineage("蓝牙耳机的防水等级", vectorstore, llm)
print(lineage.answer)
print(format_lineage(lineage))
```

## 五、血缘审计

```python
class LineageAudit:
    """数据血缘审计"""
    def __init__(self):
        self.records = []

    def record(self, lineage: AnswerLineage):
        self.records.append(lineage)

    def find_by_source(self, source: str) -> list:
        """查找引用了某个来源的所有回答"""
        return [
            r for r in self.records
            if any(s["source"] == source for s in r.sources)
        ]

    def find_unsourced(self) -> list:
        """查找无来源引用的回答（可能幻觉）"""
        return [r for r in self.records if not r.sources]

    def source_usage_stats(self) -> dict:
        """统计各来源被引用次数"""
        from collections import Counter
        all_sources = []
        for r in self.records:
            for s in r.sources:
                all_sources.append(s["source"])
        return dict(Counter(all_sources).most_common())
```

## 六、血缘检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 文档有source元数据 | 每个文档块可追溯到来源 | ☐ |
| 检索结果有来源 | 每条检索结果标注来源 | ☐ |
| 回答有引用 | 回答中标注信息来源 | ☐ |
| 模型记录 | 记录用了哪个模型 | ☐ |
| Prompt版本 | 记录用了哪个Prompt | ☐ |
| 可审计 | 能反查"哪些回答引用了X" | ☐ |
