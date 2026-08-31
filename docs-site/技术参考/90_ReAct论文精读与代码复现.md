# KB90 ReAct 论文精读与代码复现

> 知识库第 90 篇。精读 ReAct 原始论文（Yao et al., 2022），并用 LangGraph 完整复现。

---

## 一、论文信息

| 项目 | 内容 |
| --- | --- |
| 标题 | ReAct: Synergizing Reasoning and Acting in Language Models |
| 作者 | Shunyu Yao, Jeffrey Zhao, Yu Su, Dian Yu, Izhak Shaer, Karthik Narasimhan |
| 发表 | 2022 年，ICLR 2023 |
| 核心贡献 | 提出推理（Reasoning）与行动（Acting）协同的 Agent 框架 |

---

## 二、核心思想

### 2.1 问题背景

传统 LLM 有两种范式：
- **推理（Reasoning）**：Chain-of-Thought 等，擅长逻辑推理但无法与外部世界交互；
- **行动（Acting）**：工具调用等，能执行操作但缺乏规划和推理能力。

```mermaid
graph LR
    subgraph "传统范式"
        R["Reasoning<br/>CoT 推理<br/>无法交互"] 
        A["Acting<br/>工具调用<br/>缺乏规划"]
    end
    R -.->|"问题：闭门造车"| Q["幻觉/过时"]
    A -.->|"问题：盲目执行"| W["出错/低效"]
```

### 2.2 ReAct 的解决方案

将推理和行动交织在一起：Thought → Action → Observation 循环。

```mermaid
graph TD
    Q["问题输入"] --> T1["Thought 1<br/>分析问题"]
    T1 --> A1["Action 1<br/>调用工具"]
    A1 --> O1["Observation 1<br/>工具返回结果"]
    O1 --> T2["Thought 2<br/>分析结果"]
    T2 --> A2["Action 2<br/>调用工具"]
    A2 --> O2["Observation 2<br/>工具返回结果"]
    O2 --> T3["Thought 3<br/>得出答案"]
    T3 --> AN["答案输出"]
```

### 2.3 关键设计

| 设计点 | 说明 |
| --- | --- |
| Thought 自由文本 | 模型用自然语言推理，不受格式限制 |
| Action 结构化 | 动作有明确格式（工具名 + 参数） |
| Observation 外部反馈 | 工具返回结果作为下一轮推理输入 |
| 交替进行 | 推理→行动→观察循环直到得出答案 |

---

## 三、论文实验结果

### 3.1 任务与数据集

| 任务 | 数据集 | ReAct 表现 |
| --- | --- | --- |
| 问答 | HotpotQA | 优于 CoT 和 Act-only |
| 事实验证 | FEVER | 幻觉率降低 |
| 交互决策 | ALFWorld | 超越模仿学习基线 |

### 3.2 与其他方法对比

| 方法 | HotpotQA EM | FEVER Acc | 特点 |
| --- | --- | --- | --- |
| CoT（纯推理） | 28.7 | 0.57 | 不用外部工具 |
| Act-only（纯行动） | 25.7 | 0.60 | 不推理直接调工具 |
| ReAct | **35.1** | **0.64** | 推理+行动协同 |

### 3.3 关键发现

```mermaid
graph LR
    F1["发现1<br/>ReAct 优于纯推理和纯行动"] --> F2["发现2<br/>Thought 帮助模型<br/>跟踪进度和处理异常"]
    F2 --> F3["发现3<br/>外部 Observation<br/>减少幻觉"]
    F3 --> F4["发现4<br/>推理和行动<br/>相互增强"]
```

---

## 四、LangGraph 代码复现

### 4.1 架构设计

```mermaid
graph TD
    S["State<br/>消息列表"] --> AG["Agent 节点<br/>LLM 推理+决策"]
    AG -->|"有 tool_calls"| TN["ToolNode<br/>执行工具"]
    AG -->|"无 tool_calls"| END["END<br/>输出答案"]
    TN --> S
```

### 4.2 完整复现代码

