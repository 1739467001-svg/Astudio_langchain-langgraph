# 第 03 课：核心概念——Models、Prompts、Parsers

> 这是 LangChain 的"三件套"：告诉模型做什么（Prompt）、模型本身（Model）、把回复变成你需要的格式（Parser）。

---

## 学习目标

- 掌握 LangChain 中 Models 的分类与使用方式
- 理解消息类型（System / Human / AI）和 PromptTemplate 的用法
- 学会使用 Output Parsers 将文本回复解析为结构化数据
- 能够独立组合这三个组件完成一个小任务

## 一、Models（模型）

### 1.1 两大类型

LangChain 中的模型接口分为两大类：

| 类型 | 基类 | 输入 | 输出 | 典型用途 |
|------|------|------|------|----------|
| LLM（文本补全模型） | `LLM` | 字符串 | 字符串 | 补全文本、传统用法 |
| Chat Model（对话模型） | `ChatModel` | 消息列表 | AI 消息 | 对话、现代用法 |

> 📌 **注意**：现代应用几乎都用 Chat Model。LLM 类型是老式模型（如 text-davinci-003）的接口，现在已较少使用。本课程以 Chat Model 为主。

### 1.2 Chat Model 的基本用法

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

# 创建实例
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 最简单的调用
response = llm.invoke("你好")
print(response.content)  # 模型的文字回复
```

### 1.3 常用参数

```python
llm = ChatOpenAI(
    model="gpt-4o-mini",       # 模型名称
    temperature=0,              # 0=确定性输出, 1=更有创意
    max_tokens=500,             # 最大输出长度
    timeout=30,                 # 超时时间（秒）
    max_retries=2,              # 失败重试次数
)
```

### 1.4 消息类型

Chat Model 接收的消息分为三种角色：

```python
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

messages = [
    SystemMessage(content="你是一个专业的翻译助手，只输出翻译结果。"),
    HumanMessage(content="Translate 'hello' to Chinese."),
    AIMessage(content="你好"),          # 模型之前的回复
    HumanMessage(content="Translate 'world' to Chinese."),
]

response = llm.invoke(messages)
print(response.content)  # 世界
```

角色含义：

- **System**：设定模型的行为/人设（"你是xxx，遵守xxx规则"）
- **Human**：用户的输入
- **AI**：模型之前的回复（用于提供上下文）

## 二、Prompts（提示词模板）

### 2.1 为什么需要模板

直接写字符串拼接 Prompt 会很混乱：

```python
# ❌ 不好：硬拼接
prompt = "你是一个" + role + "，请回答：" + question

# ✅ 好：用模板
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一个&#123;role&#125;"),
    ("human", "&#123;question&#125;")
])
```

### 2.2 ChatPromptTemplate

```python
from langchain_core.prompts import ChatPromptTemplate

# 方式一：从消息列表创建
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一位&#123;role&#125;，请用&#123;tone&#125;的语气回答问题。"),
    ("human", "&#123;question&#125;")
])

