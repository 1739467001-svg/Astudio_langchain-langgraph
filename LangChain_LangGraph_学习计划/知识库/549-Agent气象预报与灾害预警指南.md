# Agent 气象预报与灾害预警指南

> 气象数据来自卫星、雷达、地面站——海量且复杂。Agent 能分析气象数据、生成预报文本、发布灾害预警、提供穿衣/出行建议。本指南系统讲解气象 Agent 架构、数据分析、预报生成、灾害预警、公众服务。

---

## 1. 气象 Agent 架构

### 工作流

```mermaid
graph TB
    DATA["气象数据<br/>卫星/雷达/地面站"] --> ANALYZE["数据分析<br/>温度/气压/湿度/风"]
    ANALYZE --> FORECAST["预报生成<br/>短临/短期/中期"]
    FORECAST --> WARN["灾害预警<br/>台风/暴雨/高温"]
    ANALYZE --> SERVICE["公众服务<br/>穿衣/出行/健康"]

    style DATA fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style FORECAST fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style WARN fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style SERVICE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 预报生成

```python
@dataclass
class WeatherForecaster:
    """气象预报器"""

    async def forecast(self, location: str, current: dict,
                      model_output: dict = None) -> dict:
        """生成天气预报"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""生成天气预报。

地点: {location}
当前数据: {json.dumps(current, ensure_ascii=False)}
数值模型: {json.dumps(model_output or {}, ensure_ascii=False)[:1000]}

输出 JSON:
{{
    "today": {{
        "weather": "晴/多云/雨",
        "temp_high": 30, "temp_low": 22,
        "wind": "东南风3级",
        "humidity": "60%",
        "uv_index": 8,
        "air_quality": "良"
    }},
    "tomorrow": {{...}},
    "week_forecast": [{{"day": "周一", "weather": "...", "temp": "22-30"}}],
    "forecast_text": "自然语言预报",
    "confidence": 0.85
}}""")

        return json.loads(response.content)

    async def generate_text(self, forecast: dict) -> str:
        """生成自然语言预报"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        response = await llm.ainvoke(f"""将气象数据转为自然语言预报。

数据: {json.dumps(forecast, ensure_ascii=False)}

要求: 通俗易懂、包含建议、200字内。""")

        return response.content
```

---

## 3. 灾害预警

```python
@dataclass
class WeatherAlertSystem:
    """灾害预警系统"""

    alert_thresholds = {
        "typhoon": {"level": ["蓝", "黄", "橙", "红"], "wind_speed": [6, 8, 10, 12]},
        "rainstorm": {"level": ["蓝", "黄", "橙", "红"], "rain_24h": [50, 100, 250, 400]},
        "high_temp": {"level": ["黄", "橙", "红"], "temp": [35, 37, 40]},
        "cold_wave": {"level": ["蓝", "黄", "橙", "红"], "temp_drop": [8, 10, 12, 16]},
        "fog": {"level": ["黄", "橙"], "visibility": [500, 200]},
    }

    async def check_alerts(self, weather_data: dict, location: str) -> dict:
        """检查并发布预警"""
        alerts = []

        # 台风
        wind = weather_data.get("wind_speed", 0)
        if wind > 6:
            level_idx = sum(1 for t in self.alert_thresholds["typhoon"]["wind_speed"] if wind >= t) - 1
            alerts.append({
                "type": "台风", "level": self.alert_thresholds["typhoon"]["level"][max(0, level_idx)],
                "wind_speed": wind, "location": location,
                "action": self._get_action("typhoon", level_idx),
            })

        # 暴雨
        rain = weather_data.get("rain_24h", 0)
        if rain > 50:
            level_idx = sum(1 for t in self.alert_thresholds["rainstorm"]["rain_24h"] if rain >= t) - 1
            alerts.append({
                "type": "暴雨", "level": self.alert_thresholds["rainstorm"]["level"][max(0, level_idx)],
                "rain_24h": rain, "location": location,
                "action": self._get_action("rainstorm", level_idx),
            })

        # 高温
        temp = weather_data.get("temp_high", 30)
        if temp > 35:
            alerts.append({
                "type": "高温", "level": "黄" if temp < 37 else "橙" if temp < 40 else "红",
                "temp": temp, "location": location,
                "action": "减少户外活动，注意防暑",
            })

        return {
            "location": location,
            "alerts": alerts,
            "alert_count": len(alerts),
            "highest_level": max([a["level"] for a in alerts], key=["蓝", "黄", "橙", "红"].index) if alerts else "无",
        }

    def _get_action(self, alert_type: str, level_idx: int) -> str:
        actions = {
            "typhoon": ["注意防范", "减少外出", "停止户外活动", "紧急避险"],
            "rainstorm": ["注意排水", "远离低洼", "停止集会", "紧急转移"],
        }
        return actions.get(alert_type, ["注意防范"])[min(level_idx, 3)]
```

---

## 4. 公众服务

```python
@dataclass
class WeatherPublicService:
    """气象公众服务"""

    async def clothing_advice(self, forecast: dict) -> str:
        """穿衣建议"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.5)

        response = await llm.ainvoke(f"""根据天气给穿衣建议。

天气: {json.dumps(forecast.get('today', {}), ensure_ascii=False)}

100字内，实用接地气。""")

        return response.content

    async def travel_advice(self, forecast: dict, destination: str) -> dict:
        """出行建议"""
        weather = forecast.get("today", {})
        rain = "雨" in weather.get("weather", "")
        temp = weather.get("temp_high", 25)

        suitable = 80
        reasons = []

        if rain:
            suitable -= 30
            reasons.append("有降雨，需带伞")
        if temp > 35 or temp < 0:
            suitable -= 20
            reasons.append("极端温度")
        if weather.get("uv_index", 0) > 8:
            suitable -= 10
            reasons.append("紫外线强")
        if not reasons:
            reasons.append("天气适宜出行")

        return {
            "destination": destination,
            "suitability_score": max(0, suitable),
            "recommendation": "推荐出行" if suitable > 60 else "建议改期" if suitable > 30 else "不建议",
            "reasons": reasons,
            "tips": ["带防晒" if weather.get("uv_index", 0) > 6 else "", "带伞" if rain else ""],
        }
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了预报生成 | ☐ |
| 实现了自然语言预报 | ☐ |
| 实现了灾害预警（5 类） | ☐ |
| 实现了预警分级（蓝/黄/橙/红） | ☐ |
| 实现了穿衣建议 | ☐ |
| 实现了出行建议 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 34 | 智能农业管理 Agent | 农业 |
| 533 | Agent 农业 | 农业 |
| 534 | Agent 智慧交通 | 交通 |
| 537 | Agent 旅游规划 | 旅游 |
| 542 | Agent 环保监测 | 环保 |
| 546 | Agent 城市规划 | 城市 |
