# Agent 边界与异常输入处理

> 用户会输入各种奇怪的东西：空文本、超长文本、代码注入、非预期语言。Agent 需要优雅处理。

---

## 一、边界情况分类

```mermaid
graph TB
    subgraph 边界 {"Agent需要处理的边界情况"}
        B1["空输入<br/>('' 或纯空格)"]
        B2["超长输入<br/>(>5000字)"]
        B3["纯符号/乱码<br/>(无意义内容)"]
        B4["非预期语言<br/>(英文输入到中文Agent)"]
        B5["代码/HTML注入<br/>(<script>或代码)"]
        B6["重复提问<br/>(连续10次相同问题)"]
        B7["矛盾输入<br/>('既是对的不对')"]
        B8["超范围请求<br/>(让客服Agent写代码)"]
    end

    style 边界 fill:'#E3F2FD'
```

## 二、处理策略

### 2.1 输入验证层

```python
import re

class InputValidator:
    """输入验证器：在进入Agent前拦截异常输入"""

    @staticmethod
    def validate(text: str) -> tuple[str, bool, str]:
        """返回(处理后文本, 是否通过, 原因)"""
        # 1. 空输入
        if not text or not text.strip():
            return "", False, "输入为空，请输入您的问题"

        text = text.strip()

        # 2. 超长输入
        if len(text) > 5000:
            return text[:5000] + "...[输入过长，已截断]", True, "truncated"

        # 3. 纯符号/无意义内容
        if re.match(r'^[^\w\u4e00-\u9fff]+$', text):
            return "", False, "输入似乎不包含有效内容，请输入文字"

        # 4. HTML/代码注入
        if re.search(r'<script|<iframe|javascript:', text, re.IGNORECASE):
            return "", False, "输入包含潜在危险的代码"

        # 5. 重复字符（如"啊啊啊啊啊啊啊啊啊啊啊啊"）
        if len(set(text)) <= 2 and len(text) > 10:
            return "", False, "输入似乎不完整，请详细描述您的问题"

        return text, True, "valid"

# 使用
validator = InputValidator()
text, ok, reason = validator.validate("你好")
# ("你好", True, "valid")

text, ok, reason = validator.validate("")
# ("", False, "输入为空...")

text, ok, reason = validator.validate("啊啊啊啊啊啊啊啊啊啊啊啊")
# ("", False, "输入似乎不完整...")
```

### 2.2 重复提问检测

```python
from collections import deque

class RepetitionDetector:
    """重复提问检测器"""
    def __init__(self, window_size: int = 5, max_repeats: int = 3):
        self.history = deque(maxlen=window_size)
        self.max_repeats = max_repeats

    def check(self, question: str) -> tuple[bool, str]:
        """检查是否重复提问"""
        count = sum(1 for h in self.history if h == question)
        if count >= self.max_repeats:
            return True, f"您已连续问了{count}次相同问题，建议换一种问法或联系人工"
        self.history.append(question)
        return False, ""
```

### 2.3 超范围请求处理

```python
def handle_out_of_scope(question: str, llm) -> str:
    """检测并处理超范围请求"""
    prompt = ChatPromptTemplate.from_template(
        """判断以下问题是否属于客服范围（产品/订单/售后），只返回YES或NO：
        问题：{question}
        判断："""
    )
    chain = prompt | llm
    result = chain.invoke({"question": question}).content.strip().upper()

    if "NO" in result:
        return ("抱歉，这个问题超出了我的服务范围。我可以帮您处理产品咨询、订单查询和售后服务。"
                "如果您有其他问题，建议联系相关部门。")
    return None  # 在范围内，正常处理
```

## 三、LangGraph 中的边界处理

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class BoundaryState(TypedDict):
    user_input: str
    valid: bool
    error: str
    answer: str

def validate_node(state: BoundaryState) -> dict:
    """验证输入"""
    text, ok, reason = InputValidator.validate(state["user_input"])
    return {"user_input": text, "valid": ok, "error": reason if not ok else ""}

def route_valid(state: BoundaryState) -> str:
    return "process" if state.get("valid") else "reject"

def process_node(state: BoundaryState) -> dict:
    """正常处理"""
    answer = llm.invoke(state["user_input"]).content
    return {"answer": answer}

def reject_node(state: BoundaryState) -> dict:
    """拒绝处理"""
    return {"answer": f"⚠️ {state.get('error', '输入异常')} 请重新输入。"}

# 构建图
graph = StateGraph(BoundaryState)
graph.add_node("validate", validate_node)
graph.add_node("process", process_node)
graph.add_node("reject", reject_node)
graph.add_edge(START, "validate")
graph.add_conditional_edges("validate", route_valid, {
    "process": "process",
    "reject": "reject",
})
graph.add_edge("process", END)
graph.add_edge("reject", END)
app = graph.compile()
```

## 四、边界处理检查表

| 边界情况 | 处理方式 | 用户看到 |
|---------|---------|---------|
| 空输入 | 拦截 | "请输入问题" |
| 超长输入 | 截断+提示 | "已截断" |
| 纯符号 | 拦截 | "请输入有效内容" |
| 代码注入 | 拦截 | "输入含危险代码" |
| 重复提问 | 提示 | "已问过多次，换种问法" |
| 超范围 | 引导 | "超出服务范围" |
| 矛盾输入 | 正常处理 | LLM自行判断 |
