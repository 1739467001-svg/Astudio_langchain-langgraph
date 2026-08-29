# 第 05 课：Chains——链式调用

> Chain 是 LangChain 的灵魂。它让你把多个组件像水管一样连起来，数据从一端流入、从另一端流出。

---

## 学习目标

- 理解 LCEL（LangChain Expression Language）的基本概念
- 掌握管道符 `|` 串联组件的方式
- 学会使用 RunnablePassthrough、RunnableLambda 等工具组件
- 能够构建多步骤的 Chain
- 理解流式输出、批处理和异步调用

## 一、什么是 Chain

### 1.1 从管道说起

你应该已经在前面几课见过这个写法了：

```python
chain = prompt | llm | parser
```

这里的 `|` 就是 LCEL 的核心语法。它的工作方式就像 Unix 管道：

```
数据 → prompt 处理 → llm 处理 → parser 处理 → 最终结果
```

每个组件接收上一步的输出，处理后再传给下一步。

### 1.2 为什么用 LCEL

在 LangChain 旧版本中，创建 Chain 需要用特定的类（如 `LLMChain`、`SequentialChain`）。新版统一为 LCEL，好处是：

| 特性 | 说明 |
|------|------|
| 统一接口 | 所有 Chain 都支持 `invoke`、`stream`、`batch` |
| 流式输出 | 自动支持，不需要额外代码 |
| 异步支持 | 自动支持 `ainvoke`、`astream` |
| 批处理 | 自动支持并发调用多条输入 |
| 可组合 | 任何 Runnable 都可以用 `\|` 连接 |
| 可调试 | 支持 LangSmith 追踪 |

## 二、LCEL 基础组件

### 2.1 Runnable 接口

LCEL 中所有组件都实现了 `Runnable` 接口，提供以下方法：

| 方法 | 作用 | 同步/异步 |
|------|------|-----------|
| `invoke(input)` | 处理单条输入 | 同步 |
| `batch(inputs)` | 批量处理多条输入 | 同步 |
| `stream(input)` | 流式输出 | 同步 |
| `ainvoke(input)` | 异步处理单条 | 异步 |
| `abatch(inputs)` | 异步批量 | 异步 |
| `astream(input)` | 异步流式 | 异步 |

```python
# 单条调用
result = chain.invoke(&#123;"topic": "AI"&#125;)

# 批量调用（自动并发）
results = chain.batch([
    &#123;"topic": "AI"&#125;,
    &#123;"topic": "区块链"&#125;,
    &#123;"topic": "量子计算"&#125;
])

# 流式调用（逐字输出）
for chunk in chain.stream(&#123;"topic": "AI"&#125;):
    print(chunk, end="", flush=True)
```

### 2.2 RunnablePassthrough

`RunnablePassthrough` 是一个"透传"组件——它把输入原封不动地传到下一步，或者用来添加额外字段：

```python
from langchain_core.runnables import RunnablePassthrough

# 透传：输入什么就输出什么
chain = RunnablePassthrough()
chain.invoke("hello")  # "hello"

# 常用于并行组装数据
chain = RunnablePassthrough.assign(
    extra_field=lambda x: f"处理了: &#123;x['input']&#125;"
)
chain.invoke(&#123;"input": "hello"&#125;)
# &#123;"input": "hello", "extra_field": "处理了: hello"&#125;
```

### 2.3 RunnableLambda

把任意 Python 函数变成 Runnable：

```python
from langchain_core.runnables import RunnableLambda

def word_count(text):
    return len(text.split())

chain = RunnableLambda(word_count)
chain.invoke("hello world foo bar")  # 4
```

### 2.4 RunnableParallel

并行执行多个组件，把结果合并成字典：

```python
from langchain_core.runnables import RunnableParallel, RunnableLambda

chain = RunnableParallel(
    word_count=RunnableLambda(lambda x: len(x.split())),
    char_count=RunnableLambda(lambda x: len(x)),
    upper=RunnableLambda(lambda x: x.upper()),
)

result = chain.invoke("hello world")
# &#123;"word_count": 2, "char_count": 11, "upper": "HELLO WORLD"&#125;
```

## 三、组合实战

### 3.1 基础 Chain：Prompt → LLM → Parser

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("用一段话解释&#123;concept&#125;")
parser = StrOutputParser()

chain = prompt | llm | parser

