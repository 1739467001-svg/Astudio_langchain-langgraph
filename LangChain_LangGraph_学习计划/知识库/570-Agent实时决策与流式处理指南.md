# Agent 实时决策与流式处理指南

> Agent 不只处理批量请求——实时数据流（传感器/交易/日志）需要毫秒级响应。本指南深度讲解流式 Agent 架构、窗口处理、实时异常检测、事件驱动决策。

---

## 1. 流式 Agent 架构

```mermaid
graph LR
    STREAM["数据流<br/>Kafka/Pulsar"] --> WINDOW["窗口处理<br/>滑动/滚动"]
    WINDOW --> DETECT["实时检测<br/>异常/模式"]
    DETECT --> DECIDE["即时决策<br/>Agent推理"]
    DECIDE --> ACT["实时行动<br/>告警/控制"]

    style STREAM fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DETECT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style ACT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 窗口处理

```python
from collections import deque
from dataclasses import dataclass
import time

@dataclass
class SlidingWindowProcessor:
    """滑动窗口处理器"""

    window_size: int = 100
    buffer: deque = field(default_factory=lambda: deque(maxlen=100))

    def add(self, data_point: dict):
        """添加数据点"""
        self.buffer.append({
            "data": data_point,
            "timestamp": time.time(),
        })

    def get_window(self) -> list:
        """获取当前窗口数据"""
        return [item["data"] for item in self.buffer]

    def compute_stats(self) -> dict:
        """计算窗口统计"""
        if not self.buffer:
            return {"count": 0}

        values = [item["data"].get("value", 0) for item in self.buffer]

        return {
            "count": len(values),
            "mean": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
            "latest": values[-1],
        }

    def detect_anomaly(self, threshold_std: float = 3.0) -> dict:
        """实时异常检测"""
        if len(self.buffer) < 10:
            return {"anomaly": False, "reason": "数据不足"}

        values = [item["data"].get("value", 0) for item in self.buffer]
        mean = sum(values) / len(values)
        std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5

        latest = values[-1]
        z_score = (latest - mean) / std if std > 0 else 0

        is_anomaly = abs(z_score) > threshold_std

        return {
            "anomaly": is_anomaly,
            "z_score": z_score,
            "mean": mean,
            "latest": latest,
            "threshold": threshold_std,
        }
```

---

## 3. 事件驱动决策

```python
@dataclass
class RealTimeDecisionAgent:
    """实时决策 Agent"""

    async def process_event(self, event: dict, window_stats: dict) -> dict:
        """处理实时事件"""
        # 1. 快速规则检查
        rule_result = self._apply_rules(event, window_stats)

        if rule_result.get("action") == "alert":
            return rule_result

        # 2. 异常时调用 Agent 深度分析
        if rule_result.get("needs_analysis"):
            analysis = await self._agent_analyze(event, window_stats)
            return analysis

        return {"action": "pass", "event": event}

    def _apply_rules(self, event: dict, stats: dict) -> dict:
        """快速规则引擎"""
        value = event.get("value", 0)

        # 超阈值
        if value > event.get("max_threshold", float("inf")):
            return {"action": "alert", "reason": "超阈值", "value": value}

        # 窗口异常
        if stats.get("latest") and stats.get("mean"):
            ratio = stats["latest"] / max(stats["mean"], 0.01)
            if ratio > 3 or ratio < 0.3:
                return {"action": "alert", "reason": "窗口异常", "ratio": ratio}

        return {"action": "pass"}

    async def _agent_analyze(self, event: dict, stats: dict) -> dict:
        """Agent 深度分析"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""实时分析事件。

事件: {json.dumps(event, ensure_ascii=False)}
窗口统计: {json.dumps(stats, ensure_ascii=False)}

输出 JSON:
{{
    "severity": "low/medium/high/critical",
    "likely_cause": "可能原因",
    "recommended_action": "建议操作",
    "auto_response": "自动响应"
}}""")

        return json.loads(response.content)
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解流式 Agent 架构 | ☐ |
| 实现了滑动窗口 | ☐ |
| 实现了实时异常检测 | ☐ |
| 实现了事件驱动决策 | ☐ |
| 有规则引擎+Agent 分层 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 47 | 事件驱动架构 | 事件 |
| 153 | 实时数据管道 | 实时 |
| 478 | AIOps 智能运维 | 运维 |
| 486 | Webhook 事件通知 | Webhook |
| 562 | 边缘计算 | 边缘 |
