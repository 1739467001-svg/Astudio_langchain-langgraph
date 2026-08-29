# Agent 测试自动化与 CI 集成

> Agent 不是传统软件——它的行为不确定，输入相同输出可能不同。这让测试变得困难但更重要。这份指南覆盖 Agent 测试策略、自动化测试框架和 CI/CD 集成，确保每次修改不引入退化。

---

## 一、Agent 测试的挑战

```mermaid
graph TB
    subgraph 传统软件 {"传统软件测试"}
        T1["输入固定→输出固定"] --> T2["断言精确值"]
        T2 --> T3["✅ 测试可靠"]
    end

    subgraph Agent测试 {"Agent测试挑战"}
        A1["输入固定→输出不固定"] --> A2["无法精确断言"]
        A2 --> A3["需要语义断言"]
        A1 --> A4["涉及LLM调用"] --> A5["慢且贵"]
        A5 --> A6["需要mock+真实混合"]
    end

    style 传统软件 fill:#C8E6C9
    style Agent测试 fill:#FFCDD2
```

---

## 二、测试金字塔

```mermaid
graph TB
    subgraph 金字塔 {"Agent测试金字塔"}
        TOP["顶端: 端到端测试 10%<br/>完整Agent流程<br/>真实LLM<br/>慢但全面"]
        MID["中间: 集成测试 30%<br/>多节点组合<br/>mock LLM<br/>中等速度"]
        BASE["底层: 单元测试 60%<br/>单个节点/函数<br/>全部mock<br/>快速"]
    end

    style TOP fill:#FFCDD2
    style MID fill:#FFF9C4
    style BASE fill:#C8E6C9
```

---

## 三、单元测试：节点级

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

# 测试单个节点的逻辑（mock LLM）

class TestRetrievalNode:
    """检索节点单元测试。"""

    @pytest.mark.asyncio
    async def test_retrieve_returns_documents(self):
        """测试检索节点返回文档。"""
        from langchain_core.documents import Document

        # Mock向量库
        mock_vectorstore = MagicMock()
        mock_vectorstore.asimilarity_search = AsyncMock(return_value=[
            Document(page_content="测试文档1"),
            Document(page_content="测试文档2"),
        ])

        state = {"question": "测试问题", "documents": []}

        # 调用节点
        from my_app.nodes import retrieve_node
        result = await retrieve_node(state, mock_vectorstore)

        assert "documents" in result
        assert len(result["documents"]) == 2

    @pytest.mark.asyncio
    async def test_retrieve_empty_results(self):
        """测试无检索结果的情况。"""
        mock_vectorstore = MagicMock()
        mock_vectorstore.asimilarity_search = AsyncMock(return_value=[])

        state = {"question": "无结果查询", "documents": []}

        result = await retrieve_node(state, mock_vectorstore)

        assert result["documents"] == []

    @pytest.mark.asyncio
    async def test_retrieve_passes_question_to_vectorstore(self):
        """测试查询正确传递给向量库。"""
        mock_vectorstore = MagicMock()
        mock_vectorstore.asimilarity_search = AsyncMock(return_value=[])

        state = {"question": "特定查询", "documents": []}

        await retrieve_node(state, mock_vectorstore)

        # 验证向量库收到正确的查询
        mock_vectorstore.asimilarity_search.assert_called_once_with("特定查询", k=3)
```

---

## 四、集成测试：多节点组合

```python
import pytest
from unittest.mock import AsyncMock, patch

