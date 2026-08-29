# Agent 可解释性与 XAI 指南

> "为什么 AI 做了这个决定？"在医疗、金融、法律等高风险场景，这个问题必须能回答。可解释 AI（XAI）不是"让模型变简单"，而是让模型的决策过程对人类透明可审计。本指南系统讲解 Agent 决策可解释性的层次、推理链可视化、工具选择解释、置信度量化，以及在 LangGraph 中的实现。

---

## 1. 为什么 Agent 需要可解释性

### 不可解释的风险

```
场景1：医疗诊断 Agent
  Agent: "建议进行化疗"
  医生: "为什么？"
  Agent: ???
  → 没有推理依据，医生不敢采纳

场景2：贷款审批 Agent
  Agent: "拒绝贷款"
  用户: "为什么拒绝？"
  Agent: ???
  → 没有理由，用户无法申诉

场景3：法律建议 Agent
  Agent: "建议认罪"
  律师: "依据是什么？"
  Agent: ???
  → 没有法条引用，律师无法判断
```

### 可解释性的三个层次

| 层次 | 问题 | 方法 | 用户 |
|------|------|------|------|
| 全局解释 | 模型整体如何工作？ | 架构图、特征重要性 | 开发者 |
| 局部解释 | 这次决策为什么？ | 推理链、SHAP | 最终用户 |
| 过程解释 | 决策过程是什么？ | 步骤回放、工具调用链 | 审计者 |

---

## 2. 推理链可视化

### Chain-of-Thought 展示

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from dataclasses import dataclass

@dataclass
class ExplainableResponse:
    """可解释的响应"""
    reasoning: str        # 推理过程
    answer: str           # 最终答案
    confidence: float     # 置信度
    sources: list          # 引用来源
    alternatives: list     # 备选方案

async def explainable_invoke(query: str, context: str = "") -> ExplainableResponse:
    """带推理链的可解释调用"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", """你是一个可解释 AI 助手。回答问题时必须：

1. 【推理过程】逐步分析你的思考过程
2. 【最终答案】给出明确结论
3. 【置信度】评估你的置信度（0-1），并说明依据
4. 【来源】引用的文档或数据
5. 【备选方案】如果置信度 < 0.8，提供备选建议

格式：
### 推理过程
1. 首先分析...
2. 然后考虑...
3. 因此得出...

### 最终答案
...

### 置信度
0.X
依据：...

### 来源
- [1] 文档A
- [2] 文档B

### 备选方案
（如置信度 < 0.8）"""),
        ("human", "问题: &#123;query&#125;\n\n参考资料:\n&#123;context&#125;")
    ])

    model = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = prompt | model
    response = await chain.ainvoke(&#123;"query": query, "context": context&#125;)

    # 解析结构化输出
    return parse_explainable_response(response.content)
```

### 推理步骤追踪

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class ExplainableState(TypedDict):
    query: str
    reasoning_steps: list    # 推理步骤
    tool_decisions: list      # 工具选择记录
    tool_results: list        # 工具结果
    final_answer: str
    confidence: float
    explanation: str           # 最终解释

async def reasoning_node(state: ExplainableState):
    """推理节点：记录每一步思考"""
    model = ChatOpenAI(model="gpt-4o", temperature=0)

    # 强制模型分步推理
    response = await model.ainvoke(
        f"""分析以下问题，分步骤推理。每步必须包含：
        - 步骤编号
        - 思考内容
        - 需要的工具（如有）
        - 当前结论

        问题: &#123;state['query']&#125;
        已有信息: &#123;state.get('tool_results', [])&#125;"""
    )

    steps = parse_reasoning_steps(response.content)

    return &#123;
        "reasoning_steps": state.get("reasoning_steps", []) + steps,
    &#125;

