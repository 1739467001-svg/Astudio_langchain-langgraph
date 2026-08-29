# LLM 应用 SLO 整合速查指南

> 14 篇提及SLO。这篇整合为速查——SLI/SLO/SLA、错误预算和告警规则。

---

## 一、速查表

| 指标 | 目标 | 告警阈值 |
|------|------|----------|
| 可用性 | 99.9% | <99.5%告警 |
| P95延迟 | <3s | >5s告警 |
| 错误率 | <1% | >5%告警 |
| 质量 | >85% | <80%告警 |

---

## 二、错误预算速查

```python
class SLOSpeedGuide:
    """SLO速查。"""

    @staticmethod
    def error_budget(slo: float = 0.999, days: int = 30) -> dict:
        """计算错误预算。"""
        error_ratio = 1 - slo
        total_minutes = days * 24 * 60
        budget = error_ratio * total_minutes
        return &#123;
            "slo": f"&#123;slo*100&#125;%",
            "budget_minutes": round(budget, 1),
            "budget_hours": round(budget / 60, 2),
            "description": f"每&#123;days&#125;天允许&#123;round(budget, 1)&#125;分钟故障",
        &#125;

    @staticmethod
    def check_budget(used_minutes: float, slo: float = 0.999, days: int = 30) -> dict:
        """检查预算使用。"""
        budget = SLOSpeedGuide.error_budget(slo, days)["budget_minutes"]
        remaining = budget - used_minutes
        usage_pct = used_minutes / budget * 100 if budget > 0 else 100

        if usage_pct >= 100:
            return &#123;"status": "exhausted", "action": "冻结新功能"&#125;
        elif usage_pct >= 80:
            return &#123;"status": "warning", "action": "谨慎发布"&#125;
        return &#123;"status": "healthy", "action": "可正常发布"&#125;

    @staticmethod
    def alert_rules() -> dict:
        """告警规则速查。"""
        return &#123;
            "availability": &#123;"condition": "<99.5%", "severity": "critical"&#125;,
            "latency_p95": &#123;"condition": ">5s", "severity": "high"&#125;,
            "error_rate": &#123;"condition": ">5%", "severity": "high"&#125;,
            "budget": &#123;"condition": ">80%", "severity": "warning"&#125;,
        &#125;
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| SLO比SLA高0.1% | 留缓冲 | ★★★ |
| 错误预算驱动发布 | 用完冻结 | ★★★ |
| P95不看平均 | 平均被拉偏 | ★★★ |
| 每月回顾 | 调整目标 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有SLO速查 | ☐ |
| 有错误预算 | ☐ |
| 有告警规则 | ☐ |
