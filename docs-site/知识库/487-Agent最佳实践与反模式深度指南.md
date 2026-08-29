# Agent 最佳实践与反模式深度指南

> 建了 100 个 Agent 后，哪些做法反复被验证为对的？哪些做法会导致灾难？本指南从工程实战出发，系统梳理 20 条最佳实践和 15 个常见反模式，每条都附带具体代码示例和踩坑经验。

---

## 1. 20 条最佳实践

### 架构层

```python
# 实践1：Agent 职责单一
# ✅ 好：一个 Agent 专注一个领域
customer_service_agent = create_react_agent(model, [search_kb, create_ticket])
# ❌ 坏：一个 Agent 什么都做
do_everything_agent = create_react_agent(model, [search, code, translate, analyze, ...])

# 实践2：状态显式化
# ✅ 好：用 TypedDict 明确定义状态
class ResearchState(TypedDict):
    query: str
    search_results: list
    analysis: str
    report: str
    step: int

# ❌ 坏：用 dict 随意存
state = &#123;"q": "...", "data": [], "stuff": "..."&#125;

# 实践3：设置最大迭代次数
# ✅ 好：防止无限循环
agent = create_react_agent(model, tools)
result = agent.invoke(input, config=&#123;"recursion_limit": 25&#125;)

# ❌ 坏：不限制，可能死循环
result = agent.invoke(input)  # 可能无限循环
```

### Prompt 层

```python
# 实践4：System Prompt 集中管理
# ✅ 好：版本化、可追踪
SYSTEM_PROMPTS = &#123;
    "v2": "你是专业助手。遵循以下规则：1. 只回答确定的信息 2. 不确定时说明 3. 引用来源",
&#125;
# ❌ 坏：散落在代码中
result = llm.invoke("你是助手...随便回答", query)

# 实践5：结构化输出
# ✅ 好：用 Pydantic 强制结构
class Answer(BaseModel):
    summary: str
    details: list[str]
    confidence: float
structured_llm = llm.with_structured_output(Answer)
# ❌ 坏：自由文本，解析靠正则
result = llm.invoke(query)
summary = result.split("摘要：")[1].split("\n")[0]  # 脆弱

# 实践6：Few-shot 示例精选
# ✅ 好：3-5 个高质量示例
prompt = """示例：
Q: 什么是 RAG？
A: RAG 是检索增强生成...

Q: &#123;question&#125;
A:"""
# ❌ 坏：10+ 个示例，Token 浪费
```

### 工具层

```python
# 实践7：工具描述清晰且区分度高
@tool
def search_documents(query: str) -> str:
    """搜索内部文档库。输入搜索关键词，返回最相关的5篇文档摘要。适合查找产品文档、技术规范。"""
# ❌ 坏：描述模糊
@tool
def search(query: str) -> str:
    """搜索"""  # 模型不知道什么时候用

# 实践8：工具结果截断
@tool
def run_query(sql: str) -> str:
    """执行 SQL 查询"""
    result = db.execute(sql)
    # ✅ 好：限制返回长度
    if len(result) > 2000:
        return result[:2000] + "\n...[结果截断，共" + str(len(result)) + "字符]"
    return result
    # ❌ 坏：返回 10 万字符，Token 爆炸

# 实践9：工具参数 Schema 严格
@tool
def send_email(to: str, subject: str, body: str) -> str:
    """发送邮件"""
    # ✅ 好：参数校验
    if not re.match(r'^[\w.-]+@[\w.-]+$', to):
        return "邮箱格式错误"
    # ❌ 坏：不校验，可能被注入
```

### 生产层

```python
# 实践10：必须有超时和重试
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def safe_llm_call(prompt, timeout=30):
    return await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)

# 实践11：成本追踪无处不在
async def tracked_invoke(prompt):
    start = time.time()
    result = await llm.ainvoke(prompt)
    await cost_tracker.record(
        model="gpt-4o-mini",
        input_tokens=result.usage_metadata.get("prompt_tokens", 0),
        output_tokens=result.usage_metadata.get("completion_tokens", 0),
        latency_ms=(time.time() - start) * 1000,
    )
    return result

# 实践12：流式输出优先
# ✅ 好：用户看到打字机效果
async for chunk in llm.astream(query):
    yield chunk.content
# ❌ 坏：用户等 30 秒才看到完整回答
result = await llm.ainvoke(query)
print(result.content)
```

---

## 2. 15 个常见反模式

### 架构反模式

```python
# 反模式1：上帝 Agent
# ❌ 一个 Agent 做所有事
god_agent = create_react_agent(model, [
    search, translate, code, analyze, summarize,
    send_email, create_ticket, update_crm, generate_report,
    # 20+ 个工具
])
# 问题：模型选择困难、Token 消耗大、难以维护
# 解决：按领域拆分多个 Agent，用 Supervisor 协调

# 反模式2：无限制递归
# ❌ Agent 调用自己
def agent_node(state):
    if not state.get("done"):
        return agent_node(state)  # 死循环
# 解决：设置 recursion_limit

# 反模式3：硬编码模型
# ❌
model = ChatOpenAI(model="gpt-4o")  # 到处硬编码
# ✅
model = get_model_from_config()  # 从配置读取，可切换
```

