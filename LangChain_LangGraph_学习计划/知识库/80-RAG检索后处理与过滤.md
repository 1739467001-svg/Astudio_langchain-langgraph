# RAG 检索后处理与过滤

> 检索到文档后，在送给 LLM 之前还有一系列优化步骤：过滤、去重、压缩、重排序、截断。

---

## 一、检索后处理的位置

```mermaid
graph LR
    subgraph 检索后处理管线 {"检索→后处理→生成"}
        R["向量检索<br/>Top-K(10)"] --> FILTER["后处理"]
        FILTER --> F1["过滤: 去无关"]
        FILTER --> F2["去重: 去重复"]
        FILTER --> F3["压缩: 精简"]
        FILTER --> F4["重排序: 精排"]
        FILTER --> F5["截断: 控Token"]
        F1 & F2 & F3 & F4 & F5 --> GEN["LLM生成<br/>(Top-N=3)"]
    end

    style FILTER fill:'#FFF9C4'
    style GEN fill:'#C8E6C9'
```

## 二、五步后处理

### 2.1 过滤

```python
def filter_results(docs: list, min_length: int = 50, metadata_filter: dict = None) -> list:
    """过滤掉不合格的检索结果"""
    filtered = []
    for doc in docs:
        # 长度过滤：太短的片段可能没有信息量
        if len(doc.page_content) < min_length:
            continue
        # 元数据过滤
        if metadata_filter:
            match = True
            for key, value in metadata_filter.items():
                if doc.metadata.get(key) != value:
                    match = False
                    break
            if not match:
                continue
        filtered.append(doc)
    return filtered

# 使用：只保留产品手册的检索结果
filtered = filter_results(results, metadata_filter={"source": "product_manual.pdf"})
```

### 2.2 去重

```python
def deduplicate(docs: list, similarity_threshold: float = 0.9) -> list:
    """基于内容相似度的去重"""
    if len(docs) <= 1:
        return docs

    unique = [docs[0]]
    for doc in docs[1:]:
        is_duplicate = False
        for existing in unique:
            # 简单方法：检查内容重叠率
            overlap = len(set(doc.page_content.split()) & set(existing.page_content.split()))
            total = len(set(doc.page_content.split()) | set(existing.page_content.split()))
            if total > 0 and overlap / total > similarity_threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            unique.append(doc)

    return unique
```

### 2.3 压缩

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor

def compress_results(docs: list, question: str, llm) -> list:
    """用LLM压缩每个文档片段，只保留与问题相关的部分"""
    compressor = LLMChainExtractor(llm=llm)
    # 把压缩器包装为检索器
    compression_retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    )
    # 压缩器会自动过滤+压缩
    return compression_retriever.invoke(question)
```

### 2.4 重排序（已在高级RAG模式中详述）

```python
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

def rerank_results(docs: list, question: str, top_n: int = 3) -> list:
    """Cross-Encoder重排序"""
    reranker = CrossEncoderReranker(
        model=HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-base"),
        top_n=top_n
    )
    # 重排序器需要检索器和查询
    # 这里简化：对已有docs按相关度重排
    return reranker.compress_documents(docs, question)
```

### 2.5 截断

```python
import tiktoken

def truncate_by_tokens(docs: list, max_tokens: int = 2000) -> list:
    """按Token限制截断"""
    encoding = tiktoken.get_encoding("cl100k_base")
    kept = []
    current = 0
    for doc in docs:
        tokens = len(encoding.encode(doc.page_content))
        if current + tokens > max_tokens:
            # 截断当前文档
            remaining = max_tokens - current
            if remaining > 100:
                encoded = encoding.encode(doc.page_content)[:remaining]
                doc.page_content = encoding.decode(encoded) + "..."
                kept.append(doc)
            break
        kept.append(doc)
        current += tokens
    return kept
```

## 三、完整后处理管线

```python
def post_retrieval_pipeline(docs: list, question: str, llm, max_tokens: int = 2000) -> list:
    """完整检索后处理管线"""
    print(f"  检索: {len(docs)} 条")

    # Step 1: 过滤
    docs = filter_results(docs, min_length=50)
    print(f"  过滤后: {len(docs)} 条")

    # Step 2: 去重
    docs = deduplicate(docs)
    print(f"  去重后: {len(docs)} 条")

    # Step 3: 截断
    docs = truncate_by_tokens(docs, max_tokens=max_tokens)
    print(f"  截断后: {len(docs)} 条")

    return docs
```

## 四、后处理效果

```mermaid
graph LR
    subgraph 效果 {"后处理效果示例"}
        BEFORE["检索前: 10条<br/>含噪声/重复/过长"]
        BEFORE --> AFTER["后处理后: 3条<br/>精简/相关/Token可控"]
    end

    style BEFORE fill:'#FFE0B2'
    style AFTER fill:'#C8E6C9'
```

## 五、策略选择

| 场景 | 需要哪些步骤 | 原因 |
|------|-----------|------|
| 小知识库 | 截断 | 数据少，过滤可能误删 |
| 大知识库 | 全部五步 | 数据多，需要精排 |
| FAQ库 | 去重+截断 | FAQ可能有重复 |
| 长文档 | 压缩+截断 | 片段可能过长 |
| 多来源 | 过滤+去重 | 不同来源可能有重复 |
