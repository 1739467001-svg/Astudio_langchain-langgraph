# AIOps 与智能运维指南

> 传统运维靠人盯仪表盘，AIOps 让 AI 来运维 AI——用 LLM 分析日志、预测故障、自动诊断根因、生成修复建议。Agent 运维 Agent，形成智能闭环。本指南系统讲解 AIOps 架构、异常检测、故障预测、智能诊断，以及自愈闭环。

---

## 1. AIOps 架构

### 核心能力

```mermaid
graph TB
    AIOps["AIOps 核心能力"]

    AIOps --> DETECT["异常检测<br/>实时指标监控<br/>偏离基线即告警"]
    AIOps --> PREDICT["故障预测<br/>趋势分析<br/>提前预警"]
    AIOps --> DIAGNOSE["智能诊断<br/>LLM 分析日志<br/>根因定位"]
    AIOps --> HEAL["自愈闭环<br/>自动修复<br/>验证恢复"]
    AIOps --> LEARN["持续学习<br/>历史事件<br/>改进策略"]

    style AIOps fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style DETECT fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style DIAGNOSE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style HEAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 与传统运维对比

| 维度 | 传统运维 | AIOps |
|------|---------|-------|
| 监控 | 人工看仪表盘 | AI 自动分析 |
| 告警 | 阈值触发 | 异常检测+语义告警 |
| 诊断 | 人工查日志 | LLM 分析日志 |
| 根因 | 经验猜测 | 数据驱动定位 |
| 修复 | 人工操作 | 自动修复建议 |
| 预测 | 被动响应 | 主动预测 |

---

## 2. 异常检测

### 基线+偏差检测

```python
from dataclasses import dataclass, field
from collections import deque
import statistics

@dataclass
class AnomalyDetector:
    """异常检测器"""

    window_size: int = 100              # 基线窗口
    threshold_std: float = 3.0          # 标准差阈值
    metrics_history: dict = field(default_factory=lambda: {
        "error_rate": deque(maxlen=100),
        "latency_p95": deque(maxlen=100),
        "token_cost": deque(maxlen=100),
        "request_count": deque(maxlen=100),
    })

    async def record(self, metric: str, value: float):
        """记录指标"""
        if metric in self.metrics_history:
            self.metrics_history[metric].append(value)

    async def detect(self, metric: str, current_value: float) -> dict:
        """检测异常"""
        history = list(self.metrics_history.get(metric, []))

        if len(history) < 10:
            return {"anomaly": False, "reason": "数据不足"}

        mean = statistics.mean(history)
        std = statistics.stdev(history) if len(history) > 1 else 0

        if std == 0:
            return {"anomaly": False, "reason": "无波动"}

        z_score = (current_value - mean) / std

        is_anomaly = abs(z_score) > self.threshold_std

        return {
            "anomaly": is_anomaly,
            "metric": metric,
            "current": current_value,
            "mean": mean,
            "std": std,
            "z_score": z_score,
            "direction": "up" if z_score > 0 else "down",
            "severity": "high" if abs(z_score) > 5 else "medium" if abs(z_score) > 3 else "low",
        }

    async def detect_all(self, current_metrics: dict) -> list:
        """检测所有指标"""
        anomalies = []
        for metric, value in current_metrics.items():
            result = await self.detect(metric, value)
            if result["anomaly"]:
                anomalies.append(result)
            await self.record(metric, value)
        return anomalies
```

### 语义异常检测

```python
@dataclass
class SemanticAnomalyDetector:
    """语义异常检测：用 LLM 分析异常含义"""

    async def analyze_anomaly(self, anomaly: dict) -> dict:
        """用 LLM 分析异常含义"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""分析以下系统指标异常：

指标: {anomaly['metric']}
当前值: {anomaly['current']:.2f}
基线均值: {anomaly['mean']:.2f}
标准差: {anomaly['std']:.2f}
Z-Score: {anomaly['z_score']:.2f}
方向: {anomaly['direction']}

请分析：
1. 这个异常可能表示什么问题？
2. 严重程度（critical/warning/info）？
3. 可能的根因（3个）？
4. 建议的排查方向？

输出 JSON。"""

        response = await llm.ainvoke(prompt)
        try:
            return json.loads(response.content)
        except:
            return {"analysis": response.content}