class TestRAGPipeline:
    """RAG管线集成测试：检索+生成。"""

    @pytest.mark.asyncio
    async def test_retrieve_then_generate(self):
        """测试检索后生成的完整流程。"""
        from langchain_core.documents import Document

        # Mock向量库
        mock_vectorstore = MagicMock()
        mock_vectorstore.asimilarity_search = AsyncMock(return_value=[
            Document(page_content="RAG是检索增强生成"),
        ])

        # Mock LLM
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content="RAG通过检索外部知识增强LLM回答。"
        ))

        # 构建管线（用mock组件）
        from my_app.graph import build_rag_pipeline
        app = build_rag_pipeline(mock_vectorstore, mock_llm)

        # 执行
        result = await app.ainvoke({"question": "什么是RAG？"})

        # 语义断言（不精确匹配）
        assert "RAG" in result["answer"]
        assert "检索" in result["answer"] or "增强" in result["answer"]

    @pytest.mark.asyncio
    async def test_no_documents_fallback(self):
        """测试无检索结果时的降级处理。"""
        mock_vectorstore = MagicMock()
        mock_vectorstore.asimilarity_search = AsyncMock(return_value=[])

        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(
            content="抱歉，我没有找到相关信息。"
        ))

        app = build_rag_pipeline(mock_vectorstore, mock_llm)
        result = await app.ainvoke({"question": "未知问题"})

        assert "没有找到" in result["answer"] or "不知道" in result["answer"]
```

---

## 五、端到端测试：真实 LLM

```python
import pytest

class TestEndToEnd:
    """端到端测试：真实LLM调用。

    注意：
    - 慢（每次几秒）
    - 贵（消耗Token）
    - 语义断言（不精确匹配）
    - 标记为slow，CI中可选跳过
    """

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.requires_api
    async def test_simple_qa(self):
        """简单问答端到端。"""
        from my_app.graph import build_rag_pipeline
        from langchain_openai import ChatOpenAI

        app = build_rag_pipeline(
            vectorstore,  # 真实向量库
            ChatOpenAI(model="gpt-4o-mini"),  # 真实但便宜的模型
        )

        result = await app.ainvoke({"question": "什么是LangChain？"})

        # 语义断言
        assert len(result["answer"]) > 20  # 有实质内容
        assert any(w in result["answer"] for w in ["LangChain", "框架", "LLM"])

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_agent_tool_calling(self):
        """Agent工具调用端到端。"""
        from langgraph.prebuilt import create_react_agent
        from langchain_openai import ChatOpenAI
        from langchain_core.tools import tool

        @tool
        def calculate(expression: str) -> str:
            """计算数学表达式"""
            return str(eval(expression))

        agent = create_react_agent(
            ChatOpenAI(model="gpt-4o-mini"),
            [calculate],
        )

        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": "2+3等于多少？"}]
        })

        last_msg = result["messages"][-1].content
        assert "5" in last_msg
```

---

## 六、语义断言

```python
class SemanticAssertions:
    """语义断言：不精确匹配但验证语义正确。"""

    @staticmethod
    def assert_contains_any(text: str, keywords: list[str]):
        """断言文本包含至少一个关键词。"""
        assert any(kw in text for kw in keywords), \
            f"文本应包含以下任一关键词: {keywords}，实际: {text[:100]}"

    @staticmethod
    def assert_length_range(text: str, min_len: int, max_len: int):
        """断言文本长度在范围内。"""
        assert min_len <= len(text) <= max_len, \
            f"文本长度应在{min_len}-{max_len}之间，实际: {len(text)}"

    @staticmethod
    def assert_not_contains(text: str, forbidden: list[str]):
        """断言文本不包含禁止内容。"""
        for word in forbidden:
            assert word not in text, f"文本不应包含'{word}'"

    @staticmethod
    async def assert_llm_judge(
        llm,
        question: str,
        answer: str,
        criteria: str = "回答是否正确且相关",
    ):
        """用LLM断言答案质量。"""
        from langchain_core.messages import HumanMessage

        prompt = f"""判断以下回答是否满足要求。

问题: {question}
回答: {answer[:500]}
要求: {criteria}

只回答"通过"或"不通过":"""""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        assert "通过" in response.content[:5], \
            f"LLM判定不通过: {response.content}"
