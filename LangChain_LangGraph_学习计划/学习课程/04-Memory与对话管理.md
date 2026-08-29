# 第 04 课：Memory 与对话管理

> 还记得我们在第 01 课说过 LLM 是"无状态"的吗？这一课就是来解决这个问题的。

---

## 学习目标

- 理解为什么 LLM 需要记忆机制
- 掌握 LangChain 中 Memory 的几种实现方式
- 能够构建一个多轮对话应用
- 理解不同记忆策略的优缺点与适用场景

## 一、为什么需要 Memory

### 1.1 问题重现

```python
# 第一次对话
llm.invoke("我叫张三")
# 模型回复："你好，张三！"

# 第二次对话
llm.invoke("我叫什么名字？")
# 模型回复："抱歉，我不知道你叫什么名字。"  ← 忘了！
```

原因很简单：LLM 每次调用都是独立的，它看不到上一次的对话。

### 1.2 解决思路

既然模型自己记不住，我们就**每次把之前的对话历史手动传给它**：

```python
messages = [
    HumanMessage(content="我叫张三"),
    AIMessage(content="你好，张三！"),
    HumanMessage(content="我叫什么名字？"),
]
llm.invoke(messages)  # 模型回复："你叫张三。"
```

Memory 就是**自动帮你管理这些对话历史的机制**。

## 二、LangChain 中的 Memory 方案

### 2.1 LangChain Memory 的演进

LangChain 的 Memory 机制经历过一次大的变化：

| 时期 | 方式 | 状态 |
|------|------|------|
| 旧版（0.1 及以前） | `ConversationBufferMemory` 等类 | 已废弃，不推荐 |
| 新版（0.2+） | `RunnableWithMessageHistory` | 推荐，基于 LCEL |
| LangGraph | 在 State 中管理消息列表 | 最灵活，推荐用于复杂场景 |

> 📌 本课程使用新版方式。旧版 Memory 类你可能在老教程中看到，但新项目不要再用。

### 2.2 方案一：手动管理消息列表

最直接的方式——自己维护一个列表：

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini")

# 自己维护对话历史
chat_history = []

def chat(user_input):
    # 添加用户消息
    chat_history.append(HumanMessage(content=user_input))
    # 调用模型（传入完整历史）
    response = llm.invoke(chat_history)
    # 添加 AI 回复
    chat_history.append(response)
    return response.content

# 测试多轮对话
print(chat("我叫张三，今年28岁"))      # 你好，张三！
print(chat("我叫什么名字？"))          # 你叫张三。
print(chat("我今年多大？"))            # 你今年28岁。
```

这个方案简单但有问题：**对话越来越长，Token 消耗会越来越大，最终超过上下文窗口**。

### 2.3 方案二：RunnableWithMessageHistory

LangChain 提供了一个封装类，自动管理对话历史：

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini")

# 创建带历史占位符的提示词
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个友好的助手。"),
    MessagesPlaceholder(variable_name="history"),  # 对话历史会注入这里
    ("human", "{input}")
])

# 组装链
chain = prompt | llm

# 用一个字典存储不同会话的历史
store = {}

def get_session_history(session_id: str):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

# 包装链，添加历史管理
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

# 使用：每条消息需要指定 session_id
response1 = chain_with_history.invoke(
    {"input": "我叫张三"},
    config={"configurable": {"session_id": "user_001"}}
)
print(response1.content)

response2 = chain_with_history.invoke(
    {"input": "我叫什么名字？"},
    config={"configurable": {"session_id": "user_001"}}
)
print(response2.content)  # "你叫张三"

# 换一个 session_id，模型不记得之前的对话
response3 = chain_with_history.invoke(
    {"input": "我叫什么名字？"},
    config={"configurable": {"session_id": "user_002"}}
)
print(response3.content)  # "我不知道你叫什么名字"
```

### 2.4 对话历史窗口策略

当对话很长时，全部历史会撑爆上下文窗口。常见策略：

