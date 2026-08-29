# Prompt 版本对比与回归测试指南

> 改了一个词的 Prompt，之前能答对的问题全答错了——这是 Prompt 工程的"蝴蝶效应"。这篇指南讲透 Prompt 版本对比、回归测试集设计和自动化回归管线。

---

## 一、回归测试架构

```mermaid
graph TB
    NEW["新版本Prompt"] --> RUN["在测试集上运行"]
    OLD["旧版本Prompt"] --> RUN2["在测试集上运行"]
    RUN & RUN2 --> DIFF["逐条对比结果"]
    DIFF --> CLASSIFY&#123;"变化分类"&#125;
    CLASSIFY -->|改善| BETTER["✅ 新版更好"]
    CLASSIFY -->|退化| REGRESS["❌ 新版退化"]
    CLASSIFY -->|无变化| SAME["⬜ 持平"]
    BETTER & REGRESS & SAME --> REPORT["回归报告<br/>改善/退化/持平统计"]

    style DIFF fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REGRESS fill:#FFCDD2,stroke:#C62828
    style BETTER fill:#C8E6C9
    style REPORT fill:#E3F2FD,stroke:#1565C0
```

---

## 二、回归测试实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import asyncio

class ChangeType(str, Enum):
    IMPROVED = "improved"
    REGRESSED = "regressed"
    UNCHANGED = "unchanged"
    NEW_PASS = "new_pass"     # 旧版错→新版对
    NEW_FAIL = "new_fail"     # 旧版对→新版错

@dataclass
class TestCase:
    """单个测试用例。"""
    test_id: str
    input: str
    expected: str             # 期望输出
    category: str = "general" # 分类（准确性/格式/安全/边界）
    difficulty: str = "medium"

@dataclass
class TestResult:
    """单条测试结果。"""
    test_id: str
    output: str
    passed: bool
    score: float              # 0.0-1.0
    latency_ms: float

@dataclass
class DiffResult:
    """版本对比结果。"""
    test_id: str
    old_result: TestResult
    new_result: TestResult
    change_type: ChangeType
    description: str

@dataclass
class RegressionReport:
    """回归报告。"""
    total_tests: int = 0
    improved: int = 0
    regressed: int = 0
    unchanged: int = 0
    old_pass_rate: float = 0.0
    new_pass_rate: float = 0.0
    old_avg_score: float = 0.0
    new_avg_score: float = 0.0
    regressions: list[DiffResult] = field(default_factory=list)
    improvements: list[DiffResult] = field(default_factory=list)
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())


from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
import time

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

JUDGE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是答案评估器。判断模型输出是否与期望答案匹配。

期望答案: &#123;expected&#125;
模型输出: &#123;actual&#125;

返回JSON:
&#123;&#123;"passed": true/false, "score": 0.0-1.0, "reason": "简短理由"&#125;&#125;"""),
    ("human", "请评估。"),
])


