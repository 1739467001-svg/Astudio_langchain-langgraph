# API 参考与速查手册

> 常用 API 的快速查找。按模块分类，每条附简要说明和代码片段。

---

## 一、模型调用

### 1.1 ChatOpenAI

```python
from langchain_openai import ChatOpenAI

# 创建
llm = ChatOpenAI(
    model="gpt-4o-mini",       # 模型名
    temperature=0.7,             # 随机性 0-2
    max_tokens=None,             # 最大输出 token
    timeout=None,                # 超时秒数
    max_retries=2,               # 重试次数
    streaming=False,             # 流式输出
)

# 调用
response = llm.invoke("你好")
response = llm.invoke([HumanMessage(content="你好")])
response = llm.invoke(prompt_value)  # ChatPromptValue

# 流式
for chunk in llm.stream("讲故事"):
    print(chunk.content, end="")

# 批量
results = llm.batch(["问题1", "问题2", "问题3"])

# 异步
response = await llm.ainvoke("你好")
async for chunk in llm.astream("讲故事"):
    print(chunk.content, end="")

# 绑定工具
llm_with_tools = llm.bind_tools([search_tool, calc_tool])

# 绑定 stop 词
llm = llm.bind(stop=["\nHuman:"])

# 结构化输出
structured_llm = llm.with_structured_output(MyPydanticModel)
result = structured_llm.invoke("提取信息...")  # 直接返回 Pydantic 对象
```

### 1.2 OpenAIEmbeddings

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",  # 嵌入模型
)

# 向量化单条文本
vector = embeddings.embed_query("hello world")

# 向量化多条
vectors = embeddings.embed_documents(["text1", "text2"])
```

### 1.3 其他模型集成

```python
# Anthropic Claude
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")

# Ollama 本地模型
from langchain_ollama import ChatOllama
llm = ChatOllama(model="llama3", temperature=0)

# Google Gemini
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model="gemini-pro")

# 通义千问
from langchain_community.chat_models import ChatTongyi
llm = ChatTongyi(model="qwen-max")
```

## 二、消息类型

```python
from langchain_core.messages import (
    SystemMessage,    # 系统消息
    HumanMessage,     # 用户消息
    AIMessage,        # AI 回复
    AIMessageChunk,   # AI 流式片段
    ToolMessage,      # 工具返回
    AnyMessage,       # 任意消息类型（联合类型）
    BaseMessage,      # 消息基类
)

# 创建消息
msg = HumanMessage(content="你好")
msg = SystemMessage(content="你是一个助手")
msg = AIMessage(content="你好！有什么可以帮你的？")

# 带 tool_calls 的 AIMessage
msg = AIMessage(
    content="",
    tool_calls=[&#123;
        "name": "search",
        "args": &#123;"query": "天气"&#125;,
        "id": "call_123",
    &#125;]
)

# ToolMessage
msg = ToolMessage(content="搜索结果...", tool_call_id="call_123")

# 消息属性
msg.content        # 文本内容
msg.type           # 消息类型
msg.additional_kwargs  # 附加信息
```

## 三、提示词模板

### 3.1 ChatPromptTemplate

```python
from langchain_core.prompts import ChatPromptTemplate

# 从模板创建
prompt = ChatPromptTemplate.from_template("解释&#123;concept&#125;")

# 从消息列表创建
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是&#123;role&#125;"),
    ("human", "&#123;question&#125;"),
])

# 带占位符（用于注入历史）
from langchain_core.prompts import MessagesPlaceholder
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是助手"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "&#123;input&#125;"),
])

# 调用（返回 ChatPromptValue）
value = prompt.invoke(&#123;"role": "老师", "question": "1+1"&#125;)
messages = value.to_messages()  # 转为消息列表
string = value.to_string()      # 转为字符串

# 格式化
formatted = prompt.format_messages(role="老师", question="1+1")
```

### 3.2 PromptTemplate

```python
from langchain_core.prompts import PromptTemplate

prompt = PromptTemplate.from_template("翻译：&#123;text&#125;")
text = prompt.format(text="hello")
```

### 3.3 FewShotChatMessagePromptTemplate

```python
from langchain_core.prompts import FewShotChatMessagePromptTemplate

examples = [
    &#123;"input": "开心", "output": "😊"&#125;,
    &#123;"input": "难过", "output": "😢"&#125;,
]

example_prompt = ChatPromptTemplate.from_messages([
    ("human", "&#123;input&#125;"),
    ("ai", "&#123;output&#125;"),
])

few_shot = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples,
)

final_prompt = ChatPromptTemplate.from_messages([
    ("system", "根据情感输出表情"),
    few_shot,
    ("human", "&#123;input&#125;"),
])
```

## 四、输出解析器

```python
from langchain_core.output_parsers import (
    StrOutputParser,                     # → str
    JsonOutputParser,                    # → dict
    PydanticOutputParser,                # → Pydantic 对象
    CommaSeparatedListOutputParser,      # → list[str]
    PydanticToolsParser,                 # → 工具调用参数
    BaseOutputParser,                    # 基类（自定义用）
)

# StrOutputParser
parser = StrOutputParser()
result = parser.invoke(ai_message)  # → "纯文本"

# JsonOutputParser
from pydantic import BaseModel
class Person(BaseModel):
    name: str
    age: int

parser = JsonOutputParser(pydantic_object=Person)
# 获取格式说明（注入到 prompt 中）
format_instructions = parser.get_format_instructions()

# 自定义 Parser
class MyParser(BaseOutputParser[str]):
    def parse(self, text: str) -> str:
        return text.strip().upper()
```

## 五、LCEL Runnable

```python
from langchain_core.runnables import (
    RunnablePassthrough,      # 透传
    RunnableLambda,           # 包装函数
    RunnableParallel,         # 并行
    RunnableBranch,           # 分支
    RunnableWithMessageHistory,  # 带历史
)