```

---

## 3. 故障预测

### 趋势分析

```python
@dataclass
class FailurePredictor:
    """故障预测器"""

    async def predict_from_trends(self, metrics_history: dict) -> list:
        """从趋势预测故障"""
        predictions = []

        for metric, values in metrics_history.items():
            if len(values) < 20:
                continue

            # 简单线性回归预测
            trend = self._calculate_trend(values)

            if trend["direction"] == "increasing":
                # 预测何时达到阈值
                threshold = self._get_threshold(metric)
                if threshold and trend["rate"] > 0:
                    steps_to_threshold = (threshold - values[-1]) / trend["rate"]
                    if 0 < steps_to_threshold < 100:
                        predictions.append({
                            "metric": metric,
                            "prediction": f"{metric} 预计在 {steps_to_threshold:.0f} 个时间步后达到 {threshold}",
                            "current": values[-1],
                            "threshold": threshold,
                            "eta_steps": steps_to_threshold,
                            "severity": "warning" if steps_to_threshold < 20 else "info",
                        })

        return predictions

    def _calculate_trend(self, values: list) -> dict:
        """计算趋势"""
        n = len(values)
        x = list(range(n))
        y = values

        # 简单线性回归
        mean_x = sum(x) / n
        mean_y = sum(y) / n

        numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
        denominator = sum((xi - mean_x) ** 2 for xi in x)

        if denominator == 0:
            return {"direction": "stable", "rate": 0}

        slope = numerator / denominator

        if slope > 0.01:
            return {"direction": "increasing", "rate": slope}
        elif slope < -0.01:
            return {"direction": "decreasing", "rate": slope}
        return {"direction": "stable", "rate": 0}

    def _get_threshold(self, metric: str) -> float:
        """获取告警阈值"""
        thresholds = {
            "error_rate": 0.10,
            "latency_p95": 30000,
            "token_cost": 1000,
            "gpu_memory": 0.95,
        }
        return thresholds.get(metric, float("inf"))
```

---

## 4. 智能诊断

### LLM 日志分析

```python
@dataclass
class IntelligentDiagnosis:
    """智能诊断"""

    async def diagnose_from_logs(self, error_logs: list, metrics: dict) -> dict:
        """从日志和指标智能诊断"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 准备上下文
        log_text = "\n".join([f"[{l['timestamp']}] {l['level']}: {l['message'][:200]}" for l in error_logs[-20:]])
        metric_text = json.dumps(metrics, indent=2)

        prompt = f"""你是 AIOps 诊断引擎。分析以下系统故障：

## 当前指标
{metric_text}

## 错误日志（最近20条）
{log_text}

## 诊断要求
1. 问题摘要（1句话）
2. 根因分析（3个候选根因，按可能性排序）
3. 影响范围评估
4. 修复建议（具体操作步骤）
5. 预防措施

输出 JSON 格式。"""

        response = await llm.ainvoke(prompt)

        try:
            diagnosis = json.loads(response.content)
        except:
            diagnosis = {"raw_analysis": response.content}

        return diagnosis

    async def generate_runbook(self, diagnosis: dict) -> str:
        """生成修复手册"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""根据以下诊断结果生成修复手册：

{json.dumps(diagnosis, ensure_ascii=False, indent=2)}

