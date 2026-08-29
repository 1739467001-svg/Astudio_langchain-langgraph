# Agent 决策可解释性

> Agent 为什么选了这个工具？为什么走了这条路？让 Agent 的决策过程透明可审计。

---

## 一、为什么需要可解释性

```mermaid
graph TB
    subgraph 黑盒 &#123;"❌ 不可解释的Agent"&#125;
        U["用户: '帮我查订单'"]
        U --> A1["Agent(内部决策不透明)"]
        A1 --> R1["回答(不知道为什么是这个)"]
        Note1["❌ 无法调试<br/>❌ 无法审计<br/>❌ 用户不信任"]
    end

    subgraph 可解释 &#123;"✅ 可解释的Agent"&#125;
        U2["用户: '帮我查订单'"]
        U2 --> A2["Agent"]
        A2 --> D1["决策记录: 识别为订单查询"]
        D1 --> D2["工具选择: query_order"]
        D2 --> D3["执行: query_order(ORD001)"]
        D3 --> R2["回答+决策链"]
        Note2["✅ 可调试 ✅ 可审计 ✅ 可信任"]
    end

    style 黑盒 fill:'#FFCDD2'
    style 可解释 fill:'#C8E6C9'
```

## 二、决策记录结构

```python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any

class DecisionRecord(BaseModel):
    """单次决策记录"""
    step: int                           # 第几步
    timestamp: str = ""                # 时间戳
    thought: str = ""                  # 思考过程
    action: str = ""                   # 选择的动作
    action_input: Optional[Any] = None # 动作参数
    observation: str = ""              # 观察结果
    reasoning: str = ""                # 选择理由

class DecisionTrace(BaseModel):
    """完整决策链"""
    question: str                       # 用户问题
    decisions: list[DecisionRecord] = []  # 决策序列
    final_answer: str = ""             # 最终回答
    total_steps: int = 0               # 总步数
    total_tokens: int = 0              # 总Token
    total_latency: float = 0           # 总耗时
```

## 三、实现可解释 Agent

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.callbacks import BaseCallbackHandler

class ExplainabilityCallback(BaseCallbackHandler):
    """可解释性回调：记录Agent每步决策"""
    def __init__(self):
        self.trace = DecisionTrace(question="", decisions=[])
        self._current_step = 0
        self._start_time = None

    def on_llm_start(self, serialized, prompts, **kwargs):
        if not self._start_time:
            import time
            self._start_time = time.time()

    def on_llm_end(self, response, **kwargs):
        # 记录LLM的思考
        if response.generations:
            gen = response.generations[0][0]
            self._current_step += 1
            record = DecisionRecord(
                step=self._current_step,
                timestamp=datetime.now().isoformat(),
                thought=gen.text[:200] if hasattr(gen, 'text') else "",
            )
            self.trace.decisions.append(record)

    def on_tool_start(self, serialized, input_str, **kwargs):
        tool_name = serialized.get("name", "unknown")
        if self.trace.decisions:
            last = self.trace.decisions[-1]
            last.action = tool_name
            last.action_input = input_str[:200]

    def on_tool_end(self, output, **kwargs):
        if self.trace.decisions:
            self.trace.decisions[-1].observation = str(output)[:200]

    def finalize(self, question: str, answer: str, tokens: int):
        import time
        self.trace.question = question
        self.trace.final_answer = answer
        self.trace.total_steps = len(self.trace.decisions)
        self.trace.total_tokens = tokens
        if self._start_time:
            self.trace.total_latency = round(time.time() - self._start_time, 2)

    def explain(self) -> str:
        """生成可解释报告"""
        report = f"=== Agent 决策追踪 ===\n"
        report += f"问题: &#123;self.trace.question&#125;\n"
        report += f"步数: &#123;self.trace.total_steps&#125;\n"
        report += f"Token: &#123;self.trace.total_tokens&#125;\n"
        report += f"耗时: &#123;self.trace.total_latency&#125;s\n\n"

        for d in self.trace.decisions:
            report += f"Step &#123;d.step&#125;:\n"
            if d.thought:
                report += f"  🧠 思考: &#123;d.thought[:150]&#125;\n"
            if d.action:
                report += f"  🔧 工具: &#123;d.action&#125;\n"
                report += f"  📥 输入: &#123;str(d.action_input)[:100]&#125;\n"
            if d.observation:
                report += f"  👀 结果: &#123;d.observation[:150]&#125;\n"
            report += "\n"

        report += f"最终回答: &#123;self.trace.final_answer[:200]&#125;\n"
        return report

# 使用
cb = ExplainabilityCallback()
agent_executor = AgentExecutor(
    agent=agent, tools=tools, verbose=True,
    callbacks=[cb],
)

result = agent_executor.invoke(&#123;"input": "查一下ORD001的订单状态"&#125;)
cb.finalize(
    question=result["input"],
    answer=result["output"],
    tokens=0,  # 从response.usage_metadata获取
)
print(cb.explain())
```

## 四、可解释性的三个层次

```mermaid
graph TB
    subgraph 三层次 &#123;"可解释性三个层次"&#125;
        L1["Level 1: 执行追踪<br/>记录用了什么工具/什么参数<br/>实现: Callback"]
        L2["Level 2: 决策理由<br/>记录为什么选这个工具<br/>实现: Prompt要求LLM输出理由"]
        L3["Level 3: 对话式解释<br/>用户可追问'为什么这样做'<br/>实现: 决策记录+LLM解释"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L3 fill:'#F3E5F5'
```

## 五、决策理由提取

```python
def extract_reasoning(llm_output: str) -> str:
    """从LLM输出中提取决策理由"""
    prompt = ChatPromptTemplate.from_template(
        """从以下Agent输出中提取决策理由（为什么选择这个工具/这个参数）：

        Agent输出：&#123;output&#125;

        决策理由（一句话）："""
    )
    chain = prompt | llm | StrOutputParser()
    return chain.invoke(&#123;"output": llm_output[:500]&#125;)
```

## 六、可解释性检查

| 检查项 | 说明 | 实现方式 |
|--------|------|---------|
| 工具调用记录 | 调用了什么工具 | Callback |
| 参数记录 | 传了什么参数 | Callback |
| 结果记录 | 工具返回了什么 | Callback |
| 决策理由 | 为什么选这个工具 | Prompt要求 |
| 耗时记录 | 每步多久 | Callback计时 |
| Token记录 | 每步消耗多少 | usage_metadata |
| 错误记录 | 哪步出错 | ErrorCallback |
