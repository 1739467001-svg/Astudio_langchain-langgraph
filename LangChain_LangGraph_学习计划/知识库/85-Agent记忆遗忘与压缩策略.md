# Agent 记忆遗忘与压缩策略

> 记住一切不现实——记忆会膨胀、成本会增加。这份指南覆盖"主动遗忘"和"记忆压缩"策略。

---

## 一、记忆膨胀的问题

```mermaid
graph TB
    subgraph 膨胀 {"记忆膨胀的后果"}
        E1["对话越长 → messages越多"]
        E2["Token消耗线性增长"]
        E3["超过上下文窗口 → 报错"]
        E4["旧信息可能过时"]
    end

    subgraph 解决 {"遗忘策略解决"}
        S1["主动遗忘无关旧信息"]
        S2["压缩旧信息为摘要"]
        S3["只保留有用的信息"]
    end

    style 膨胀 fill:'#FFCDD2'
    style 解决 fill:'#C8E6C9'
```

## 二、遗忘策略

### 2.1 时间衰减遗忘

```python
from datetime import datetime, timedelta

class TimeDecayMemory:
    """时间衰减记忆：旧消息权重降低"""
    def __init__(self, half_life_hours: float = 24):
        self.half_life = half_life_hours  # 半衰期：24小时

    def get_weight(self, message_time: datetime, now: datetime = None) -> float:
        """计算消息权重（0-1），越旧越低"""
        now = now or datetime.now()
        age_hours = (now - message_time).total_seconds() / 3600
        weight = 0.5 ** (age_hours / self.half_life)
        return weight

    def filter_by_weight(self, messages: list, threshold: float = 0.1) -> list:
        """过滤掉权重低于阈值的旧消息"""
        return [
            msg for msg in messages
            if self.get_weight(msg.get("time", datetime.now())) >= threshold
        ]
```

### 2.2 重要性遗忘

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class ImportanceMemory:
    """重要性记忆：LLM评分决定保留/遗忘"""
    def __init__(self):
        self.messages = []
        self.importance_scores = []

    def add(self, message: str, role: str = "user"):
        """添加消息并评分"""
        self.messages.append({"role": role, "content": message})

        # 用LLM评估重要性(1-5)
        prompt = ChatPromptTemplate.from_template(
            "评估以下消息的重要性(1=闲聊 5=关键信息)：\n{msg}\n分数："
        )
        chain = prompt | llm | StrOutputParser()
        score = int(chain.invoke({"msg": message[:200]}).strip()[0] or "3")
        self.importance_scores.append(score)

    def get_important(self, max_count: int = 10) -> list:
        """获取最重要的N条消息"""
        indexed = list(enumerate(self.messages))
        indexed.sort(key=lambda x: self.importance_scores[x[0]], reverse=True)
        important = [msg for _, msg in indexed[:max_count]]
        # 按时间排序恢复
        return sorted(important, key=lambda m: self.messages.index(m))

    def forget_unimportant(self, threshold: int = 2):
        """遗忘不重要的消息"""
        kept = []
        for msg, score in zip(self.messages, self.importance_scores):
            if score >= threshold:
                kept.append(msg)
        self.messages = kept
```

### 2.3 摘要压缩遗忘

```python
def compress_old_memory(messages: list, llm, keep_recent: int = 6) -> list:
    """把旧消息压缩为摘要，只保留最近几条"""
    if len(messages) <= keep_recent:
        return messages

    # 分割
    old = messages[:-keep_recent]
    recent = messages[-keep_recent:]

    # 生成摘要
    conversation = "\n".join(
        f"{m.get('role', '?')}: {m.get('content', '')[:200]}" for m in old
    )
    prompt = ChatPromptTemplate.from_template(
        "将以下对话总结为关键信息（不超过100字）：\n{conv}\n\n摘要："
    )
    summary = (prompt | llm | StrOutputParser()).invoke({"conv": conversation})

    # 用摘要替换旧消息
    return [
        {"role": "system", "content": f"之前对话摘要：{summary}"}
    ] + recent
```

## 三、三种策略对比

```mermaid
graph TB
    subgraph 策略对比 {"三种遗忘策略"}
        S1["时间衰减<br/>✅ 自动<br/>❌ 旧但重要的也忘"]
        S2["重要性评分<br/>✅ 保留关键信息<br/>❌ 每条多1次LLM调用"]
        S3["摘要压缩<br/>✅ 保留关键信息<br/>✅ Token可控<br/>❌ 摘要可能丢细节"]
    end

    style S1 fill:'#E3F2FD'
    style S2 fill:'#FFF9C4'
    style S3 fill:'#C8E6C9'
```

## 四、组合策略（推荐）

```python
def smart_memory_management(messages: list, llm, max_messages: int = 20) -> list:
    """智能记忆管理：组合多种策略"""
    # Step 1: 如果消息不多，不需要处理
    if len(messages) <= max_messages:
        return messages

    # Step 2: 摘要压缩（压缩旧消息）
    messages = compress_old_memory(messages, llm, keep_recent=10)

    # Step 3: 如果还是太多，保留最近N条
    if len(messages) > max_messages:
        messages = messages[-max_messages:]

    return messages
```

## 五、选型建议

| 场景 | 策略 | 原因 |
|------|------|------|
| 短对话(<10轮) | 不需要遗忘 | 不够长 |
| 中等对话(10-50轮) | 摘要压缩 | 平衡信息与Token |
| 长对话(50+轮) | 摘要+重要性 | 保留关键+压缩其余 |
| 实时聊天 | 时间衰减 | 自动衰减 |
| 客服系统 | 摘要压缩 | 保留用户信息 |
