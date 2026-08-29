# 第 02 课：LangChain 入门——初识框架

> 这一课我们来回答一个关键问题：既然可以直接用 API 调用 LLM，为什么还需要 LangChain？

---

## 学习目标

- 理解 LangChain 解决什么问题
- 了解 LangChain 的核心模块组成
- 跑通第一个 LangChain 应用
- 理解 LangChain 的设计哲学

## 一、为什么需要 LangChain

### 1.1 裸调 API 的局限

假设你只用 OpenAI 的 API 写一个聊天机器人，你很快会遇到这些问题：

```
问题 1：模型不记得之前说过什么（每次调用都是独立的）
问题 2：你想让模型查数据库？它做不到（没有工具）
问题 3：你想让模型读一个 PDF 文件？需要自己写解析
问题 4：你想让模型先思考、再搜索、再回答？需要自己编排流程
问题 5：换一个模型提供商，代码要大改
```

### 1.2 LangChain 的价值

LangChain 就是为了解决这些问题而生：

```
裸调 API:  你写大量胶水代码连接 LLM 和外部世界
LangChain: 框架已经帮你封装好这些连接，你只需要组合
```

用一个比喻来理解：

> - LLM 就像一个**聪明的但没有任何工具的人**
> - LangChain 就像给这个人配了一套**完整的办公装备**：记事本（Memory）、工具箱（Tools）、文件柜（RAG）、流程手册（Chains）

## 二、LangChain 的核心模块

LangChain 由以下几个核心模块组成，后续每节课会逐一深入：

```
LangChain 核心模块
│
├── Models（模型）
│   └── 统一接口对接各种 LLM（OpenAI、Claude、本地模型等）
│
├── Prompts（提示词）
│   └── 模板化管理和复用提示词
│
├── Output Parsers（输出解析器）
│   └── 把模型的文本回复解析成结构化数据
│
├── Memory（记忆）
│   └── 让模型"记住"对话上下文
│
├── Chains（链）
│   └── 将多个步骤串联起来，形成完整工作流
│
├── Agents（智能代理）
│   └── 让模型自主决定使用哪些工具、如何行动
│
├── Retrieval（检索）
│   └── 从外部数据源加载和检索信息（RAG 的基础）
│
└── Callbacks（回调）
    └── 在运行过程中插入自定义逻辑（日志、监控等）
```

> 📌 更详细的架构说明见 [知识库：LangChain 架构详解](../知识库/02-LangChain架构详解.md)

## 三、安装与第一个程序

### 3.1 安装

如果你还没安装，执行以下命令（确保虚拟环境已激活）：

```bash
pip install langchain langchain-openai langchain-community python-dotenv
```

各包的作用：

| 包名 | 作用 |
|------|------|
| `langchain` | 核心框架 |
| `langchain-openai` | OpenAI 模型集成 |
| `langchain-community` | 社区集成（各种第三方工具） |
| `python-dotenv` | 读取 `.env` 文件中的密钥 |

### 3.2 第一个程序：单次对话

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()  # 加载 .env 中的 API Key

# 创建一个 LLM 实例
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

# 发送消息并获取回复
response = llm.invoke("用三句话解释什么是人工智能。")

print(response.content)
```

`temperature` 参数控制输出的随机性：0 = 确定性（每次回答一样），1 = 更有创意（每次不同）。

### 3.3 第二个程序：带变量模板的提示词

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini")

# 创建一个提示词模板（带占位变量）
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一位{role}，用简洁、专业的语言回答问题。"),
    ("human", "{question}")
])

# 填充变量并调用
chain = prompt | llm  # 用管道符 | 把 prompt 和 llm 连起来
response = chain.invoke({
    "role": "数学老师",
    "question": "什么是质数？"
})

print(response.content)
```

这里出现了两个新概念：

- **PromptTemplate**：把固定的提示词模板化，通过变量动态填充
- **`|` 管道符**：这是 LangChain 表达式语言（LCEL）的核心语法，下一课会详细讲

### 3.4 第三个程序：解析结构化输出

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini")

prompt = ChatPromptTemplate.from_template(
    "将以下英文翻译为中文，只输出翻译结果：\n{text}"
)

# 用管道符串联：prompt → llm → parser
chain = prompt | llm | StrOutputParser()

result = chain.invoke({"text": "Artificial intelligence is changing the world."})
print(result)  # 直接得到字符串，不需要再 .content
```

## 四、LangChain 的设计哲学

### 4.1 可组合性

LangChain 的核心理念是**可组合性**：把小的、独立的组件像积木一样拼在一起：

```python
# 每个组件都是独立的，通过 | 连接
chain = prompt | llm | parser
```

### 4.2 提供商无关

同一个接口，换一行代码就能切换模型：

```python
# 用 OpenAI
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o-mini")

# 换成 Anthropic Claude
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")

# 换成本地 Ollama
from langchain_ollama import ChatOllama
llm = ChatOllama(model="llama3")
```

你的 prompt、parser、chain 代码完全不用改。

### 4.3 LCEL（LangChain Expression Language）

LangChain 的新版语法使用 LCEL——一种用 `|` 管道符连接组件的方式。它的好处：

- 统一的接口：所有组件都支持 `invoke`、`stream`、`batch`
- 自动支持流式输出
- 自动支持异步
- 自动支持并发批处理

> 📌 LCEL 的详细用法将在第 05 课深入讲解

## 动手练习

1. ✅ 安装 LangChain 并运行第一个程序
2. ✅ 修改第一个程序，让模型用"海盗的语气"回答问题
3. ✅ 修改提示词模板程序，让 `{role}` 变量接受不同的职业角色（如"医生"、"律师"），观察输出的变化
4. ✅ 修改翻译程序，让它支持中文翻英文

## 自测清单

- [ ] 我能说出裸调 API 至少 3 个局限，以及 LangChain 如何解决它们
- [ ] 我知道 LangChain 有哪些核心模块
- [ ] 我成功运行了三个示例程序
- [ ] 我理解 `|` 管道符的作用是把组件串联起来
- [ ] 我知道切换 LLM 提供商只需要换一行 import 和实例化代码

## 下一课

→ 打开 [03-核心概念-Models-Prompts-Parsers.md](03-核心概念-Models-Prompts-Parsers.md)，深入学习 LangChain 的三大基础组件。

## 知识库链接

- 想了解 LangChain 完整的包结构？→ [知识库：LangChain 架构详解](../知识库/02-LangChain架构详解.md)
- 想查看所有可用模型的列表？→ [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 遇到安装问题？→ [知识库：环境配置指南](../知识库/06-环境配置指南.md)