# RunnablePassthrough
RunnablePassthrough().invoke("hello")  # → "hello"
RunnablePassthrough.assign(
    upper=lambda x: x["text"].upper()
).invoke(&#123;"text": "hello"&#125;)
# → &#123;"text": "hello", "upper": "HELLO"&#125;

# RunnableLambda
chain = RunnableLambda(lambda x: x.upper())
chain.invoke("hello")  # → "HELLO"

# RunnableParallel
chain = RunnableParallel(
    a=RunnableLambda(lambda x: x["input"]),
    b=RunnableLambda(lambda x: len(x["input"])),
)
chain.invoke(&#123;"input": "hello"&#125;)
# → &#123;"a": "hello", "b": 5&#125;

# RunnableWithMessageHistory
chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)
```

## 六、文档加载器

```python
# 文本
from langchain_community.document_loaders import TextLoader
loader = TextLoader("file.txt", encoding="utf-8")

# PDF
from langchain_community.document_loaders import PyPDFLoader
loader = PyPDFLoader("doc.pdf")

# Markdown
from langchain_community.document_loaders import UnstructuredMarkdownLoader
loader = UnstructuredMarkdownLoader("README.md")

# 网页
from langchain_community.document_loaders import WebBaseLoader
loader = WebBaseLoader("https://example.com")

# CSV
from langchain_community.document_loaders import CSVLoader
loader = CSVLoader("data.csv")

# 目录
from langchain_community.document_loaders import DirectoryLoader
loader = DirectoryLoader("./docs", glob="**/*.txt", loader_cls=TextLoader)

# 加载
documents = loader.load()       # 全部加载
documents = loader.lazy_load()  # 懒加载（大文件用）
```

## 七、文本分割器

```python
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,  # 递归分割（推荐）
    CharacterTextSplitter,           # 字符分割
    TokenTextSplitter,               # Token 分割
    MarkdownHeaderTextSplitter,      # Markdown 标题分割
)

# 递归分割（最常用）
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", " ", ""],  # 分割优先级
)
chunks = splitter.split_documents(documents)
chunks = splitter.split_text(text)
```

## 八、向量数据库

```python
# FAISS（本地，推荐学习用）
from langchain_community.vectorstores import FAISS
db = FAISS.from_documents(chunks, embeddings)
db = FAISS.from_texts(["text1", "text2"], embeddings)
db.save_local("my_index")
db = FAISS.load_local("my_index", embeddings, allow_dangerous_deserialization=True)

# Chroma
from langchain_community.vectorstores import Chroma
db = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")

# 检索
results = db.similarity_search("query", k=3)
results = db.similarity_search_with_score("query", k=3)  # 带相似度分数

# 转为检索器
retriever = db.as_retriever(
    search_type="similarity",        # 或 "mmr", "similarity_score_threshold"
    search_kwargs=&#123;"k": 3&#125;,
)
docs = retriever.invoke("query")
```

## 九、工具

```python
from langchain_core.tools import tool, StructuredTool, BaseTool
from pydantic import BaseModel, Field

# @tool 装饰器（推荐）
@tool
def search(query: str) -> str:
    """搜索互联网。query: 搜索关键词"""
    return "结果"

# StructuredTool
class SearchInput(BaseModel):
    query: str = Field(description="搜索关键词")
    max_results: int = Field(default=5, description="最大结果数")

search_tool = StructuredTool.from_function(
    func=my_search_func,
    name="search",
    description="搜索互联网",
    args_schema=SearchInput,
)

# 内置工具
from langchain_community.tools import DuckDuckGoSearchRun
search = DuckDuckGoSearchRun()
```

## 十、Agent

```python
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个助手"),
    ("human", "&#123;input&#125;"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    max_iterations=5,
    handle_parsing_errors=True,
)

result = executor.invoke(&#123;"input": "123 * 456?"&#125;)
```

## 十一、LangGraph 速查

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent, ToolNode

# 定义 State
from typing import TypedDict, Annotated
from operator import add

class State(TypedDict):
    messages: Annotated[list, add]
    result: str

# 构建图
graph = StateGraph(State)
graph.add_node("node_a", func_a)
graph.add_node("node_b", func_b)
graph.add_edge(START, "node_a")
graph.add_edge("node_a", "node_b")
graph.add_edge("node_b", END)
graph.add_conditional_edges("node_a", router, &#123;"path1": "node_b", "path2": END&#125;)

# 编译
app = graph.compile()
app = graph.compile(checkpointer=MemorySaver())
app = graph.compile(interrupt_before=["node_b"])

# 运行
result = app.invoke(input_data)
for event in app.stream(input_data):
    print(event)
result = await app.ainvoke(input_data)

# 快速 ReAct Agent
agent = create_react_agent(llm, tools)
result = agent.invoke(&#123;"messages": [HumanMessage(content="hello")]&#125;)
```

## 十二、缓存

```python
from langchain_core.globals import set_llm_cache
from langchain_community.cache import InMemoryCache
# SQLite 缓存
from langchain_community.cache import SQLiteCache

# 内存缓存
set_llm_cache(InMemoryCache())
# SQLite 缓存
set_llm_cache(SQLiteCache(database_path="langchain.db"))
```

## 十三、回调

```python
from langchain_core.callbacks import BaseCallbackHandler, StdOutCallbackHandler

# 内置
handler = StdOutCallbackHandler()
llm = ChatOpenAI(callbacks=[handler])

# 自定义
class MyHandler(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        print("LLM started")
    def on_llm_end(self, response, **kwargs):
        print("LLM ended")
    def on_llm_new_token(self, token, **kwargs):
        print(token, end="")
```
