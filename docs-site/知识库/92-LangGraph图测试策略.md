# LangGraph 图测试策略

> LangGraph 工作流是复杂的状态机。本指南覆盖图的单元测试、状态测试和集成测试方法。

---

## 一、为什么需要测试图

```mermaid
graph TB
    subgraph 不测试 &#123;"❌ 不测试"&#125;
        N1["改一个条件边"] --> N2["其他路径可能受影响"]
        N2 --> N3["上线后才发现"]
    end

    subgraph 有测试 &#123;"✅ 有测试"&#125;
        T1["改条件边"] --> T2["测试自动运行"]
        T2 --> T3["受影响的路径立即报错"]
        T3 --> T4["修复后再上线"]
    end

    style 不测试 fill:'#FFCDD2'
    style 有测试 fill:'#C8E6C9'
```

## 二、测试分层

```mermaid
graph TB
    subgraph 测试分层 &#123;"LangGraph 测试三层"&#125;
        L1["Layer 1: 节点单元测试<br/>测试单个节点函数<br/>Mock LLM"]
        L2["Layer 2: 路由测试<br/>测试条件边的路由逻辑<br/>验证State变化"]
        L3["Layer 3: 端到端测试<br/>测试完整工作流<br/>可选真实LLM"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L3 fill:'#F3E5F5'
```

## 三、Layer 1: 节点单元测试

```python
import pytest
from unittest.mock import MagicMock, patch

class TestNodes:
    """节点单元测试"""

    def test_retrieve_node(self):
        """测试检索节点"""
        # Mock向量库
        mock_vectorstore = MagicMock()
        mock_vectorstore.similarity_search.return_value = [
            MagicMock(page_content="LangChain是框架", metadata=&#123;"source": "test"&#125;)
        ]

        state = &#123;"question": "什么是LangChain", "context": ""&#125;
        result = retrieve_node(state, mock_vectorstore)

        assert "LangChain" in result["context"]
        assert result["context"] != ""

    def test_answer_node_with_mock_llm(self):
        """测试回答节点（Mock LLM）"""
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(content="LangChain是LLM应用框架")

        state = &#123;
            "question": "什么是LangChain",
            "context": "LangChain是框架",
        &#125;
        result = answer_node(state, mock_llm)

        assert "框架" in result["answer"]
        mock_llm.invoke.assert_called_once()

    def test_error_handling_node(self):
        """测试错误处理节点"""
        state = &#123;"error": "API超时", "answer": ""&#125;
        result = error_handler_node(state)
        assert "暂时不可用" in result["answer"] or "重试" in result["answer"]
```

## 四、Layer 2: 路由测试

```python
class TestRouting:
    """路由逻辑测试"""

    def test_route_by_type_tech(self):
        """测试技术问题路由"""
        state = &#123;"query_type": "tech"&#125;
        assert route_by_type(state) == "tech_agent"

    def test_route_by_type_order(self):
        """测试订单问题路由"""
        state = &#123;"query_type": "order"&#125;
        assert route_by_type(state) == "order_agent"

    def test_route_by_type_default(self):
        """测试默认路由"""
        state = &#123;"query_type": "unknown"&#125;
        assert route_by_type(state) == "chat_agent"

    def test_should_retry_within_limit(self):
        """测试重试逻辑（未超限）"""
        state = &#123;"review": "FAIL", "retry_count": 2&#125;
        assert should_retry(state) == "retry"

    def test_should_retry_exceed_limit(self):
        """测试重试逻辑（超限）"""
        state = &#123;"review": "FAIL", "retry_count": 3&#125;
        assert should_retry(state) == "done"

    def test_should_retry_pass(self):
        """测试审查通过"""
        state = &#123;"review": "PASS", "retry_count": 1&#125;
        assert should_retry(state) == "done"
```

## 五、Layer 3: 端到端测试