result = chain.invoke(&#123;"concept": "量子计算"&#125;)
print(result)
```

### 3.2 带数据增强的 Chain

经典 RAG 模式：先检索知识，再把知识传给 LLM 生成回答：

```python
from langchain_core.runnables import RunnablePassthrough, RunnableLambda

# 模拟一个知识检索函数
def retrieve_knowledge(query):
    """从知识库中检索相关内容"""
    # 实际中会查询向量数据库
    return "LangChain 是一个用于构建 LLM 应用的框架，由 Harrison Chase 创建。"

# 构建链
prompt = ChatPromptTemplate.from_template(
    "根据以下背景知识回答问题。\n\n背景知识：&#123;context&#125;\n\n问题：&#123;question&#125;"
)

chain = (
    # 第一步：并行组装数据
    &#123;
        "context": RunnableLambda(lambda x: retrieve_knowledge(x["question"])),
        "question": RunnablePassthrough()
    &#125;
    # 第二步：填充模板
    | prompt
    # 第三步：调用 LLM
    | llm
    # 第四步：解析输出
    | StrOutputParser()
)

result = chain.invoke(&#123;"question": "LangChain 是什么？"&#125;)
print(result)
```

### 3.3 多步骤 Chain

串联多个 LLM 调用——第一步生成大纲，第二步根据大纲写内容：

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda

llm = ChatOpenAI(model="gpt-4o-mini")

# 第一步：生成大纲
outline_prompt = ChatPromptTemplate.from_template(
    "为以下主题生成3个要点的大纲：\n&#123;topic&#125;"
)
outline_chain = outline_prompt | llm | StrOutputParser()

# 第二步：根据大纲写详细内容
detail_prompt = ChatPromptTemplate.from_template(
    "根据以下大纲，写一段详细的内容：\n&#123;outline&#125;"
)
detail_chain = detail_prompt | llm | StrOutputParser()

# 串联两步
final_chain = outline_chain | RunnableLambda(lambda outline: &#123;"outline": outline&#125;) | detail_chain

result = final_chain.invoke(&#123;"topic": "人工智能的未来"&#125;)
print(result)
```

## 四、流式输出

流式输出让用户逐字看到回复，体验更好：

```python
chain = prompt | llm | StrOutputParser()

# 流式输出
for chunk in chain.stream(&#123;"concept": "黑洞"&#125;):
    print(chunk, end="", flush=True)
print()  # 换行
```

异步流式（Web 应用中更常用）：

```python
import asyncio

async def main():
    async for chunk in chain.astream(&#123;"concept": "黑洞"&#125;):
        print(chunk, end="", flush=True)

asyncio.run(main())
```

## 五、给 Chain 添加 Memory

结合上一课的 Memory：

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个知识渊博的助手。"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "&#123;input&#125;")
])

chain = prompt | llm

# 添加历史管理
store = &#123;&#125;
def get_history(session_id):
    return store.setdefault(session_id, ChatMessageHistory())

chain_with_memory = RunnableWithMessageHistory(
    chain,
    get_history,
    input_messages_key="input",
    history_messages_key="history",
)

# 现在它有记忆了
response = chain_with_memory.invoke(
    &#123;"input": "推荐一本 Python 书"&#125;,
    config=&#123;"configurable": &#123;"session_id": "s1"&#125;&#125;
)
```

## 动手练习

1. ✅ 运行所有示例代码
2. ✅ 用 `RunnableParallel` 同时生成一首诗的"标题"和"正文"（并行两次 LLM 调用）
3. ✅ 实现一个两步 Chain：第一步让 LLM 提取关键词，第二步根据关键词生成摘要
4. ✅ 用 `stream()` 实现流式输出，观察逐字打印效果
5. ✅ 挑战：用 `batch()` 同时处理 5 个不同的主题，观察并发效果

## 自测清单

- [ ] 我理解 `|` 管道符的作用是把多个 Runnable 串联起来
- [ ] 我知道 `invoke`、`stream`、`batch` 的区别和使用场景
- [ ] 我会用 `RunnablePassthrough`、`RunnableLambda`、`RunnableParallel`
- [ ] 我能构建多步骤的 Chain，串联多次 LLM 调用
- [ ] 我能实现流式输出

## 下一课

→ 打开 [06-Agents与Tools-智能代理.md](06-Agents与Tools-智能代理.md)，让 LLM 学会"使用工具"。

## 知识库链接

- LCEL 的完整 API → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 更多 Chain 示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