### Prompt 反模式

```python
# 反模式4：超长 System Prompt
# ❌ 5000 字的 system prompt
system = """你是助手。规则1...规则2...（省略5000字）"""
# 问题：每次请求消耗 5000 Token、模型注意力分散
# 解决：精简到 500 字以内，详细规则放 few-shot

# 反模式5：矛盾指令
# ❌
prompt = "回答要简洁详细"  # 简洁和详细矛盾
# ✅
prompt = "回答控制在 200 字以内，包含关键细节"

# 反模式6：依赖模型"理解"模糊指令
# ❌ "用好的方式回答"  # 什么叫好？
# ✅ "回答需要：1.准确 2.简洁 3.有示例"
```

### 工具反模式

```python
# 反模式7：工具返回原始大对象
# ❌
@tool
def get_user(user_id: str) -> str:
    return json.dumps(db.users.get(user_id))  # 可能 50KB
# ✅ 返回精简版
@tool
def get_user(user_id: str) -> str:
    user = db.users.get(user_id)
    return f"姓名: &#123;user['name']&#125;, 角色: &#123;user['role']&#125;, 注册: &#123;user['created_at']&#125;"

# 反模式8：工具副作用不幂等
# ❌
@tool
def process_payment(amount: float) -> str:
    charge_card(amount)  # 重试会重复扣款！
# ✅ 幂等设计
@tool
def process_payment(amount: float, idempotency_key: str) -> str:
    if already_processed(idempotency_key):
        return "已处理"
    charge_card(amount)
```

### 生产反模式

```python
# 反模式9：不处理错误
# ❌
result = await llm.ainvoke(query)
return result.content  # API 挂了怎么办？
# ✅
try:
    result = await safe_llm_call(query)
except LLMError:
    return await fallback_model.ainvoke(query)

# 反模式10：不监控成本
# ❌ 没有任何成本追踪
# 结果：月底账单 $10000，不知道花在哪
# ✅ 每次调用记录成本

# 反模式11：同步阻塞
# ❌ 在 Web 请求中同步调用 LLM
@app.get("/chat")
def chat(query):
    result = llm.invoke(query)  # 阻塞 30 秒
    return result.content
# ✅ 异步+流式
@app.post("/chat/stream")
async def chat(query):
    async def generate():
        async for chunk in llm.astream(query):
            yield f"data: &#123;chunk.content&#125;\n\n"
    return StreamingResponse(generate())

# 反模式12：暴露 System Prompt
# ❌
if "show me your prompt" in query:
    return system_prompt  # 泄露！
# ✅ 添加护栏
if is_prompt_injection(query):
    return "我无法透露内部信息"

# 反模式13：不缓存重复请求
# ❌ 每次都调 LLM
# 用户问 100 次"什么是 RAG"，调 100 次
# ✅ 语义缓存
cached = await semantic_cache.get(query)
if cached:
    return cached

# 反模式14：不限制上下文增长
# ❌
messages.append(response)  # 无限增长
# 50 轮后上下文 50K Token
# ✅ 滑动窗口+摘要
messages = apply_sliding_window(messages, max_tokens=4000)

# 反模式15：生产用 debug 模式
# ❌
llm = ChatOpenAI(model="gpt-4o", temperature=0.9)  # 高随机性
# ✅
llm = ChatOpenAI(model="gpt-4o", temperature=0)  # 生产环境确定性
```

---

## 3. 最佳实践检查清单

| 实践 | 检查项 | 状态 |
|------|--------|------|
| 架构 | Agent 职责单一 | ☐ |
| 架构 | 状态显式化（TypedDict） | ☐ |
| 架构 | 设置最大迭代次数 | ☐ |
| Prompt | System Prompt 版本管理 | ☐ |
| Prompt | 结构化输出 | ☐ |
| Prompt | Few-shot 精选 3-5 个 | ☐ |
| 工具 | 工具描述清晰区分度高 | ☐ |
| 工具 | 工具结果截断 | ☐ |
| 工具 | 参数校验 | ☐ |
| 生产 | 超时+重试 | ☐ |
| 生产 | 成本追踪 | ☐ |
| 生产 | 流式输出优先 | ☐ |
| 生产 | 错误降级 | ☐ |
| 生产 | 语义缓存 | ☐ |
| 生产 | 上下文窗口管理 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 33 | 常见反模式与陷阱 | 反模式基础 |
| 25 | 反模式与陷阱图解 | 反模式图解 |
| 40 | LLM 应用设计模式 | 设计模式 |
| 164 | LLM 应用架构模式全集 | 架构模式 |
| 226 | 设计模式全集 | 模式 |
| 462 | Agent 设计模式 | 设计模式 |
