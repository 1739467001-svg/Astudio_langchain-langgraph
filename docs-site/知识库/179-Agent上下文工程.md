# Agent 上下文工程

> Prompt 工程关注"怎么说"，上下文工程关注"给 LLM 看什么"。检索回来 10 个文档全塞给 LLM？对话历史全带上？系统提示写多长？这些决定了对 Token 效率和回答质量。这份指南系统讲解上下文窗口的组装策略。

---

## 一、上下文工程的核 心问题

```mermaid
graph TB
    subgraph 上下文 &#123;"Agent上下文窗口内容"&#125;
        C1["系统提示<br/>角色定义+规则<br/>~500 tokens"]
        C2["检索上下文<br/>RAG返回的文档<br/>~2000-5000 tokens"]
        C3["对话历史<br/>多轮对话消息<br/>~1000-10000 tokens"]
        C4["用户输入<br/>当前问题<br/>~50-500 tokens"]
        C5["工具结果<br/>已调用的工具返回<br/>~500-2000 tokens"]
    end

    subgraph 约束 &#123;"上下文窗口约束"&#125;
        K1["模型上限<br/>GPT-4o: 128K tokens"]
        K2["实际可用<br/>建议<8000 tokens"]
        K3["成本约束<br/>Token越多越贵"]
        K4["质量约束<br/>上下文太长→注意力分散"]
    end

    style 上下文 fill:#E3F2FD
    style 约束 fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 二、上下文组装策略

```mermaid
graph TB
    subgraph 策略 &#123;"4种上下文组装策略"&#125;
        S1["策略1: 优先级组装<br/>系统提示>用户输入>检索>历史"]
        S2["策略2: 动态截断<br/>超限时从最早开始删"]
        S3["策略3: 摘要压缩<br/>历史→摘要, 检索→精选"]
        S4["策略4: 分层管理<br/>核心层+扩展层+参考层"]
    end

    style 策略 fill:#C8E6C9
```

### 2.1 优先级组装

```python
from dataclasses import dataclass, field
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
import tiktoken

@dataclass
class ContextBudget:
    """上下文预算管理。"""
    max_tokens: int = 8000
    system_prompt: str = ""
    retrieved_docs: list[str] = field(default_factory=list)
    history: list[dict] = field(default_factory=list)
    user_input: str = ""
    tool_results: list[str] = field(default_factory=list)

    def _count_tokens(self, text: str) -> int:
        """计算Token数。"""
        try:
            encoder = tiktoken.encoding_for_model("gpt-4o")
            return len(encoder.encode(text))
        except Exception:
            return len(text) // 3  # 粗略估算

    def assemble(self) -> list[BaseMessage]:
        """按优先级组装上下文消息。"""
        messages = []
        remaining = self.max_tokens

        # 优先级1: 系统提示（不可删减）
        sys_tokens = self._count_tokens(self.system_prompt)
        messages.append(SystemMessage(content=self.system_prompt))
        remaining -= sys_tokens

        # 优先级2: 用户输入（不可删减）
        user_tokens = self._count_tokens(self.user_input)
        messages.append(HumanMessage(content=self.user_input))
        remaining -= user_tokens

        # 优先级3: 检索上下文（按相关度排序，超出则截断）
        doc_text = "\n\n".join(self.retrieved_docs)
        doc_tokens = self._count_tokens(doc_text)
        if doc_tokens > remaining * 0.5:
            # 检索上下文超过剩余预算的50%，按相关度截断
            doc_text = self._truncate_docs(remaining * 0.5)
            doc_tokens = self._count_tokens(doc_text)
        messages.append(HumanMessage(content=f"## 参考信息\n&#123;doc_text&#125;"))
        remaining -= doc_tokens

        # 优先级4: 对话历史（从最近开始保留）
        history_msgs = self._assemble_history(remaining)
        messages = [messages[0]] + history_msgs + messages[1:]

        return messages

    def _truncate_docs(self, max_tokens: float) -> str:
        """截断检索文档到预算内。"""
        result = []
        used = 0
        for doc in self.retrieved_docs:
            doc_tokens = self._count_tokens(doc)
            if used + doc_tokens > max_tokens:
                break
            result.append(doc)
            used += doc_tokens
        return "\n\n".join(result)

    def _assemble_history(self, max_tokens: float) -> list[BaseMessage]:
        """从最近开始保留对话历史。"""
        msgs = []
        used = 0
        for msg in reversed(self.history):
            tokens = self._count_tokens(msg.get("content", ""))
            if used + tokens > max_tokens:
                break
            msgs.insert(0, HumanMessage(content=msg["content"]) if msg["role"] == "user"
                       else AIMessage(content=msg["content"]))
            used += tokens
        return msgs

    def budget_report(self) -> dict:
        """预算使用报告。"""
        return &#123;
            "system_prompt": self._count_tokens(self.system_prompt),
            "retrieved_docs": sum(self._count_tokens(d) for d in self.retrieved_docs),
            "history": sum(self._count_tokens(m.get("content", "")) for m in self.history),
            "user_input": self._count_tokens(self.user_input),
            "tool_results": sum(self._count_tokens(t) for t in self.tool_results),
            "total": sum([
                self._count_tokens(self.system_prompt),
                sum(self._count_tokens(d) for d in self.retrieved_docs),
                sum(self._count_tokens(m.get("content", "")) for m in self.history),
                self._count_tokens(self.user_input),
                sum(self._count_tokens(t) for t in self.tool_results),
            ]),
            "max_budget": self.max_tokens,
        &#125;
