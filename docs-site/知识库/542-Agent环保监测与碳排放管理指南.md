# Agent 环保监测与碳排放管理指南

> 环保 Agent 能实时监测空气/水质/噪音、预测污染趋势、追踪碳排放、生成合规报告。本指南系统讲解环保 Agent 架构、环境监测、污染预警、碳足迹计算、ESG 报告。

---

## 1. 环保 Agent 架构

### 工作流

```mermaid
graph TB
    SENSORS["监测站数据<br/>空气/水质/噪音"] --> ANALYZE["环境分析<br/>超标检测+趋势"]
    ANALYZE --> ALERT["污染预警<br/>分级告警"]
    ANALYZE --> FORECAST["污染预测<br/>扩散模型"]
    EMISSION["排放数据"] --> CARBON["碳足迹计算<br/>范围1/2/3"]
    CARBON --> ESG["ESG报告<br/>自动生成"]
    ALERT --> REPORT["环保报告<br/>合规检查"]

    style ANALYZE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CARBON fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ALERT fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 环境监测

```python
@dataclass
class EnvironmentMonitor:
    """环境监测器"""

    standards = &#123;
        "pm25": &#123;"excellent": 35, "good": 75, "mild": 115, "moderate": 150, "heavy": 250&#125;,
        "pm10": &#123;"excellent": 50, "good": 150, "mild": 250, "moderate": 350, "heavy": 420&#125;,
        "no2": &#123;"limit": 80&#125;,
        "so2": &#123;"limit": 50&#125;,
        "noise": &#123;"daytime": 60, "nighttime": 50&#125;,
    &#125;

    async def analyze(self, station_id: str, readings: dict) -> dict:
        """分析监测数据"""
        alerts = []

        for pollutant, value in readings.items():
            standard = self.standards.get(pollutant, &#123;&#125;)
            level = self._classify_level(pollutant, value, standard)
            if level in ["moderate", "heavy", "severe"]:
                alerts.append(&#123;
                    "pollutant": pollutant,
                    "value": value,
                    "level": level,
                    "standard": standard,
                    "action": self._get_action(level),
                &#125;)

        return &#123;
            "station_id": station_id,
            "readings": readings,
            "overall_level": self._overall_level(readings),
            "alerts": alerts,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;

    async def forecast_pollution(self, current: dict, weather_forecast: dict) -> dict:
        """污染预测"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        wind_speed = weather_forecast.get("wind_speed", 3)
        rain = weather_forecast.get("rain_probability", 0)

        # 风速大→扩散好，降雨→净化
        dispersal_factor = min(1.5, wind_speed / 5)
        rain_factor = 0.7 if rain > 0.5 else 1.0

        response = await llm.ainvoke(f"""预测空气质量。

当前: &#123;json.dumps(current, ensure_ascii=False)&#125;
天气预报: &#123;json.dumps(weather_forecast, ensure_ascii=False)&#125;
扩散因子: &#123;dispersal_factor:.1f&#125;
降雨因子: &#123;rain_factor&#125;

输出 JSON:
&#123;&#123;
    "next_24h_forecast": [&#123;&#123;"hour": "00", "pm25": 0, "level": "...", "trend": "↑/↓/→"&#125;&#125;],
    "peak_pollution_hour": "08:00",
    "recommendation": "建议措施"
&#125;&#125;""")

        return json.loads(response.content)

    def _classify_level(self, pollutant: str, value: float, standard: dict) -> str:
        if pollutant in ["pm25", "pm10"]:
            if value <= standard.get("excellent", 0): return "excellent"
            if value <= standard.get("good", 0): return "good"
            if value <= standard.get("mild", 0): return "mild"
            if value <= standard.get("moderate", 0): return "moderate"
            return "heavy"
        else:
            limit = standard.get("limit", 100)
            return "normal" if value <= limit else "exceeded"
```

---

## 3. 碳足迹计算

```python
@dataclass
class CarbonFootprintCalculator:
    """碳足迹计算器"""

    emission_factors = &#123;
        "electricity": 0.581,      # kgCO2/kWh
        "natural_gas": 2.162,       # kgCO2/m³
        "gasoline": 2.325,          # kgCO2/L
        "diesel": 2.652,            # kgCO2/L
        "coal": 1.977,              # kgCO2/kg
        "flight_short": 0.255,      # kgCO2/km/pax
        "flight_long": 0.195,
    &#125;

    async def calculate(self, company_data: dict) -> dict:
        """计算企业碳足迹（范围1/2/3）"""
        scope1 = await self._calc_scope1(company_data.get("scope1", &#123;&#125;))
        scope2 = await self._calc_scope2(company_data.get("scope2", &#123;&#125;))
        scope3 = await self._calc_scope3(company_data.get("scope3", &#123;&#125;))

        total = scope1 + scope2 + scope3

        return &#123;
            "scope1_direct": f"&#123;scope1:.0f&#125; tCO2e",
            "scope2_electricity": f"&#123;scope2:.0f&#125; tCO2e",
            "scope3_supply_chain": f"&#123;scope3:.0f&#125; tCO2e",
            "total": f"&#123;total:.0f&#125; tCO2e",
            "carbon_intensity": f"&#123;total / max(company_data.get('revenue_millions', 1), 1):.1f&#125; tCO2e/百万收入",
        &#125;

    def _calc_scope1(self, data: dict) -> float:
        """范围1：直接排放"""
        total = 0
        total += data.get("natural_gas_m3", 0) * self.emission_factors["natural_gas"] / 1000
        total += data.get("gasoline_l", 0) * self.emission_factors["gasoline"] / 1000
        total += data.get("diesel_l", 0) * self.emission_factors["diesel"] / 1000
        total += data.get("coal_kg", 0) * self.emission_factors["coal"] / 1000
        return total

    def _calc_scope2(self, data: dict) -> float:
        """范围2：电力间接排放"""
        return data.get("electricity_kwh", 0) * self.emission_factors["electricity"] / 1000

    def _calc_scope3(self, data: dict) -> float:
        """范围3：供应链排放（简化）"""
        total = 0
        total += data.get("business_flights_km", 0) * self.emission_factors["flight_short"] / 1000
        total += data.get("supply_chain_estimate_tons", 0) * 0.5  # 简化系数
        return total
```

---

## 4. ESG 报告

```python
@dataclass
class ESGReportGenerator:
    """ESG 报告生成器"""

    async def generate(self, company_data: dict, carbon_data: dict,
                       environmental_data: dict) -> str:
        """生成 ESG 报告"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""生成企业 ESG 报告。

企业信息: &#123;json.dumps(company_data, ensure_ascii=False)[:500]&#125;
碳足迹: &#123;json.dumps(carbon_data, ensure_ascii=False)&#125;
环境数据: &#123;json.dumps(environmental_data, ensure_ascii=False)[:500]&#125;

报告结构:
1. 环境(E)表现：碳排放、能源消耗、废物管理
2. 社会(S)表现：员工、社区、客户
3. 治理(G)表现：合规、风险管理、伦理
4. 改进目标与措施

用中文，正式报告风格。"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了环境监测（多污染物分级） | ☐ |
| 实现了污染预测（天气因子） | ☐ |
| 实现了碳足迹计算（范围1/2/3） | ☐ |
| 实现了 ESG 报告生成 | ☐ |
| 有污染预警机制 | ☐ |
| 有排放因子库 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 39 | 智能环保排放监控 Agent | 环保 |
| 64 | 智能环保排放监控 Agent | 环保 |
| 529 | Agent 能源管理 | 能源 |
| 534 | Agent 智慧交通 | 交通 |
| 540 | Agent 智能建筑 | 建筑 |
| 451 | LLM 应用合规 | 合规 |
