# Agent 规划与推理链

> 高级 Agent 不是"一步到位"，而是先规划再执行、逐步推理。本指南覆盖推理链设计模式。

---

## 一、推理链的价值

```mermaid
graph TB
    subgraph 直接回答 &#123;"❌ 直接回答（无推理链）"&#125;
        U["问题: '如果A比B大，B比C大，C比D大，那A和D谁大？'"]
        U --> LLM1["LLM直接回答"]
        LLM1 --> A1["答案可能出错 ❌"]
    end

    subgraph 推理链 &#123;"✅ 推理链（逐步推理）"&#125;
        U2["问题: 同上"]
        U2 --> S1["Step1: A>B"]
        S1 --> S2["Step2: B>C → A>B>C"]
        S2 --> S3["Step3: C>D → A>B>C>D"]
        S3 --> A2["A>D ✅ 正确"]
    end

    style 直接回答 fill:'#FFCDD2'
    style 推理链 fill:'#C8E6C9'
```

## 二、推理链的四种模式

```mermaid
graph TB
    subgraph 四种模式 &#123;"推理链四种模式"&#125;
        M1["1. 线性推理链<br/>Step1→Step2→Step3→答案"]
        M2["2. 树形推理<br/>多分支探索→选最优"]
        M3["3. 自我反思推理<br/>生成→评价→改进→答案"]
        M4["4. 工具增强推理<br/>推理+工具调用交替"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#FFF9C4'
    style M4 fill:'#F3E5F5'
```

## 三、线性推理链实现

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

class ReasoningState(TypedDict):
    question: str
    steps: list[str]    # 推理步骤
    answer: str

def reason_step(state: ReasoningState) -> dict:
    """执行一步推理"""
    history = "\n".join(f"Step&#123;i+1&#125;: &#123;s&#125;" for i, s in enumerate(state.get("steps", [])))

    prompt = ChatPromptTemplate.from_template(
        """你是一个逻辑推理专家。逐步解决以下问题。

        问题：&#123;question&#125;

        已完成的推理步骤：
        &#123;history&#125;

        请输出下一步推理（如果已有足够信息得出结论，输出"结论：XXX"）：
        """
    )
    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;
        "question": state["question"],
        "history": history or "(开始推理)"
    &#125;)

    steps = state.get("steps", [])
    steps.append(result)

    return &#123;"steps": steps&#125;

def should_continue(state: ReasoningState) -> str:
    """检查是否得出结论"""
    last_step = state.get("steps", [])[-1] if state.get("steps") else ""
    if "结论" in last_step or len(state.get("steps", [])) >= 5:
        return "done"
    return "continue"

def answer_node(state: ReasoningState) -> dict:
    """生成最终答案"""
    last_step = state["steps"][-1]
    # 提取结论
    if "结论：" in last_step:
        answer = last_step.split("结论：")[-1].strip()
    else:
        answer = last_step
    return &#123;"answer": answer&#125;

# 构建图
graph = StateGraph(ReasoningState)
graph.add_node("reason", reason_step)
graph.add_node("answer", answer_node)
graph.add_edge(START, "reason")
graph.add_conditional_edges("reason", should_continue, &#123;
    "continue": "reason",  # 循环推理
    "done": "answer"
&#125;)
graph.add_edge("answer", END)

app = graph.compile()

# 使用
result = app.invoke(&#123;
    "question": "一个商店有23个苹果，上午卖了8个，下午又进了15个，晚上卖了12个，还剩多少？",
    "steps": [],
    "answer": "",
&#125;)
print("推理步骤:")
for i, s in enumerate(result["steps"], 1):
    print(f"  Step&#123;i&#125;: &#123;s[:100]&#125;")
print(f"\n答案: &#123;result['answer']&#125;")
```

## 四、树形推理实现

```python
def tree_of_thought(question: str, llm, n_branches: int = 3) -> str:
    """树形推理：生成多个思路→评估→选最优"""
    # Step 1: 生成多个思路
    gen_prompt = ChatPromptTemplate.from_template(
        "为以下问题生成&#123;n&#125;种不同的解决思路，每种2-3句：\n&#123;question&#125;\n\n思路："
    )
    thoughts = (gen_prompt | llm | StrOutputParser()).invoke(&#123;
        "question": question, "n": n_branches
    &#125;)

    # Step 2: 评估每个思路
    eval_prompt = ChatPromptTemplate.from_template(
        "评估以下解决思路，选出最优的。1-&#123;n&#125;分。\n思路：&#123;thoughts&#125;\n\n最优思路编号和理由："
    )
    evaluation = (eval_prompt | llm | StrOutputParser()).invoke(&#123;
        "thoughts": thoughts, "n": n_branches
    &#125;)

    # Step 3: 基于最优思路生成答案
    answer_prompt = ChatPromptTemplate.from_template(
        "基于以下思路和评估，给出最终答案：\n问题：&#123;question&#125;\n思路：&#123;thoughts&#125;\n评估：&#123;eval&#125;\n\n答案："
    )
    return (answer_prompt | llm | StrOutputParser()).invoke(&#123;
        "question": question, "thoughts": thoughts, "eval": evaluation
    &#125;)
```

## 五、推理链 + 工具调用

```mermaid
graph TB
    subgraph 推理工具交替 &#123;"推理链+工具调用交替模式"&#125;
        R1["推理: 需要计算"] --> T1["工具: calculator"]
        T1 --> R2["推理: 得到结果，继续"]
        R2 --> R3["推理: 需要搜索"]
        R3 --> T2["工具: web_search"]
        T2 --> R4["推理: 信息齐全"]
        R4 --> A["最终答案 ✅"]
    end

    style 推理工具交替 fill:'#E3F2FD'
```

## 六、模式选择

```mermaid
graph TD
    Q&#123;"问题类型?"&#125;
    Q -->|"简单事实"| DIRECT["直接回答<br/>(无需推理链)"]
    Q -->|"多步逻辑"| LINEAR["✅ 线性推理链"]
    Q -->|"需要探索多种方案"| TOT["✅ 树形推理"]
    Q -->|"需要高质量输出"| REFLECT["✅ 自我反思"]
    Q -->|"需要外部信息"| TOOLS["✅ 工具增强推理"]

    style LINEAR fill:'#C8E6C9'
    style TOT fill:'#E3F2FD'
```

## 七、成本与效果

| 模式 | LLM调用 | 效果提升 | 延迟 | 适用 |
|------|---------|---------|------|------|
| 直接回答 | 1次 | 基线 | 低 | 简单问题 |
| 线性推理 | 2-5次 | +15-25% | 中 | 逻辑推理 |
| 树形推理 | 3-5次 | +20-30% | 中高 | 创意/策略 |
| 自我反思 | 3-6次 | +15-25% | 中 | 高质量输出 |
| 工具增强 | 变化 | +30%+ | 高 | 需要外部数据 |
