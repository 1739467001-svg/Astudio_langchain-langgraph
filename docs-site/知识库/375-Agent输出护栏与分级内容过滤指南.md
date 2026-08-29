# Agent 输出护栏与分级内容过滤指南

> Agent 生成的回答可能包含有害内容、PII 泄露或不合规表述。输出护栏（Output Guardrail）在响应返回用户前做最后一道检查。这篇指南讲透分级过滤策略、规则引擎与 LLM 校验结合、以及拦截后处理。

---

## 一、输出护栏架构

```mermaid
graph TB
    LLM["LLM原始输出"] --> PIPELINE&#123;"护栏管线"&#125;
    PIPELINE --> G1["规则过滤<br/>正则/关键词"]
    G1 -->|通过| G2&#123;"PII检测<br/>个人隐私信息"&#125;
    G2 -->|通过| G3&#123;"LLM安全审查<br/>有害内容检测"&#125;
    G3 -->|通过| G4&#123;"格式校验<br/>输出格式合规"&#125;
    G4 -->|通过| OK["✅ 放行"]
    G1 -->|拦截| BLOCK1["拦截+替换"]
    G2 -->|拦截| BLOCK2["拦截+脱敏"]
    G3 -->|拦截| BLOCK3["拦截+重写"]
    G4 -->|拦截| BLOCK4["拦截+修正"]

    style PIPELINE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OK fill:#C8E6C9
    style BLOCK1 fill:#FFCDD2
    style BLOCK2 fill:#FFCDD2
    style BLOCK3 fill:#FFCDD2
    style BLOCK4 fill:#FFCDD2
```

护栏管线是多级过滤——规则最快、PII其次、LLM最慢但最准。每级通过才进入下一级，任一级拦截则走对应处理策略。

---

## 二、分级护栏实现

```python
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Any, Optional, Callable, Awaitable
import re

class Severity(str, Enum):
    LOW = "low"       # 可修正后放行
    MEDIUM = "medium"  # 需脱敏后放行
    HIGH = "high"      # 拦截+重写
    CRITICAL = "critical"  # 完全拦截

class FilterAction(str, Enum):
    PASS = "pass"
    REDACT = "redact"     # 脱敏处理
    REWRITE = "rewrite"   # 重写
    BLOCK = "block"       # 拦截

@dataclass
class FilterResult:
    """过滤结果。"""
    passed: bool
    action: FilterAction
    severity: Severity
    reason: str
    filtered_content: str = ""
    original_content: str = ""
    filter_name: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class RuleFilter:
    """规则过滤——正则和关键词。"""

    def __init__(self):
        self._rules: list[dict] = []

    def add_rule(self, name: str, pattern: str, replacement: str = "[已过滤]", severity: Severity = Severity.MEDIUM):
        self._rules.append(&#123;
            "name": name,
            "pattern": re.compile(pattern, re.IGNORECASE),
            "replacement": replacement,
            "severity": severity,
        &#125;)

    def filter(self, content: str) -> FilterResult:
        filtered = content
        matched_rules = []

        for rule in self._rules:
            if rule["pattern"].search(filtered):
                matched_rules.append(rule["name"])
                filtered = rule["pattern"].sub(rule["replacement"], filtered)

        if matched_rules:
            return FilterResult(
                passed=False,
                action=FilterAction.REDACT,
                severity=Severity.MEDIUM,
                reason=f"规则匹配: &#123;', '.join(matched_rules)&#125;",
                filtered_content=filtered,
                original_content=content,
                filter_name="rule_filter",
            )
        return FilterResult(
            passed=True,
            action=FilterAction.PASS,
            severity=Severity.LOW,
            reason="无规则匹配",
            filter_name="rule_filter",
        )


class PIIFilter:
    """PII检测——个人隐私信息脱敏。"""

    PII_PATTERNS = &#123;
        "phone": (r'1[3-9]\d&#123;9&#125;', '[手机号已脱敏]'),
        "email": (r'[\w.-]+@[\w.-]+\.\w+', '[邮箱已脱敏]'),
        "id_card": (r'\d&#123;17&#125;[\dXx]', '[身份证已脱敏]'),
        "bank_card": (r'\d&#123;16,19&#125;', '[银行卡已脱敏]'),
        "ip_address": (r'\d&#123;1,3&#125;\.\d&#123;1,3&#125;\.\d&#123;1,3&#125;\.\d&#123;1,3&#125;', '[IP已脱敏]'),
    &#125;

    def filter(self, content: str) -> FilterResult:
        filtered = content
        matched = []

        for pii_type, (pattern, replacement) in self.PII_PATTERNS.items():
            regex = re.compile(pattern)
            if regex.search(filtered):
                matched.append(pii_type)
                filtered = regex.sub(replacement, filtered)

        if matched:
            return FilterResult(
                passed=False,
                action=FilterAction.REDACT,
                severity=Severity.HIGH,
                reason=f"PII检测: &#123;', '.join(matched)&#125;",
                filtered_content=filtered,
                original_content=content,
                filter_name="pii_filter",
            )
        return FilterResult(
            passed=True,
            action=FilterAction.PASS,
            severity=Severity.LOW,
            reason="无PII",
            filter_name="pii_filter",
        )


from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

SAFETY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """你是内容安全审查员。判断以下内容是否安全合规。

检查维度:
1. 有害内容（暴力/歧视/非法建议）
2. 误导信息（明显错误/虚构事实）
3. 不当建议（危险操作/法律风险）

返回JSON:
&#123;&#123;"safe": true/false, "severity": "low/medium/high/critical", "issues": ["问题1"], "suggestion": "安全版本建议"&#125;&#125;"""),
    ("human", "内容: &#123;content&#125;"),
])


class LLMSafetyFilter:
    """LLM安全审查——用LLM判断内容安全性。"""

    def __init__(self, llm):
        self.chain = SAFETY_PROMPT | llm | StrOutputParser()

    async def filter(self, content: str) -> FilterResult:
        try:
            result = await self.chain.ainvoke(&#123;"content": content[:1000]&#125;)
            import json
            parsed = json.loads(result)
            safe = parsed.get("safe", True)
            severity = Severity(parsed.get("severity", "low"))
            issues = parsed.get("issues", [])
            suggestion = parsed.get("suggestion", "")

            if not safe:
                action = FilterAction.BLOCK if severity == Severity.CRITICAL else FilterAction.REWRITE
                return FilterResult(
                    passed=False,
                    action=action,
                    severity=severity,
                    reason=f"安全问题: &#123;', '.join(issues)&#125;",
                    filtered_content=suggestion or content,
                    original_content=content,
                    filter_name="llm_safety",
                )
        except (json.JSONDecodeError, ValueError):
            pass  # 解析失败时放行，但记录

        return FilterResult(
            passed=True,
            action=FilterAction.PASS,
            severity=Severity.LOW,
            reason="安全审查通过",
            filter_name="llm_safety",
        )


class GuardrailPipeline:
    """护栏管线——串联多级过滤。"""

    def __init__(self):
        self._filters: list = []

    def add_filter(self, filter_instance):
        self._filters.append(filter_instance)

    async def run(self, content: str) -> dict:
        """运行完整护栏管线。"""
        current = content
        results = []

        for f in self._filters:
            if hasattr(f, 'filter'):
                # 同步过滤器
                if asyncio.iscoroutinefunction(f.filter):
                    result = await f.filter(current)
                else:
                    result = f.filter(current)
            else:
                continue

            results.append(result)

            if not result.passed:
                if result.action == FilterAction.BLOCK:
                    return &#123;
                        "approved": False,
                        "final_content": "[此回复已被安全护栏拦截]",
                        "filters": [r.__dict__ for r in results],
                        "block_reason": result.reason,
                    &#125;
                elif result.action == FilterAction.REDACT:
                    current = result.filtered_content
                elif result.action == FilterAction.REWRITE:
                    current = result.filtered_content

        return &#123;
            "approved": True,
            "final_content": current,
            "filters": [r.__dict__ for r in results],
            "modifications": sum(1 for r in results if not r.passed),
        &#125;


import asyncio

# 构建护栏管线
pipeline = GuardrailPipeline()

rule_filter = RuleFilter()
rule_filter.add_rule("profanity", r'(脏话|侮辱性词汇)', severity=Severity.MEDIUM)
rule_filter.add_rule("illegal_advice", r'(如何制造|如何获取.*非法)', severity=Severity.HIGH)

pipeline.add_filter(rule_filter)
pipeline.add_filter(PIIFilter())
pipeline.add_filter(LLMSafetyFilter(llm))
```

