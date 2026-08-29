# 推理模型与 Agent 集成指南

> 2024 年 9 月 OpenAI 发布 o1，开启了"推理模型"时代：模型在回答前先进行内部链式思考（Chain-of-Thought），擅长数学、代码、多步推理任务。2025 年 o3、o4-mini 相继发布，DeepSeek R1 开源，推理模型从"新鲜事物"变成"生产工具"。本指南详解推理模型与传统 LLM 的区别、在 LangChain/LangGraph Agent 中的集成方式及最佳实践。

---

## 1. 推理模型 vs 传统 LLM

### 核心差异

```
传统 LLM（GPT-4o / Claude 3.5 / Qwen）：
  Prompt → 直接生成回答（Token 逐个输出）
  思考过程隐含在输出 Token 中（或被压缩）
  快、便宜、适合对话和通用任务

推理模型（o1 / o3 / o4-mini / DeepSeek R1）：
  Prompt → 内部推理（hidden thinking tokens） → 生成回答
  模型显式地"想"再"说"
  慢、贵、擅长复杂推理（数学/代码/科学/逻辑）
```

### 能力对比

| 维度 | 传统 LLM | 推理模型 |
|------|----------|----------|
| 推理深度 | 表层推理 | 深度链式思考 |
| 数学/逻辑 | 中等 | 极强 |
| 代码生成 | 好 | 更好（复杂算法） |
| 响应速度 | 快（秒级） | 慢（10秒~数分钟） |
| 成本 | 低 | 高（含思考 Token） |
| 工具调用 | 原生支持 | 需特定版本/配置 |
| 流式输出 | 内容流式 | 思考+回答分阶段 |
| 上下文窗口 | 128K+ | 因模型而异 |
| 提示敏感性 | 中等 | 低（更听指令） |

### 思考 Token 机制

```python
# 推理模型的输出分两部分：
# 1. reasoning（思考过程，可能隐藏或可读）
# 2. content（最终回答）

# OpenAI o 系列
response = client.chat.completions.create(
    model="o3-mini",
    messages=[&#123;"role": "user", "content": "证明 √2 是无理数"&#125;],
)

# response.choices[0].message.content → 最终回答
# response.usage.completion_tokens_details.reasoning_tokens → 思考消耗的 Token
# 思考过程本身不可见，但消耗 Token

# DeepSeek R1
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=[&#123;"role": "user", "content": "设计一个分布式锁算法"&#125;],
)
# response.choices[0].message.reasoning_content → 思考过程（可读）
# response.choices[0].message.content → 最终回答
```

---

## 2. 在 LangChain 中使用推理模型

### OpenAI o 系列

```python
from langchain_openai import ChatOpenAI

# o3-mini 适合日常推理任务
reasoning_model = ChatOpenAI(
    model="o3-mini",
    # 推理模型特有参数
    reasoning_effort="medium",  # "low" | "medium" | "high"
    # low: 快速、浅层思考
    # medium: 平衡（推荐默认）
    # high: 深度思考、慢但更准
)

# o4-mini 支持工具调用
tool_model = ChatOpenAI(
    model="o4-mini",
    reasoning_effort="medium",
)

# 基础调用
response = await reasoning_model.ainvoke("设计一个 LRU 缓存的 Python 实现")
print(response.content)

# 查看思考 Token 消耗
print(f"思考 Token: &#123;response.usage_metadata&#125;")
```

### DeepSeek R1

```python
from langchain_openai import ChatOpenAI

# DeepSeek R1 通过 OpenAI 兼容 API 调用
r1_model = ChatOpenAI(
    model="deepseek-reasoner",
    openai_api_base="https://api.deepseek.com/v1",
    openai_api_key="sk-...",
)

response = await r1_model.ainvoke("分析快速排序的时间复杂度推导")
# DeepSeek R1 返回 reasoning_content + content
print(f"思考过程:\n&#123;response.additional_kwargs.get('reasoning_content', '')&#125;")
print(f"最终回答:\n&#123;response.content&#125;")
```

### 混合模型策略

