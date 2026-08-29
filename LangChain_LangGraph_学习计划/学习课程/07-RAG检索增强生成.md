# 第 07 课：RAG——检索增强生成

> LLM 的知识只到它的训练截止日期，而且不知道你的私有数据。RAG 就是解决"让 LLM 基于你的数据回答问题"的关键技术。

---

## 学习目标

- 理解 RAG 的完整原理和流程
- 掌握文档加载、分割、向量化、检索的每个步骤
- 能够构建一个端到端的 RAG 系统
- 理解不同检索策略的优缺点

## 一、什么是 RAG

### 1.1 问题：LLM 的知识局限

```
问题 1：LLM 的知识有截止日期，不知道昨天发生的事
问题 2：LLM 不知道你的公司文档、个人笔记、私有数据
问题 3：让 LLM 直接生成回答，可能有"幻觉"（编造信息）
```

### 1.2 RAG 的解决思路

**RAG（Retrieval-Augmented Generation，检索增强生成）** 的核心思路很简单：

```
用户提问 → 先从你的知识库中检索相关内容 → 把检索到的内容 + 用户问题一起发给 LLM → LLM 基于检索内容生成回答
```

比喻理解：

> - 直接问 LLM = 让学生闭卷考试（可能编答案）
> - RAG = 让学生开卷考试（翻到相关页面，基于内容回答）

### 1.3 RAG 的完整流程

```
┌──────────────────────────────────────────────┐
│              离线阶段（构建知识库）              │
│                                              │
│  原始文档 → 加载 → 分割 → 向量化 → 存入向量数据库  │
│  (PDF/TXT)  (Loader)  (Splitter)  (Embedding)  (VectorStore) │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│              在线阶段（问答检索）               │
│                                              │
│  用户提问 → 向量化 → 在向量数据库中检索 → 取出相关片段 │
│  → 将片段+问题一起发给LLM → 生成回答            │
└──────────────────────────────────────────────┘
```

## 二、逐步实现 RAG

### 2.1 第一步：文档加载（Document Loading）

LangChain 提供了多种文档加载器：

```python
from langchain_community.document_loaders import TextLoader

# 加载文本文件
loader = TextLoader("my_notes.txt")
documents = loader.load()
# documents 是一个 List[Document]，每个 Document 有 page_content 和 metadata
```

其他常用加载器：

```python
# PDF
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("report.pdf")

# Markdown
from langchain_community.document_loaders import UnstructuredMarkdownLoader
loader = UnstructuredMarkdownLoader("README.md")

# 网页
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader("https://example.com/article")

# 目录批量加载
from langchain_community.document_loaders import DirectoryLoader
loader = DirectoryLoader("./docs", glob="**/*.txt", loader_cls=TextLoader)
```

### 2.2 第二步：文档分割（Splitting）

文档通常太长，不能整个塞给 LLM。需要切成小块：

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # 每块大约500字符
    chunk_overlap=50,    # 相邻块之间重叠50字符（保持上下文连贯）
)

chunks = splitter.split_documents(documents)
print(f"原始文档数: {len(documents)}")  # 通常1
print(f"分割后块数: {len(chunks)}")    # 可能几十到几百
```

为什么要 overlap？因为切割可能正好在句子中间断开，重叠部分确保不丢失上下文。

### 2.3 第三步：向量化（Embedding）

把文本转换成向量（数字数组），让计算机能计算"语义相似度"：

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings()

# 把一句话变成向量
vector = embeddings.embed_query("什么是人工智能？")
print(len(vector))  # 1536（OpenAI 默认维度）
print(type(vector)) # <class 'list'>
```

为什么需要向量化？

```
"猫是哺乳动物" → [0.12, -0.34, 0.56, ...]  (1536维向量)
"猫属于哺乳类" → [0.11, -0.33, 0.55, ...]  (非常接近)
"今天天气不错" → [0.87, 0.21, -0.43, ...]  (完全不同)

→ 语义相近的文本，向量也相近
→ 通过比较向量距离，就能找到"意思最接近"的内容
```

### 2.4 第四步：存入向量数据库

```python
from langchain_community.vectorstores import FAISS

# 把所有 chunks 向量化并存入 FAISS
vectorstore = FAISS.from_documents(chunks, embeddings)

# 也可以保存到磁盘
vectorstore.save_local("my_vector_db")

# 加载已保存的数据库
loaded_db = FAISS.load_local("my_vector_db", embeddings)
```

常用向量数据库对比：

