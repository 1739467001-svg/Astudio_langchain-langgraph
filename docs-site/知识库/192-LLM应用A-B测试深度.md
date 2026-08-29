# LLM 应用 A/B 测试深度

> 改了 Prompt 不知道变好还是变差？换了模型不确定效果如何？A/B 测试让数据说话——同时运行两个版本，对比真实用户反馈，数据驱动决策。

---

## 一、A/B 测试核心概念

```mermaid
graph TB
    subgraph AB &#123;"A/B测试流程"&#125;
        S1["定义假设<br/>'新Prompt比旧的好'"]
        S2["流量分组<br/>A组50% B组50%"]
        S3["同时运行<br/>收集用户反馈"]
        S4["统计分析<br/>是否有显著差异"]
        S5["决策<br/>采用B或保持A"]
    end

    style AB fill:#E3F2FD
    style S4 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
```

---

## 二、实验设计

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any
import hashlib
from datetime import datetime
from collections import defaultdict

class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"

@dataclass
class Variant:
    """实验变体。"""
    name: str              # A / B
    config: dict           # 该变体的配置(Prompt/模型/参数)
    traffic_percent: float # 流量比例

@dataclass
class Experiment:
    """A/B实验。"""
    name: str
    description: str
    variants: dict[str, Variant]
    metrics: list[str]     # 关注的指标
    status: ExperimentStatus = ExperimentStatus.DRAFT
    min_sample_size: int = 1000  # 最小样本量
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    results: dict = field(default_factory=dict)

class ExperimentManager:
    """实验管理器。"""

    def __init__(self):
        self.experiments: dict[str, Experiment] = &#123;&#125;

    def create(
        self,
        name: str,
        variant_a_config: dict,
        variant_b_config: dict,
        traffic_split: tuple[float, float] = (0.5, 0.5),
    ) -> Experiment:
        """创建A/B实验。"""
        exp = Experiment(
            name=name,
            description=f"&#123;name&#125; A/B测试",
            variants=&#123;
                "A": Variant("A", variant_a_config, traffic_split[0]),
                "B": Variant("B", variant_b_config, traffic_split[1]),
            &#125;,
            metrics=["satisfaction", "accuracy", "latency"],
        )
        self.experiments[name] = exp
        return exp

    def assign_variant(self, experiment_name: str, user_id: str) -> str:
        """为用户分配变体（确定性）。"""
        exp = self.experiments.get(experiment_name)
        if not exp or exp.status != ExperimentStatus.RUNNING:
            return "A"

        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        cumulative = 0
        for variant_name, variant in exp.variants.items():
            cumulative += variant.traffic_percent * 100
            if hash_val < cumulative:
                return variant_name
        return "A"

    def record_result(
        self,
        experiment_name: str,
        variant: str,
        metrics: dict,
    ):
        """记录实验结果。"""
        exp = self.experiments.get(experiment_name)
        if not exp:
            return

        if variant not in exp.results:
            exp.results[variant] = &#123;
                "count": 0,
                "metrics_sum": defaultdict(float),
                "positive_feedback": 0,
            &#125;

        exp.results[variant]["count"] += 1
        for metric, value in metrics.items():
            exp.results[variant]["metrics_sum"][metric] += value

        if metrics.get("satisfaction", 0) >= 4:  # 4/5星以上算正面
            exp.results[variant]["positive_feedback"] += 1
```

---

## 三、统计分析

```python
import math

class ABTestAnalyzer:
    """A/B测试统计分析器。"""

    @staticmethod
    def analyze(experiment: Experiment) -> dict:
        """分析实验结果。"""
        results = experiment.results
        if "A" not in results or "B" not in results:
            return &#123;"error": "数据不足"&#125;

        a_count = results["A"]["count"]
        b_count = results["B"]["count"]

        if a_count < experiment.min_sample_size or b_count < experiment.min_sample_size:
            return &#123;
                "status": "insufficient_data",
                "a_count": a_count,
                "b_count": b_count,
                "min_required": experiment.min_sample_size,
            &#125;

        analysis = &#123;"variants": &#123;&#125;&#125;

        for variant_name in ["A", "B"]:
            data = results[variant_name]
            count = data["count"]

            variant_stats = &#123;
                "count": count,
                "positive_rate": round(data["positive_feedback"] / count, 4),
            &#125;

            for metric_name, total in data["metrics_sum"].items():
                variant_stats[f"avg_&#123;metric_name&#125;"] = round(total / count, 4)

            analysis["variants"][variant_name] = variant_stats

        # 计算差异
        a_positive = analysis["variants"]["A"]["positive_rate"]
        b_positive = analysis["variants"]["B"]["positive_rate"]

        analysis["delta"] = round(b_positive - a_positive, 4)
        analysis["relative_improvement"] = round(
            (b_positive - a_positive) / a_positive * 100, 2
        ) if a_positive > 0 else 0

        # 简化的显著性检验（Z检验）
        analysis["significant"] = ABTestAnalyzer._is_significant(
            a_count, a_positive, b_count, b_positive
        )

        analysis["recommendation"] = (
            "采用B" if analysis["delta"] > 0 and analysis["significant"]
            else "保持A" if analysis["significant"]
            else "继续实验"
        )

        return analysis

    @staticmethod
    def _is_significant(n_a: int, p_a: float, n_b: int, p_b: float) -> bool:
        """简化的Z检验（α=0.05）。"""
        pooled_p = (p_a * n_a + p_b * n_b) / (n_a + n_b)
        se = math.sqrt(pooled_p * (1 - pooled_p) * (1/n_a + 1/n_b))

        if se == 0:
            return False

        z_score = (p_b - p_a) / se
        return abs(z_score) > 1.96  # 95%置信度
```

---

## 四、实际应用场景

```mermaid
graph TB
    subgraph 场景 &#123;"A/B测试场景"&#125;
        S1["Prompt版本对比<br/>v1 vs v2"]
        S2["模型对比<br/>GPT-4o vs Claude"]
        S3["检索策略对比<br/>向量 vs 混合"]
        S4["RAG参数对比<br/>k=3 vs k=5"]
        S5["系统提示对比<br/>简洁 vs 详细"]
    end

    style 场景 fill:#E3F2FD
```

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 明确假设 | "B比A好在哪" | ★★★ |
| 最小样本量 | 至少1000请求/变体 | ★★★ |
| 确定性分组 | 同一用户始终同变体 | ★★★ |
| 同时运行 | 排除时间差异 | ★★★ |
| 统计显著性 | 不能凭感觉 | ★★☆ |
| 一次只测一个变量 | 控制变量 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有实验管理器 | ☐ |
| 有变体分配 | ☐ |
| 有统计分析 | ☐ |
| 有显著性检验 | ☐ |