class PromptRegressionTester:
    """Prompt回归测试器。"""

    def __init__(self, llm):
        self.llm = llm
        self.judge_chain = JUDGE_PROMPT | llm | StrOutputParser()
        self._test_cases: list[TestCase] = []

    def add_test_case(self, case: TestCase):
        self._test_cases.append(case)

    def load_test_suite(self, cases: list[TestCase]):
        self._test_cases = cases

    async def run_prompt(self, prompt_template: str, test_cases: list[TestCase] = None) -> list[TestResult]:
        """在测试集上运行Prompt。"""
        cases = test_cases or self._test_cases
        results = []

        for case in cases:
            start = time.monotonic()
            chain = ChatPromptTemplate.from_template(prompt_template) | self.llm | StrOutputParser()
            output = await chain.ainvoke(&#123;"input": case.input&#125;)
            latency = (time.monotonic() - start) * 1000

            # 评估
            judge_result = await self.judge_chain.ainvoke(&#123;
                "expected": case.expected,
                "actual": output[:500],
            &#125;)

            try:
                import json
                parsed = json.loads(judge_result)
                passed = parsed.get("passed", False)
                score = float(parsed.get("score", 0.5))
            except (json.JSONDecodeError, ValueError):
                # 降级：简单包含检查
                passed = case.expected.lower() in output.lower()
                score = 0.8 if passed else 0.2

            results.append(TestResult(
                test_id=case.test_id,
                output=output[:200],
                passed=passed,
                score=score,
                latency_ms=round(latency, 1),
            ))

        return results

    async def compare(self, old_prompt: str, new_prompt: str) -> RegressionReport:
        """对比两个Prompt版本。"""
        old_results = await self.run_prompt(old_prompt)
        new_results = await self.run_prompt(new_prompt)

        report = RegressionReport(total_tests=len(old_results))

        old_scores = []
        new_scores = []
        old_passes = 0
        new_passes = 0

        for old_r, new_r in zip(old_results, new_results):
            old_scores.append(old_r.score)
            new_scores.append(new_r.score)
            if old_r.passed: old_passes += 1
            if new_r.passed: new_passes += 1

            # 判断变化类型
            diff = DiffResult(
                test_id=old_r.test_id,
                old_result=old_r,
                new_result=new_r,
                change_type=ChangeType.UNCHANGED,
                description="",
            )

            if new_r.passed and not old_r.passed:
                diff.change_type = ChangeType.NEW_PASS
                diff.description = f"新修复: &#123;old_r.test_id&#125;"
                report.improvements.append(diff)
                report.improved += 1
            elif not new_r.passed and old_r.passed:
                diff.change_type = ChangeType.NEW_FAIL
                diff.description = f"新退化: &#123;old_r.test_id&#125;"
                report.regressions.append(diff)
                report.regressed += 1
            elif new_r.score > old_r.score + 0.1:
                diff.change_type = ChangeType.IMPROVED
                report.improvements.append(diff)
                report.improved += 1
            elif new_r.score < old_r.score - 0.1:
                diff.change_type = ChangeType.REGRESSED
                report.regressions.append(diff)
                report.regressed += 1
            else:
                report.unchanged += 1

        report.old_pass_rate = old_passes / max(len(old_results), 1)
        report.new_pass_rate = new_passes / max(len(new_results), 1)
        report.old_avg_score = sum(old_scores) / max(len(old_scores), 1)
        report.new_avg_score = sum(new_scores) / max(len(new_scores), 1)

        return report
```

### 使用示例

```python
import asyncio

async def main():
    tester = PromptRegressionTester(llm)

    # 加载测试集
    tester.load_test_suite([
        TestCase("t1", "什么是LangChain?", "LangChain是一个用于构建LLM应用的框架", "factual", "easy"),
        TestCase("t2", "RAG的全称是什么?", "Retrieval-Augmented Generation", "factual", "easy"),
        TestCase("t3", "解释什么是embedding", "将文本转换为向量表示的技术", "factual", "medium"),
    ])

    old_prompt = "回答以下问题：&#123;input&#125;"
    new_prompt = "你是AI助手。请准确、简洁地回答以下问题。\n问题：&#123;input&#125;"

    report = await tester.compare(old_prompt, new_prompt)

    print(f"总测试数: &#123;report.total_tests&#125;")
    print(f"改善: &#123;report.improved&#125;, 退化: &#123;report.regressed&#125;, 持平: &#123;report.unchanged&#125;")
    print(f"通过率: &#123;report.old_pass_rate:.0%&#125; → &#123;report.new_pass_rate:.0%&#125;")
    print(f"平均分: &#123;report.old_avg_score:.2f&#125; → &#123;report.new_avg_score:.2f&#125;")

    if report.regressions:
        print("\n⚠ 退化用例:")
        for r in report.regressions:
            print(f"  &#123;r.test_id&#125;: &#123;r.description&#125;")

asyncio.run(main())
```

---

## 三、测试集设计原则

| 原则 | 说明 | 优先级 |
|------|------|--------|
| 覆盖核心场景 | 包含最常见使用场景 | ★★★ |
| 包含边界用例 | 空输入/超长输入/特殊字符 | ★★★ |
| 包含退化陷阱 | 容易因Prompt修改而退化的用例 | ★★★ |
| 分类标注 | factual/format/safety/edge | ★★☆ |
| 定期更新 | 新发现的bad case加入 | ★★☆ |
| 版本化 | 测试集本身也版本管理 | ★☆☆ |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 改Prompt前先跑基线 | 记录旧版成绩 | ★★★ |
| 退化>0则阻止上线 | 零退化容忍 | ★★★ |
| LLM-as-Judge评分 | 比精确匹配更灵活 | ★★★ |
| 按类别看退化 | 某类退化但整体上升也需关注 | ★★☆ |
| 自动化CI集成 | 每次Prompt变更自动回归 | ★★☆ |
| 测试集防泄露 | 不用训练数据当测试 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有测试用例管理 | ☐ |
| 有LLM-as-Judge评分 | ☐ |
| 有版本对比 | ☐ |
| 有退化检测 | ☐ |
| 有回归报告 | ☐ |
| 支持CI集成 | ☐ |
