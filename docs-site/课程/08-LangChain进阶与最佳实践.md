# 第 08 课：LangChain 进阶与最佳实践

> 你已经掌握了 LangChain 的核心组件。这一课讲生产环境中的进阶话题：调试、监控、性能优化和部署。

---

## 学习目标

- 学会使用 Callbacks 和 LangSmith 进行调试与追踪
- 理解 LCEL 的高级用法（异步、并发、重试）
- 掌握成本控制和性能优化策略
- 了解部署 LangChain 应用的基本方式

## 一、Callbacks（回调系统）

### 1.1 什么是回调

Callbacks 让你在 Chain 执行过程中插入自定义逻辑，比如记录日志、计时、发送通知：

```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain_openai import ChatOpenAI

# 自定义回调处理器
class MyCallbackHandler(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        print(f"[LLM开始] 准备调用模型...")
    
    def on_llm_end(self, response, **kwargs):
        print(f"[LLM结束] 耗时统计...")
    
    def on_llm_new_token(self, token, **kwargs):
        print(f"[新Token] &#123;token&#125;", end="")

# 使用回调
llm = ChatOpenAI(model="gpt-4o-mini", callbacks=[MyCallbackHandler()])
response = llm.invoke("你好")
```

### 1.2 内置回调

LangChain 提供了几个有用的内置回调：

```python
# 标准输出回调（打印执行过程）
from langchain.callbacks import StdOutCallbackHandler
handler = StdOutCallbackHandler()

llm = ChatOpenAI(model="gpt-4o-mini", callbacks=[handler])
```

## 二、LangSmith 追踪

### 2.1 为什么需要 LangSmith

当你的 Chain 变长、Agent 步骤变多时，出错后很难定位问题。LangSmith 是 LangChain 官方的可观测性平台：

- 可视化整个 Chain 的执行流程
- 查看每一步的输入和输出
- 统计 Token 消耗和成本
- 支持 A/B 测试和评估

### 2.2 配置 LangSmith

```bash
# 在 .env 文件中添加
LANGSMITH_API_KEY=你的密钥
LANGSMITH_TRACING=true
```

```python
# 只要在环境变量中配置了，LangChain 会自动上报
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini")
response = llm.invoke("解释什么是递归")
# 去 LangSmith 网站就能看到这次调用的完整追踪
```

### 2.3 不用 LangSmith 的替代方案

如果你不想用 LangSmith，可以用回调实现简单的日志：

```python
import time
from langchain_core.callbacks import BaseCallbackHandler

class TimingCallback(BaseCallbackHandler):
    def __init__(self):
        self.start_time = None
        self.total_tokens = 0
    
    def on_llm_start(self, serialized, prompts, **kwargs):
        self.start_time = time.time()
    
    def on_llm_end(self, response, **kwargs):
        elapsed = time.time() - self.start_time
        print(f"LLM 调用耗时: &#123;elapsed:.2f&#125;s")
```

## 三、性能优化

### 3.1 并发批处理

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("用一句话解释&#123;concept&#125;")
chain = prompt | llm | StrOutputParser()

