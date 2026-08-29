# LLM 应用知识沉淀与组织记忆

> 应用运行中产生的知识（用户反馈、常见问题、错误案例）如何沉淀为"组织记忆"？

---

## 一、组织记忆的价值

```mermaid
graph TB
    subgraph 无记忆 {"❌ 无组织记忆"}
        N1["用户A问了问题→回答"] --> N2["用户B问同样问题→重新处理"]
        N3["错误案例未记录"] --> N4["同样错误反复出现"]
    end

    subgraph 有记忆 {"✅ 有组织记忆"}
        Y1["用户A问了→回答→沉淀"] --> Y2["用户B问同样→命中记忆→快速回答"]
        Y3["错误案例→记录"] --> Y4["下次避免同样错误"]
    end

    style 无记忆 fill:'#FFCDD2'
    style 有记忆 fill:'#C8E6C9'
```

## 二、组织记忆的三层

```mermaid
graph TB
    subgraph 三层记忆 {"组织记忆三层模型"}
        L1["Layer 1: 知识缓存<br/>问答对缓存<br/>(精确匹配)"]
        L2["Layer 2: 经验库<br/>历史案例+解决方案<br/>(语义检索)"]
        L3["Layer 3: 模式总结<br/>LLM从案例中提炼规律<br/>(抽象知识)"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L2 fill:'#E3F2FD'
    style L3 fill:'#F3E5F5'
```

## 三、实现

### 3.1 知识缓存层

```python
import hashlib
from datetime import datetime

class KnowledgeCache:
    """知识缓存：精确匹配问答对"""
    def __init__(self):
        self.cache = {}  # 实际用Redis

    def _key(self, question: str) -> str:
        return hashlib.md5(question.encode()).hexdigest()

    def store(self, question: str, answer: str, metadata: dict = None):
        """沉淀问答对"""
        key = self._key(question)
        self.cache[key] = {
            "question": question,
            "answer": answer,
            "metadata": metadata or {},
            "created_at": datetime.now().isoformat(),
            "hit_count": 0,
        }

    def lookup(self, question: str) -> dict:
        """查找缓存的问答"""
        key = self._key(question)
        entry = self.cache.get(key)
        if entry:
            entry["hit_count"] += 1
            return entry
        return None

# 使用
cache = KnowledgeCache()
cache.store("什么是RAG", "RAG是检索增强生成...", {"model": "gpt-4o-mini"})
result = cache.lookup("什么是RAG")  # 命中缓存
```

### 3.2 经验库

```python
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

class ExperienceStore:
    """经验库：语义检索历史案例"""
    def __init__(self):
        self.embeddings = OpenAIEmbeddings()
        self.store = FAISS.from_documents(
            [Document(page_content="初始化", metadata={"type": "init"})],
            self.embeddings
        )

    def record_experience(self, question: str, answer: str, success: bool, error: str = ""):
        """记录一次经验"""
        content = f"问题: {question}\n回答: {answer[:200]}\n成功: {success}"
        if error:
            content += f"\n错误: {error}"

        self.store.add_documents([Document(
            page_content=content,
            metadata={
                "type": "experience",
                "success": success,
                "question": question[:50],
            }
        )])

    def recall(self, question: str, k: int = 3) -> list[str]:
        """回忆相关经验"""
        docs = self.store.similarity_search(question, k=k)
        return [d.page_content for d in docs if d.metadata.get("type") == "experience"]

    def recall_errors(self, question: str) -> list[str]:
        """回忆相关错误案例"""
        docs = self.store.similarity_search(question, k=5)
        return [
            d.page_content for d in docs
            if d.metadata.get("type") == "experience" and not d.metadata.get("success")
        ]

# 使用
exp = ExperienceStore()
exp.record_experience("分析数据", "用pandas处理...", success=True)
exp.record_experience("执行代码", "os.system失败", success=False, error="权限不足")

# 遇到类似问题时回忆
related = exp.recall("数据分析")
errors = exp.recall_errors("执行代码")
```

### 3.3 模式总结

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def summarize_patterns(experiences: list[str]) -> str:
    """从经验中提炼模式"""
    exp_text = "\n---\n".join(experiences)
    prompt = ChatPromptTemplate.from_template(
        """从以下历史经验中提炼出可复用的知识模式：

        {experiences}

        请总结：
        1. 常见问题类型
        2. 有效解决方法
        3. 常见陷阱
        4. 最佳实践

        知识总结："""
    )
    chain = prompt | llm
    return chain.invoke({"experiences": exp_text}).content
```

## 四、组织记忆在应用中的使用

```python
def chat_with_memory(question: str, cache: KnowledgeCache, exp: ExperienceStore, llm) -> str:
    """带组织记忆的聊天"""
    # Layer 1: 查缓存
    cached = cache.lookup(question)
    if cached:
        print("✅ 命中知识缓存")
        return cached["answer"]

    # Layer 2: 查经验库
    experiences = exp.recall(question)
    if experiences:
        print(f"📚 回忆到 {len(experiences)} 条相关经验")
        # 基于经验优化Prompt
        context = "\n".join(experiences)
        prompt = f"参考以下经验回答：\n{context}\n\n问题：{question}"
    else:
        prompt = question

    # 生成回答
    answer = llm.invoke(prompt).content

    # 沉淀到记忆
    cache.store(question, answer)
    exp.record_experience(question, answer, success=True)

    return answer
```

## 五、知识沉淀检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 问答缓存 | 精确匹配的问答对 | ☐ |
| 经验库 | 语义检索历史案例 | ☐ |
| 错误案例 | 记录失败案例 | ☐ |
| 模式总结 | 定期从经验提炼知识 | ☐ |
| 命中率监控 | 记忆命中率统计 | ☐ |
| 过期清理 | 旧记忆定期清理 | ☐ |
