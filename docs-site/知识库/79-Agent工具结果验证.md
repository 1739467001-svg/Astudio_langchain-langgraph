# Agent 工具结果验证

> Agent 调用工具后，结果一定是可靠的吗？不验证的工具结果可能导致错误连锁。

---

## 一、工具结果的风险

```mermaid
graph TB
    subgraph 风险 &#123;"未验证的工具结果风险"&#125;
        R1["工具返回空值<br/>→ Agent基于空值回答"]
        R2["工具返回错误<br/>→ Agent基于错误信息回答"]
        R3["工具返回超大文本<br/>→ Agent上下文溢出"]
        R4["工具返回不一致<br/>→ 同一查询不同结果"]
    end

    style 风险 fill:'#FFCDD2'
```

## 二、验证策略

```mermaid
graph TB
    subgraph 三层验证 &#123;"工具结果三层验证"&#125;
        L1["Layer 1: 格式验证<br/>结果类型/长度/结构"]
        L2["Layer 2: 内容验证<br/>非空/有效值/无异常"]
        L3["Layer 3: 语义验证<br/>与问题相关/合理"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L3 fill:'#F3E5F5'
```

## 三、实现

### 3.1 格式验证

```python
def validate_tool_output(output: str, max_length: int = 5000) -> tuple[str, bool, str]:
    """格式验证"""
    # 空值检查
    if not output or not output.strip():
        return "工具返回空值", False, "empty_result"

    # 长度检查
    if len(output) > max_length:
        truncated = output[:max_length] + "...[截断]"
        return truncated, True, "truncated"

    # 类型检查
    if not isinstance(output, str):
        return str(output), True, "type_converted"

    return output, True, "valid"
```

### 3.2 内容验证

```python
def validate_content(output: str, expected_patterns: list = None) -> tuple[bool, str]:
    """内容验证"""
    # 异常标记检查
    error_indicators = ["error", "failed", "exception", "null", "undefined", "None"]
    for indicator in error_indicators:
        if indicator.lower() in output.lower()[:100]:
            return False, f"可能包含错误: &#123;indicator&#125;"

    # 期望模式检查
    if expected_patterns:
        for pattern in expected_patterns:
            if pattern.lower() not in output.lower():
                return False, f"缺少期望内容: &#123;pattern&#125;"

    return True, "valid"
```

### 3.3 语义验证（用LLM）

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def validate_semantics(question: str, tool_output: str) -> tuple[bool, str]:
    """语义验证：工具结果是否与问题相关"""
    prompt = ChatPromptTemplate.from_template(
        """判断工具结果是否与用户问题相关。

        用户问题：&#123;question&#125;
        工具结果：&#123;output&#125;

        相关性（1=相关，0=不相关）+ 原因：
        """
    )
    chain = prompt | llm
    result = chain.invoke(&#123;"question": question, "output": tool_output[:500]&#125;)
    is_relevant = "1" in result.content[:5]
    return is_relevant, result.content
```

## 四、完整验证管线

```python
def validated_tool_call(tool, tool_input: str, question: str) -> dict:
    """带验证的工具调用"""
    # 执行工具
    try:
        raw_output = tool.invoke(tool_input)
    except Exception as e:
        return &#123;"success": False, "error": str(e), "output": "", "stage": "execution"&#125;

    # Layer 1: 格式验证
    output, fmt_ok, fmt_msg = validate_tool_output(raw_output)
    if not fmt_ok:
        return &#123;"success": False, "error": fmt_msg, "output": output, "stage": "format"&#125;

    # Layer 2: 内容验证
    content_ok, content_msg = validate_content(output)
    if not content_ok:
        return &#123;"success": False, "error": content_msg, "output": output, "stage": "content"&#125;

    # Layer 3: 语义验证（可选，因为消耗LLM调用）
    # semantic_ok, semantic_msg = validate_semantics(question, output)
    # if not semantic_ok:
    #     return &#123;"success": False, "error": semantic_msg, "output": output, "stage": "semantic"&#125;

    return &#123;"success": True, "output": output, "stage": "passed"&#125;
```

## 五、验证策略选择

| 场景 | 验证层级 | 原因 |
|------|---------|------|
| 内部工具 | 格式+内容 | 内部工具可信 |
| 外部API | 全部三层 | 外部不可控 |
| 搜索结果 | 格式+内容 | 搜索结果质量波动大 |
| 数据库查询 | 格式 | SQL结果可信 |
| LLM生成结果 | 语义 | 检查幻觉 |