```

### 2.2 分层上下文管理

```mermaid
graph TB
    subgraph 分层 &#123;"三层上下文管理"&#125;
        CORE["核心层<br/>系统提示+当前问题<br/>始终保留"]
        CONTEXT["上下文层<br/>检索文档+工具结果<br/>按预算动态截断"]
        HISTORY["历史层<br/>对话历史<br/>超出→摘要压缩"]

        CORE -->|"优先级最高"| CONTEXT
        CONTEXT -->|"次高"| HISTORY
    end

    style CORE fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style CONTEXT fill:#E3F2FD
    style HISTORY fill:#FFF9C4
```

```python
class LayeredContextManager:
    """分层上下文管理器。

    核心层不可删减，上下文层按相关度截断，
    历史层超出预算时自动摘要压缩。
    """

    def __init__(self, max_tokens: int = 8000):
        self.max_tokens = max_tokens

    async def assemble(
        self,
        system_prompt: str,
        user_input: str,
        retrieved_docs: list[str],
        history: list[dict],
        llm=None,
    ) -> list[BaseMessage]:
        """组装分层上下文。"""
        budget = ContextBudget(
            max_tokens=self.max_tokens,
            system_prompt=system_prompt,
            retrieved_docs=retrieved_docs,
            history=history,
            user_input=user_input,
        )

        # 检查是否超预算
        report = budget.budget_report()
        if report["total"] <= self.max_tokens:
            return budget.assemble()

        # 超预算：先压缩历史
        if report["history"] > self.max_tokens * 0.3 and llm:
            # 将早期历史摘要化
            cutoff = len(history) // 2
            old_history = history[:cutoff]
            recent_history = history[cutoff:]

            summary = await self._summarize_history(old_history, llm)

            # 用摘要替换旧历史
            budget.history = [&#123;"role": "system", "content": f"早期对话摘要: &#123;summary&#125;"&#125;] + recent_history

        # 再检查
        report = budget.budget_report()
        if report["total"] > self.max_tokens:
            # 仍超：截断检索文档
            budget.retrieved_docs = budget.retrieved_docs[:3]  # 只保留前3个

        return budget.assemble()

    async def _summarize_history(self, history: list[dict], llm) -> str:
        """摘要对话历史。"""
        history_text = "\n".join(
            f"&#123;'用户' if m['role'] == 'user' else '助手'&#125;: &#123;m['content'][:200]&#125;"
            for m in history
        )
        from langchain_core.messages import HumanMessage
        prompt = f"用一段话总结以下对话的要点（200字以内）:\n\n&#123;history_text&#125;"
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
```

---

## 三、上下文窗口分配建议

```mermaid
graph TB
    subgraph 分配 &#123;"8000 Token预算分配建议"&#125;
        A1["系统提示: 500 (6%)"]
        A2["用户输入: 200 (3%)"]
        A3["检索上下文: 3000 (37%)"]
        A4["对话历史: 2000 (25%)"]
        A5["工具结果: 1000 (13%)"]
        A6["LLM输出预留: 1300 (16%)"]
    end

    style A3 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style A4 fill:#E3F2FD
```

---

## 四、上下文质量优化

```python
class ContextQualityOptimizer:
    """上下文质量优化器。"""

    @staticmethod
    def deduplicate_docs(docs: list[str]) -> list[str]:
        """去重检索文档。"""
        seen = set()
        result = []
        for doc in docs:
            key = hash(doc[:200])
            if key not in seen:
                seen.add(key)
                result.append(doc)
        return result

    @staticmethod
    def order_by_relevance(docs: list[str], query: str) -> list[str]:
        """按相关度排序。"""
        # 简化版：按包含查询关键词的数量排序
        def relevance_score(doc):
            return sum(1 for word in query.split() if word in doc)
        return sorted(docs, key=relevance_score, reverse=True)

    @staticmethod
    def add_context_markers(docs: list[str]) -> str:
        """为检索文档添加上下文标记。"""
        return "\n\n".join(
            f"--- 参考文档 &#123;i+1&#125; ---\n&#123;doc&#125;" for i, doc in enumerate(docs)
        )
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 实际预算<8000 tokens | 太长注意力分散 | ★★★ |
| 检索上下文≤37% | 不要全塞给LLM | ★★★ |
| 历史超限先摘要 | 不要直接截断 | ★★★ |
| 去重+排序再组装 | 质量优先 | ★★☆ |
| 预留输出空间 | 留16%给LLM输出 | ★★☆ |
| 监控Token使用 | 防止成本失控 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有上下文预算管理 | ☐ |
| 有优先级组装 | ☐ |
| 有历史摘要压缩 | ☐ |
| 有分层管理 | ☐ |
| 有质量优化 | ☐ |
