# RAG 评估指标体系

> RAG 系统的质量不能靠"感觉"。本指南覆盖 RAG 的标准化评估指标和测量方法。

---

## 一、RAG 评估的三层框架

```mermaid
graph TB
    subgraph RAG评估三层 &#123;"RAG 评估三层框架"&#125;
        L1["Layer 1: 检索质量<br/>检索到了正确的文档吗？<br/>指标: Context Precision / Recall"]
        L2["Layer 2: 生成质量<br/>回答是否基于检索内容？<br/>指标: Faithfulness / Answer Relevancy"]
        L3["Layer 3: 端到端质量<br/>用户最终体验如何？<br/>指标: Answer Correctness / Latency"]
    end

    L1 --> L2 --> L3

    style L1 fill:#E3F2FD
    style L2 fill:#FFF9C4
    style L3 fill:#C8E6C9
```

## 二、核心指标详解

### 2.1 检索质量指标

```mermaid
graph TB
    subgraph 检索指标 &#123;"检索质量指标"&#125;
        CP["Context Precision<br/>上下文精确率<br/>检索到的文档中有多少是相关的"]
        CR["Context Recall<br/>上下文召回率<br/>相关文档中有多少被检索到了"]
        CRR["Context Relevance<br/>上下文相关性<br/>检索结果与问题的相关程度"]
    end

    style 检索指标 fill:#E3F2FD
```

| 指标 | 含义 | 计算方式 | 目标 |
|------|------|----------|------|
| Context Precision | 检索结果中相关文档的比例 | 相关文档数 / 检索总数 | ≥80% |
| Context Recall | 相关文档被检索到的比例 | 被检索到的相关文档 / 全部相关文档 | ≥90% |
| Context Relevance | 检索结果与问题的语义相关度 | LLM评分 1-5 | ≥4 |

### 2.2 生成质量指标

```mermaid
graph TB
    subgraph 生成指标 &#123;"生成质量指标"&#125;
        FAITH["Faithfulness<br/>忠实度<br/>回答是否只基于检索到的上下文<br/>(不编造信息)"]
        AR["Answer Relevancy<br/>回答相关性<br/>回答是否切题"]
    end

    style FAITH fill:#C8E6C9
    style AR fill:#FFE0B2
```

### 2.3 端到端指标

| 指标 | 含义 | 目标 |
|------|------|------|
| Answer Correctness | 回答与标准答案的匹配度 | ≥85% |
| Latency | 端到端延迟 | P95 < 5s |
| Token Cost | 每次查询的Token消耗 | < 3000 tokens |

## 三、评估方法实现

