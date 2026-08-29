# Agent 自愈与自动恢复

> Agent 出错后能否自己修好？自愈机制让 Agent 在遇到问题时自动调整、恢复和继续。

---

## 一、自愈的价值

```mermaid
graph TB
    subgraph 无自愈 &#123;"❌ 无自愈"&#125;
        E1["Agent出错"] --> E2["崩溃/返回错误"]
        E2 --> E3["用户需手动重试"]
    end

    subgraph 有自愈 &#123;"✅ 有自愈"&#125;
        S1["Agent出错"] --> S2["检测到异常"]
        S2 --> S3["自动调整策略"]
        S3 --> S4["重试/降级/换路径"]
        S4 --> S5["恢复并继续 ✅"]
    end

    style 无自愈 fill:'#FFCDD2'
    style 有自愈 fill:'#C8E6C9'
```

## 二、自愈的四种模式

```mermaid
graph TB
    subgraph 四种模式 &#123;"Agent 自愈四种模式"&#125;
        M1["1.重试自愈<br/>失败后自动重试<br/>(指数退避)"]
        M2["2.降级自愈<br/>换更简单的方案<br/>(Agent→Chain/大模型→小模型)"]
        M3["3.换路径自愈<br/>换一条路由<br/>(工具A失败→工具B)"]
        M4["4.状态修复自愈<br/>修复损坏的State<br/>(截断/重置/回滚)"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#FFF9C4'
    style M4 fill:'#F3E5F5'
```

## 三、实现

### 3.1 重试自愈

```python
import time
from functools import wraps

def retry_heal(max_retries=3, base_delay=1):
    """重试自愈装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    delay = base_delay * (2 ** attempt)
                    print(f"⚠️ 第&#123;attempt+1&#125;次失败: &#123;e&#125;，&#123;delay&#125;秒后自愈重试...")
                    time.sleep(delay)
            # 最后一次也失败，返回友好错误
            print(f"❌ 自愈失败，已达最大重试次数")
            return &#123;"error": str(last_error), "self_healed": False&#125;
        return wrapper
    return decorator

@retry_heal(max_retries=3)
def call_llm(prompt):
    """带自愈的LLM调用"""
    return llm.invoke(prompt)
```

### 3.2 降级自愈

```python
def degrade_heal(func, fallback_func, error_types=(Exception,)):
    """降级自愈：主方案失败时自动切换到降级方案"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except error_types as e:
            print(f"⚠️ 主方案失败(&#123;e&#125;)，自愈：降级到简单方案")
            try:
                return fallback_func(*args, **kwargs)
            except Exception as e2:
                print(f"❌ 降级方案也失败: &#123;e2&#125;")
                return &#123;"error": "所有方案均失败", "self_healed": False&#125;
    return wrapper

# 使用：Agent失败时降级为简单Chain
def agent_answer(question):
    """Agent方式（复杂，可能失败）"""
    return agent_executor.invoke(&#123;"input": question&#125;)

def chain_answer(question):
    """Chain方式（简单，更可靠）"""
    return (prompt | llm).invoke(&#123;"input": question&#125;)

# 自愈版本：Agent失败→自动降级到Chain
healed_answer = degrade_heal(agent_answer, chain_answer)
```

### 3.3 换路径自愈

```python
def route_heal(primary_tool, fallback_tool):
    """换路径自愈：主工具失败时换备用工具"""
    def wrapper(*args, **kwargs):
        try:
            result = primary_tool.invoke(*args, **kwargs)
            if not result or len(str(result)) < 5:
                raise ValueError("工具返回空结果")
            return result
        except Exception as e:
            print(f"⚠️ 主工具失败(&#123;e&#125;)，自愈：换备用工具")
            return fallback_tool.invoke(*args, **kwargs)
    return wrapper

# 搜索工具失败→换另一个搜索工具
healed_search = route_heal(tavily_search, duckduckgo_search)
```

### 3.4 状态修复自愈

```python
def state_heal(state: dict, max_messages: int = 50) -> dict:
    """状态修复自愈：检测并修复损坏的State"""
    healed = state.copy()

    # 修复1: 消息列表过长
    if "messages" in healed and len(healed["messages"]) > max_messages:
        healed["messages"] = healed["messages"][-max_messages:]
        print(f"⚠️ 自愈：截断消息列表 &#123;len(state['messages'])&#125;→&#123;max_messages&#125;")

    # 修复2: 空值字段
    for key in ["question", "answer"]:
        if key in healed and not healed[key]:
            healed[key] = ""
            print(f"⚠️ 自愈：修复空值字段 &#123;key&#125;")

    # 修复3: 类型错误
    if "retry_count" in healed and not isinstance(healed["retry_count"], int):
        healed["retry_count"] = 0
        print(f"⚠️ 自愈：重置retry_count")

    return healed
```

## 四、LangGraph 中的自愈节点

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class HealableState(TypedDict):
    question: str
    answer: str
    error: str
    retry_count: int
    healed: bool

def process_with_heal(state: HealableState) -> dict:
    """带自愈的处理节点"""
    try:
        # 先修复State
        state = state_heal(state)

        # 正常处理
        answer = llm.invoke(state["question"]).content
        return &#123;"answer": answer, "error": "", "healed": True&#125;

    except Exception as e:
        return &#123;"error": str(e), "retry_count": state.get("retry_count", 0) + 1&#125;

def heal_check(state: HealableState) -> str:
    """自愈路由：有错误→重试/降级；无错误→完成"""
    if state.get("error"):
        if state.get("retry_count", 0) >= 3:
            return "fallback"
        return "retry"
    return "done"

def fallback_node(state: HealableState) -> dict:
    """降级节点"""
    return &#123;"answer": "抱歉，处理遇到困难。请尝试换一种问法。", "error": "", "healed": True&#125;

# 构建自愈图
graph = StateGraph(HealableState)
graph.add_node("process", process_with_heal)
graph.add_node("fallback", fallback_node)
graph.add_edge(START, "process")
graph.add_conditional_edges("process", heal_check, &#123;
    "retry": "process",     # 重试自愈
    "fallback": "fallback", # 降级自愈
    "done": END,
&#125;)
graph.add_edge("fallback", END)
app = graph.compile()
```

## 五、自愈决策

```mermaid
graph TD
    Q&#123;"错误类型?"&#125;
    Q -->|"临时性(超时/限流)"| R["✅ 重试自愈"]
    Q -->|"方法失败(工具不可用)"| D["✅ 降级/换路径"]
    Q -->|"State损坏(数据异常)"| S["✅ 状态修复"]
    Q -->|"永久性(认证失败)"| F["❌ 无法自愈→报错"]

    style R fill:'#C8E6C9'
    style D fill:'#E3F2FD'
    style F fill:'#FFCDD2'
```

## 六、自愈检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 重试机制 | 临时错误自动重试 | ☐ |
| 降级方案 | 主方案失败有备用 | ☐ |
| 工具备用 | 主工具有备用工具 | ☐ |
| State修复 | 检测并修复异常State | ☐ |
| 自愈记录 | 记录每次自愈事件 | ☐ |
| 自愈上限 | 防止无限自愈循环 | ☐ |