输出格式：
## 故障描述
## 紧急处理步骤
1. ...
2. ...
## 根因修复
1. ...
## 验证恢复
1. ...
## 预防措施
1. ..."""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 5. 自愈闭环

```python
@dataclass
class SelfHealingLoop:
    """自愈闭环"""

    async def run_healing_cycle(self, anomaly: dict) -> dict:
        """执行自愈循环"""
        result = {
            "anomaly": anomaly,
            "actions_taken": [],
            "healed": False,
        }

        # 1. 诊断
        diagnosis = await self._diagnose(anomaly)
        result["actions_taken"].append({"step": "diagnose", "result": diagnosis})

        # 2. 选择修复策略
        healing_action = await self._select_healing_action(diagnosis)
        result["actions_taken"].append({"step": "select_action", "action": healing_action})

        # 3. 执行修复
        if healing_action and healing_action.get("auto_executable"):
            heal_result = await self._execute_healing(healing_action)
            result["actions_taken"].append({"step": "heal", "result": heal_result})

            # 4. 验证恢复
            verified = await self._verify_recovery(anomaly["metric"])
            result["healed"] = verified
            result["actions_taken"].append({"step": "verify", "recovered": verified})

            if not verified:
                # 5. 升级到人工
                result["actions_taken"].append({"step": "escalate", "reason": "自愈失败"})

        return result

    async def _diagnose(self, anomaly: dict) -> dict:
        """诊断"""
        metric = anomaly.get("metric", "")
        if "error_rate" in metric:
            return {"root_cause": "可能是 API 故障或模型异常", "type": "api_error"}
        elif "latency" in metric:
            return {"root_cause": "可能是过载或网络问题", "type": "performance"}
        return {"root_cause": "未知", "type": "unknown"}

    async def _select_healing_action(self, diagnosis: dict) -> dict:
        """选择修复策略"""
        actions = {
            "api_error": {"action": "switch_model", "auto_executable": True},
            "performance": {"action": "scale_up", "auto_executable": True},
            "unknown": {"action": "alert_human", "auto_executable": False},
        }
        return actions.get(diagnosis.get("type"), actions["unknown"])

    async def _execute_healing(self, action: dict) -> dict:
        """执行修复"""
        if action["action"] == "switch_model":
            # 切换到备用模型
            return {"status": "switched", "new_model": "gpt-4o-mini"}
        elif action["action"] == "scale_up":
            # 扩容
            return {"status": "scaled", "new_replicas": 5}
        return {"status": "no_action"}

    async def _verify_recovery(self, metric: str) -> bool:
        """验证恢复"""
        # 检查指标是否恢复正常
        return True
```

---

## 6. 持续学习

```python
@dataclass
class OperationalLearning:
    """运维知识学习"""

    async def learn_from_incident(self, incident: dict):
        """从事件中学习"""
        # 记录事件+诊断+修复方案
        knowledge = {
            "incident_type": incident.get("type"),
            "symptoms": incident.get("symptoms"),
            "root_cause": incident.get("root_cause"),
            "fix_applied": incident.get("fix"),
            "fix_successful": incident.get("healed"),
            "timestamp": incident.get("timestamp"),
        }
        await db.ops_knowledge.insert(knowledge)

    async def query_similar(self, current_incident: dict) -> list:
        """查询类似历史事件"""
        # 用语义检索找类似事件
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        query = f"症状: {current_incident.get('symptoms', '')}"
        # 向量检索历史知识
        results = await vectorstore.similarity_search(query, k=5)

        return [{"content": r.page_content, "metadata": r.metadata} for r in results]

    async def update_runbook(self, incident: dict):
        """更新修复手册"""
        if incident.get("healed"):
            # 成功的修复方案加入手册
            await db.runbooks.update(
                {"type": incident["type"]},
                {"$set": {"last_fix": incident["fix"], "updated": datetime.utcnow().isoformat()}},
                upsert=True,
            )
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 AIOps 核心能力 | ☐ |
| 实现了异常检测器 | ☐ |
| 实现了语义异常分析 | ☐ |
| 实现了故障预测 | ☐ |
| 实现了 LLM 智能诊断 | ☐ |
| 实现了自愈闭环 | ☐ |
| 实现了运维知识学习 | ☐ |
| 能生成修复手册 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 17 | LangSmith 可观测性 | 可观测性 |
| 42 | 性能剖析 | 性能 |
| 59 | LLM 应用性能剖析 | 性能 |
| 89 | SLO 与告警 | 告警 |
| 122 | SRE 运维与事故响应 | SRE |
| 145 | 监控面板与告警 | 监控 |
| 154 | SRE 运维 | SRE |
| 200 | 日志分析与智能诊断 | 日志诊断 |
| 249 | SLO 告警 | 告警 |
| 306 | 容量预测 | 预测 |
| 380 | 指标采集与监控面板 | 监控 |
| 417 | Agent 监控与可观测性 | 监控 |
| 445 | Agent 调试与可观测工具链 | 调试 |
| 460 | 事件响应与根因分析 | 事件响应 |
| 473 | Agent 可靠性与韧性工程 | 韧性 |
