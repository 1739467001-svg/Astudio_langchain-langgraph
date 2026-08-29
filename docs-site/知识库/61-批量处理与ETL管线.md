# 批量处理与 ETL 管线

> 当需要处理大量文档或执行大量 LLM 调用时，需要批处理和 ETL 管线。

---

## 一、批量处理的场景

```mermaid
graph TB
    subgraph 批处理场景 &#123;"需要批处理的典型场景"&#125;
        S1["📄 批量文档入库<br/>1000篇文档→向量化→存库"]
        S2["📊 批量分析<br/>100份报告→LLM摘要"]
        S3["🏷️ 批量分类<br/>10000条评论→情感分析"]
        S4["🔄 批量翻译<br/>500篇文章→翻译"]
        S5["📝 批量生成<br/>100个产品→广告文案"]
    end

    style 批量处理场景 fill:'#E3F2FD'
```

## 二、批量 LLM 调用

### 2.1 batch 方法

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
chain = ChatPromptTemplate.from_template("总结：&#123;text&#125;") | llm | StrOutputParser()

# 批量处理（自动并发）
texts = [&#123;"text": f"文档&#123;i&#125;内容..."&#125; for i in range(100)]
results = chain.batch(texts)  # 自动并发调用
```

### 2.2 异步批量（更高并发）

```python
import asyncio

async def batch_process_async(items: list, chain, batch_size: int = 20):
    """异步批量处理，控制并发数"""
    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        tasks = [chain.ainvoke(item) for item in batch]
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)
        print(f"  已处理 &#123;i+len(batch)&#125;/&#123;len(items)&#125;")
    return results

# 使用
results = asyncio.run(batch_process_async(texts, chain, batch_size=20))
```

## 三、ETL 管线

```mermaid
graph LR
    subgraph ETL管线 &#123;"ETL: Extract → Transform → Load"&#125;
        E["Extract<br/>提取数据<br/>(文件/API/DB)"]
        E --> T["Transform<br/>处理数据<br/>(清洗/分割/向量化/LLM处理)"]
        T --> L["Load<br/>加载入库<br/>(向量库/数据库)"]
    end

    style E fill:'#E3F2FD'
    style T fill:'#FFF9C4'
    style L fill:'#C8E6C9'
```

### 3.1 完整 ETL 管线实现

```python
import os
import time
from langchain_core.documents import Document
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

class ETLpipeline:
    """文档ETL管线"""

    def __init__(self, embeddings=None):
        self.embeddings = embeddings or OpenAIEmbeddings()
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
        )

    def extract(self, source_dir: str) -> list[str]:
        """Extract: 提取所有文档内容"""
        docs = []
        for filename in os.listdir(source_dir):
            if filename.endswith((".txt", ".md")):
                loader = TextLoader(os.path.join(source_dir, filename), encoding="utf-8")
                docs.extend([d.page_content for d in loader.load()])
        return docs

    def transform(self, texts: list[str]) -> list[Document]:
        """Transform: 分割+元数据"""
        all_chunks = []
        for i, text in enumerate(texts):
            chunks = self.splitter.split_text(text)
            for j, chunk in enumerate(chunks):
                all_chunks.append(Document(
                    page_content=chunk,
                    metadata=&#123;"doc_index": i, "chunk_index": j&#125;
                ))
        return all_chunks

    def load(self, chunks: list[Document], batch_size: int = 100) -> FAISS:
        """Load: 分批向量化+存入向量库"""
        # 第一批创建索引
        db = FAISS.from_documents(chunks[:batch_size], self.embeddings)

        # 后续批次增量添加
        for i in range(batch_size, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            db.add_documents(batch)
            print(f"  已入库 &#123;min(i+batch_size, len(chunks))&#125;/&#123;len(chunks)&#125;")

        return db

    def run(self, source_dir: str) -> FAISS:
        """运行完整ETL管线"""
        start = time.time()

        print("1️⃣ Extract: 提取文档...")
        texts = self.extract(source_dir)
        print(f"   提取了 &#123;len(texts)&#125; 个文档")

        print("2️⃣ Transform: 分割处理...")
        chunks = self.transform(texts)
        print(f"   分割为 &#123;len(chunks)&#125; 个文档块")

        print("3️⃣ Load: 向量化入库...")
        db = self.load(chunks)
        print(f"   入库完成")

        elapsed = time.time() - start
        print(f"\n✅ ETL完成: &#123;len(texts)&#125;文档→&#123;len(chunks)&#125;块, 耗时&#123;elapsed:.1f&#125;s")
        return db

# 使用
pipeline = ETLpipeline()
db = pipeline.run("docs/")
```

## 四、批处理 vs 流式处理

```mermaid
graph TB
    subgraph 批处理模式 &#123;"批处理（定期全量）"&#125;
        B1["收集所有文档"]
        B1 --> B2["一次性处理"]
        B2 --> B3["适合: 定期更新/全量重建"]
    end

    subgraph 流式模式 &#123;"流式处理（实时增量）"&#125;
        S1["文档变更"]
        S1 --> S2["立即处理单个文档"]
        S2 --> S3["适合: 实时更新/增量入库"]
    end

    style 批处理模式 fill:'#E3F2FD'
    style 流式模式 fill:'#C8E6C9'
```

## 五、并发控制

```python
import asyncio
from asyncio import Semaphore

async def batch_with_semaphore(items, func, max_concurrent=10):
    """带并发限制的批量处理"""
    sem = Semaphore(max_concurrent)

    async def process(item):
        async with sem:
            return await func(item)

    tasks = [process(item) for item in items]
    return await asyncio.gather(*tasks)
```

## 六、错误处理与重试

```python
async def batch_with_retry(items, func, max_retries=3):
    """带重试的批量处理"""
    results = []
    for item in items:
        for attempt in range(max_retries):
            try:
                result = await func(item)
                results.append(&#123;"success": True, "result": result&#125;)
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    results.append(&#123;"success": False, "error": str(e)&#125;)
                else:
                    await asyncio.sleep(2 ** attempt)  # 指数退避
    return results
```

## 七、选型决策

| 场景 | 方案 | 并发数 |
|------|------|--------|
| <100条 | batch() | 自动 |
| 100-1000条 | 异步+Semaphore | 10-20 |
| >1000条 | 分批ETL | 20-50 |
| 实时更新 | 流式增量 | 1(单条) |
| 全量重建 | ETL管线 | 50-100 |