### 3.1 忠实度评估（Faithfulness）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def evaluate_faithfulness(answer: str, context: str) -> dict:
    """评估回答是否忠实于上下文（无幻觉）"""
    prompt = ChatPromptTemplate.from_template(
        """判断回答中的每句话是否都能从上下文中找到依据。

        上下文：&#123;context&#125;
        回答：&#123;answer&#125;

        分析每句话：
        1. 逐句检查是否有上下文支持
        2. 计算忠实度 = 有支持的句子数 / 总句子数
        3. 列出无支持的句子（幻觉）

        格式：
        忠实句子数: X
        总句子数: Y
        忠实度: X/Y
        幻觉句子: [列出]"""
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"answer": answer, "context": context&#125;)

    # 简单解析忠实度分数
    import re
    match = re.search(r'忠实度:\s*(\d+)/(\d+)', result)
    if match:
        supported = int(match.group(1))
        total = int(match.group(2))
        score = supported / total if total > 0 else 0
    else:
        score = 0

    return &#123;
        "faithfulness_score": round(score, 2),
        "detail": result,
    &#125;
```

### 3.2 回答相关性评估

```python
def evaluate_answer_relevancy(question: str, answer: str) -> dict:
    """评估回答与问题的相关性"""
    prompt = ChatPromptTemplate.from_template(
        """评估回答与问题的相关性。1-5分。

        问题：&#123;question&#125;
        回答：&#123;answer&#125;

        评分标准：
        5 = 完全切题，信息充分
        4 = 基本切题，略有偏离
        3 = 部分相关
        2 = 大部分不相关
        1 = 完全不相关

        分数："""
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"question": question, "answer": answer&#125;)
    score = int(result.strip()[0]) if result.strip() else 0
    return &#123;"relevancy_score": score, "max": 5&#125;
```

### 3.3 检索质量评估

```python
def evaluate_retrieval(query: str, retrieved_docs: list, relevant_docs: list) -> dict:
    """评估检索质量"""
    retrieved_set = set(d.page_content[:100] for d in retrieved_docs)
    relevant_set = set(d.page_content[:100] for d in relevant_docs)

    # 精确率
    relevant_retrieved = retrieved_set & relevant_set
    precision = len(relevant_retrieved) / len(retrieved_set) if retrieved_set else 0

    # 召回率
    recall = len(relevant_retrieved) / len(relevant_set) if relevant_set else 0

    # F1
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return &#123;
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "f1": round(f1, 2),
    &#125;
```

## 四、完整评估管线

```python
def evaluate_rag_system(rag_chain, vectorstore, test_cases: list) -> dict:
    """完整RAG评估管线"""
    results = []

    for case in test_cases:
        question = case["question"]
        ground_truth = case.get("answer", "")
        relevant_context = case.get("context", "")

        # 检索评估
        retrieved = vectorstore.similarity_search(question, k=3)
        retrieval_eval = evaluate_retrieval(
            question, retrieved,
            [type("D", (), &#123;"page_content": relevant_context&#125;)] if relevant_context else []
        )

        # 生成回答
        answer = rag_chain.invoke(question)

        # 生成质量评估
        faithfulness = evaluate_faithfulness(answer, "\n".join(d.page_content for d in retrieved))
        relevancy = evaluate_answer_relevancy(question, answer)

        results.append(&#123;
            "question": question,
            "answer": answer,
            "retrieval": retrieval_eval,
            "faithfulness": faithfulness["faithfulness_score"],
            "relevancy": relevancy["relevancy_score"],
        &#125;)

    # 汇总
    n = len(results)
    return &#123;
        "avg_faithfulness": sum(r["faithfulness"] for r in results) / n,
        "avg_relevancy": sum(r["relevancy"] for r in results) / n,
        "avg_precision": sum(r["retrieval"]["precision"] for r in results) / n,
        "avg_recall": sum(r["retrieval"]["recall"] for r in results) / n,
        "details": results,
    &#125;
```

## 五、RAGAS 框架

```python
# RAGAS 是专门的RAG评估框架
# pip install ragas

from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

def evaluate_with_ragas(questions, answers, contexts, ground_truths):
    """用RAGAS框架评估"""
    data = &#123;
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths,
    &#125;
    dataset = Dataset.from_dict(data)

    result = evaluate(
        dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
        ],
    )
    return result
```

## 六、评估指标基准

```mermaid
graph TB
    subgraph 目标基准 &#123;"RAG 评估目标基准"&#125;
        F["Faithfulness 忠实度<br/>目标: ≥0.90<br/>(<0.85有严重幻觉)"]
        AR["Answer Relevancy 相关性<br/>目标: ≥0.85<br/>(<0.70回答跑题)"]
        CP["Context Precision 精确率<br/>目标: ≥0.80<br/>(<0.60检索噪声多)"]
        CR["Context Recall 召回率<br/>目标: ≥0.90<br/>(<0.80漏检相关文档)"]
    end

    style F fill:#C8E6C9
    style AR fill:#C8E6C9
    style CP fill:#FFF9C4
    style CR fill:#FFF9C4
```

## 七、指标到改进的映射

```mermaid
graph TD
    Q&#123;"哪个指标低?"&#125;
    Q -->|"Faithfulness低<br/>(幻觉严重)"| F1["加'只基于上下文回答'<br/>降temperature<br/>减少k值(减少噪声)"]
    Q -->|"Relevancy低<br/>(回答跑题)"| R1["优化Prompt<br/>加Few-Shot<br/>检查问题理解"]
    Q -->|"Precision低<br/>(检索噪声多)"| P1["减小k值<br/>加重排序<br/>调chunk_size"]
    Q -->|"Recall低<br/>(漏检相关文档)"| RR1["增大k值<br/>用多查询检索<br/>检查文档质量"]

    style F1 fill:#C8E6C9
    style R1 fill:#C8E6C9
    style P1 fill:#C8E6C9
    style RR1 fill:#C8E6C9
```
