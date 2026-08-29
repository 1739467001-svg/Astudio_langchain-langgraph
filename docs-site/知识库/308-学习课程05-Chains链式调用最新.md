# 学习课程 05：Chains 链式调用最新

> 学习课程 05 有 300 行。这篇基于 v0.3 更新——LCEL 替代旧 Chains，Runnable 管道组合。

---

## 一、LCEL 管道

```mermaid
graph LR
    PROMPT["Prompt模板"] -->|管道符| LLM["LLM调用"]
    LLM -->|管道符| PARSER["输出解析器"]
    PARSER --> OUTPUT["结构化结果"]

    style LLM fill:#FFF9C4
    style OUTPUT fill:#C8E6C9
```

---

## 二、基本管道

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

# LCEL管道——用|组合
chain = (
    ChatPromptTemplate.from_template("回答: &#123;question&#125;")
    | ChatOpenAI(model="gpt-4o-mini")
    | StrOutputParser()
)

# 调用方式统一
result = chain.invoke(&#123;"question": "什么是RAG?"&#125;)
# 流式
for chunk in chain.stream(&#123;"question": "解释量子计算"&#125;):
    print(chunk, end="")
# 异步
result = await chain.ainvoke(&#123;"question": "什么是RAG?"&#125;)
# 批量
results = chain.batch([&#123;"question": "Q1"&#125;, &#123;"question": "Q2"&#125;])
```

---

## 三、RAG 管道

```python
from langchain_core.runnables import RunnablePassthrough

# RAG管道——检索+生成
rag_chain = (
    &#123;"context": retriever, "question": RunnablePassthrough()&#125;
    | ChatPromptTemplate.from_template("基于以下信息回答:\n&#123;context&#125;\n\n问题: &#123;question&#125;")
    | ChatOpenAI(model="gpt-4o-mini")
    | StrOutputParser()
)

result = rag_chain.invoke("什么是向量数据库?")
```

---

## 四、高级组合

```python
# 1. 带降级
from langchain_openai import ChatOpenAI

main_llm = ChatOpenAI(model="gpt-4o", temperature=0)
backup_llm = ChatOpenAI(model="gpt-4o-mini")

chain = prompt | main_llm.with_fallbacks([backup_llm]) | parser

# 2. 带重试
chain = prompt | llm.with_retry(stop_after_attempt=3) | parser

# 3. 并行
from langchain_core.runnables import RunnableParallel

parallel = RunnableParallel(
    summary=summarize_chain,
    translation=translate_chain,
)
result = parallel.invoke(&#123;"text": "..."&#125;)
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用LCEL管道符 | 替代旧Chains | ★★★ |
| 统一Runnable接口 | invoke/stream/batch | ★★★ |
| 有降级方案 | with_fallbacks | ★★☆ |
| 有重试机制 | with_retry | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 能用LCEL组合 | ☐ |
| 能构建RAG管道 | ☐ |
| 能用降级和重试 | ☐ |