async def tool_decision_node(state: ExplainableState):
    """工具选择节点：记录选择理由"""
    available_tools = ["search", "calculator", "database"]
    reasoning = state.get("reasoning_steps", [])
    last_step = reasoning[-1] if reasoning else &#123;&#125;

    if last_step.get("tool_needed"):
        tool_name = last_step["tool_needed"]
        # 记录为什么选这个工具
        return &#123;
            "tool_decisions": state.get("tool_decisions", []) + [&#123;
                "tool": tool_name,
                "reason": last_step.get("content", ""),
                "step": len(reasoning),
            &#125;]
        &#125;
    return &#123;&#125;

async def explain_node(state: ExplainableState):
    """生成最终解释"""
    steps = state.get("reasoning_steps", [])
    decisions = state.get("tool_decisions", [])

    explanation = f"""## 决策过程

### 推理步骤
"""
    for i, step in enumerate(steps):
        explanation += f"&#123;i+1&#125;. &#123;step.get('content', '')&#125;\n"
        if step.get("conclusion"):
            explanation += f"   → 结论: &#123;step['conclusion']&#125;\n"

    explanation += f"\n### 工具使用\n"
    for d in decisions:
        explanation += f"- 使用 &#123;d['tool']&#125;：&#123;d['reason']&#125;\n"

    explanation += f"\n### 最终答案\n&#123;state.get('final_answer', '')&#125;\n"
    explanation += f"\n### 置信度\n&#123;state.get('confidence', 0)&#125;\n"

    return &#123;"explanation": explanation&#125;

# 构建可解释 Agent
graph = StateGraph(ExplainableState)
graph.add_node("reasoning", reasoning_node)
graph.add_node("tool_decision", tool_decision_node)
graph.add_node("explain", explain_node)
graph.add_edge(START, "reasoning")
graph.add_edge("reasoning", "tool_decision")
graph.add_edge("tool_decision", "explain")
graph.add_edge("explain", END)

explainable_agent = graph.compile()
```

---

## 3. 置信度量化

### 多维度置信度

```python
@dataclass
class ConfidenceScorer:
    """多维度置信度评估"""

    async def score(self, answer: str, sources: list, query: str) -> float:
        """综合置信度评分"""
        scores = &#123;
            "source_coverage": await self._source_coverage(sources, query),
            "answer_specificity": await self._specificity(answer, query),
            "factuality": await self._factuality(answer, sources),
            "completeness": await self._completeness(answer, query),
        &#125;

        # 加权平均
        weights = &#123;
            "source_coverage": 0.3,
            "answer_specificity": 0.2,
            "factuality": 0.3,
            "completeness": 0.2,
        &#125;

        total = sum(scores[k] * weights[k] for k in scores)
        return total

    async def _source_coverage(self, sources: list, query: str) -> float:
        """来源覆盖度：是否有足够的证据"""
        if not sources:
            return 0.2  # 无来源，低置信
        if len(sources) >= 3:
            return 0.9
        if len(sources) >= 1:
            return 0.7

    async def _specificity(self, answer: str, query: str) -> float:
        """答案具体性：是否具体而非笼统"""
        if "可能" in answer or "也许" in answer:
            return 0.5
        if len(answer) < 50:
            return 0.4
        return 0.8

    async def _factuality(self, answer: str, sources: list) -> float:
        """事实性：答案是否基于来源"""
        if not sources:
            return 0.3
        # 检查答案中的关键信息是否在来源中出现
        source_text = " ".join(sources)
        overlap = self._text_overlap(answer, source_text)
        return min(1.0, overlap * 2)

    async def _completeness(self, answer: str, query: str) -> float:
        """完整性：是否完整回答了问题"""
        model = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        result = await model.ainvoke(
            f"判断回答是否完整地回答了问题。只回答 0-1 的分数。\n\n问题: &#123;query&#125;\n回答: &#123;answer&#125;"
        )
        try:
            return float(result.content.strip())
        except:
            return 0.5

    @staticmethod
    def _text_overlap(text1: str, text2: str) -> float:
        """文本重叠度"""
        words1 = set(text1.split())
        words2 = set(text2.split())
        if not words1:
            return 0
        return len(words1 & words2) / len(words1)
```

### 置信度展示

```python
def format_confidence(score: float) -> str:
    """格式化置信度展示"""
    if score >= 0.85:
        return f"🟢 高置信度 (&#123;score:.0%&#125;)"
    elif score >= 0.6:
        return f"🟡 中等置信度 (&#123;score:.0%&#125;)"
    elif score >= 0.4:
        return f"🟠 低置信度 (&#123;score:.0%&#125;)"
    else:
        return f"🔴 极低置信度 (&#123;score:.0%&#125;)"

def format_explanation(response: ExplainableResponse) -> str:
    """格式化完整解释"""
    return f"""&#123;response.answer&#125;

---
&#123;format_confidence(response.confidence)&#125;

📚 来源:
&#123;chr(10).join(f'  [&#123;i+1&#125;] &#123;s&#125;' for i, s in enumerate(response.sources))&#125;

💡 推理过程:
&#123;response.reasoning&#125;

&#123;f"⚠️ 备选建议: &#123;response.alternatives&#125;" if response.confidence < 0.8 else ""&#125;
"""
```

---

## 4. 工具选择解释

### 记录工具选择理由

```python
@dataclass
class ToolSelectionRecord:
    """工具选择记录"""
    tool_name: str
    selected: bool
    reason: str            # 选择/未选择的理由
    alternative: str = ""   # 如果未选，选了什么替代

async def explain_tool_selection(query: str, tools: list) -> list:
    """解释为什么选择/不选择每个工具"""
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    tool_descriptions = "\n".join([
        f"- &#123;t.name&#125;: &#123;t.description&#125;" for t in tools
    ])

    response = await model.ainvoke(
        f"""分析以下问题需要哪些工具，逐一解释每个工具是否被选择以及理由。

问题: &#123;query&#125;
可用工具:
&#123;tool_descriptions&#125;

对每个工具，输出：
工具名: [选择/未选择]
理由: ...
"""
    )
    return parse_tool_selections(response.content)
```

---

## 5. LangSmith 追踪集成

### 用 LangSmith 实现过程可解释

```python
from langsmith import Client
from langchain_core.tracers.context import tracing_v2_enabled

# 方式1：自动追踪
with tracing_v2_enabled(project_name="explainable-agent"):
    result = await explainable_agent.ainvoke(&#123;
        "query": "客户A的信用风险等级是多少？"
    &#125;)

# 方式2：手动添加解释性标注
from langchain_core.callbacks import BaseCallbackHandler

class ExplanationCallback(BaseCallbackHandler):
    """为每一步添加解释性标注"""

    def on_llm_end(self, response, **kwargs):
        # 记录 LLM 推理过程
        print(f"[推理] &#123;response.llm_output&#125;")

    def on_tool_start(self, serialized, input_str, **kwargs):
        # 记录工具选择理由
        print(f"[工具] 选择 &#123;serialized['name']&#125;: &#123;input_str&#125;")

    def on_tool_end(self, output, **kwargs):
        # 记录工具结果
        print(f"[结果] &#123;output[:100]&#125;")

# 使用回调
agent = create_react_agent(
    model,
    tools,
    callbacks=[ExplanationCallback()],
)
```

---

## 6. 特征重要性（SHAP/LIME）

### 适用于 RAG 的特征重要性

```python
async def explain_rag_decision(query: str, retrieved_docs: list,
                                answer: str) -> dict:
    """解释 RAG 决策：哪些文档对答案贡献最大"""
    model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # 让模型评估每个文档的贡献
    doc_importance = []
    for i, doc in enumerate(retrieved_docs):
        response = await model.ainvoke(
            f"""评估以下文档对回答的贡献度（0-1分）。

问题: &#123;query&#125;
答案: &#123;answer&#125;
文档: &#123;doc.page_content[:500]&#125;

只回答 0-1 的分数。"""
        )
        try:
            score = float(response.content.strip())
        except:
            score = 0.5

        doc_importance.append(&#123;
            "doc_index": i,
            "content": doc.page_content[:200],
            "importance": score,
        &#125;)

    # 按贡献度排序
    doc_importance.sort(key=lambda x: x["importance"], reverse=True)

    return &#123;
        "doc_importance": doc_importance,
        "top_contributors": doc_importance[:3],
        "low_contributors": [d for d in doc_importance if d["importance"] < 0.3],
    &#125;
```

---

## 7. 决策审计报告

```python
@dataclass
class DecisionAuditReport:
    """决策审计报告生成器"""

    async def generate(self, agent_run: dict) -> str:
        """生成完整审计报告"""
        report = f"""# Agent 决策审计报告

## 基本信息
- 时间: &#123;agent_run.get('timestamp', '')&#125;
- 用户: &#123;agent_run.get('user_id', 'anonymous')&#125;
- 查询: &#123;agent_run.get('query', '')&#125;

## 决策过程

### 推理步骤
"""
        steps = agent_run.get("reasoning_steps", [])
        for i, step in enumerate(steps):
            report += f"&#123;i+1&#125;. &#123;step&#125;\n"

        report += f"""
### 工具使用
"""
        tools_used = agent_run.get("tool_decisions", [])
        for t in tools_used:
            report += f"- &#123;t['tool']&#125;: &#123;t.get('reason', '')&#125;\n"

        report += f"""
## 结果
- 答案: &#123;agent_run.get('final_answer', '')&#125;
- 置信度: &#123;agent_run.get('confidence', 0)&#125;

## 评估
- 推理链完整性: &#123;'✅' if len(steps) >= 2 else '⚠️'&#125;
- 工具使用合理性: &#123;'✅' if tools_used else '⚠️ 无工具调用'&#125;
- 置信度: &#123;'🟢 高' if agent_run.get('confidence', 0) >= 0.8 else '🟡 中' if agent_run.get('confidence', 0) >= 0.5 else '🔴 低'&#125;

## 审计结论
&#123;"决策过程清晰、有据可查" if len(steps) >= 2 and agent_run.get('confidence', 0) >= 0.7 else "决策过程需要进一步审查"&#125;
"""
        return report
```

---

## 8. 可解释性方案对比

| 方法 | 层次 | 优势 | 劣势 | 适用 |
|------|------|------|------|------|
| CoT 展示 | 局部 | 简单直观 | 可能编造 | 通用 |
| 推理步骤追踪 | 过程 | 完整链路 | 额外开销 | 审计 |
| 置信度评分 | 局部 | 量化评估 | 需校准 | 高风险 |
| 工具选择解释 | 过程 | 透明决策 | 增加调用 | Agent |
| 特征重要性 | 全局 | 精确量化 | 计算昂贵 | RAG |
| 审计报告 | 全局 | 完整记录 | 格式固定 | 合规 |

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解可解释性的三个层次 | ☐ |
| 实现了推理链展示 | ☐ |
| 实现了多维度置信度评分 | ☐ |
| 记录了工具选择理由 | ☐ |
| 集成了 LangSmith 追踪 | ☐ |
| 实现了 RAG 文档贡献度分析 | ☐ |
| 能生成决策审计报告 | ☐ |
| 置信度低时有备选方案 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 76 | Agent 决策可解释性 | 可解释性基础 |
| 88 | Agent 决策回放与调试 | 决策回放 |
| 106 | RAG 检索结果解释性 | 检索解释 |
| 179 | 决策可解释性图解 | 可解释图解 |
| 211 | Agent 决策可解释性 | 决策解释 |
| 236 | 决策可解释性图解 | 可解释 |
| 266 | 检索解释性 | 检索解释 |
| 337 | 轨迹评分 | 轨迹评估 |
| 362 | Agent 工具调用链追踪 | 调用链 |
| 390 | 分布式追踪与调用图谱 | 分布式追踪 |
| 410 | Agent 对齐与价值约束 | Agent 对齐 |
| 417 | Agent 监控与可观测性 | 可观测性 |