```python
from dataclasses import dataclass
from enum import Enum

class TaskComplexity(Enum):
    SIMPLE = "simple"       # 闲聊、翻译、摘要
    MODERATE = "moderate"   # 代码生成、文档分析
    COMPLEX = "complex"     # 数学证明、算法设计、多步推理

@dataclass
class HybridModelRouter:
    """根据任务复杂度自动选择模型"""
    fast_model: ChatOpenAI = None      # GPT-4o-mini
    reasoning_model: ChatOpenAI = None # o3-mini
    deep_model: ChatOpenAI = None      # o3 / DeepSeek R1

    async def classify_complexity(self, query: str) -> TaskComplexity:
        """用快模型分类任务复杂度"""
        classifier = self.fast_model
        result = await classifier.ainvoke(
            f"判断以下任务的复杂度。只回答 simple/moderate/complex。\n\n&#123;query&#125;"
        )
        level = result.content.strip().lower()
        if "complex" in level:
            return TaskComplexity.COMPLEX
        elif "moderate" in level:
            return TaskComplexity.MODERATE
        return TaskComplexity.SIMPLE

    async def invoke(self, query: str):
        """自动路由到合适模型"""
        complexity = await self.classify_complexity(query)

        if complexity == TaskComplexity.SIMPLE:
            return await self.fast_model.ainvoke(query)
        elif complexity == TaskComplexity.MODERATE:
            return await self.reasoning_model.ainvoke(query)
        else:
            return await self.deep_model.ainvoke(query)


# 使用
router = HybridModelRouter(
    fast_model=ChatOpenAI(model="gpt-4o-mini"),
    reasoning_model=ChatOpenAI(model="o3-mini", reasoning_effort="medium"),
    deep_model=ChatOpenAI(model="o3", reasoning_effort="high"),
)
```

---

## 3. 推理模型 + LangGraph Agent

### 架构设计

```
用户输入
  ↓
复杂度分类（快模型，~100ms）
  ↓
┌─────────────┬──────────────┬──────────────┐
│  简单任务     │  中等任务      │  复杂任务     │
│  GPT-4o-mini │  o3-mini      │  o3 / R1     │
│  直接回答     │  推理+工具      │  深度推理      │
└─────────────┴──────────────┴──────────────┘
  ↓
成本追踪 + 延迟监控
```

### 完整 LangGraph 实现

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode
import time

