# LangChain 架构详解

> 深入理解 LangChain 的包结构、核心模块和设计理念。

---

## 一、包结构

LangChain 自 v0.2 起将原来庞大的单体包拆分为多个独立包：

```
langchain-core      ← 核心抽象与接口（Runnable、Prompt、Message 等）
langchain           ← 面向应用的链、Agent、检索等高阶组件
langchain-community ← 第三方集成（各种 Loader、VectorStore、Tool）
langchain-openai    ← OpenAI 专属集成
langchain-anthropic ← Anthropic 专属集成
langchain-ollama    ← Ollama 本地模型集成
langgraph           ← 图式工作流编排
langsmith           ← 可观测性平台 SDK
```

### 各包的依赖关系

```
langchain-core（被所有包依赖）
    ↑
    ├── langchain-openai
    ├── langchain-anthropic
    ├── langchain-ollama
    ├── langchain-community
    └── langchain（依赖 core + 可选依赖 community）
            ↑
        langgraph（依赖 langchain-core）
```

### 安装策略

```bash
# 基础安装（学习用）
pip install langchain langchain-openai langchain-community

# 用 LangGraph
pip install langgraph langchain-openai

# 用特定模型
pip install langchain-anthropic  # Claude
pip install langchain-ollama    # 本地模型

# 只用核心抽象（不需要高阶组件时）
pip install langchain-core
```

## 二、核心抽象：Runnable

`Runnable` 是 LangChain 中**一切可执行组件**的统一接口。所有组件——LLM、Prompt、Parser、Retriever——都是 Runnable。

### 2.1 Runnable 接口

```python
from langchain_core.runnables import Runnable

# 所有 Runnable 都实现以下方法：
class Runnable:
    def invoke(self, input, config=None):        # 单条同步调用
        ...
    def batch(self, inputs, config=None):          # 批量并发
        ...
    def stream(self, input, config=None):         # 流式输出
        ...
    async def ainvoke(self, input, config=None):   # 异步单条
        ...
    async def abatch(self, inputs, config=None):   # 异步批量
        ...
    async def astream(self, input, config=None):   # 异步流式
        ...
```

### 2.2 Runnable 的组合操作

```python
# 管道：A 的输出作为 B 的输入
chain = runnable_a | runnable_b

# 并行：同时执行多个，合并结果为字典
parallel = RunnableParallel(a=runnable_a, b=runnable_b)

# 透传：原样传递，或添加字段
passthrough = RunnablePassthrough.assign(field=runnable_x)

# 自定义函数
custom = RunnableLambda(my_func)
```

### 2.3 为什么统一接口很重要

因为所有组件接口一致，你可以：

- 自由替换组件（换模型不改代码）
- 自由组合组件（任意串联和嵌套）
- 自动获得流式、异步、批处理能力
- 统一的调试和追踪

## 三、核心模块详解

### 3.1 Models（模型层）

```
BaseChatModel（对话模型基类）
    ├── ChatOpenAI
    ├── ChatAnthropic
    ├── ChatOllama
    └── ...

BaseLLM（文本补全模型基类，较少使用）
    ├── OpenAI
    └── ...

BaseEmbeddings（向量化模型基类）
    ├── OpenAIEmbeddings
    ├── OllamaEmbeddings
    └── ...
```

### 3.2 Prompts（提示词层）

```
BasePromptTemplate
    ├── PromptTemplate           ← 纯文本模板
    ├── ChatPromptTemplate       ← 对话消息模板
    │    └── from_messages()     ← 从消息列表创建
    └── FewShotChatMessagePromptTemplate  ← 少样本模板
```

消息类型层级：

```
BaseMessage
    ├── SystemMessage      ← 系统角色
    ├── HumanMessage       ← 用户角色
    ├── AIMessage          ← AI 角色
    │    └── tool_calls    ← AI 请求调用工具
    └── ToolMessage        ← 工具返回结果
```

### 3.3 Output Parsers（输出解析层）

```
BaseOutputParser
    ├── StrOutputParser                    ← 提取纯文本
    ├── JsonOutputParser                   ← 解析为 JSON 字典
    ├── PydanticOutputParser               ← 解析为 Pydantic 对象
    ├── CommaSeparatedListOutputParser     ← 解析为列表
    └── PydanticToolsParser                ← 解析工具调用参数
```

