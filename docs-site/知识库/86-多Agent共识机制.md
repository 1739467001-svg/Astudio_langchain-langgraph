# 多 Agent 共识机制

> 当多个 Agent 对同一问题给出不同答案时，如何达成共识？这份指南覆盖投票、辩论和仲裁机制。

---

## 一、为什么需要共识机制

```mermaid
graph TB
    subgraph 问题 &#123;"多Agent可能不一致"&#125;
        Q["问题: '这个产品好不好？'"]
        Q --> A1["Agent1: '好'"]
        Q --> A2["Agent2: '一般'"]
        Q --> A3["Agent3: '差'"]
        Note1["❓ 用哪个答案？<br/>❓ 如何综合？"]
    end

    subgraph 解决 &#123;"共识机制解决"&#125;
        Q2["问题"] --> VOTE["共识投票<br/>多数表决"]
        VOTE --> RESULT["综合答案 ✅"]
    end

    style 问题 fill:'#FFE0B2'
    style 解决 fill:'#C8E6C9'
```

## 二、三种共识机制

```mermaid
graph TB
    subgraph 共识机制 &#123;"三种共识机制"&#125;
        M1["1.多数投票<br/>简单计数取多数<br/>适合: 分类/判断题"]
        M2["2.辩论收敛<br/>Agent互相辩论<br/>→逐步收敛<br/>适合: 开放性问题"]
        M3["3.仲裁者<br/>独立Agent裁决<br/>综合多方意见<br/>适合: 复杂决策"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#F3E5F5'
```

## 三、多数投票实现

```python
from collections import Counter
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

def multi_agent_vote(question: str, n_agents: int = 3) -> dict:
    """多Agent投票"""
    # 每个Agent独立回答（temperature>0确保多样性）
    answers = []
    for i in range(n_agents):
        prompt = ChatPromptTemplate.from_template("回答问题（简洁）：&#123;question&#125;")
        chain = prompt | llm | StrOutputParser()
        answer = chain.invoke(&#123;"question": question&#125;)
        answers.append(answer.strip())

    # 多数投票（简化：取最相似答案）
    # 实际中可以用LLM判断答案是否相同
    counter = Counter(answers)
    consensus = counter.most_common(1)[0]

    return &#123;
        "question": question,
        "answers": answers,
        "consensus": consensus[0],
        "agreement": f"&#123;consensus[1]&#125;/&#123;n_agents&#125;",
    &#125;
```

## 四、辩论收敛实现

```python
from typing import TypedDict, Annotated
from operator import add
from langchain_core.messages import AnyMessage
from langgraph.graph import StateGraph, START, END

class DebateState(TypedDict):
    question: str
    messages: Annotated[list[AnyMessage], add]
    current_round: int
    consensus: str

def agent_a_node(state: DebateState) -> dict:
    """Agent A：给出观点"""
    history = state.get("messages", [])
    history_text = "\n".join(m.content[:200] for m in history[-4:])

    prompt = ChatPromptTemplate.from_template(
        "你是辩论者A。基于历史和问题，给出你的观点（简洁）。"
        "如果与对方观点一致，回复'AGREE: XXX'。"
        "\n问题：&#123;q&#125;\n历史：&#123;h&#125;\n观点："
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"q": state["question"], "h": history_text&#125;)
    return &#123;
        "messages": [AIMessage(content=f"[A]: &#123;result&#125;")],
        "current_round": state.get("current_round", 0) + 1,
    &#125;

def agent_b_node(state: DebateState) -> dict:
    """Agent B：回应A的观点"""
    history = state.get("messages", [])
    history_text = "\n".join(m.content[:200] for m in history[-4:])

    prompt = ChatPromptTemplate.from_template(
        "你是辩论者B。基于A的观点，给出你的回应。"
        "如果同意A，回复'AGREE: XXX'。"
        "\n问题：&#123;q&#125;\n历史：&#123;h&#125;\n回应："
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"q": state["question"], "h": history_text&#125;)
    return &#123;
        "messages": [AIMessage(content=f"[B]: &#123;result&#125;")],
    &#125;

def check_consensus(state: DebateState) -> str:
    """检查是否达成共识"""
    if state.get("current_round", 0) >= 3:
        return "done"  # 最多3轮
    last_msgs = state.get("messages", [])[-2:]
    for msg in last_msgs:
        if "AGREE" in msg.content:
            return "done"
    return "continue"

# 构建辩论图
graph = StateGraph(DebateState)
graph.add_node("agent_a", agent_a_node)
graph.add_node("agent_b", agent_b_node)
graph.add_edge(START, "agent_a")
graph.add_edge("agent_a", "agent_b")
graph.add_conditional_edges("agent_b", check_consensus, &#123;
    "continue": "agent_a",
    "done": END,
&#125;)
debate_app = graph.compile()
```

## 五、仲裁者实现

```python
def arbiter_node(question: str, opinions: list[str]) -> str:
    """仲裁者：综合多方意见给出最终答案"""
    opinions_text = "\n".join(f"Agent&#123;i+1&#125;: &#123;op&#125;" for i, op in enumerate(opinions))
    prompt = ChatPromptTemplate.from_template(
        "你是仲裁者。多个Agent对同一问题给出了不同意见。"
        "请综合所有意见，给出最合理的最终答案。"
        "\n问题：&#123;q&#125;\n各方意见：&#123;ops&#125;\n最终答案："
    )
    chain = prompt | llm | StrOutputParser()
    return chain.invoke(&#123;"q": question, "ops": opinions_text&#125;)
```

## 六、机制选择

```mermaid
graph TD
    Q&#123;"问题类型?"&#125;
    Q -->|"分类/判断"| VOTE["✅ 多数投票"]
    Q -->|"开放性问题"| DEBATE["✅ 辩论收敛"]
    Q -->|"复杂决策"| ARBITER["✅ 仲裁者"]
    Q -->|"简单问题"| SINGLE["→ 单Agent即可"]

    style VOTE fill:'#C8E6C9'
    style ARBITER fill:'#E3F2FD'
```

| 场景 | 机制 | LLM调用 | 准确率提升 |
|------|------|---------|-----------|
| 分类判断 | 多数投票 | N次 | +10-20% |
| 推理题 | 多数投票(Self-Consistency) | N次 | +15-25% |
| 开放讨论 | 辩论收敛 | 2N次 | +20% |
| 复杂决策 | 仲裁者 | N+1次 | +25% |