---

## 三、使用示例

```python
async def main():
    # 测试1: 正常内容
    result = await pipeline.run("LangChain是一个用于构建LLM应用的框架。")
    print(f"测试1 通过: &#123;result['approved']&#125;, 修改: &#123;result['modifications']&#125;")

    # 测试2: PII泄露
    result = await pipeline.run("请联系张三，电话13812345678，邮箱zhangsan@example.com")
    print(f"测试2 通过: &#123;result['approved']&#125;")
    print(f"  脱敏后: &#123;result['final_content'][:80]&#125;")

    # 测试3: 拦截
    result = await pipeline.run("这是脏话内容，应该被过滤")
    print(f"测试3 通过: &#123;result['approved']&#125;, 修改: &#123;result['modifications']&#125;")

asyncio.run(main())
```

---

## 四、过滤策略对比

| 策略 | 速度 | 准确率 | 成本 | 适用 |
|------|------|--------|------|------|
| 规则过滤 | 极快 | 中 | 0 | 关键词/正则 |
| PII检测 | 快 | 高 | 0 | 隐私脱敏 |
| LLM安全审查 | 慢 | 高 | 中 | 有害内容 |
| 混合管线 | 中 | 高 | 低 | 生产环境 |
| 人工审核 | 极慢 | 极高 | 高 | 高风险场景 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 多级管线 | 规则→PII→LLM | ★★★ |
| 快速过滤优先 | 规则最快先跑 | ★★★ |
| 拦截不丢弃 | 替换而非删除 | ★★★ |
| 脱敏而非删除 | 保留上下文 | ★★☆ |
| 审计日志 | 所有拦截可追溯 | ★★☆ |
| 误判可申诉 | 用户可标记误拦截 | ★☆☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有规则过滤 | ☐ |
| 有PII检测 | ☐ |
| 有LLM安全审查 | ☐ |
| 有管线编排 | ☐ |
| 有拦截日志 | ☐ |
| 支持脱敏处理 | ☐ |
