# Agent 会话管理与上下文工程指南

> 用户和 Agent 聊了 50 轮——上下文已经 3 万 Token，但模型的窗口只有 8000。怎么保留重要信息、压缩冗余、让 Agent"记住"关键上下文？这就是上下文工程。本指南系统讲解会话状态管理、上下文窗口策略、多会话切换、上下文压缩与优先级排序。

---

## 1. 会话管理核心问题

### 挑战

```
挑战1：上下文窗口限制
  模型窗口 8K Token，对话已 30K
  → 必须裁剪，但裁什么？留什么？

挑战2：多会话切换
  用户同时和 3 个 Agent 聊
  → 每个会话的上下文要隔离

挑战3：跨会话记忆
  用户昨天聊的，今天要"记住"
  → 短期记忆（当前会话）vs 长期记忆（跨会话）

挑战4：上下文优先级
  System Prompt + 对话历史 + 检索文档 + 工具结果
  → 总共可能超 10 万 Token，怎么排序和截断？
```

### 上下文组成

```mermaid
graph TB
    CTX["Agent 上下文"]

    CTX --> SYS["系统指令<br/>System Prompt<br/>优先级: 最高"]
    CTX --> HIST["对话历史<br/>用户/AI 交替<br/>优先级: 高"]
    CTX --> RET["检索文档<br/>RAG 结果<br/>优先级: 中"]
    CTX --> TOOL["工具结果<br/>函数返回值<br/>优先级: 中"]
    CTX --> MEM["记忆<br/>用户偏好/历史<br/>优先级: 低"]

    style CTX fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style SYS fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style HIST fill:#C8E6C9,stroke:#2E7D32
    style RET fill:#FFF9C4,stroke:#F9A825
```

---

## 2. 上下文窗口策略

### Token 预算分配

```python
@dataclass
class ContextBudget:
    """Token 预算管理器"""

    max_tokens: int = 8000       # 模型窗口
    reserve_output: int = 1000   # 预留输出

    # 预算分配比例
    allocation = {
        "system": 0.10,          # 系统指令 10%
        "history": 0.35,         # 对话历史 35%
        "retrieval": 0.30,       # 检索文档 30%
        "tool_results": 0.15,    # 工具结果 15%
        "memory": 0.10,          # 记忆 10%
    }

    def get_budget(self, component: str) -> int:
        """获取组件 Token 预算"""
        available = self.max_tokens - self.reserve_output
        return int(available * self.allocation.get(component, 0))

    def build_context(self, components: dict) -> list:
        """在预算内构建上下文"""
        messages = []
        available = self.max_tokens - self.reserve_output

        # 按优先级处理
        priority_order = ["system", "memory", "history", "retrieval", "tool_results"]

        for component in priority_order:
            budget = self.get_budget(component)
            content = components.get(component, "")

            if not content:
                continue

            # 裁剪到预算内
            trimmed = self._trim_to_budget(content, budget)

            if trimmed:
                if component == "system":
                    messages.append({"role": "system", "content": trimmed})
                elif component == "memory":
                    messages.append({"role": "system", "content": f"用户偏好: {trimmed}"})
                elif component == "history":
                    if isinstance(trimmed, list):
                        messages.extend(trimmed)
                elif component == "retrieval":
                    messages.append({"role": "system", "content": f"参考文档:\n{trimmed}"})
                elif component == "tool_results":
                    messages.append({"role": "system", "content": f"工具结果:\n{trimmed}"})

        return messages

    def _trim_to_budget(self, content, budget_tokens: int) -> any:
        """裁剪内容到 Token 预算内"""
        if isinstance(content, str):
            max_chars = budget_tokens * 3  # 粗估 1 Token ≈ 3 字符
            if len(content) > max_chars:
                return content[:max_chars] + "\n...[截断]"
            return content

        if isinstance(content, list):
            # 消息列表：从最新开始保留
            total = sum(len(m.get("content", "")) for m in content)
            max_chars = budget_tokens * 3

            if total <= max_chars:
                return content

            # 从最新开始保留
            kept = []
            used = 0
            for msg in reversed(content):
                msg_chars = len(msg.get("content", ""))
                if used + msg_chars > max_chars:
                    break
                kept.insert(0, msg)
                used += msg_chars

            # 添加摘要提示
            dropped = len(content) - len(kept)
            if dropped > 0:
                kept.insert(0, {
                    "role": "system",
                    "content": f"[已省略 {dropped} 条较早的对话]"
                })

            return kept

        return content
```

### 上下文压缩策略

```python
@dataclass
class ContextCompressor:
    """上下文压缩器"""

    async def compress_history(self, messages: list, target_tokens: int = 2000) -> list:
        """压缩对话历史"""
        total_tokens = self._estimate_tokens(messages)

        if total_tokens <= target_tokens:
            return messages

        # 策略1：摘要旧消息
        old_messages = messages[:-4]  # 保留最近4条
        recent_messages = messages[-4:]

        summary = await self._summarize(old_messages)

        return [
            {"role": "system", "content": f"之前对话摘要:\n{summary}"}
        ] + recent_messages

    async def compress_tool_results(self, tool_results: list) -> list:
        """压缩工具结果"""
        compressed = []
        for result in tool_results:
            content = result.get("content", "")
            if len(content) > 500:
                # 截断长结果
                compressed.append({
                    **result,
                    "content": content[:300] + "\n...[结果已截断]" +
                              content[-100:],  # 保留头尾
                })
            else:
                compressed.append(result)
        return compressed

    async def compress_retrieval(self, docs: list, target_tokens: int = 2000) -> str:
        """压缩检索文档"""
        max_chars = target_tokens * 3
        result = ""
        for doc in docs:
            content = doc.get("content", doc.get("page_content", ""))
            if len(result) + len(content) > max_chars:
                # 截断到剩余空间
                remaining = max_chars - len(result)
                result += content[:remaining] + "\n...[截断]"
                break
            result += content + "\n\n---\n\n"

        return result

    async def _summarize(self, messages: list) -> str:
        """摘要消息"""
        text = "\n".join([
            f"{m['role']}: {m['content'][:200]}"
            for m in messages
        ])

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"用 300 字以内总结以下对话的关键信息：\n\n{text}"
        )
        return response.content

    def _estimate_tokens(self, messages: list) -> int:
        """估算 Token 数"""
        total = 0
        for m in messages:
            total += len(m.get("content", "")) // 3
        return total
```