```python
"""
ReAct 论文复现：基于 LangGraph 的 ReAct Agent
论文：ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2022)
"""
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# === 1. 定义工具（论文中的 Action） ===
@tool
def search(query: str) -> str:
    """搜索网络获取信息。输入搜索关键词。"""
    # 实际实现可替换为 SerpAPI/Tavily 等
    results = {
        "法国首都": "巴黎",
        "巴黎人口": "约210万",
        "法国人口": "约6700万",
    }
    return results.get(query, f"未找到'{query}'的相关信息")

@tool
def lookup(entity: str) -> str:
    """查找实体信息。输入实体名称。"""
    data = {
        "巴黎": "法国首都，人口约210万",
        "法国": "欧洲国家，首都巴黎，人口约6700万",
    }
    return data.get(entity, f"未找到'{entity}'的信息")

@tool
def finish(answer: str) -> str:
    """提交最终答案。输入答案文本。"""
    return answer

tools = [search, lookup, finish]

# === 2. 配置模型（论文中的 LLM + Few-shot Prompt） ===
llm = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools(tools)

SYSTEM_PROMPT = """你是一个 ReAct Agent。请按以下步骤工作：
1. Thought：分析当前情况，决定下一步
2. Action：选择一个工具执行
3. Observation：查看工具返回的结果
4. 重复上述步骤直到得出答案
最后使用 finish 工具提交答案。"""

# === 3. 定义状态 ===
class State(TypedDict):
    messages: Annotated[list, add_messages]

# === 4. 定义 Agent 节点 ===
def agent_node(state: State):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# === 5. 定义路由（论文中的控制流） ===
def should_use_tools(state: State) -> str:
    last_msg = state["messages"][-1]
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        return "tools"
    return END

# === 6. 构建 LangGraph ===
graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools))
graph.set_entry_point("agent")
graph.add_conditional_edges("agent", should_use_tools, {"tools": "tools", END: END})
graph.add_edge("tools", "agent")
app = graph.compile()

# === 7. 测试 ===
if __name__ == "__main__":
    question = "法国首都的人口是多少？"
    result = app.invoke({"messages": [{"role": "user", "content": question}]})
    print("最终答案:", result["messages"][-1].content)
```

### 4.3 运行轨迹示例

```mermaid
sequenceDiagram
    participant U as 用户
    participant A as Agent
    participant S as search工具
    participant L as lookup工具
    participant F as finish工具

    U->>A: 法国首都人口多少？
    Note over A: Thought: 需先查法国首都
    A->>S: search("法国首都")
    S-->>A: "巴黎"
    Note over A: Thought: 查巴黎人口
    A->>L: lookup("巴黎")
    L-->>A: "人口约210万"
    Note over A: Thought: 得到答案
    A->>F: finish("巴黎人口约210万")
    F-->>A: "巴黎人口约210万"
    A-->>U: 巴黎人口约210万
```

---

## 五、论文核心贡献总结

| 贡献 | 说明 |
| --- | --- |
| ReAct 框架 | 首次系统提出推理+行动协同的 Agent 范式 |
| Thought-Action-Observation 循环 | 成为后续 Agent 的标准结构 |
| 实验验证 | 证明推理和行动相互增强 |
| 可解释性 | Thought 链提供推理过程的可追溯性 |

---

## 六、论文影响与后续工作

```mermaid
graph TD
    R["ReAct (2022)"] --> LM["LangChain Agent"]
    R --> LF["LangGraph Agent"]
    R --> RE["Reflexion (2023)<br/>加自省"]
    R --> PS["Plan-and-Solve (2023)<br/>加规划"]
    R --> TO["Tree of Thoughts (2023)<br/>加树搜索"]
    R --> AG["AutoGPT/BabyAGI<br/>自主Agent"]
```

ReAct 是几乎所有现代 Agent 框架的基石。

---

## 七、复现注意事项

| 注意点 | 说明 |
| --- | --- |
| Few-shot Prompt | 论文用手工 Few-shot 示例，现代可用系统提示词替代 |
| 工具定义 | 论文用文本解析 Action，现代用 function calling |
| 温度 | 推理任务 temperature=0 更稳定 |
| 循环上限 | 设 max_iterations 防死循环 |
| LangSmith | 复现时用 LangSmith Trace 观察 Thought 链 |

---

> 本篇配合第 103 课学习，论文原文：arxiv.org/abs/2210.03629