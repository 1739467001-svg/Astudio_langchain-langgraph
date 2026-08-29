# OpenAI Agents SDK 与多 Agent 框架指南

> 2024 年 10 月 OpenAI 发布 Swarm 实验框架，2025 年 3 月正式推出 Agents SDK——一个基于 Handoff 机制的多 Agent 协作框架。它和 LangGraph 有什么区别？该选哪个？CrewAI、AutoGen 又如何？本指南系统对比四大 Agent 框架，详解 OpenAI Agents SDK 的核心概念和实战集成。

---

## 1. 四大 Agent 框架定位

### 框架全景

| 框架 | 出品方 | 核心模型 | 多 Agent 机制 | 适合场景 |
|------|--------|---------|--------------|---------|
| LangGraph | LangChain | 图（StateGraph） | 状态图+条件边 | 复杂工作流、精确控制 |
| OpenAI Agents SDK | OpenAI | Agent+Handoff | 手off传递 | OpenAI 生态、快速搭建 |
| CrewAI | CrewAI Inc. | 角色+任务 | 角色分工+任务委派 | 模拟团队协作 |
| AutoGen | Microsoft | 对话式 | 多轮对话+GroupChat | 研究探索、对话式协作 |

### 选型决策

```
需要精确控制流程？
├─ 是 → LangGraph（状态图+条件路由）
└─ 否 → 需要 OpenAI 生态深度集成？
    ├─ 是 → OpenAI Agents SDK
    └─ 否 → 偏好哪种协作模式？
        ├─ 角色分工 → CrewAI
        └─ 对话式 → AutoGen
```

---

## 2. OpenAI Agents SDK 核心概念

### Agent 定义

```python
# pip install openai-agents

from agents import Agent, Runner

# === 创建 Agent ===
agent = Agent(
    name="客服助手",
    instructions="""你是一个客服助手。
    - 回答用户关于产品的问题
    - 遇到退款问题转给退款专员
    - 遇到技术问题转给技术支持""",
    model="gpt-4o-mini",
)

# === 运行 Agent ===
result = Runner.run_sync(agent, "你们的退货政策是什么？")
print(result.final_output)
```

### Handoff 机制

```python
from agents import Agent, Runner, handoff

# === 核心概念：Handoff ===
# Handoff = 一个 Agent 把对话控制权交给另一个 Agent
# 类似客服转接：客服Agent → 退款专员Agent

# 退款专员 Agent
refund_agent = Agent(
    name="退款专员",
    instructions="""你是退款专员。
    - 核实订单信息
    - 判断是否符合退款条件
    - 处理退款流程""",
    model="gpt-4o-mini",
)

# 技术支持 Agent
tech_agent = Agent(
    name="技术支持",
    instructions="""你是技术支持工程师。
    - 诊断技术问题
    - 提供解决方案
    - 无法解决时升级给开发团队""",
    model="gpt-4o-mini",
)

# 主 Agent（带 Handoff 能力）
triage_agent = Agent(
    name="客服前台",
    instructions="""你是客服前台。
    - 回答一般问题
    - 退款问题 → 转给退款专员
    - 技术问题 → 转给技术支持""",
    model="gpt-4o-mini",
    handoffs=[refund_agent, tech_agent],  # 可转接的 Agent
)

# 运行：前台判断后自动 Handoff
result = Runner.run_sync(
    triage_agent,
    "我昨天买的商品有质量问题，想退款"
)
# 流程：前台 → 判断为退款 → Handoff 给退款专员 → 退款专员处理

print(result.final_output)
```

### 工具定义

```python
from agents import Agent, Runner, function_tool

# === 工具（Function Tool）===
@function_tool
def get_order_status(order_id: str) -> str:
    """查询订单状态

    Args:
        order_id: 订单编号
    """
    # 模拟查询
    return f"订单 &#123;order_id&#125;: 已发货，预计明天送达"

@function_tool
def process_refund(order_id: str, amount: float) -> str:
    """处理退款

    Args:
        order_id: 订单编号
        amount: 退款金额
    """
    return f"退款已处理: 订单&#123;order_id&#125;, 金额¥&#123;amount&#125;"

# Agent 绑定工具
refund_agent = Agent(
    name="退款专员",
    instructions="你是退款专员，使用工具查询订单和处理退款。",
    model="gpt-4o-mini",
    tools=[get_order_status, process_refund],
    handoffs=[],  # 退款专员不再转接
)

result = Runner.run_sync(refund_agent, "帮我查一下订单 ORD-2024-001 的状态")
print(result.final_output)
```

---

## 3. Agent 执行生命周期