| 数据库 | 类型 | 适用场景 |
|--------|------|----------|
| FAISS | 本地库 | 学习、原型开发 |
| Chroma | 本地库 | 中小规模、开发 |
| Pinecone | 云服务 | 生产环境、大规模 |
| Milvus | 可自部署 | 大规模生产 |
| pgvector | PostgreSQL 扩展 | 已有 PG 的环境 |

### 2.5 第五步：检索

```python
# 从向量数据库中检索最相关的片段
results = vectorstore.similarity_search("LangChain是什么？", k=3)
# k=3 表示返回最相似的3个片段

for doc in results:
    print(doc.page_content)
    print("---")
```

### 2.6 第六步：生成回答

把检索到的内容 + 用户问题一起发给 LLM：

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_template("""
基于以下背景知识回答用户的问题。如果背景知识中没有答案，请说"我不知道"。

背景知识：
{context}

问题：{question}
""")

# 把检索到的文档拼接成纯文本
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

# 构建 RAG 链
rag_chain = (
    {
        "context": vectorstore.as_retriever() | format_docs,
        "question": RunnablePassthrough()
    }
    | prompt
    | llm
    | StrOutputParser()
)

# 使用
answer = rag_chain.invoke("LangChain 是什么？")
print(answer)
```

## 三、完整 RAG 示例

把所有步骤合在一起：

```python
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

load_dotenv()

# ========== 离线阶段：构建知识库 ==========

# 1. 加载文档
loader = TextLoader("knowledge.txt")
documents = loader.load()

# 2. 分割
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
chunks = splitter.split_documents(documents)

# 3 & 4. 向量化 + 存储到向量数据库
embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_documents(chunks, embeddings)

# 创建检索器
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# ========== 在线阶段：问答 ==========

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

prompt = ChatPromptTemplate.from_template("""
基于以下背景知识回答用户的问题。如果背景知识中没有答案，请说"我不知道"。

背景知识：
{context}

问题：{question}
""")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {
        "context": retriever | format_docs,
        "question": RunnablePassthrough()
    }
    | prompt
    | llm
    | StrOutputParser()
)

# 提问
questions = [
    "这个文档的主要内容是什么？",
    "文档中提到了哪些关键概念？",
]

for q in questions:
    print(f"问：{q}")
    print(f"答：{rag_chain.invoke(q)}\n")
```

## 四、检索优化策略

### 4.1 调整 chunk_size 和 overlap

```python
# 小 chunk：检索更精准，但可能上下文不足
splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=30)

# 大 chunk：上下文更完整，但可能包含无关信息
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
```

### 4.2 使用 Metadata 过滤

```python
from langchain_core.documents import Document

# 给文档添加元数据
docs = [
    Document(page_content="Python基础知识", metadata={"source": "python_guide", "chapter": 1}),
    Document(page_content="进阶Python", metadata={"source": "python_guide", "chapter": 2}),
]

vectorstore = FAISS.from_documents(docs, embeddings)

# 检索时过滤
results = vectorstore.similarity_search(
    "Python",
    k=3,
    filter={"source": "python_guide"}  # 只在这本书里搜
)
```

### 4.3 Multi-Query 检索

让 LLM 从多个角度重写问题，分别检索后合并结果：

```python
from langchain.retrievers.multi_query import MultiQueryRetriever

retriever = MultiQueryRetriever.from_llm(
    retriever=vectorstore.as_retriever(),
    llm=llm,
)
# 会自动用 LLM 把一个问题改写成多个角度的查询
```

## 动手练习

1. ✅ 准备一个 txt 文件（比如一篇关于你自己的介绍），完成完整的 RAG 流程
2. ✅ 尝试不同的 `chunk_size`（200 vs 500 vs 1000），观察检索质量变化
3. ✅ 用 `similarity_search` 查看检索到了哪些片段
4. ✅ 挑战：加载一个 PDF 文件，构建 RAG 系统
5. ✅ 挑战：实现多轮对话 RAG（结合第 04 课的 Memory）

## 自测清单

- [ ] 我能清晰说出 RAG 的两个阶段（离线构建、在线检索）
- [ ] 我知道每个步骤的作用：加载→分割→向量化→存储→检索→生成
- [ ] 我理解为什么要分割文档，以及 chunk_overlap 的作用
- [ ] 我理解向量化的意义：把文本变成可以计算相似度的数字
- [ ] 我能构建一个完整的 RAG 链
- [ ] 我知道至少 3 种检索优化策略

## 下一课

→ 打开 [08-LangChain进阶与最佳实践.md](08-LangChain进阶与最佳实践.md)，学习生产环境中的进阶技巧。

## 知识库链接

- 向量数据库对比 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- RAG 完整代码示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 文档加载器完整列表 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
