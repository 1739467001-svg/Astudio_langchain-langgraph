# RAG 数据准备最佳实践

> RAG 的效果 80% 取决于数据质量。这份指南覆盖从文档收集到入库的完整最佳实践。

---

## 一、数据质量金字塔

```mermaid
graph TB
    subgraph 金字塔 &#123;"RAG 数据质量金字塔"&#125;
        TOP["顶层: 持续优化<br/>定期评估+更新"]
        MID["中层: 结构化处理<br/>清洗→分割→元数据"]
        BASE["底层: 原始数据质量<br/>准确/完整/无冗余"]
    end

    BASE --> MID --> TOP

    style BASE fill:'#C8E6C9'
    style TOP fill:'#F3E5F5'
```

## 二、文档收集原则

| 原则 | 说明 | 反面案例 |
|------|------|---------|
| 相关性 | 只收集与目标相关的文档 | 把整个维基百科都放进去 |
| 准确性 | 文档内容必须正确 | 过时的手册、错误的FAQ |
| 完整性 | 每篇文档应自成一体 | 只有片段没有上下文 |
| 去重 | 避免相似文档重复 | 同一政策有5个版本 |
| 格式统一 | 尽量统一为TXT/MD | 混用PDF/图片/扫描件 |

## 三、文档预处理流水线

```mermaid
graph LR
    R["原始文档"] --> F1["格式转换<br/>→统一为文本"]
    F1 --> F2["清洗去噪<br/>→去页眉/控制字符"]
    F2 --> F3["结构标注<br/>→标题/段落/表格"]
    F3 --> F4["智能分割<br/>→400-600字/块"]
    F4 --> F5["元数据标注<br/>→source/page/type"]
    F5 --> F6["去重检查<br/>→相似度>95%去重"]
    F6 --> OUT["入库"]

    style F2 fill:'#FFF9C4'
    style F4 fill:'#FFE0B2'
    style F6 fill:'#C8E6C9'
```

## 四、分割策略最佳实践

```python
# 中文文档最佳分割参数
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,        # 400-600最佳
    chunk_overlap=50,     # chunk_size的10%
    separators=[
        "\n\n",  # 段落
        "\n",    # 换行
        "。",    # 句号
        "！",    # 感叹号
        "？",    # 问号
        "；",    # 分号
        "，",    # 逗号
        " ",     # 空格
        "",      # 逐字
    ]
)
```

### 不同文档类型的最佳分割

| 文档类型 | chunk_size | overlap | 特殊处理 |
|---------|-----------|---------|---------|
| FAQ问答 | 200-300 | 0 | 按Q-A对分割 |
| 产品手册 | 400-500 | 50 | 按章节分割 |
| 技术文档 | 500-600 | 80 | 保留代码块完整 |
| 法律条文 | 300-400 | 40 | 按条款分割 |
| 对话记录 | 500-800 | 100 | 按轮次分割 |

## 五、元数据标注最佳实践

```python
from langchain_core.documents import Document

# 丰富的元数据让检索更精准
doc = Document(
    page_content="蓝牙耳机支持蓝牙5.3...",
    metadata=&#123;
        "source": "product_manual.pdf",   # 来源文件
        "page": 3,                        # 页码
        "section": "技术规格",             # 章节
        "product": "BT-Pro",              # 产品名
        "doc_type": "manual",             # 文档类型
        "language": "zh",                 # 语言
        "version": "2.0",                 # 版本
        "updated_at": "2025-01-15",      # 更新日期
    &#125;
)

# 利用元数据过滤检索
results = db.similarity_search(
    "蓝牙版本",
    k=3,
    filter=&#123;"product": "BT-Pro", "doc_type": "manual"&#125;  # 只在BT-Pro手册中搜
)
```

## 六、去重策略

```python
def deduplicate_documents(docs: list, threshold: float = 0.95) -> list:
    """基于内容相似度的去重"""
    from langchain_openai import OpenAIEmbeddings
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    if len(docs) <= 1:
        return docs

    embeddings = OpenAIEmbeddings()
    vectors = np.array([embeddings.embed_query(d.page_content) for d in docs])
    sim_matrix = cosine_similarity(vectors)

    to_remove = set()
    for i in range(len(docs)):
        if i in to_remove:
            continue
        for j in range(i + 1, len(docs)):
            if j in to_remove:
                continue
            if sim_matrix[i][j] > threshold:
                to_remove.add(j)  # 保留前一个，移除后一个

    return [d for i, d in enumerate(docs) if i not in to_remove]
```

## 七、数据质量检查清单

| 检查项 | 通过标准 | 状态 |
|--------|---------|------|
| 文档相关性 | 所有文档与目标领域相关 | ☐ |
| 文档准确性 | 内容正确无过时信息 | ☐ |
| 文档去重 | 无高度重复文档 | ☐ |
| 分割质量 | 每块语义完整 | ☐ |
| 元数据完整性 | 每块有source+类型 | ☐ |
| 检索测试 | 用5个典型问题测试检索质量 | ☐ |
| 中文支持 | 分割不切断中文句子 | ☐ |
| 表格处理 | 表格数据正确提取 | ☐ |
