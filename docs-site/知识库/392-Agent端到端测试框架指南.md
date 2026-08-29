# Agent 端到端测试框架指南

> 单元测试只验证单个函数，但 Agent 的价值在端到端流程——从用户输入到最终输出。这篇指南讲透端到端测试设计、模拟数据管理、断言策略和 CI 集成。

---

## 一、端到端测试架构

```mermaid
graph TB
    SUITE["测试套件"] --> SETUP["环境准备<br/>Mock LLM+Mock工具"]
    SETUP --> CASE1["用例1: 简单问答"]
    SETUP --> CASE2["用例2: 多步推理"]
    SETUP --> CASE3["用例3: 工具调用"]
    SETUP --> CASE4["用例4: 边界处理"]

    CASE1 & CASE2 & CASE3 & CASE4 --> RUN["执行Agent"]
    RUN --> ASSERT&#123;"断言检查"&#125;
    ASSERT -->|通过| PASS["✅ 通过"]
    ASSERT -->|失败| FAIL["❌ 失败+记录"]
    PASS & FAIL --> REPORT["测试报告"]
    REPORT --> CI&#123;"CI/CD门禁"&#125;
    CI -->|全通过| DEPLOY["允许部署"]
    CI -->|有失败| BLOCK["阻止部署"]

    style ASSERT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style PASS fill:#C8E6C9
    style FAIL fill:#FFCDD2
```

---

## 二、测试框架实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Callable, Awaitable
import asyncio
import json
from collections import defaultdict

class TestCategory(str, Enum):
    SIMPLE_QA = "simple_qa"           # 简单问答
    MULTI_STEP = "multi_step"          # 多步推理
    TOOL_CALL = "tool_call"            # 工具调用
    EDGE_CASE = "edge_case"           # 边界处理
    ERROR_HANDLING = "error_handling"  # 错误处理
    SAFETY = "safety"                  # 安全测试

class AssertionType(str, Enum):
    CONTAINS = "contains"              # 包含关键词
    NOT_CONTAINS = "not_contains"      # 不包含
    EXACT_MATCH = "exact_match"        # 精确匹配
    SEMANTIC = "semantic"              # 语义匹配（LLM判断）
    TOOL_CALLED = "tool_called"        # 调用了指定工具
    RESPONSE_TIME = "response_time"    # 响应时间
    JSON_VALID = "json_valid"          # JSON格式有效

@dataclass
class Assertion:
    """断言。"""
    assertion_type: AssertionType
    expected: Any
    description: str = ""

@dataclass
class TestCase:
    """测试用例。"""
    test_id: str
    name: str
    category: TestCategory
    input: str
    assertions: list[Assertion] = field(default_factory=list)
    expected_tools: list[str] = field(default_factory=list)
    max_response_time: float = 30.0
    setup_mock: Optional[dict] = None
    tags: list[str] = field(default_factory=list)

@dataclass
class TestResult:
    """测试结果。"""
    test_id: str
    passed: bool
    response: str = ""
    tools_called: list[str] = field(default_factory=list)
    response_time: float = 0.0
    assertion_results: list[dict] = field(default_factory=list)
    error: str = ""

@dataclass
class TestReport:
    """测试报告。"""
    total: int = 0
    passed: int = 0
    failed: int = 0
    results: list[TestResult] = field(default_factory=list)
    duration_seconds: float = 0.0
    category_summary: dict = field(default_factory=dict)

    @property
    def pass_rate(self) -> float:
        return round(self.passed / max(self.total, 1) * 100, 1)

    @property
    def all_passed(self) -> bool:
        return self.failed == 0


from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
import time

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def search(query: str) -> dict:
    """搜索。"""
    return &#123;"results": f"搜索结果: &#123;query&#125;"&#125;

@tool
async def calculate(expression: str) -> dict:
    """计算。"""
    try:
        return &#123;"result": eval(expression)&#125;
    except Exception:
        return &#123;"error": "无效"&#125;