# 格式化
formatted = prompt.invoke(&#123;
    "role": "数学老师",
    "tone": "幽默",
    "question": "1+1等于几？"
&#125;)
# formatted 是一个 ChatPromptValue，可以直接传给 llm
```

### 2.3 PromptTemplate（纯文本模板）

```python
from langchain_core.prompts import PromptTemplate

prompt = PromptTemplate.from_template(
    "请为以下产品写一句广告语：\n产品名称：&#123;product&#125;\n目标受众：&#123;audience&#125;"
)

text = prompt.format(product="智能手表", audience="年轻人")
print(text)
```

### 2.4 Few-Shot Prompt（少样本提示）

给模型几个例子，让它学会你想要的输出模式：

```python
from langchain_core.prompts import FewShotChatMessagePromptTemplate

# 给模型看的示例
examples = [
    &#123;"input": "开心", "output": "😊 我今天心情很好！"&#125;,
    &#123;"input": "难过", "output": "😢 今天有点不开心"&#125;,
    &#123;"input": "愤怒", "output": "😠 这让我很生气！"&#125;,
]

# 示例模板
example_prompt = ChatPromptTemplate.from_messages([
    ("human", "&#123;input&#125;"),
    ("ai", "&#123;output&#125;"),
])

# 组合成 Few-Shot 提示词
few_shot_prompt = FewShotChatMessagePromptTemplate(
    example_prompt=example_prompt,
    examples=examples,
)

# 最终的完整提示词
final_prompt = ChatPromptTemplate.from_messages([
    ("system", "根据情感词，输出对应的表情和回复。"),
    few_shot_prompt,
    ("human", "&#123;input&#125;"),
])

# 使用
chain = final_prompt | llm
response = chain.invoke(&#123;"input": "惊讶"&#125;)
print(response.content)  # 😮 这太出乎意料了！
```

## 三、Output Parsers（输出解析器）

### 3.1 为什么需要解析器

模型返回的是纯文本字符串，但你往往需要结构化数据：

```python
# 模型返回: "张三, 25岁, 北京"
# 你想要的: &#123;"name": "张三", "age": 25, "city": "北京"&#125;
```

### 3.2 StrOutputParser（最简单）

直接提取模型的文本内容，去掉多余的元数据：

```python
from langchain_core.output_parsers import StrOutputParser

chain = prompt | llm | StrOutputParser()
# 输出直接是字符串，不需要 .content
```

### 3.3 JsonOutputParser（JSON 解析）

让模型返回 JSON 并自动解析：

```python
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel

# 定义你期望的数据结构
class PersonInfo(BaseModel):
    name: str
    age: int
    hobbies: list[str]

# 创建解析器
parser = JsonOutputParser(pydantic_object=PersonInfo)

# 在提示词中告诉模型按格式输出
prompt = PromptTemplate.from_template(
    "根据以下描述，提取人物信息并以JSON格式返回：\n&#123;description&#125;\n\n&#123;format_instructions&#125;"
)

# 自动注入格式说明
chain = prompt | llm | parser

result = chain.invoke(&#123;
    "description": "张三今年28岁，喜欢打篮球和看电影",
    "format_instructions": parser.get_format_instructions()
&#125;)

print(result)
# &#123;'name': '张三', 'age': 28, 'hobbies': ['打篮球', '看电影']&#125;
print(type(result))  # <class 'dict'>
```

### 3.4 PydanticOutputParser（强类型解析）

类似 JsonOutputParser，但返回 Pydantic 对象，有类型校验：

```python
from langchain_core.output_parsers import PydanticOutputParser

parser = PydanticOutputParser(pydantic_object=PersonInfo)

chain = prompt | llm | parser
result = chain.invoke(&#123;...&#125;)  # result 是 PersonInfo 对象
print(result.name)  # 直接访问属性
```

### 3.5 CommaSeparatedListOutputParser（列表解析）

```python
from langchain_core.output_parsers import CommaSeparatedListOutputParser

parser = CommaSeparatedListOutputParser()

prompt = PromptTemplate.from_template(
    "列出5种&#123;category&#125;。\n&#123;format_instructions&#125;"
)

chain = prompt | llm | parser
result = chain.invoke(&#123;
    "category": "编程语言",
    "format_instructions": parser.get_format_instructions()
&#125;)

print(result)  # ['Python', 'Java', 'JavaScript', 'C++', 'Go']
```

## 四、三件套组合实战

把 Models + Prompts + Parsers 组合起来，完成一个"人物信息提取器"：

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

load_dotenv()

# 1. 定义输出结构
class Recipe(BaseModel):
    dish_name: str = Field(description="菜名")
    ingredients: list[str] = Field(description="所需食材列表")
    steps: list[str] = Field(description="制作步骤")
    cook_time: str = Field(description="预计烹饪时间")

# 2. 创建解析器
parser = JsonOutputParser(pydantic_object=Recipe)

# 3. 创建提示词模板
prompt = ChatPromptTemplate.from_messages([
    ("system", "你是一位专业厨师，根据用户需求提供菜谱。"),
    ("human", "&#123;request&#125;\n\n&#123;format_instructions&#125;")
])

# 4. 创建模型
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 5. 组合！
chain = prompt | llm | parser

# 6. 执行
result = chain.invoke(&#123;
    "request": "我想做一道简单的家常菜",
    "format_instructions": parser.get_format_instructions()
&#125;)

print(f"菜名：&#123;result['dish_name']&#125;")
print(f"食材：&#123;', '.join(result['ingredients'])&#125;")
print(f"时间：&#123;result['cook_time']&#125;")
print("步骤：")
for i, step in enumerate(result['steps'], 1):
    print(f"  &#123;i&#125;. &#123;step&#125;")
```

## 动手练习

1. ✅ 运行所有示例代码
2. ✅ 修改 Few-Shot 示例，让模型学习一种新的输出模式（如将中文数字转为阿拉伯数字）
3. ✅ 创建一个 Pydantic 模型表示"电影信息"（片名、导演、年份、评分），让模型从一段文字中提取电影信息
4. ✅ 挑战：把温度参数从 0 改到 0.9，多次运行同一个 prompt，观察输出变化

## 自测清单

- [ ] 我知道 LLM 和 Chat Model 的区别，且知道现代应用推荐用 Chat Model
- [ ] 我能说出 System、Human、AI 三种消息角色的用途
- [ ] 我会用 ChatPromptTemplate 创建带变量的提示词
- [ ] 我会用 Few-Shot Prompt 给模型展示示例
- [ ] 我会用 Output Parser 把模型输出解析为 JSON 或列表
- [ ] 我能把 prompt | llm | parser 三者用管道符串联起来

## 下一课

→ 打开 [04-Memory与对话管理.md](04-Memory与对话管理.md)，学习如何让模型"记住"对话上下文。

## 知识库链接

- 所有 Output Parser 的完整列表 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 更多代码示例 → [知识库：代码示例集](../知识库/05-代码示例集.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
