# RAG 混合检索调优

> 混合检索（向量+关键词）不是简单加在一起——权重、融合方法和参数都需要调优。

---

## 一、混合检索调优的三个维度

```mermaid
graph TB
    subgraph 三维度 {"混合检索调优三维度"}
        D1["1.权重调优<br/>向量vs关键词各占多少"]
        D2["2.融合方法<br/>RRF / 加权 / 重新排序"]
        D3["3.参数调优<br/>各自的k值/阈值"]
    end

    style 三维度 fill:'#E3F2FD'
```

## 二、权重调优

```python
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

def create_hybrid_retriever(vectorstore, docs, weights: tuple = (0.5, 0.5)):
    """创建混合检索器"""
    # BM25关键词检索
    bm25 = BM25Retriever.from_documents(docs)
    bm25.k = 5

    # 向量检索
    vector = vectorstore.as_retriever(search_kwargs={"k": 5})

    # 混合
    ensemble = EnsembleRetriever(
        retrievers=[bm25, vector],
        weights=list(weights),  # [关键词权重, 向量权重]
    )
    return ensemble

# 不同权重的效果
retriever_50_50 = create_hybrid_retriever(vectorstore, docs, weights=(0.5, 0.5))
retriever_30_70 = create_hybrid_retriever(vectorstore, docs, weights=(0.3, 0.7))  # 偏语义
retriever_70_30 = create_hybrid_retriever(vectorstore, docs, weights=(0.7, 0.3))  # 偏关键词
```

## 三、权重选择指南

```mermaid
graph TB
    subgraph 权重选择 {"权重选择指南"}
        W1["偏关键词(0.7, 0.3)<br/>适合: 专有名词/代码/精确匹配"]
        W2["均衡(0.5, 0.5)<br/>适合: 通用场景"]
        W3["偏语义(0.3, 0.7)<br/>适合: 口语化/近义词多"]
    end

    style W1 fill:'#C8E6C9'
    style W2 fill:'#E3F2FD'
    style W3 fill:'#FFF9C4'
```

## 四、RRF 融合方法

```python
def rrf_fusion(vector_results: list, keyword_results: list, k: int = 60) -> list:
    """Reciprocal Rank Fusion（倒数排名融合）"""
    scores = {}

    # 向量结果按排名计分
    for rank, doc in enumerate(vector_results):
        key = doc.page_content[:100]
        scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)

    # 关键词结果按排名计分
    for rank, doc in enumerate(keyword_results):
        key = doc.page_content[:100]
        scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)

    # 按融合分数排序
    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    # 返回融合后的结果
    all_docs = {doc.page_content[:100]: doc for doc in vector_results + keyword_results}
    return [all_docs[key] for key in sorted_keys[:3]]
```

## 五、调优流程

```mermaid
graph TB
    subgraph 调优流程 {"混合检索调优流程"}
        S1["1.准备测试集<br/>20个问题+正确文档"]
        S1 --> S2["2.基准线<br/>纯向量检索的Recall"]
        S2 --> S3["3.尝试不同权重<br/>(0.3,0.7)/(0.5,0.5)/(0.7,0.3)"]
        S3 --> S4["4.评估<br/>Recall@K / Precision@K"]
        S4 --> S5["5.选最优权重<br/>或调整k值"]
    end

    style S1 fill:'#C8E6C9'
    style S5 fill:'#F3E5F5'
```

```python
def evaluate_hybrid_weights(vectorstore, docs, test_cases: list) -> dict:
    """评估不同权重的效果"""
    results = {}
    for vec_w, kw_w in [(0.3, 0.7), (0.5, 0.5), (0.7, 0.3), (0.0, 1.0), (1.0, 0.0)]:
        retriever = create_hybrid_retriever(vectorstore, docs, weights=(kw_w, vec_w))

        hit_count = 0
        for case in test_cases:
            retrieved = retriever.invoke(case["question"])
            # 检查正确答案是否在检索结果中
            for doc in retrieved:
                if case["expected_content"][:50] in doc.page_content:
                    hit_count += 1
                    break

        recall = hit_count / len(test_cases)
        label = f"向量{vec_w:.0%}/关键词{kw_w:.0%}"
        results[label] = round(recall, 2)

    return results

# 使用
results = evaluate_hybrid_weights(vectorstore, docs, test_cases)
for config, recall in sorted(results.items(), key=lambda x: -x[1]):
    print(f"{config}: Recall={recall}")
# "向量70%/关键词30%: Recall=0.85"  ← 最优
```

## 六、参数调优建议

| 参数 | 默认值 | 调优方向 | 效果 |
|------|--------|---------|------|
| 向量k值 | 5 | 增大→Recall↑但噪声↑ | 3-10 |
| 关键词k值 | 5 | 同上 | 3-10 |
| 最终k值 | 3 | 减小→Precision↑ | 2-5 |
| 权重 | (0.5,0.5) | 按数据类型调 | 见上 |
| RRF k值 | 60 | 影响排名平滑度 | 30-100 |