```

---

## 七、CI/CD 集成

```mermaid
graph TB
    subgraph CI {"CI/CD中的Agent测试"}
        DEV["开发者提交"] --> LINT["代码检查"]
        LINT --> UNIT["单元测试<br/>全mock<br/>快速<br/>100%运行"]
        UNIT --> INTEG["集成测试<br/>mock LLM<br/>中等速度<br/>100%运行"]
        INTEG --> E2E{"端到端测试<br/>真实LLM<br/>慢<br/>选择性运行"}
        E2E -->|PR检查| E2E_RUN["运行子集<br/>5条核心用例"]
        E2E -->|每日| E2E_FULL["运行全集<br/>定时任务"]
        E2E_RUN & E2E_FULL --> REPORT["测试报告"]
        REPORT --> MERGE{"通过？"}
        MERGE -->|是| DEPLOY["部署"]
        MERGE -->|否| BLOCK["阻止合并"]
    end

    style UNIT fill:#C8E6C9
    style E2E fill:#FFF9C4
    style BLOCK fill:#FFCDD2
    style DEPLOY fill:#C8E6C9
```

### 7.1 pytest 配置

```ini
# pytest.ini
[pytest]
markers =
    slow: 慢速测试（端到端，真实LLM）
    requires_api: 需要API Key
    integration: 集成测试
    unit: 单元测试

# 默认不运行slow测试
addopts = -m "not slow"
```

### 7.2 GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Agent Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt pytest pytest-asyncio
      - name: 单元测试（快速，全mock）
        run: pytest tests/unit/ -v --tb=short

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt pytest pytest-asyncio
      - name: 集成测试（mock LLM）
        run: pytest tests/integration/ -v --tb=short

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt pytest pytest-asyncio
      - name: 端到端测试（真实LLM，子集）
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: pytest tests/e2e/ -v -m "slow" --tb=short -k "core"

  nightly-full-e2e:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 2 * * *'  # 每天凌晨2点
    steps:
      - uses: actions/checkout@v4
      - name: 完整端到端测试
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: pytest tests/e2e/ -v -m "slow" --tb=short
```

---

## 八、回归测试基线

```python
class AgentRegressionTest:
    """Agent回归测试：对比基线防止退化。"""

    def __init__(self, baseline_path: str = "test_baseline.json"):
        import json
        from pathlib import Path
        self.path = Path(baseline_path)
        self.baseline = json.loads(self.path.read_text()) if self.path.exists() else {}

    def save_result(self, test_name: str, passed: bool, answer: str):
        """保存测试结果到基线。"""
        self.baseline[test_name] = {
            "passed": passed,
            "answer_preview": answer[:200],
        }
        self.path.write_text(json.dumps(self.baseline, indent=2, ensure_ascii=False))

    def compare(self, test_name: str, current_passed: bool) -> dict:
        """对比当前结果与基线。"""
        baseline = self.baseline.get(test_name, {})
        was_passing = baseline.get("passed", False)

        regression = was_passing and not current_passed  # 退化
        improvement = not was_passing and current_passed  # 改进

        return {
            "test": test_name,
            "baseline_passed": was_passing,
            "current_passed": current_passed,
            "is_regression": regression,
            "is_improvement": improvement,
            "should_block": regression,
        }
```

---

## 九、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 单元测试全mock | 快速可靠，不依赖LLM | ★★★ |
| E2E用便宜模型 | gpt-4o-mini足够测试 | ★★★ |
| E2E选择性运行 | PR跑子集，夜间跑全集 | ★★★ |
| 语义断言 | 不精确匹配但验证语义 | ★★★ |
| 回归基线 | 防止修改引入退化 | ★★☆ |
| 测试集分层 | 单元60%/集成30%/E2E10% | ★★☆ |
| 标记分类测试 | @slow @requires_api | ★★☆ |

---

## 十、检查清单

| 检查项 | 状态 |
|--------|------|
| 有单元测试（全mock） | ☐ |
| 有集成测试（mock LLM） | ☐ |
| 有端到端测试（真实LLM） | ☐ |
| 有语义断言工具 | ☐ |
| CI中分层运行测试 | ☐ |
| E2E选择性运行 | ☐ |
| 有回归测试基线 | ☐ |
| 有夜间完整测试 | ☐ |
