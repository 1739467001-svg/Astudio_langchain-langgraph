# 多 Agent 任务分配策略

> 多个 Agent 谁做什么？如何分配任务最高效？这份指南覆盖任务分配模式。

---

## 一、任务分配的挑战

```mermaid
graph TB
    subgraph 挑战 &#123;"多Agent任务分配挑战"&#125;
        C1["谁来做？<br/>能力匹配"]
        C2["做多少？<br/>负载均衡"]
        C3["什么时候做？<br/>依赖关系"]
        C4["做不好怎么办？<br/>重新分配"]
    end

    style 挑战 fill:'#E3F2FD'
```

## 二、三种分配策略

```mermaid
graph TB
    subgraph 策略 &#123;"三种任务分配策略"&#125;
        S1["1.能力匹配<br/>按Agent专长分配<br/>研究→研究员<br/>写作→写手"]
        S2["2.负载均衡<br/>谁闲谁做<br/>避免某个Agent过载"]
        S3["3.竞标分配<br/>Agent评估自己的能力<br/>最优者获得任务"]
    end

    style S1 fill:'#C8E6C9'
    style S2 fill:'#E3F2FD'
    style S3 fill:'#F3E5F5'
```

## 三、实现

### 3.1 能力匹配

```python
from typing import TypedDict

class AgentCapability(BaseModel):
    """Agent能力描述"""
    name: str
    skills: list[str]       # 擅长的技能
    tools: list[str]        # 可用工具
    max_concurrent: int = 1  # 最大并发

class CapabilityAllocator:
    """能力匹配分配器"""
    def __init__(self):
        self.agents: list[AgentCapability] = []

    def register(self, agent: AgentCapability):
        self.agents.append(agent)

    def allocate(self, task: str, required_skill: str) -> Optional[str]:
        """按能力分配任务"""
        candidates = [a for a in self.agents if required_skill in a.skills]
        if not candidates:
            return None
        # 简单：选第一个匹配的
        return candidates[0].name

# 使用
allocator = CapabilityAllocator()
allocator.register(AgentCapability(name="researcher", skills=["research", "search"], tools=["web_search"]))
allocator.register(AgentCapability(name="writer", skills=["write", "summarize"], tools=[]))
allocator.register(AgentCapability(name="analyst", skills=["analyze", "research"], tools=["query_db"]))

agent = allocator.allocate("分析销售数据", "analyze")
# → "analyst"
```

### 3.2 负载均衡

```python
class LoadBalancer:
    """负载均衡分配器"""
    def __init__(self):
        self.agent_loads: dict[str, int] = &#123;&#125;

    def allocate(self, available_agents: list[str]) -> str:
        """分配给负载最低的Agent"""
        # 初始化
        for agent in available_agents:
            if agent not in self.agent_loads:
                self.agent_loads[agent] = 0

        # 选负载最低的
        return min(available_agents, key=lambda a: self.agent_loads.get(a, 0))

    def acquire(self, agent: str):
        self.agent_loads[agent] = self.agent_loads.get(agent, 0) + 1

    def release(self, agent: str):
        self.agent_loads[agent] = max(0, self.agent_loads.get(agent, 0) - 1)
```

### 3.3 竞标分配

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class BiddingAllocator:
    """竞标分配器"""
    def allocate(self, task: str, agents: list[AgentCapability]) -> str:
        """让Agent竞标"""
        prompt = ChatPromptTemplate.from_template(
            """你是任务分配器。以下Agent可以完成任务，选择最合适的。

            任务：&#123;task&#125;
            可用Agent：
            &#123;agents&#125;

            最合适的Agent名称："""
        )
        agents_text = "\n".join(f"- &#123;a.name&#125;: 擅长&#123;a.skills&#125;" for a in agents)
        chain = prompt | llm
        result = chain.invoke(&#123;"task": task, "agents": agents_text&#125;)
        return result.content.strip()
```

## 四、LangGraph Supervisor 分配

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class SupervisorState(TypedDict):
    task: str
    assigned_to: str
    result: str
    history: Annotated[list, add]

def supervisor_node(state: SupervisorState) -> dict:
    """Supervisor：决定分配给谁"""
    task = state["task"]
    # 用LLM判断
    prompt = ChatPromptTemplate.from_template(
        "判断任务类型(research/write/analyze)，只返回类型名：\n&#123;task&#125;\n类型："
    )
    task_type = (prompt | llm).invoke(&#123;"task": task&#125;).content.strip().lower()

    # 按类型分配
    routing = &#123;"research": "researcher", "write": "writer", "analyze": "analyst"&#125;
    agent = routing.get(task_type, "writer")

    return &#123;"assigned_to": agent&#125;

def route_to_worker(state: SupervisorState) -> str:
    return state.get("assigned_to", "writer")

# 构建Supervisor图
graph = StateGraph(SupervisorState)
graph.add_node("supervisor", supervisor_node)
graph.add_node("researcher", researcher_node)
graph.add_node("writer", writer_node)
graph.add_node("analyst", analyst_node)

graph.add_edge(START, "supervisor")
graph.add_conditional_edges("supervisor", route_to_worker, &#123;
    "researcher": "researcher",
    "writer": "writer",
    "analyst": "analyst",
&#125;)
for agent in ["researcher", "writer", "analyst"]:
    graph.add_edge(agent, END)
```

## 五、策略选择

| 场景 | 策略 | 原因 |
|------|------|------|
| Agent专长不同 | 能力匹配 | 让专业的人做专业的事 |
| Agent能力相同 | 负载均衡 | 避免某个过载 |
| 任务复杂难分类 | 竞标分配 | 让Agent自评 |
| 需要动态调度 | Supervisor | 主控动态决策 |
| 简单固定流程 | 串联 | 不需要分配 |
