# LLM 应用 SLO 与告警

> SLO（服务等级目标）让你明确"什么算正常"。这份指南定义 LLM 应用的 SLO 和告警规则。

---

## 一、SLO/SLI/SLA 速查

```mermaid
graph TB
    subgraph 三概念 {"三个概念"}
        SLI["SLI (指标)<br/>实际测量的值<br/>如: 延迟P95=3.2s"]
        SLO["SLO (目标)<br/>期望的目标<br/>如: 延迟P95 < 5s"]
        SLA["SLA (协议)<br/>给用户的承诺<br/>如: 99.9%可用"]
    end

    SLI -->|"对比"| SLO
    SLO -->|"基于"| SLA

    style 三概念 fill:'#E3F2FD'
```

## 二、LLM 应用的 SLO 定义

```python
from dataclasses import dataclass

@dataclass
class LLMAppSLO:
    """LLM 应用 SLO 定义"""
    # 可用性
    availability_target: float = 0.999        # 99.9%可用
    # 延迟
    latency_p50_target: float = 2.0           # P50 < 2秒
    latency_p95_target: float = 5.0           # P95 < 5秒
    latency_p99_target: float = 10.0          # P99 < 10秒
    # 质量
    answer_quality_target: float = 0.85       # 准确率 ≥ 85%
    hallucination_rate_max: float = 0.05       # 幻觉率 ≤ 5%
    # 成本
    daily_cost_max: float = 50.0               # 日成本 < $50
    monthly_cost_max: float = 1000.0           # 月成本 < $1000
    # 错误率
    error_rate_max: float = 0.05               # 错误率 < 5%

SLO = LLMAppSLO()
```

## 三、SLI 指标收集

```python
import time
from collections import defaultdict
from datetime import datetime

class SLICollector:
    """SLI 指标收集器"""
    def __init__(self):
        self.metrics = defaultdict(list)

    def record_latency(self, latency: float):
        self.metrics["latency"].append(latency)

    def record_error(self):
        self.metrics["errors"].append(1)

    def record_success(self):
        self.metrics["successes"].append(1)

    def record_cost(self, cost: float):
        self.metrics["cost"].append(cost)

    def record_quality(self, score: float):
        self.metrics["quality"].append(score)

    def get_sli(self) -> dict:
        """获取当前SLI"""
        latencies = sorted(self.metrics.get("latency", []))
        errors = sum(self.metrics.get("errors", []))
        successes = sum(self.metrics.get("successes", [1]))
        total = errors + successes

        return {
            "latency_p50": latencies[len(latencies)//2] if latencies else 0,
            "latency_p95": latencies[int(len(latencies)*0.95)] if len(latencies) > 20 else max(latencies) if latencies else 0,
            "error_rate": errors / total if total > 0 else 0,
            "avg_quality": sum(self.metrics.get("quality", [])) / len(self.metrics.get("quality", [1])) if self.metrics.get("quality") else 0,
            "total_cost": sum(self.metrics.get("cost", [])),
        }
```

## 四、告警规则

```python
class AlertManager:
    """告警管理器"""
    def __init__(self, slo: LLMAppSLO):
        self.slo = slo
        self.alerts = []

    def check(self, sli: dict) -> list:
        """检查SLO是否达标"""
        alerts = []

        # 延迟告警
        if sli.get("latency_p95", 0) > self.slo.latency_p95_target:
            alerts.append({
                "level": "WARN",
                "metric": "latency_p95",
                "value": sli["latency_p95"],
                "target": self.slo.latency_p95_target,
                "message": f"P95延迟{sli['latency_p95']:.1f}s超过目标{self.slo.latency_p95_target}s",
            })

        # 错误率告警
        if sli.get("error_rate", 0) > self.slo.error_rate_max:
            alerts.append({
                "level": "ERROR",
                "metric": "error_rate",
                "value": sli["error_rate"],
                "target": self.slo.error_rate_max,
                "message": f"错误率{sli['error_rate']:.1%}超过目标{self.slo.error_rate_max:.1%}",
            })

        # 成本告警
        if sli.get("total_cost", 0) > self.slo.daily_cost_max:
            alerts.append({
                "level": "WARN",
                "metric": "cost",
                "value": sli["total_cost"],
                "target": self.slo.daily_cost_max,
                "message": f"日成本${sli['total_cost']:.2f}超过预算${self.slo.daily_cost_max}",
            })

        # 质量告警
        if sli.get("avg_quality", 1) < self.slo.answer_quality_target:
            alerts.append({
                "level": "WARN",
                "metric": "quality",
                "value": sli["avg_quality"],
                "target": self.slo.answer_quality_target,
                "message": f"质量{self.slo.answer_quality_target:.0%}低于目标{self.slo.answer_quality_target:.0%}",
            })

        return alerts

    def notify(self, alert: dict):
        """发送告警通知"""
        level = alert["level"]
        msg = alert["message"]
        print(f"[{level}] {msg}")
        # 实际可以发邮件/Slack/钉钉
```

## 五、SLO 看板

```mermaid
graph TB
    subgraph SLO看板 {"LLM应用SLO看板"}
        A["📊 可用性<br/>99.9%目标<br/>当前: 99.95% ✅"]
        B["⏱️ 延迟P95<br/><5s目标<br/>当前: 3.2s ✅"]
        C["📊 错误率<br/><5%目标<br/>当前: 2.1% ✅"]
        D["💰 日成本<br/><$50目标<br/>当前: $32 ✅"]
        E["🎯 质量<br/>>85%目标<br/>当前: 88% ✅"]
    end

    style SLO看板 fill:'#C8E6C9'
```

## 六、SLO 检查清单

| SLO | 目标 | 告警阈值 | 告警级别 |
|-----|------|---------|---------|
| 可用性 | 99.9% | <99.5% | ERROR |
| 延迟P95 | <5s | >5s | WARN |
| 延迟P99 | <10s | >10s | ERROR |
| 错误率 | <5% | >5% | ERROR |
| 质量 | >85% | <80% | WARN |
| 日成本 | <$50 | >$40 | WARN |
| 月成本 | <$1000 | >$800 | WARN |
