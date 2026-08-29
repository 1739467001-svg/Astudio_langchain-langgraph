# LLM 应用 SLA 管理与错误预算

> SLA 不只是写个数字——它驱动工程决策。99.9% 可用性意味着每月允许 43 分钟故障——这叫"错误预算"。用完了就停止发新功能，专注稳定性。这份指南讲透 SLA 制定、错误预算和 SLO 闭环。

---

## 一、SLA/SLO/SLI 三层关系

```mermaid
graph TB
    subgraph 三层 &#123;"SLA/SLO/SLI"&#125;
        SLA["SLA 服务等级协议<br/>对外承诺<br/>99.5%可用性"]
        SLO["SLO 服务等级目标<br/>内部目标<br/>99.9%可用性<br/>(比SLA高)"]
        SLI["SLI 服务等级指标<br/>实际测量<br/>本月: 99.92%"]
    end

    SLA --> SLO --> SLI

    style SLA fill:#FFCDD2,stroke:#C62828,stroke-width:3px
    style SLO fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SLI fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、LLM 应用的核心 SLI

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

@dataclass
class SLIMetric:
    """SLI指标。"""
    name: str
    target: float          # SLO目标
    current: float = 0     # 当前值
    window_days: int = 30  # 统计窗口

LLM_SLIS = &#123;
    "availability": SLIMetric("可用性", 0.999),       # 99.9%
    "latency_p95": SLIMetric("P95延迟", 3000),         # <3秒
    "latency_p99": SLIMetric("P99延迟", 5000),         # <5秒
    "error_rate": SLIMetric("错误率", 0.01),           # <1%
    "quality_score": SLIMetric("质量评分", 0.85),      # >85%
    "cache_hit_rate": SLIMetric("缓存命中率", 0.30),  # >30%
&#125;

class SLITracker:
    """SLI追踪器。"""

    def __init__(self):
        self.data: dict[str, list] = defaultdict(list)  # &#123;metric_name: [(timestamp, value)]&#125;

    def record(self, metric_name: str, value: float):
        """记录SLI指标。"""
        self.data[metric_name].append((datetime.now(), value))

    def calculate_sli(self, metric_name: str, window_days: int = 30) -> dict:
        """计算SLI。"""
        cutoff = datetime.now() - timedelta(days=window_days)
        values = [(ts, v) for ts, v in self.data[metric_name] if ts > cutoff]

        if not values:
            return &#123;"metric": metric_name, "value": None, "sample_count": 0&#125;

        vals = [v for _, v in values]
        target = LLM_SLIS.get(metric_name)
        target_val = target.target if target else 0

        # 计算统计
        import statistics
        avg = statistics.mean(vals)
        p50 = statistics.median(vals)
        p95 = sorted(vals)[int(len(vals) * 0.95)] if len(vals) > 20 else max(vals)
        p99 = sorted(vals)[int(len(vals) * 0.99)] if len(vals) > 100 else max(vals)

        return &#123;
            "metric": metric_name,
            "current": round(avg, 4),
            "p50": round(p50, 4),
            "p95": round(p95, 4),
            "p99": round(p99, 4),
            "target": target_val,
            "sample_count": len(values),
            "meeting_target": avg <= target_val if metric_name in ("latency_p95", "latency_p99", "error_rate") else avg >= target_val,
        &#125;
```

---

## 三、错误预算

```mermaid
graph TB
    subgraph 预算 &#123;"错误预算机制"&#125;
        SLO["SLO: 99.9%可用"] --> BUDGET["错误预算<br/>30天×0.1%=43分钟故障"]
        BUDGET --> USED["本月已用: 20分钟"]
        USED --> REMAIN["剩余: 23分钟"]
        REMAIN --> DECISION&#123;"预算用完?"&#125;
        DECISION -->|否| FEATURE["可发新功能"]
        DECISION -->|是| FREEZE["冻结新功能<br/>专注稳定性"]
    end

    style BUDGET fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style FREEZE fill:#FFCDD2
    style FEATURE fill:#C8E6C9
```