class AgentTestRunner:
    """Agent端到端测试运行器。"""

    def __init__(self, agent, llm=None):
        self.agent = agent
        self.llm = llm or ChatOpenAI(model="gpt-4o-mini", temperature=0)
        self._test_cases: list[TestCase] = []

    def add_case(self, case: TestCase):
        self._test_cases.append(case)

    def load_suite(self, cases: list[TestCase]):
        self._test_cases = cases

    async def run_all(self) -> TestReport:
        """运行所有测试。"""
        report = TestReport(total=len(self._test_cases))
        start = time.monotonic()

        for case in self._test_cases:
            result = await self._run_case(case)
            report.results.append(result)
            report.total += 1
            if result.passed:
                report.passed += 1
            else:
                report.failed += 1

            # 分类统计
            cat = case.category.value
            if cat not in report.category_summary:
                report.category_summary[cat] = &#123;"total": 0, "passed": 0&#125;
            report.category_summary[cat]["total"] += 1
            if result.passed:
                report.category_summary[cat]["passed"] += 1

        report.duration_seconds = round(time.monotonic() - start, 2)
        return report

    async def _run_case(self, case: TestCase) -> TestResult:
        """运行单个用例。"""
        result = TestResult(test_id=case.test_id, passed=True)
        start = time.monotonic()

        try:
            # 执行Agent
            agent_result = await self.agent.ainvoke(&#123;
                "messages": [&#123;"role": "user", "content": case.input&#125;]
            &#125;)
            result.response = agent_result["messages"][-1].content
            result.response_time = round(time.monotonic() - start, 2)

            # 提取调用的工具
            for msg in agent_result.get("messages", []):
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        result.tools_called.append(tc.get("name", ""))

            # 运行断言
            for assertion in case.assertions:
                passed, detail = self._check_assertion(assertion, result, case)
                result.assertion_results.append(&#123;
                    "type": assertion.assertion_type.value,
                    "passed": passed,
                    "detail": detail,
                &#125;)
                if not passed:
                    result.passed = False

            # 检查响应时间
            if result.response_time > case.max_response_time:
                result.passed = False
                result.assertion_results.append(&#123;
                    "type": "response_time",
                    "passed": False,
                    "detail": f"超时: &#123;result.response_time&#125;s > &#123;case.max_response_time&#125;s",
                &#125;)

        except Exception as e:
            result.passed = False
            result.error = str(e)[:200]

        return result

    def _check_assertion(self, assertion: Assertion, result: TestResult, case: TestCase) -> tuple[bool, str]:
        """检查断言。"""
        atype = assertion.assertion_type
        expected = assertion.expected

        if atype == AssertionType.CONTAINS:
            passed = expected.lower() in result.response.lower()
            return passed, f"包含'&#123;expected&#125;'" if passed else f"未包含'&#123;expected&#125;'"

        elif atype == AssertionType.NOT_CONTAINS:
            passed = expected.lower() not in result.response.lower()
            return passed, f"不包含'&#123;expected&#125;'" if passed else f"包含禁止词'&#123;expected&#125;'"

        elif atype == AssertionType.EXACT_MATCH:
            passed = result.response.strip() == expected.strip()
            return passed, "精确匹配" if passed else "不匹配"

        elif atype == AssertionType.TOOL_CALLED:
            passed = expected in result.tools_called
            return passed, f"调用了&#123;expected&#125;" if passed else f"未调用&#123;expected&#125;"

        elif atype == AssertionType.JSON_VALID:
            try:
                json.loads(result.response)
                return True, "有效JSON"
            except json.JSONDecodeError:
                return False, "无效JSON"

        return False, "未知断言类型"

    def format_report(self, report: TestReport) -> str:
        """格式化报告。"""
        lines = [
            f"测试报告: &#123;report.passed&#125;/&#123;report.total&#125; 通过 (&#123;report.pass_rate&#125;%)",
            f"耗时: &#123;report.duration_seconds&#125;s",
            f"状态: &#123;'✅ 全部通过' if report.all_passed else '❌ 有失败'&#125;",
            "\n分类统计:",
        ]
        for cat, stats in report.category_summary.items():
            lines.append(f"  &#123;cat&#125;: &#123;stats['passed']&#125;/&#123;stats['total']&#125;")

        if report.failed > 0:
            lines.append("\n失败用例:")
            for r in report.results:
                if not r.passed:
                    lines.append(f"  ❌ &#123;r.test_id&#125;: &#123;r.error or '断言失败'&#125;")
                    for ar in r.assertion_results:
                        if not ar["passed"]:
                            lines.append(f"    - &#123;ar['detail']&#125;")

        return "\n".join(lines)
```

### 使用示例

```python
import asyncio

async def main():
    agent = create_react_agent(llm, [search, calculate], prompt="你是智能助手。")
    runner = AgentTestRunner(agent)

    # 加载测试用例
    runner.load_suite([
        TestCase(
            test_id="tc-001", name="简单问答", category=TestCategory.SIMPLE_QA,
            input="什么是Python？",
            assertions=[
                Assertion(AssertionType.CONTAINS, "编程", "回答应包含'编程'"),
                Assertion(AssertionType.NOT_CONTAINS, "不知道", "不应回答'不知道'"),
            ],
            max_response_time=15.0,
        ),
        TestCase(
            test_id="tc-002", name="工具调用-计算", category=TestCategory.TOOL_CALL,
            input="计算 3 + 5 * 2",
            assertions=[
                Assertion(AssertionType.TOOL_CALLED, "calculate", "应调用calculate工具"),
            ],
            expected_tools=["calculate"],
        ),
        TestCase(
            test_id="tc-003", name="边界-空输入", category=TestCategory.EDGE_CASE,
            input="",
            assertions=[
                Assertion(AssertionType.NOT_CONTAINS, "错误", "不应直接报错"),
            ],
            max_response_time=10.0,
        ),
    ])

    report = await runner.run_all()
    print(runner.format_report(report))

asyncio.run(main())
```

---

## 三、断言策略对比

| 断言类型 | 精确度 | 实现难度 | 适用场景 |
|----------|--------|----------|----------|
| 关键词包含 | 中 | 低 | 事实问答 |
| 精确匹配 | 高 | 低 | 固定格式输出 |
| 不包含禁止词 | 中 | 低 | 安全测试 |
| 工具调用检查 | 高 | 低 | 工具使用验证 |
| 响应时间 | 高 | 低 | 性能测试 |
| 语义匹配(需LLM) | 高 | 中 | 复杂回答 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 分类覆盖 | 简单/多步/工具/边界/安全 | ★★★ |
| 多断言组合 | 不只看关键词 | ★★★ |
| CI门禁 | 失败阻止部署 | ★★★ |
| 响应时间检查 | 防止性能退化 | ★★☆ |
| Mock隔离 | 测试不依赖真实API | ★★★ |
| 失败详情 | 记录哪条断言失败 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有测试用例管理 | ☐ |
| 有多类断言 | ☐ |
| 有测试报告 | ☐ |
| 有分类统计 | ☐ |
| 有响应时间检查 | ☐ |
| 支持CI集成 | ☐ |