# ❌ 慢：逐个调用
import time
start = time.time()
for concept in ["AI", "区块链", "量子计算"]:
    chain.invoke(&#123;"concept": concept&#125;)
print(f"逐个调用: &#123;time.time()-start:.2f&#125;s")

# ✅ 快：批量并发调用
start = time.time()
results = chain.batch([
    &#123;"concept": "AI"&#125;,
    &#123;"concept": "区块链"&#125;,
    &#123;"concept": "量子计算"&#125;,
])
print(f"批量调用: &#123;time.time()-start:.2f&#125;s")
```

### 3.2 异步调用

在 Web 服务（如 FastAPI）中，用异步避免阻塞：

```python
import asyncio
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")

async def async_chat():
    # 多个请求并发执行
    tasks = [
        llm.ainvoke("写一句关于春天的诗"),
        llm.ainvoke("写一句关于夏天的诗"),
        llm.ainvoke("写一句关于秋天的诗"),
    ]
    results = await asyncio.gather(*tasks)
    for r in results:
        print(r.content)

asyncio.run(async_chat())
```

### 3.3 缓存

避免重复调用 LLM（省钱又省时间）：

```python
from langchain_community.cache import InMemoryCache
from langchain_core.globals import set_llm_cache

# 设置内存缓存
set_llm_cache(InMemoryCache())

llm = ChatOpenAI(model="gpt-4o-mini")

# 第一次调用（实际请求 LLM）
import time
start = time.time()
r1 = llm.invoke("什么是AI？")
print(f"第一次: &#123;time.time()-start:.2f&#125;s")

# 第二次同样的问题（命中缓存，秒回）
start = time.time()
r2 = llm.invoke("什么是AI？")
print(f"第二次: &#123;time.time()-start:.2f&#125;s")
```

### 3.4 重试与超时

```python
llm = ChatOpenAI(
    model="gpt-4o-mini",
    max_retries=3,     # 失败自动重试3次
    timeout=30,       # 超时30秒
)
```

## 四、成本控制

### 4.1 Token 统计

```python
response = llm.invoke("你好")

# 查看 Token 使用量
print(f"输入Token: &#123;response.usage_metadata['input_tokens']&#125;")
print(f"输出Token: &#123;response.usage_metadata['output_tokens']&#125;")
print(f"总Token: &#123;response.usage_metadata['total_tokens']&#125;")
```

### 4.2 成本估算

```python
# GPT-4o-mini 大约价格（可能有变动，请查询官方）
# 输入: $0.15 / 1M tokens
# 输出: $0.60 / 1M tokens

INPUT_PRICE = 0.15 / 1_000_000
OUTPUT_PRICE = 0.60 / 1_000_000

input_tokens = response.usage_metadata['input_tokens']
output_tokens = response.usage_metadata['output_tokens']

cost = input_tokens * INPUT_PRICE + output_tokens * OUTPUT_PRICE
print(f"本次调用成本: $&#123;cost:.6f&#125;")
```

### 4.3 省钱技巧

| 策略 | 说明 |
|------|------|
| 用小模型 | 简单任务用 GPT-4o-mini 而非 GPT-4o |
| 缓存 | 重复问题直接命中缓存 |
| 精简 Prompt | 去掉不必要的 system prompt |
| 控制 chunk_size | RAG 中合理设置，避免上下文过长 |
| 设置 max_tokens | 限制输出长度 |

## 五、部署方式

### 5.1 使用 LangServe（已废弃，了解即可）

LangServe 曾是 LangChain 官方的部署工具，但已被 LangGraph Platform 取代。

### 5.2 使用 FastAPI 自行部署

```python
from fastapi import FastAPI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel

app = FastAPI()

llm = ChatOpenAI(model="gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("回答问题：&#123;question&#125;")
chain = prompt | llm | StrOutputParser()

class QuestionRequest(BaseModel):
    question: str

@app.post("/ask")
async def ask(request: QuestionRequest):
    # 使用异步版本
    answer = await chain.ainvoke(&#123;"question": request.question&#125;)
    return &#123;"answer": answer&#125;

# 运行: uvicorn server:app --reload
```

### 5.3 使用 LangGraph Platform

对于使用 LangGraph 构建的应用，可以使用 LangGraph Platform 部署（后续课程会涉及）。

## 六、最佳实践总结

### 6.1 代码组织

```
my_app/
├── .env                   # 密钥配置
├── requirements.txt       # 依赖
├── chains/
│   ├── __init__.py
│   ├── qa_chain.py        # 问答链
│   └── summary_chain.py   # 摘要链
├── tools/
│   ├── __init__.py
│   ├── search.py          # 搜索工具
│   └── calculator.py      # 计算工具
├── app.py                  # 主入口
└── README.md
```

### 6.2 开发原则

1. **从简单开始**：先用最简单的 Chain 跑通，再逐步添加复杂度
2. **测试每一步**：每加一个组件就测试一次
3. **控制成本**：开发时用便宜的模型，上线后再评估是否需要更强的
4. **处理错误**：LLM 调用可能失败（限流、超时），做好重试和降级
5. **不要过度抽象**：初学者常见错误是过早地写复杂框架，先用简单直白的代码

## 动手练习

1. ✅ 配置 LangSmith 或自定义 Callback，观察 Chain 的执行过程
2. ✅ 对比 `invoke` + 循环 vs `batch` 的性能差异
3. ✅ 启用缓存，验证重复调用是否秒回
4. ✅ 实现一个 Token 统计回调，记录每次调用的 Token 消耗
5. ✅ 挑战：用 FastAPI 把你的 Chain 封装成 API 服务

## 自测清单

- [ ] 我知道如何用 Callback 或 LangSmith 追踪 Chain 的执行
- [ ] 我会用 `batch` 和异步调用来提升性能
- [ ] 我知道如何设置缓存来省钱
- [ ] 我能统计每次 LLM 调用的 Token 用量和成本
- [ ] 我了解至少一种部署 LangChain 应用的方式
- [ ] 我知道至少 3 条开发最佳实践

## 下一课

→ 恭喜你完成了 LangChain 的核心学习！接下来进入 LangGraph 篇：打开 [09-LangGraph入门-图式编排.md](09-LangGraph入门-初识框架.md)

## 知识库链接

- 所有 Callback 类型 → [知识库：API 参考与速查手册](../知识库/04-API参考与速查手册.md)
- 部署相关 → [知识库：版本演进与生态](../知识库/08-版本演进与生态.md)
- 术语不懂？→ [知识库：技术术语表](../知识库/01-技术术语表.md)
