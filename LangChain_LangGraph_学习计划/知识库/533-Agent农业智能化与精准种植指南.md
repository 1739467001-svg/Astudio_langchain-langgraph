# Agent 农业智能化与精准种植指南

> 农业不只靠经验——Agent 能分析土壤数据、气象预报、作物生长模型，提供精准的灌溉、施肥、病虫害防治建议。本指南系统讲解农业 Agent 架构、环境监测、作物管理、病虫害识别、产量预测。

---

## 1. 农业 Agent 架构

### 工作流

```mermaid
graph TB
    SENSORS["传感器数据<br/>土壤/气象/水质"] --> ANALYZE["环境分析<br/>生长条件评估"]
    ANALYZE --> CROP["作物管理<br/>灌溉/施肥/修剪"]
    SENSORS --> PEST["病虫害识别<br/>图像+症状"]
    ANALYZE --> YIELD["产量预测<br/>基于模型"]
    CROP --> ADVISE["种植建议<br/>推送到农户"]
    PEST --> TREAT["防治方案<br/>农药/生物防治"]

    style SENSORS fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style CROP fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style PEST fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 环境监测

```python
@dataclass
class EnvironmentMonitor:
    """环境监测器"""

    async def analyze(self, sensor_data: dict, crop_type: str) -> dict:
        """分析环境条件"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 理想条件对比
        ideal = self._get_ideal_conditions(crop_type)

        prompt = f"""分析农业环境数据。

作物: {crop_type}
传感器数据: {json.dumps(sensor_data, ensure_ascii=False)}
理想条件: {json.dumps(ideal, ensure_ascii=False)}

输出 JSON:
{{
    "temperature": {{"current": 0, "ideal": "...", "status": "正常/偏高/偏低"}},
    "moisture": {{"current": 0, "ideal": "...", "status": "..."}},
    "soil_ph": {{"current": 0, "ideal": "...", "status": "..."}},
    "light": {{"current": 0, "status": "..."}},
    "alerts": ["需要关注的问题"],
    "recommendations": ["建议操作"]
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    def _get_ideal_conditions(self, crop: str) -> dict:
        conditions = {
            "rice": {"temp": "25-32°C", "moisture": "高", "ph": "5.5-6.5"},
            "wheat": {"temp": "15-25°C", "moisture": "中", "ph": "6.0-7.0"},
            "corn": {"temp": "20-30°C", "moisture": "中高", "ph": "6.0-6.8"},
            "tomato": {"temp": "20-28°C", "moisture": "中", "ph": "6.0-6.8"},
        }
        return conditions.get(crop, conditions["wheat"])
```

---

## 3. 病虫害识别

```python
@dataclass
class PestIdentifier:
    """病虫害识别器"""

    async def identify(self, crop_type: str, image_path: str,
                      symptoms: str = "") -> dict:
        """识别病虫害"""
        import base64
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        from langchain_core.messages import HumanMessage

        response = await llm.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": f"""识别作物病虫害。

作物: {crop_type}
症状描述: {symptoms}

输出 JSON:
{{
    "disease": "病害名称",
    "confidence": 0.85,
    "severity": "轻/中/重",
    "cause": "病因",
    "treatment": {{"chemical": ["用药建议"], "biological": ["生物防治"], "cultural": ["管理措施"]}},
    "prevention": ["预防措施"]
}}"""},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
            ])
        ])

        try:
            return json.loads(response.content)
        except:
            return {"analysis": response.content[:500]}
```

---

## 4. 灌溉决策

```python
@dataclass
class IrrigationAdvisor:
    """灌溉决策器"""

    async def advise(self, soil_moisture: float, weather_forecast: dict,
                     crop_type: str, growth_stage: str) -> dict:
        """灌溉建议"""
        # 需水阈值
        thresholds = {"seedling": 0.3, "growing": 0.5, "flowering": 0.6, "mature": 0.4}
        threshold = thresholds.get(growth_stage, 0.5)

        will_rain = weather_forecast.get("rain_probability", 0) > 0.5
        rain_amount = weather_forecast.get("rain_amount_mm", 0)

        if soil_moisture < threshold:
            if will_rain and rain_amount > 10:
                action = "无需灌溉，预计降雨充足"
            elif will_rain and rain_amount > 5:
                action = "少量灌溉补充"
            else:
                action = f"需要灌溉，建议灌水量: {(threshold - soil_moisture) * 1000:.0f}m³/公顷"
        else:
            action = "土壤水分充足，无需灌溉"

        return {
            "soil_moisture": soil_moisture,
            "threshold": threshold,
            "will_rain": will_rain,
            "action": action,
            "crop": crop_type,
            "growth_stage": growth_stage,
        }
```

---

## 5. 产量预测

```python
@dataclass
class YieldPredictor:
    """产量预测器"""

    async def predict(self, crop_type: str, area_hectares: float,
                      conditions: dict, history: list) -> dict:
        """预测产量"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        avg_yield = sum(h.get("yield_tons", 0) for h in history[-5:]) / max(len(history[-5:]), 1)

        response = await llm.ainvoke(f"""预测作物产量。

作物: {crop_type}
面积: {area_hectares} 公顷
环境条件: {json.dumps(conditions, ensure_ascii=False)}
历史5年平均产量: {avg_yield:.0f} 吨

输出 JSON:
{{
    "predicted_yield_tons": 0,
    "yield_per_hectare": 0,
    "confidence": 0.8,
    "key_factors": ["影响产量的关键因素"],
    "risk_factors": ["风险因素"],
    "recommendations": ["提升产量建议"]
}}""")

        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了环境监测 | ☐ |
| 实现了病虫害识别（VLM） | ☐ |
| 实现了灌溉决策 | ☐ |
| 实现了产量预测 | ☐ |
| 有作物理想条件库 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 34 | 智能农业管理 Agent | 农业 |
| 527 | Agent 智能制造 | 工业 |
| 529 | Agent 能源管理 | 能源 |
| 443 | 多模态文档智能 | VLM |
| 471 | 数字孪生 | 仿真 |