| 策略 | 做法 | 适用场景 |
|------|------|----------|
| 全量保留 | 保留所有消息 | 短对话、调试 |
| 窗口截断 | 只保留最近 N 轮 | 大多数场景 |
| 摘要压缩 | 用 LLM 把旧对话总结成摘要 | 超长对话 |
| 摘要 + 窗口 | 旧对话摘要 + 最近 N 轮 | 最佳平衡 |

窗口截断示例：

```python
from langchain_core.messages import HumanMessage, AIMessage

def trim_messages(messages, max_messages=10):
    """只保留最近的消息"""
    return messages[-max_messages:]

# 在调用前裁剪
chat_history = trim_messages(chat_history, max_messages=10)
```

## 三、持久化存储

上面的例子把历史存在内存中（Python 字典），程序重启就丢了。实际应用中需要持久化：

### 3.1 文件存储

```python
from langchain_community.chat_message_histories import FileChatMessageHistory

history = FileChatMessageHistory(chat_file_path="chat_history.json")
```

### 3.2 数据库存储

```python
# Redis
from langchain_community.chat_message_histories import RedisChatMessageHistory

# SQLite
from langchain_community.chat_message_histories import SQLChatMessageHistory

# PostgreSQL
# 需要额外配置
```

### 3.3 持久化使用示例（SQLite）

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import SQLChatMessageHistory

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个友好的助手。"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

chain = prompt | llm

def get_session_history(session_id: str):
    return SQLChatMessageHistory(
        session_id=session_id,
        connection_string="sqlite:///chat_history.db"
    )

chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

# 即使程序重启，用同样的 session_id 也能恢复对话
response = chain_with_history.invoke(
    {"input": "还记得我之前说了什么吗？"},
    config={"configurable": {"session_id": "user_001"}}
)
print(response.content)
```

## 四、高级话题：对话管理策略

### 4.1 摘要记忆

对于非常长的对话，可以用 LLM 不断总结历史：

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

summary_prompt = ChatPromptTemplate.from_template(
    "请将以下对话历史总结为一段简洁的文字：\n{conversation}"
)

summary_chain = summary_prompt | llm | StrOutputParser()

# 定期执行：当历史超过一定长度时，触发摘要
if len(chat_history) > 20:
    # 把旧消息变成摘要
    old_messages = chat_history[:-10]
    summary = summary_chain.invoke({"conversation": str(old_messages)})
    # 保留摘要 + 最近的消息
    chat_history = [SystemMessage(content=f"之前对话摘要：{summary}")] + chat_history[-10:]
```

### 4.2 多用户隔离

通过 `session_id` 实现多用户对话隔离，每个用户有独立的对话历史。这在 Web 应用中非常重要：

```python
# 用户A的对话
chain_with_history.invoke(
    {"input": "我喜欢吃苹果"},
    config={"configurable": {"session_id": "user_A"}}
)

# 用户B的对话（互不干扰）
chain_with_history.invoke(
    {"input": "我喜欢吃香蕉"},
    config={"configurable": {"session_id": "user_B"}}
)
```

## 动手练习

1. ✅ 运行手动管理消息列表的示例，验证多轮对话
2. ✅ 用 `RunnableWithMessageHistory` 实现一个多轮聊天机器人
3. ✅ 测试不同的 `session_id`，验证对话隔离
4. ✅ 用 SQLite 持久化对话历史，重启程序后验证记忆还在
5. ✅ 挑战：实现窗口截断策略，当对话超过 10 轮时只保留最近 6 轮

## 自测清单

- [ ] 我理解 LLM 无状态的含义，以及为什么需要手动管理对话历史
- [ ] 我能用 `RunnableWithMessageHistory` 实现多轮对话
- [ ] 我知道如何通过 `session_id` 隔离不同用户的对话
- [ ] 我了解窗口截断、摘要压缩等策略的适用场景
- [ ] 我能把对话历史持久化到文件或数据库

## 下一课

→ 打开 [05-Chains-链式调用.md](05-Chains-链式调用.md)，学习如何把多个步骤串联成完整的工作流。

## 知识库链接

- Memory 的所有存储后端选项 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 旧版 Memory 迁移指南 → [知识库：常见问题与排错指南](../知识库/07-常见问题与排错指南.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
