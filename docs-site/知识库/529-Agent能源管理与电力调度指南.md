# Agent 能源管理与电力调度指南

> 电网需要在发电和用电之间实时平衡——Agent 能预测负荷、优化发电调度、管理储能、响应需求。本指南系统讲解能源 Agent 架构、负荷预测、发电调度、储能管理、需求响应。

---

## 1. 能源 Agent 架构

### 工作流

```mermaid
graph TB
    FORECAST["负荷预测<br/>短期+长期"] --> GENERATION["发电调度<br/>火电/水电/风电/光伏"]
    GENERATION --> BALANCE["供需平衡<br/>实时调整"]
    BALANCE --> STORAGE["储能管理<br/>充放电策略"]
    BALANCE --> DEMAND["需求响应<br/>削峰填谷"]
    FORECAST --> ALERT["异常告警<br/>过载/故障"]

    style FORECAST fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style BALANCE fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style STORAGE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 负荷预测

```python
@dataclass
class LoadForecaster:
    """电力负荷预测"""

    async def forecast(self, region: str, history: list,
                       weather: dict = None) -> dict:
        """预测负荷"""
        # 统计分析
        avg_load = sum(h["load_mw"] for h in history[-24:]) / 24
        peak_load = max(h["load_mw"] for h in history[-24:])
        min_load = min(h["load_mw"] for h in history[-24:])

        # 天气影响
        weather_factor = 1.0
        if weather:
            if weather.get("temperature", 20) > 35:
                weather_factor = 1.2  # 高温空调
            elif weather.get("temperature", 20) < 0:
                weather_factor = 1.15  # 低温供暖

        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""预测电力负荷。

区域: &#123;region&#125;
24小时平均: &#123;avg_load:.0f&#125;MW
24小时峰值: &#123;peak_load:.0f&#125;MW
24小时谷值: &#123;min_load:.0f&#125;MW
天气: &#123;json.dumps(weather or &#123;&#125;, ensure_ascii=False)&#125;
天气因子: &#123;weather_factor&#125;

输出 JSON:
&#123;&#123;
    "next_24h_forecast": [120, 115, 110, 105, 100, 98, 105, 120, 150, 180, 200, 210],
    "peak_load_mw": 210,
    "peak_hour": "11:00",
    "valley_load_mw": 98,
    "valley_hour": "05:00",
    "total_energy_mwh": 3200,
    "confidence": 0.9
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 3. 发电调度

```python
@dataclass
class GenerationScheduler:
    """发电调度器"""

    async def schedule(self, forecast: dict, generators: list,
                      storage_status: dict = None) -> dict:
        """优化发电调度"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""优化发电调度。

负荷预测:
- 峰值: &#123;forecast['peak_load_mw']&#125;MW (&#123;forecast['peak_hour']&#125;)
- 谷值: &#123;forecast['valley_load_mw']&#125;MW (&#123;forecast['valley_hour']&#125;)
- 总需求: &#123;forecast['total_energy_mwh']&#125;MWh

可用发电机组:
&#123;json.dumps(generators, ensure_ascii=False)&#125;

储能状态: &#123;json.dumps(storage_status or &#123;&#125;, ensure_ascii=False)&#125;

调度原则:
1. 优先使用可再生能源（风电/光伏）
2. 火电作为基荷+调峰
3. 储能在谷时充电、峰时放电
4. 最小化成本+碳排放

输出 JSON:
&#123;&#123;
    "schedule": [
        &#123;&#123;"hour": "00:00", "solar_mw": 0, "wind_mw": 50, "thermal_mw": 50, "storage_mw": -20, "total_mw": 80&#125;&#125;
    ],
    "total_cost_yuan": 500000,
    "total_co2_tons": 1200,
    "renewable_ratio": 0.35,
    "storage_cycles": 1
&#125;&#125;"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 4. 储能管理

```python
@dataclass
class StorageManager:
    """储能管理器"""

    async def optimize(self, current_soc: float, forecast: dict,
                       electricity_prices: list) -> dict:
        """优化储能充放电"""
        # 谷时充电、峰时放电
        charge_hours = []
        discharge_hours = []

        for i, price in enumerate(electricity_prices):
            if price < 0.3 and current_soc < 0.9:  # 便宜时充电
                charge_hours.append(&#123;"hour": i, "action": "charge", "power_mw": 10&#125;)
            elif price > 0.8 and current_soc > 0.2:  # 贵时放电
                discharge_hours.append(&#123;"hour": i, "action": "discharge", "power_mw": 15&#125;)

        return &#123;
            "current_soc": current_soc,
            "charge_schedule": charge_hours,
            "discharge_schedule": discharge_hours,
            "estimated_revenue": sum(d["power_mw"] * 0.5 for d in discharge_hours) - sum(c["power_mw"] * 0.3 for c in charge_hours),
        &#125;
```

---

## 5. 需求响应

```python
@dataclass
class DemandResponse:
    """需求响应管理器"""

    async def check_peak_alert(self, current_load: float, capacity: float) -> dict:
        """检查是否需要需求响应"""
        utilization = current_load / capacity

        if utilization > 0.95:
            return &#123;
                "alert": "critical",
                "action": "立即启动需求响应",
                "measures": ["通知大用户减负荷", "启动备用电源", "储能放电"],
            &#125;
        elif utilization > 0.85:
            return &#123;
                "alert": "warning",
                "action": "准备需求响应",
                "measures": ["通知储能准备放电", "提醒大用户准备"],
            &#125;
        return &#123;"alert": "normal", "action": "无"&#125;

    async def notify_large_consumers(self, alert: dict):
        """通知大用户"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

        message = await llm.ainvoke(
            f"生成电网负荷预警通知。等级: &#123;alert['alert']&#125;。措施: &#123;alert['measures']&#125;。100字内。"
        )
        return message.content
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了负荷预测 | ☐ |
| 实现了天气影响因子 | ☐ |
| 实现了发电调度优化 | ☐ |
| 实现了储能管理 | ☐ |
| 实现了需求响应 | ☐ |
| 实现了负荷预警 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 32 | 智能能源管理 Agent | 能源 |
| 47 | 智能电力调度 Agent | 电力 |
| 60 | 智能能源调度 Agent | 调度 |
| 471 | 数字孪生与仿真 | 仿真 |
| 517 | Agent 数据分析 | 数据 |
| 527 | Agent 智能制造 | 工业 |
| 528 | Agent 供应链 | 供应链 |