### 3.4 Memory（记忆层，新版）

```
# 新版 Memory 架构
RunnableWithMessageHistory  ← 包装器，给 Chain 添加历史
     │
     └── ChatMessageHistory（历史存储后端）
          ├── ChatMessageHistory     ← 内存存储
          ├── FileChatMessageHistory ← 文件存储
          ├── SQLChatMessageHistory  ← SQLite/SQL 存储
          ├── RedisChatMessageHistory← Redis 存储
          └── ...
```

### 3.5 Retrieval（检索层）

```
Document Loaders（加载器）
    ├── TextLoader, PyPDFLoader, WebBaseLoader, DirectoryLoader, ...
    └── 基于 Unstructured 的通用加载器

Text Splitters（分割器）
    ├── RecursiveCharacterTextSplitter  ← 递归字符分割（推荐）
    ├── CharacterTextSplitter            ← 字符分割
    ├── MarkdownHeaderTextSplitter      ← Markdown 标题分割
    └── TokenTextSplitter               ← Token 分割

Vector Stores（向量数据库）
    ├── FAISS, Chroma, Pinecone, Milvus, pgvector, ...
    └── 所有向量数据库实现 .as_retriever() 接口

Retrievers（检索器）
    ├── VectorStoreRetriever            ← 基础向量检索
    ├── MultiQueryRetriever             ← 多查询检索
    ├── ContextualCompressionRetriever  ← 上下文压缩
    └── EnsembleRetriever               ← 混合检索
```

### 3.6 Agents & Tools（代理与工具层）

```
Tools
    ├── @tool 装饰器               ← 快速创建工具
    ├── StructuredTool.from_function ← 结构化工具
    └── BaseTool                   ← 工具基类（继承实现）

Agents
    ├── create_tool_calling_agent  ← 基于 Tool Calling（推荐）
    ├── create_structured_chat_agent ← 结构化输出 Agent
    └── AgentExecutor              ← Agent 执行器
```

### 3.7 Callbacks（回调层）

```
BaseCallbackHandler
    ├── StdOutCallbackHandler     ← 打印到控制台
    ├── 自定义 Handler             ← 继承实现
    └── LangSmith 追踪            ← 自动上报
```

## 四、LCEL 设计理念

### 4.1 设计目标

LCEL（LangChain Expression Language）的设计目标：

1. **统一接口**：所有组件共享 invoke/stream/batch/async
2. **可组合**：用 `|` 自由串联
3. **零配置流式**：不需要额外代码就支持流式输出
4. **零配置异步**：不需要额外代码就支持异步
5. **可追溯**：自动集成 LangSmith 追踪

### 4.2 数据流

```
输入 (dict)
  │
  ▼
Prompt (填充模板) → ChatPromptValue (消息列表)
  │
  ▼
LLM (调用模型) → AIMessage (模型回复)
  │
  ▼
Parser (解析输出) → str / dict / pydantic object
```

每一步的输出自动作为下一步的输入。类型需要兼容——上一步的输出类型必须能被下一步接收。

### 4.3 类型流转示例

```python
# 类型流转
prompt: ChatPromptTemplate       # 输入 dict → 输出 ChatPromptValue
  |
llm: ChatOpenAI                  # 输入 ChatPromptValue → 输出 AIMessage
  |
parser: StrOutputParser           # 输入 AIMessage → 输出 str

# 整体：dict → str
chain = prompt | llm | parser
result: str = chain.invoke(&#123;"topic": "AI"&#125;)
```

## 五、版本说明

### 当前版本体系

| 包 | 版本 | 说明 |
|----|------|------|
| langchain | 0.3.x | 当前稳定版 |
| langchain-core | 0.3.x | 核心包 |
| langgraph | 0.2.x+ | 图式编排 |
| langchain-community | 0.3.x | 社区集成 |

### 从 0.1 迁移到 0.2/0.3 的主要变化

1. 包拆分：`langchain` 大包拆分为 `langchain-core`、`langchain-community`、各厂商包
2. Memory 重构：废弃旧版 Memory 类，推荐 `RunnableWithMessageHistory`
3. LCEL 成为推荐方式：旧版 `LLMChain` 等类已废弃
4. Agent 重构：推荐 `create_tool_calling_agent`，废弃旧版 Agent 类型

> 📌 详见 [版本演进与生态](08-版本演进与生态.md)