---

## 3. 多会话管理

```python
@dataclass
class SessionManager:
    """多会话管理器"""

    sessions: dict = field(default_factory=dict)  # {session_id: SessionState}

    async def create_session(self, user_id: str, agent_id: str = "default") -> str:
        """创建新会话"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "agent_id": agent_id,
            "messages": [],
            "context": {},
            "created_at": datetime.utcnow().isoformat(),
            "last_active": datetime.utcnow().isoformat(),
            "status": "active",
        }
        return session_id

    async def get_session(self, session_id: str) -> dict:
        """获取会话"""
        return self.sessions.get(session_id)

    async def add_message(self, session_id: str, role: str, content: str):
        """添加消息"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("会话不存在")

        session["messages"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })
        session["last_active"] = datetime.utcnow().isoformat()

    async def switch_session(self, user_id: str) -> list:
        """获取用户所有会话（用于切换）"""
        user_sessions = [
            s for s in self.sessions.values()
            if s["user_id"] == user_id and s["status"] == "active"
        ]
        user_sessions.sort(key=lambda s: s["last_active"], reverse=True)
        return user_sessions

    async def archive_session(self, session_id: str):
        """归档会话"""
        if session_id in self.sessions:
            self.sessions[session_id]["status"] = "archived"

    async def get_context_window(self, session_id: str, max_tokens: int = 8000) -> list:
        """获取会话的上下文窗口"""
        session = self.sessions.get(session_id)
        if not session:
            return []

        budget = ContextBudget(max_tokens=max_tokens)
        compressor = ContextCompressor()

        messages = session["messages"]

        # 压缩历史
        compressed = await compressor.compress_history(messages, target_tokens=int(max_tokens * 0.35))

        # 构建上下文
        return budget.build_context({
            "system": session.get("system_prompt", "你是 AI 助手"),
            "history": compressed,
            "memory": session.get("context", {}).get("user_prefs", ""),
            "retrieval": session.get("context", {}).get("retrieval_docs", ""),
            "tool_results": session.get("context", {}).get("tool_results", ""),
        })
```

---

## 4. 上下文优先级排序

```python
@dataclass
class ContextPrioritizer:
    """上下文优先级排序器"""

    async def prioritize(self, available_context: dict, token_budget: int) -> dict:
        """按优先级排序和分配"""
        priorities = {
            "system_prompt": 1,      # 必须保留
            "current_query": 2,      # 必须保留
            "recent_history": 3,     # 最近 2-3 轮
            "retrieval_docs": 4,     # 检索结果
            "tool_results": 5,       # 工具结果
            "summarized_history": 6, # 摘要
            "long_term_memory": 7,   # 长期记忆
            "user_preferences": 8,   # 用户偏好
        }

        # 按优先级分配 Token
        result = {}
        remaining = token_budget

        for component, priority in sorted(priorities.items(), key=lambda x: x[1]):
            content = available_context.get(component, "")
            if not content:
                continue

            # 分配 10-30% 的剩余预算
            allocation = min(remaining, int(token_budget * 0.3))
            actual = min(self._count_tokens(content), allocation)

            if actual < self._count_tokens(content):
                # 需要截断
                result[component] = self._truncate(content, actual)
            else:
                result[component] = content

            remaining -= actual
            if remaining <= 0:
                break

        return result

    def _count_tokens(self, text: str) -> int:
        return len(text) // 3

    def _truncate(self, text: str, max_tokens: int) -> str:
        max_chars = max_tokens * 3
        if len(text) <= max_chars:
            return text
        return text[:max_chars] + "...[截断]"
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解上下文五大组成 | ☐ |
| 实现了 Token 预算分配 | ☐ |
| 实现了上下文压缩（摘要+截断） | ☐ |
| 实现了多会话管理 | ☐ |
| 实现了上下文优先级排序 | ☐ |
| 能处理跨会话记忆 | ☐ |
| 能压缩工具结果 | ☐ |
| 能压缩检索文档 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 04 | Memory 与对话管理 | Memory 基础 |
| 05 | Memory 机制 | 机制 |
| 21 | Token 与上下文窗口管理 | 窗口管理 |
| 27 | 上下文窗口与 Token 管理 | 窗口 |
| 74 | RAG 上下文组装与压缩 | 组装压缩 |
| 125 | Token 优化与上下文压缩 | 优化 |
| 176 | 上下文窗口管理 | 窗口 |
| 183 | 上下文组装 | 组装 |
| 208 | LangGraph 上下文窗口管理 | 窗口 |
| 215 | RAG 上下文组装与压缩深度 | 深度 |
| 234 | 上下文组装 | 组装 |
| 361 | Agent 对话摘要与长上下文压缩 | 摘要压缩 |
| 379 | Prompt 缓存与上下文复用 | 缓存 |
| 446 | Agent 记忆架构 | 记忆 |
