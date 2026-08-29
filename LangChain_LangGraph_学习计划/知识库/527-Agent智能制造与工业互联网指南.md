# Agent 智能制造与工业互联网指南

> 工厂产线上千台设备、传感器每秒产生海量数据——Agent 能实时监控设备状态、预测故障、优化生产排程。本指南系统讲解工业 Agent 架构、设备数字孪生、预测性维护、生产调度优化、质量检测。

---

## 1. 工业 Agent 架构

### 工作流

```mermaid
graph TB
    SENSORS["传感器数据<br/>温度/振动/压力"] --> EDGE["边缘计算<br/>实时预处理"]
    EDGE --> AGENT["工业Agent<br/>分析+决策"]
    AGENT --> MONITOR["状态监控<br/>设备健康度"]
    AGENT --> PREDICT["故障预测<br/>提前预警"]
    AGENT --> SCHEDULE["生产调度<br/>排程优化"]
    AGENT --> QUALITY["质量检测<br/>缺陷识别"]
    MONITOR --> DASHBOARD["监控大屏"]
    PREDICT --> ALERT["告警+工单"]
    SCHEDULE --> MES["MES 系统"]
    QUALITY --> REJECT["剔除+记录"]

    style EDGE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style AGENT fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style DASHBOARD fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 设备状态监控

```python
@dataclass
class EquipmentMonitor:
    """设备状态监控器"""

    async def monitor(self, equipment_id: str, sensor_data: dict) -> dict:
        """分析设备状态"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        # 计算健康度
        health = self._calculate_health(sensor_data)

        # LLM 分析异常
        if health < 0.7:
            response = await llm.ainvoke(f"""分析设备异常。

设备: {equipment_id}
传感器数据: {json.dumps(sensor_data, ensure_ascii=False)}
健康度: {health:.0%}

输出 JSON:
{{
    "status": "normal/warning/critical",
    "anomalies": ["异常描述"],
    "likely_cause": "可能原因",
    "recommended_action": "建议操作",
    "urgency": "low/medium/high"
}}""")
            return json.loads(response.content)

        return {"status": "normal", "health": health, "equipment_id": equipment_id}

    def _calculate_health(self, data: dict) -> float:
        """计算设备健康度"""
        score = 1.0
        # 温度检查
        temp = data.get("temperature", 25)
        if temp > 80: score -= 0.3
        elif temp > 60: score -= 0.1
        # 振动检查
        vibration = data.get("vibration", 0)
        if vibration > 10: score -= 0.3
        elif vibration > 5: score -= 0.1
        # 压力检查
        pressure = data.get("pressure", 0)
        if pressure > data.get("max_pressure", 100): score -= 0.4
        return max(0, score)
```

---

## 3. 预测性维护

```python
@dataclass
class PredictiveMaintenance:
    """预测性维护"""

    async def predict_failure(self, equipment_id: str, history: list) -> dict:
        """预测设备故障"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 趋势分析
        temps = [h.get("temperature", 25) for h in history[-100:]]
        vibrations = [h.get("vibration", 0) for h in history[-100:]]

        temp_trend = "上升" if temps[-1] > sum(temps) / len(temps) else "稳定"
        vib_trend = "上升" if vibrations[-1] > sum(vibrations) / len(vibrations) else "稳定"

        response = await llm.ainvoke(f"""预测设备故障风险。

设备: {equipment_id}
温度趋势: {temp_trend} (当前 {temps[-1]}°C)
振动趋势: {vib_trend} (当前 {vibrations[-1]})

输出 JSON:
{{
    "failure_probability": 0-1,
    "estimated_failure_time": "7天内/30天内/正常",
    "likely_failure_mode": "轴承磨损/过热/泄漏",
    "maintenance_recommendation": "立即停机检查/计划维护/继续监控",
    "urgency": "high/medium/low"
}}""")

        return json.loads(response.content)

    async def generate_maintenance_plan(self, prediction: dict) -> dict:
        """生成维护计划"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""生成设备维护计划。

预测结果: {json.dumps(prediction, ensure_ascii=False)}

输出 JSON:
{{
    "maintenance_type": "预防性/纠正性/紧急",
    "estimated_duration_hours": 4,
    "required_parts": ["需要更换的零件"],
    "required_tools": ["需要的工具"],
    "safety_measures": ["安全措施"],
    "steps": ["操作步骤1", "操作步骤2"]
}}""")
        return json.loads(response.content)
```

---

## 4. 生产调度优化

```python
@dataclass
class ProductionScheduler:
    """生产调度优化器"""

    async def optimize(self, orders: list, machines: list, constraints: dict) -> dict:
        """优化生产排程"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""优化生产排程。

订单列表:
{json.dumps(orders[:20], ensure_ascii=False)}

可用设备:
{json.dumps(machines, ensure_ascii=False)}

约束条件:
{json.dumps(constraints, ensure_ascii=False)}

优化目标:
1. 最大化设备利用率
2. 最小化订单延迟
3. 最小化切换成本

输出 JSON:
{{
    "schedule": [
        {{"machine_id": "...", "order_id": "...", "start_time": "...", "end_time": "...", "duration_hours": 2}}
    ],
    "utilization_rate": 0.85,
    "delayed_orders": [],
    "total_completion_hours": 48
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 5. 质量检测

```python
@dataclass
class QualityInspector:
    """质量检测器"""

    async def inspect(self, product_image: str, specs: dict) -> dict:
        """检测产品质量"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # VLM 检测外观缺陷
        import base64
        with open(product_image, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": f"检测产品是否有缺陷。规格: {json.dumps(specs, ensure_ascii=False)}\n输出JSON: {{\"pass\": true/false, \"defects\": [], \"severity\": \"...\"}}"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
            ])
        ])

        try:
            return json.loads(response.content)
        except:
            return {"pass": True, "raw": response.content[:200]}
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了设备状态监控 | ☐ |
| 实现了设备健康度计算 | ☐ |
| 实现了故障预测 | ☐ |
| 实现了维护计划生成 | ☐ |
| 实现了生产调度优化 | ☐ |
| 实现了质量检测 | ☐ |
| 边缘计算集成 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 40 | 智能制造 Agent | 制造 |
| 44 | Agent 智能工厂 | 工厂 |
| 47 | 智能电力调度 Agent | 电力 |
| 48 | 智能酒店管理 Agent | 酒店 |
| 471 | 数字孪生与 Agent 仿真 | 数字孪生 |
| 469 | 分布式 Agent 与边缘部署 | 边缘 |
| 461 | 企业 Agent 集成 | MES 集成 |