# 定义工具
@tool
def calculator(expression: str) -> str:
    """安全计算数学表达式"""
    try:
        result = eval(expression, &#123;"__builtins__": &#123;&#125;&#125;, &#123;&#125;)
        return f"&#123;expression&#125; = &#123;result&#125;"
    except Exception as e:
        return f"计算错误: &#123;e&#125;"

@tool
def code_runner(code: str) -> str:
    """执行 Python 代码并返回结果"""
    # 生产环境应使用沙箱
    try:
        local_ns = &#123;&#125;
        exec(code, &#123;"__builtins__": &#123;&#125;&#125;, local_ns)
        return str(local_ns.get("result", "无返回值"))
    except Exception as e:
        return f"执行错误: &#123;e&#125;"

# 模型配置
fast_model = ChatOpenAI(model="gpt-4o-mini")
reasoning_model = ChatOpenAI(model="o3-mini", reasoning_effort="medium")
tool_model = ChatOpenAI(model="o4-mini", reasoning_effort="medium").bind_tools(
    [calculator, code_runner]
)

# 节点定义
async def classify_node(state: MessagesState):
    """分类任务复杂度"""
    last_msg = state["messages"][-1].content
    result = await fast_model.ainvoke(
        f"判断复杂度。只回答 simple/moderate/complex。\n\n&#123;last_msg&#125;"
    )
    return &#123;"complexity": result.content.strip().lower()&#125;

async def simple_node(state: MessagesState):
    """简单任务：快模型直接回答"""
    response = await fast_model.ainvoke(state["messages"])
    return &#123;"messages": [response]&#125;

async def moderate_node(state: MessagesState):
    """中等任务：推理模型回答"""
    response = await reasoning_model.ainvoke(state["messages"])
    return &#123;"messages": [response]&#125;

async def complex_with_tools(state: MessagesState):
    """复杂任务：推理模型 + 工具调用"""
    response = await tool_model.ainvoke(state["messages"])
    return &#123;"messages": [response]&#125;

async def execute_tools(state: MessagesState):
    tool_node = ToolNode([calculator, code_runner])
    return await tool_node.ainvoke(state)

def route_by_complexity(state: MessagesState):
    complexity = state.get("complexity", "simple")
    if complexity == "simple":
        return "simple"
    elif complexity == "moderate":
        return "moderate"
    return "complex"

def check_tool_calls(state: MessagesState):
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "execute"
    return END

# 构建图
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    complexity: str

graph = StateGraph(AgentState)
graph.add_node("classify", classify_node)
graph.add_node("simple", simple_node)
graph.add_node("moderate", moderate_node)
graph.add_node("complex", complex_with_tools)
graph.add_node("execute", execute_tools)

graph.add_edge(START, "classify")
graph.add_conditional_edges("classify", route_by_complexity, &#123;
    "simple": "simple",
    "moderate": "moderate",
    "complex": "complex",
&#125;)
graph.add_conditional_edges("complex", check_tool_calls, &#123;
    "execute": "execute",
    END: END,
&#125;)
graph.add_edge("execute", "complex")
graph.add_edge("simple", END)
graph.add_edge("moderate", END)

app = graph.compile()
```

---

## 4. 思考过程可视化

### 提取并展示推理过程

```python
from dataclasses import dataclass
from langchain_core.messages import AIMessage

@dataclass
class ReasoningTrace:
    """推理轨迹"""
    thinking: str       # 思考过程
    answer: str         # 最终回答
    thinking_tokens: int # 思考消耗的 Token
    answer_tokens: int   # 回答消耗的 Token
    elapsed_ms: float    # 耗时

async def invoke_with_trace(model, query: str) -> ReasoningTrace:
    """调用推理模型并提取思考过程"""
    start = time.time()
    response = await model.ainvoke(query)
    elapsed = (time.time() - start) * 1000

    # 提取思考过程（不同模型方式不同）
    thinking = ""
    if hasattr(response, "additional_kwargs"):
        thinking = response.additional_kwargs.get("reasoning_content", "")

    # Token 统计
    usage = response.usage_metadata or &#123;&#125;
    thinking_tokens = 0
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        # OpenAI o 系列：reasoning_tokens 在 completion_tokens_details
        thinking_tokens = response.usage_metadata.get(
            "completion_tokens_details", &#123;&#125;
        ).get("reasoning_tokens", 0)

    answer_tokens = usage.get("completion_tokens", 0) - thinking_tokens

    return ReasoningTrace(
        thinking=thinking,
        answer=response.content,
        thinking_tokens=thinking_tokens,
        answer_tokens=answer_tokens,
        elapsed_ms=elapsed,
    )

# 使用
trace = await invoke_with_trace(
    ChatOpenAI(model="o3-mini", reasoning_effort="high"),
    "设计一个支持并发写入的环形缓冲区"
)

print(f"思考耗时: &#123;trace.elapsed_ms:.0f&#125;ms")
print(f"思考 Token: &#123;trace.thinking_tokens&#125;")
print(f"回答 Token: &#123;trace.answer_tokens&#125;")
print(f"思考过程:\n&#123;trace.thinking[:500]&#125;...")
print(f"最终回答:\n&#123;trace.answer&#125;")
```

### 流式输出：分阶段展示

```python
async def stream_reasoning(model, query: str):
    """流式输出推理模型结果"""
    current_phase = None

    async for event in model.astream_events(query, version="v2"):
        kind = event["event"]
        data = event["data"]

        if kind == "on_chat_model_stream":
            chunk = data.get("chunk")

            # DeepSeek R1: 区分 reasoning_content 和 content
            if hasattr(chunk, "additional_kwargs"):
                reasoning = chunk.additional_kwargs.get("reasoning_content", "")
                if reasoning:
                    if current_phase != "thinking":
                        current_phase = "thinking"
                        print("\n--- 思考中 ---")
                    print(reasoning, end="", flush=True)

            if chunk.content:
                if current_phase != "answering":
                    current_phase = "answering"
                    print("\n\n--- 回答 ---")
                print(chunk.content, end="", flush=True)

# 使用
await stream_reasoning(
    ChatOpenAI(model="deepseek-reasoner",
               openai_api_base="https://api.deepseek.com/v1"),
    "证明：对于任意正整数 n，n^3 - n 能被 6 整除"
)
```

---

## 5. reasoning_effort 调优

### 不同 effort 的效果与成本

| reasoning_effort | 思考深度 | 平均耗时 | 相对成本 | 适用场景 |
|-------------------|----------|----------|----------|----------|
| low | 快速推理 | 2-5秒 | 1x | 简单数学、基础逻辑 |
| medium | 标准推理 | 5-15秒 | 2-3x | 代码生成、算法分析 |
| high | 深度推理 | 15-60秒 | 5-10x | 复杂证明、架构设计 |

### 动态调整策略

```python
@dataclass
class AdaptiveReasoningConfig:
    """根据任务特征动态调整推理强度"""

    # 规则映射
    effort_rules: dict = None

    def __post_init__(self):
        self.effort_rules = &#123;
            "数学证明": "high",
            "算法设计": "high",
            "架构设计": "high",
            "代码生成": "medium",
            "数据分析": "medium",
            "翻译": "low",
            "摘要": "low",
            "闲聊": None,  # 不用推理模型
        &#125;

    def select_effort(self, task_type: str) -> str:
        """根据任务类型选择推理强度"""
        for keyword, effort in self.effort_rules.items():
            if keyword in task_type:
                return effort
        return "medium"  # 默认

    def should_use_reasoning(self, task_type: str) -> bool:
        """是否需要推理模型"""
        for keyword in self.effort_rules:
            if keyword in task_type:
                return self.effort_rules[keyword] is not None
        return False


# 使用
config = AdaptiveReasoningConfig()

task = "证明哥德巴赫猜想对所有小于 10^6 的偶数成立"
effort = config.select_effort(task)  # "high"
use_reasoning = config.should_use_reasoning(task)  # True

if use_reasoning:
    model = ChatOpenAI(model="o3-mini", reasoning_effort=effort)
else:
    model = ChatOpenAI(model="gpt-4o-mini")
```

---

## 6. 成本管理

### 思考 Token 成本模型

```python
@dataclass
class ReasoningCostTracker:
    """推理模型成本追踪"""
    model_pricing: dict = None  # 每百万 Token 价格

    def __post_init__(self):
        self.model_pricing = &#123;
            "o3-mini": &#123;"input": 1.10, "output": 4.40, "reasoning": 4.40&#125;,
            "o3": &#123;"input": 2.00, "output": 8.00, "reasoning": 8.00&#125;,
            "o4-mini": &#123;"input": 1.10, "output": 4.40, "reasoning": 4.40&#125;,
            "deepseek-r1": &#123;"input": 0.55, "output": 2.19, "reasoning": 2.19&#125;,
        &#125;

    def calculate_cost(self, model_name: str, input_tokens: int,
                       output_tokens: int, reasoning_tokens: int) -> float:
        """计算单次调用成本（美元）"""
        pricing = self.model_pricing.get(model_name, &#123;"input": 1, "output": 4, "reasoning": 4&#125;)
        cost = (
            input_tokens / 1_000_000 * pricing["input"]
            + (output_tokens - reasoning_tokens) / 1_000_000 * pricing["output"]
            + reasoning_tokens / 1_000_000 * pricing["reasoning"]
        )
        return cost

    def compare_models(self, input_tokens: int, reasoning_tokens: int,
                       output_tokens: int) -> dict:
        """对比不同模型的成本"""
        results = &#123;&#125;
        for model in self.model_pricing:
            results[model] = self.calculate_cost(
                model, input_tokens, output_tokens, reasoning_tokens
            )
        return dict(sorted(results.items(), key=lambda x: x[1]))


# 使用
tracker = ReasoningCostTracker()

# 一次 o3-mini 调用：输入 500，思考 2000，输出 300
cost = tracker.calculate_cost("o3-mini", 500, 2300, 2000)
print(f"o3-mini 成本: $&#123;cost:.4f&#125;")

# 对比所有模型
comparison = tracker.compare_models(500, 2000, 300)
for model, cost in comparison.items():
    print(f"&#123;model&#125;: $&#123;cost:.4f&#125;")
```

### 成本优化策略

```
1. 任务分级路由
   简单任务 → GPT-4o-mini（$0.15/M）
   中等任务 → o3-mini low effort
   复杂任务 → o3-mini high effort（仅在必要时）

2. 缓存推理结果
   相同问题的推理过程可缓存
   语义缓存：相似问题复用答案

3. 两阶段策略
   阶段1: GPT-4o-mini 生成初步方案
   阶段2: 仅对不确定部分用推理模型验证

4. reasoning_effort 调优
   首次用 high 确保正确
   后续同类任务降为 medium/low

5. 批量处理
   多个推理任务合并提交
   利用批量 API 折扣
```

---

## 7. 推理模型 + RAG

### 推理模型在 RAG 中的角色

```python
# 传统 RAG：检索 → LLM 直接回答
# 推理 RAG：检索 → LLM 深度推理 → 结构化回答

from langchain_core.prompts import ChatPromptTemplate

# 推理模型特别擅长处理复杂检索结果
reasoning_rag_prompt = ChatPromptTemplate.from_messages([
    ("system", """你是一个深度推理助手。以下是检索到的相关文档：

&#123;context&#125;

请仔细分析这些文档，进行多步推理，然后回答用户问题。
要求：
1. 逐步分析每个文档的相关性
2. 交叉验证不同文档的信息
3. 如果信息矛盾，指出并分析原因
4. 给出有依据的结论"""),
    ("human", "&#123;question&#125;")
])

async def reasoning_rag(question: str, documents: list):
    """推理模型增强的 RAG"""
    context = "\n\n".join([f"[文档&#123;i+1&#125;] &#123;doc.page_content&#125;"
                          for i, doc in enumerate(documents)])

    chain = reasoning_rag_prompt | ChatOpenAI(
        model="o3-mini", reasoning_effort="medium"
    )

    response = await chain.ainvoke(&#123;"context": context, "question": question&#125;)
    return response.content
```

### 推理模型在 RAG 评估中的角色

```python
# 推理模型作为 RAG 评估器（LLM-as-Judge）
# 比传统 LLM 评估更准确

judge_prompt = ChatPromptTemplate.from_messages([
    ("system", """你是 RAG 系统的评估专家。请评估以下回答的质量。

问题：&#123;question&#125;
检索到的文档：&#123;context&#125;
生成的回答：&#123;answer&#125;
参考答案：&#123;reference&#125;

请从以下维度评分（1-5分）：
1. 相关性：回答是否切题
2. 忠实性：回答是否基于文档（无幻觉）
3. 完整性：回答是否覆盖了问题所有方面
4. 推理质量：回答的推理链条是否合理

给出每个维度的分数和理由。"""),
    ("human", "请评估。")
])

async def evaluate_with_reasoning(rag_result: dict):
    """用推理模型评估 RAG 结果"""
    chain = judge_prompt | ChatOpenAI(
        model="o3-mini", reasoning_effort="medium"
    )
    response = await chain.ainvoke(rag_result)
    return response.content
```

---

## 8. 生产注意事项

### 超时与重试

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(2),  # 推理模型贵，最多重试2次
    wait=wait_exponential(min=5, max=60),
    retry=lambda e: isinstance(e, (asyncio.TimeoutError, ConnectionError))
)
async def invoke_reasoning_safe(model, query: str, timeout: float = 120.0):
    """带超时的推理模型调用"""
    try:
        response = await asyncio.wait_for(
            model.ainvoke(query),
            timeout=timeout
        )
        return response
    except asyncio.TimeoutError:
        # 降级到快模型
        return await ChatOpenAI(model="gpt-4o-mini").ainvoke(query)
```

### 常见陷阱

| 陷阱 | 说明 | 解决 |
|------|------|------|
| 温度参数无效 | 推理模型通常不支持 temperature | 移除 temperature 参数 |
| system prompt 限制 | o1 早期版本不支持 system role | 使用 user role 代替 |
| 工具调用需特定版本 | 不是所有推理模型都支持 | 确认模型版本文档 |
| 思考 Token 不计费但计入速率限制 | 可能触发 TPM 限制 | 监控总 Token 消耗 |
| 流式输出延迟高 | 思考阶段无输出 | 前端显示"思考中"状态 |
| 并发请求慢 | 推理模型吞吐量低 | 控制并发数 + 队列 |

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解推理模型与传统 LLM 的区别 | ☐ |
| 能在 LangChain 中调用 o3-mini / R1 | ☐ |
| 实现了混合模型路由策略 | ☐ |
| 在 LangGraph Agent 中集成推理模型 | ☐ |
| 能提取和展示思考过程 | ☐ |
| 理解 reasoning_effort 的选择策略 | ☐ |
| 配置了成本追踪和预算控制 | ☐ |
| 知道推理模型在 RAG 评估中的应用 | ☐ |
| 处理了超时和降级逻辑 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 03 | 核心概念-Models-Prompts-Parsers | 模型基础 |
| 39 | 模型选型矩阵图解 | 传统模型选型 |
| 57 | 多模型路由 | 混合路由的基础 |
| 136 | 模型选型决策 | 推理模型纳入选型 |
| 152 | LLM 推理优化 | 推理模型性能优化 |
| 239 | 多模型路由 | 动态模型选择 |
| 400 | Agent 推理预算与 Token 配额管理 | 推理 Token 预算控制 |
| 418 | LLM 推理加速与批处理 | 推理模型加速 |
| 426 | LLM 网关与统一模型管理 | 网关层管理推理模型 |