```mermaid
graph TB
    START["用户输入"] --> TRIAGE&#123;"前台 Agent<br/>判断意图"&#125;
    TRIAGE -->|"一般问题"| ANSWER["前台直接回答"]
    TRIAGE -->|"退款问题"| HANDOFF1["Handoff → 退款专员"]
    TRIAGE -->|"技术问题"| HANDOFF2["Handoff → 技术支持"]

    HANDOFF1 --> REFUND&#123;"退款专员<br/>使用工具"&#125;
    REFUND --> TOOL1["get_order_status"]
    REFUND --> TOOL2["process_refund"]
    REFUND --> DONE1["退款完成"]

    HANDOFF2 --> TECH&#123;"技术支持<br/>诊断问题"&#125;
    TECH --> SOLUTION["提供解决方案"]
    TECH --> DONE2["问题解决"]

    style TRIAGE fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style HANDOFF1 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style HANDOFF2 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style DONE1 fill:#C8E6C9,stroke:#2E7D32
    style DONE2 fill:#C8E6C9,stroke:#2E7D32
```

### 追踪执行过程

```python
from agents import Agent, Runner
import logging

# 开启详细日志
logging.basicConfig(level=logging.INFO)

# 查看完整的 Handoff 链路
result = Runner.run_sync(triage_agent, "订单 ORD-2024-001 有质量问题要退款")

# result 包含完整的执行轨迹
print(f"最终输出: &#123;result.final_output&#125;")
print(f"Agent 转接历史: &#123;result.agent_history&#125;")
# [triage_agent → refund_agent]

# 每个 Agent 的对话都保留在 context 中
```

---

## 4. 与 LangGraph 对比

### 架构对比

```mermaid
graph TB
    subgraph "LangGraph 架构"
        LG_START["START"] --> LG_A["Node A"]
        LG_A -->|"条件边"| LG_B["Node B"]
        LG_A -->|"条件边"| LG_C["Node C"]
        LG_B --> LG_END["END"]
        LG_C --> LG_END
        LG_NOTE["状态图+条件路由<br/>精确控制每一步"]
    end

    subgraph "Agents SDK 架构"
        SDK_START["用户输入"] --> SDK_A&#123;"前台 Agent"&#125;
        SDK_A -->|"Handoff"| SDK_B["专员 Agent B"]
        SDK_A -->|"Handoff"| SDK_C["专员 Agent C"]
        SDK_B --> SDK_END["输出"]
        SDK_C --> SDK_END
        SDK_NOTE["Agent 自主决定转接<br/>更灵活但控制弱"]
    end

    style LG_NOTE fill:#E3F2FD,stroke:#1565C0
    style SDK_NOTE fill:#FFF9C4,stroke:#F9A825
```

### 详细对比

| 维度 | LangGraph | OpenAI Agents SDK |
|------|-----------|-------------------|
| 核心抽象 | 状态图（StateGraph） | Agent + Handoff |
| 流程控制 | 开发者定义边和条件 | Agent 自主决定转接 |
| 状态管理 | 显式 State + Checkpointer | 隐式上下文传递 |
| 持久化 | 内置 Checkpointer | 需自行实现 |
| 工具调用 | ToolNode + bind_tools | function_tool 装饰器 |
| 人机交互 | interrupt_before/after | 需自行实现 |
| 流式输出 | 原生支持 | 支持 |
| 模型限制 | 任意模型 | 主要支持 OpenAI |
| 适合复杂度 | 中-极高 | 低-中 |
| 学习曲线 | 较陡 | 平缓 |

### 何时用哪个

```
用 LangGraph：
  - 需要精确控制每一步流程
  - 需要 Checkpoint/时间旅行
  - 需要人机交互（interrupt）
  - 需要使用非 OpenAI 模型
  - 复杂的条件分支和循环
  - 生产级持久化

用 Agents SDK：
  - 快速原型
  - OpenAI 生态深度用户
  - Agent 自主性要求高（让 Agent 决定转接）
  - 简单的分诊→专员模式
  - 不需要复杂状态管理
```

---

## 5. CrewAI 快速对比

```python
# CrewAI 的角色分工模式
from crewai import Agent, Task, Crew

# 定义角色
refund_specialist = Agent(
    role='退款专员',
    goal='高效处理退款请求',
    backstory='有5年退款处理经验，熟悉公司退款政策',
    llm='gpt-4o-mini'
)

tech_engineer = Agent(
    role='技术支持工程师',
    goal='诊断并解决技术问题',
    backstory='全栈工程师，擅长排查各种技术故障',
    llm='gpt-4o-mini'
)

# 定义任务
refund_task = Task(
    description='处理用户 &#123;order_id&#125; 的退款请求',
    agent=refund_specialist,
    expected_output='退款处理结果'
)

tech_task = Task(
    description='诊断用户报告的 &#123;issue&#125; 技术问题',
    agent=tech_engineer,
    expected_output='技术解决方案'
)

# 组建团队
crew = Crew(
    agents=[refund_specialist, tech_engineer],
    tasks=[refund_task, tech_task],
)

result = crew.kickoff(inputs=&#123;'order_id': 'ORD-2024-001', 'issue': '登录失败'&#125;)
```

### CrewAI vs Agents SDK vs LangGraph

| 维度 | LangGraph | Agents SDK | CrewAI |
|------|-----------|------------|--------|
| 协作模式 | 图路由 | Handoff 转接 | 角色分工 |
| Agent 自主性 | 低（开发者控制） | 高（自主 Handoff） | 中（任务分配） |
| 模型支持 | 任意 | OpenAI 为主 | 任意 |
| 复杂工作流 | ★★★★★ | ★★★☆ | ★★★☆ |
| 快速上手 | ★★★☆ | ★★★★★ | ★★★★☆ |
| 生产就绪 | ★★★★★ | ★★★☆ | ★★★★☆ |