```python
class TestGraphE2E:
    """端到端测试（可选真实LLM）"""

    @pytest.fixture(scope="class")
    def app(self):
        """编译图"""
        from langgraph.graph import StateGraph, START, END
        graph = StateGraph(TestState)
        graph.add_node("classify", classify_node)
        graph.add_node("answer", answer_node)
        graph.add_edge(START, "classify")
        graph.add_edge("classify", "answer")
        graph.add_edge("answer", END)
        return graph.compile()

    def test_simple_qa(self, app):
        """测试简单问答"""
        result = app.invoke(&#123;
            "question": "你好",
            "query_type": "",
            "answer": "",
        &#125;)
        assert result["query_type"] in ["chat", "tech", "order"]
        assert len(result["answer"]) > 5

    def test_state_completeness(self, app):
        """测试State完整性"""
        result = app.invoke(&#123;
            "question": "测试",
            "query_type": "",
            "answer": "",
        &#125;)
        # 所有字段都应有值
        assert result["question"]
        assert result["query_type"]
        assert result["answer"]

    def test_no_infinite_loop(self, app):
        """测试不会无限循环"""
        result = app.invoke(&#123;
            "question": "测试",
            "query_type": "",
            "answer": "",
        &#125;)
        # 确保有结果返回（没有卡死）
        assert result is not None
```

## 六、State 断言模式

```python
class TestStateAssertions:
    """State 变化断言"""

    def test_messages_accumulate(self, app):
        """测试消息累积"""
        result = app.invoke(&#123;
            "messages": [HumanMessage(content="你好")],
            "answer": "",
        &#125;)
        # 消息应该增加了（AI回复追加）
        assert len(result["messages"]) > 1

    def test_retry_count_increments(self):
        """测试重试计数器"""
        state = &#123;"retry_count": 0, "review": "FAIL"&#125;
        result = generate_node(state)
        assert result["retry_count"] == 1

    def test_error_clears_on_success(self):
        """测试成功后清除错误"""
        state = &#123;"error": "旧错误", "answer": "新回答"&#125;
        result = answer_node(state)
        assert result.get("error", "") == ""
```

## 七、测试策略选择

```mermaid
graph TD
    Q&#123;"测试什么?"&#125;
    Q -->|"单节点逻辑"| UNIT["✅ 节点单元测试<br/>Mock LLM"]
    Q -->|"路由判断"| ROUTE["✅ 路由测试<br/>检查返回值"]
    Q -->|"完整流程"| E2E["✅ 端到端测试<br/>真实LLM（成本高）"]
    Q -->|"State变化"| STATE["✅ State断言<br/>检查字段值"]

    style UNIT fill:'#C8E6C9'
    style E2E fill:'#F3E5F5'
```

## 八、CI 集成

```python
# tests/conftest.py
import pytest

def pytest_collection_modifyitems(config, items):
    """自动标记：不需要LLM的标记unit，需要的标记llm"""
    for item in items:
        if "e2e" in item.nodeid.lower() or "llm" in item.nodeid.lower():
            item.add_marker(pytest.mark.llm)
        else:
            item.add_marker(pytest.mark.unit)

# pytest.ini
# [pytest]
# markers =
#     unit: 不需要LLM的单元测试
#     llm: 需要LLM的端到端测试
```

```bash
# CI中分层运行
pytest tests/test_nodes.py tests/test_routing.py -m unit  # 快，不消耗Token
pytest tests/test_graph_e2e.py -m llm  # 慢，消耗Token
```

## 九、检查清单

| 测试类型 | 覆盖什么 | 需要 LLM | 频率 |
|---------|---------|---------|------|
| 节点单元 | 每个节点函数 | 否(Mock) | 每次提交 |
| 路由测试 | 条件边返回值 | 否 | 每次提交 |
| State断言 | 字段值变化 | 否(Mock) | 每次提交 |
| 端到端 | 完整流程 | 是 | 每次PR |
| 异常测试 | 错误处理路径 | 否(Mock) | 每次提交 |
