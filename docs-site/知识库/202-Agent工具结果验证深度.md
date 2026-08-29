# Agent 工具结果验证深度

> Agent 调用工具拿到结果就直接用——但如果工具返回了错误数据呢？文件名注入、SQL 注入、数据篡改都可能让工具返回恶意结果。工具结果验证是 Agent 安全的最后一道防线。

---

## 一、工具结果风险

```mermaid
graph TB
    subgraph 风险 &#123;"工具结果风险"&#125;
        R1["数据篡改<br/>工具返回被修改的数据"]
        R2["格式异常<br/>返回非预期格式"]
        R3["注入攻击<br/>返回值含恶意指令"]
        R4["超长输出<br/>消耗上下文窗口"]
        R5["敏感信息泄露<br/>返回包含PII"]
    end

    style 风险 fill:#FFCDD2
```

---

## 二、验证器

```python
from dataclasses import dataclass
from typing import Any
import re

@dataclass
class ValidationResult:
    """验证结果。"""
    is_valid: bool
    sanitized_value: Any = None
    issues: list[str] = None
    truncated: bool = False

class ToolResultValidator:
    """工具结果验证器。"""

    MAX_RESULT_LENGTH = 5000
    DANGEROUS_PATTERNS = [
        (r"ignore.&#123;0,15&#125;(previous|above|all).&#123;0,15&#125;(instruction|prompt)", "注入指令"),
        (r"__import__\s*\(", "代码注入"),
        (r"eval\s*\(", "代码执行"),
        (r"system\s*\(", "系统命令"),
    ]

    PII_PATTERNS = [
        (r'\b1[3-9]\d&#123;9&#125;\b', "手机号"),
        (r'\b\d&#123;17&#125;[\dXx]\b', "身份证号"),
        (r'sk-[a-zA-Z0-9]&#123;40,&#125;', "API Key"),
    ]

    @classmethod
    def validate(cls, result: Any, expected_type: type = str) -> ValidationResult:
        """验证工具结果。"""
        issues = []
        sanitized = result

        # 1. 类型检查
        if not isinstance(result, expected_type):
            try:
                sanitized = expected_type(result)
            except (ValueError, TypeError):
                return ValidationResult(
                    is_valid=False,
                    issues=[f"类型错误: 期望&#123;expected_type&#125;, 实际&#123;type(result)&#125;"],
                )

        # 2. 长度检查
        result_str = str(sanitized)
        truncated = False
        if len(result_str) > cls.MAX_RESULT_LENGTH:
            sanitized = result_str[:cls.MAX_RESULT_LENGTH] + "\n[结果已截断]"
            truncated = True
            issues.append(f"结果过长（>&#123;cls.MAX_RESULT_LENGTH&#125;字符），已截断")

        # 3. 危险模式检查
        for pattern, desc in cls.DANGEROUS_PATTERNS:
            if re.search(pattern, result_str, re.IGNORECASE):
                issues.append(f"检测结果含危险模式: &#123;desc&#125;")
                sanitized = re.sub(pattern, "[已过滤]", sanitized, flags=re.IGNORECASE)

        # 4. PII检查
        for pattern, desc in cls.PII_PATTERNS:
            if re.search(pattern, result_str):
                issues.append(f"检测结果含PII: &#123;desc&#125;")
                sanitized = re.sub(pattern, f"[&#123;desc&#125;已脱敏]", sanitized)

        # 5. 空结果检查
        if not result_str.strip():
            issues.append("工具返回空结果")

        return ValidationResult(
            is_valid=len(issues) == 0 or (truncated and len(issues) == 1),
            sanitized_value=sanitized,
            issues=issues,
            truncated=truncated,
        )

    @classmethod
    def validate_json_result(cls, result: str) -> ValidationResult:
        """验证JSON格式结果。"""
        import json

        base = cls.validate(result)
        if not base.is_valid:
            return base

        try:
            parsed = json.loads(result)
            return ValidationResult(is_valid=True, sanitized_value=parsed)
        except json.JSONDecodeError as e:
            # 尝试提取JSON片段
            match = re.search(r'\&#123;.*\&#125;', result, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                    return ValidationResult(
                        is_valid=True, sanitized_value=parsed,
                        issues=["从文本中提取了JSON片段"],
                    )
                except json.JSONDecodeError:
                    pass
            return ValidationResult(
                is_valid=False,
                issues=[f"JSON解析失败: &#123;str(e)[:100]&#125;"],
            )
```

---

## 三、结果质量评估

```python
class ResultQualityChecker:
    """工具结果质量评估器。"""

    @staticmethod
    def check_relevance(result: str, query: str) -> float:
        """检查结果与查询的相关性。"""
        query_words = set(query.lower().split())
        result_lower = result.lower()
        if not query_words:
            return 1.0
        covered = sum(1 for w in query_words if w in result_lower)
        return covered / len(query_words)

    @staticmethod
    def check_completeness(result: str, expected_fields: list[str] = None) -> dict:
        """检查结果完整性。"""
        if not expected_fields:
            return &#123;"complete": True&#125;

        missing = [f for f in expected_fields if f not in result]
        return &#123;
            "complete": len(missing) == 0,
            "missing_fields": missing,
        &#125;
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 所有工具结果必须验证 | 防止恶意数据 | ★★★ |
| 长度限制+截断 | 防止上下文溢出 | ★★★ |
| PII检测+脱敏 | 防止泄露 | ★★★ |
| 危险模式过滤 | 防注入 | ★★☆ |
| JSON结果要解析验证 | 防格式错误 | ★★☆ |
| 空结果要处理 | Agent知道工具失败了 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有结果验证器 | ☐ |
| 有长度限制 | ☐ |
| 有危险模式检测 | ☐ |
| 有PII脱敏 | ☐ |
| 有JSON验证 | ☐ |