```python
class ErrorBudgetManager:
    """错误预算管理器。"""

    @staticmethod
    def calculate(slo_target: float, window_days: int = 30) -> dict:
        """计算错误预算。"""
        # 允许的故障比例
        error_ratio = 1 - slo_target
        # 允许的故障时间（分钟）
        total_minutes = window_days * 24 * 60
        budget_minutes = error_ratio * total_minutes

        return &#123;
            "slo_target": f"&#123;slo_target * 100&#125;%",
            "window_days": window_days,
            "total_budget_minutes": round(budget_minutes, 1),
            "total_budget_seconds": round(budget_minutes * 60, 0),
            "description": f"每&#123;window_days&#125;天允许&#123;round(budget_minutes, 1)&#125;分钟故障",
        &#125;

    @staticmethod
    def check_budget_usage(
        slo_target: float,
        downtime_minutes: float,
        window_days: int = 30,
    ) -> dict:
        """检查错误预算使用情况。"""
        budget = ErrorBudgetManager.calculate(slo_target, window_days)
        total_budget = budget["total_budget_minutes"]
        remaining = total_budget - downtime_minutes
        usage_pct = (downtime_minutes / total_budget) * 100 if total_budget > 0 else 100

        if usage_pct >= 100:
            action = "冻结新功能发布，专注稳定性"
            status = "exhausted"
        elif usage_pct >= 80:
            action = "谨慎发布，优先稳定性修复"
            status = "warning"
        else:
            action = "可正常发布新功能"
            status = "healthy"

        return &#123;
            "total_budget_minutes": round(total_budget, 1),
            "used_minutes": round(downtime_minutes, 1),
            "remaining_minutes": round(remaining, 1),
            "usage_percentage": round(usage_pct, 1),
            "status": status,
            "action": action,
        &#125;
```

---

## 四、告警规则

```python
class SLAAlertRules:
    """SLA告警规则。"""

    RULES = &#123;
        "availability_drop": &#123;
            "condition": "可用性 < 99.5%",
            "severity": "critical",
            "action": "立即响应",
        &#125;,
        "latency_p95_high": &#123;
            "condition": "P95延迟 > 5s",
            "severity": "high",
            "action": "30分钟内响应",
        &#125;,
        "error_rate_high": &#123;
            "condition": "错误率 > 5%",
            "severity": "high",
            "action": "30分钟内响应",
        &#125;,
        "budget_burning_fast": &#123;
            "condition": "错误预算使用率 > 80%",
            "severity": "warning",
            "action": "暂停新功能发布",
        &#125;,
        "quality_drop": &#123;
            "condition": "质量评分 < 80%",
            "severity": "warning",
            "action": "检查Prompt或模型",
        &#125;,
    &#125;

    @classmethod
    def evaluate(cls, metrics: dict) -> list[dict]:
        """评估告警规则。"""
        triggered = []

        if metrics.get("availability", 100) < 99.5:
            triggered.append(cls.RULES["availability_drop"])
        if metrics.get("latency_p95", 0) > 5000:
            triggered.append(cls.RULES["latency_p95_high"])
        if metrics.get("error_rate", 0) > 5:
            triggered.append(cls.RULES["error_rate_high"])

        return triggered
```

---

## 五、SLO 闭环

```mermaid
graph TB
    subgraph 闭环 &#123;"SLO闭环"&#125;
        S1["制定SLO<br/>确定目标"] --> S2["测量SLI<br/>采集指标"]
        S2 --> S3["计算错误预算<br/>使用情况"]
        S3 --> S4&#123;"预算用完?"&#125;
        S4 -->|否| S5["正常迭代"]
        S4 -->|是| S6["冻结新功能<br/>修复稳定性"]
        S5 --> S7["定期回顾<br/>调整SLO"]
        S6 --> S7
        S7 --> S1

    style 闭环 fill:#E3F2FD
    style S4 fill:#FFF9C4
```

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| SLO比SLA高0.1% | 留缓冲 | ★★★ |
| 错误预算驱动发布 | 用完就冻结 | ★★★ |
| P95延迟不是平均 | 平均被异常拉偏 | ★★★ |
| 每月回顾SLO | 调整不合理目标 | ★★☆ |
| 告警分级响应 | critical立即响应 | ★★☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 定义了核心SLI | ☐ |
| 有错误预算计算 | ☐ |
| 有告警规则 | ☐ |
| 有SLO闭环 | ☐ |