---

## 6. 混合使用：LangGraph + Agents SDK

```python
# 在 LangGraph 中调用 Agents SDK 的 Agent
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from agents import Agent, Runner

class HybridState(TypedDict):
    query: str
    category: str
    answer: str

# 用 Agents SDK 创建分诊 Agent
triage_agent = Agent(
    name="分诊",
    instructions="判断用户问题类别：退款/技术/一般。只回答类别名。",
    model="gpt-4o-mini",
)

# LangGraph 节点：用 Agents SDK 分诊
async def triage_node(state: HybridState):
    result = Runner.run_sync(triage_agent, state["query"])
    return &#123;"category": result.final_output.strip()&#125;

# LangGraph 节点：LangChain 处理
async def handle_node(state: HybridState):
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model="gpt-4o-mini")

    prompt = f"你是&#123;state['category']&#125;专员。回答：&#123;state['query']&#125;"
    response = await llm.ainvoke(prompt)
    return &#123;"answer": response.content&#125;

def route_by_category(state: HybridState):
    return "handle"

# 构建混合图
graph = StateGraph(HybridState)
graph.add_node("triage", triage_node)
graph.add_node("handle", handle_node)
graph.add_edge(START, "triage")
graph.add_conditional_edges("triage", route_by_category, &#123;"handle": "handle"&#125;)
graph.add_edge("handle", END)

hybrid_app = graph.compile()
```

---

## 7. Guardrails（输入输出防护）

```python
from agents import Agent, Runner, GuardrailFunctionOutput, RunContext

# Agents SDK 内置 Guardrails 机制
async def refund_amount_guardrail(ctx, agent, input_data):
    """防护：退款金额不超过 10000 元"""
    if "10000" in str(input_data) or "一万" in str(input_data):
        return GuardrailFunctionOutput(
            output_info=&#123;"reason": "退款金额超限"&#125;,
            tripwire_triggered=True,  # 触发熔断
        )
    return GuardrailFunctionOutput(
        output_info=&#123;&#125;,
        tripwire_triggered=False,
    )

refund_agent = Agent(
    name="退款专员",
    instructions="处理退款请求",
    model="gpt-4o-mini",
    input_guardrails=[refund_amount_guardrail],
)

# 触发 Guardrail 时会抛异常
try:
    result = Runner.run_sync(refund_agent, "帮我退款 20000 元")
except Exception as e:
    print(f"被 Guardrail 拦截: &#123;e&#125;")
```

---

## 8. 生产注意事项

### 模型兼容性

```python
# Agents SDK 主要支持 OpenAI 模型
# 但可以通过自定义 ModelProvider 支持其他模型

from agents import Agent, Runner
from agents.model_settings import ModelSettings

# 使用 Azure OpenAI
agent = Agent(
    name="助手",
    instructions="你是中文助手",
    model="gpt-4o-mini",
    model_settings=ModelSettings(
        # Azure OpenAI 配置通过环境变量
        # AZURE_OPENAI_ENDPOINT=...
        # AZURE_OPENAI_API_KEY=...
    ),
)

# 使用本地模型（通过 OpenAI 兼容 API）
# 设置 OPENAI_BASE_URL=http://localhost:8000/v1
agent = Agent(
    name="本地助手",
    instructions="你是中文助手",
    model="Qwen2.5-7B-Instruct",  # 本地模型名
)
```

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Handoff 后丢失上下文 | 上下文传递机制限制 | 在 instructions 中明确要求保留信息 |
| Agent 不触发 Handoff | instructions 不够明确 | 在 instructions 中明确列出转接条件 |
| 工具调用失败 | 参数 Schema 不匹配 | 检查 function_tool 的类型注解 |
| 成本过高 | 每个 Agent 独立调用 LLM | 简单任务不要拆太多 Agent |
| 延迟高 | 多次 Handoff 串行 | 合并职责、减少转接层级 |

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四大 Agent 框架的定位 | ☐ |
| 能用 Agents SDK 创建 Agent | ☐ |
| 理解 Handoff 转接机制 | ☐ |
| 能定义 function_tool | ☐ |
| 理解 Agents SDK vs LangGraph 的区别 | ☐ |
| 知道何时选哪个框架 | ☐ |
| 能实现混合使用方案 | ☐ |
| 配置了 Guardrails 防护 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 06 | Agents 与 Tools-智能代理 | Agent 基础 |
| 07 | 多 Agent 架构图解 | 多 Agent 架构 |
| 126 | LLM 框架竞品对比 | 框架对比 |
| 129 | Agent 工作流模式全集 | 工作流模式 |
| 156 | 多 Agent 协调模式与拓扑 | 协调模式 |
| 243 | 工具链编排 | 工具编排 |
| 307 | 编排引擎 | 编排引擎设计 |
| 436 | AI 编程 Agent | Agent 编程能力 |
