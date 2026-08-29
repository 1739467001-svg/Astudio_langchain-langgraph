# 实战案例 34：智能农业管理 Agent

> 农业管理涉及气象分析、病虫害预警、灌溉决策、产量预测。Agent 能综合多源数据给出农业建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"农业管理Agent"&#125;
        U["农户: '该浇水了吗'"] --> WEATHER["气象分析<br/>温度+降雨+湿度"]
        WEATHER --> SOIL["土壤分析<br/>湿度+养分"]
        SOIL --> DECIDE&#123;"灌溉决策"&#125;
        DECIDE -->|需要| IRRIGATE["灌溉建议<br/>水量+时间"]
        DECIDE -->|不需要| SKIP["暂缓<br/>说明原因"]
        IRRIGATE & SKIP --> ALERT["病虫害预警"]
    end

    style WEATHER fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ALERT fill:#C8E6C9
```

**核心技术：** 气象分析 + 土壤数据 + 灌溉决策 + 病虫害预警

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def get_weather_data(location: str) -> dict:
    """获取气象数据。

    Args:
        location: 地点
    """
    return &#123;
        "location": location,
        "temperature": 28,
        "humidity": 0.45,
        "rainfall_24h": 0,
        "forecast_3day": "晴，无降雨",
        "wind_speed": 3.5,
    &#125;

@tool
async def get_soil_data(field_id: str) -> dict:
    """获取土壤数据。

    Args:
        field_id: 地块ID
    """
    return &#123;
        "field_id": field_id,
        "soil_moisture": 0.35,  # 偏低
        "soil_temp": 25,
        "nitrogen": "中等",
        "phosphorus": "偏低",
        "ph": 6.5,
    &#125;

@tool
async def analyze_irrigation(weather: dict, soil: dict, crop_type: str = "小麦") -> dict:
    """分析灌溉需求。

    Args:
        weather: 气象数据
        soil: 土壤数据
        crop_type: 作物类型
    """
    prompt = f"""分析灌溉需求。

气象: &#123;json.dumps(weather, ensure_ascii=False)&#125;
土壤: &#123;json.dumps(soil, ensure_ascii=False)&#125;
作物: &#123;crop_type&#125;

分析:
1. 是否需要灌溉
2. 建议灌溉量(方/亩)
3. 最佳灌溉时间
4. 注意事项

输出JSON:
```json
&#123;&#123;
  "need_irrigation": true/false,
  "reason": "...",
  "recommended_amount": "...",
  "best_time": "...",
  "notes": "..."
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"need_irrigation": True&#125;

@tool
async def pest_warning(weather: dict, crop_type: str) -> dict:
    """病虫害预警。

    Args:
        weather: 气象数据
        crop_type: 作物类型
    """
    prompt = f"""基于气象条件评估病虫害风险。

气象: &#123;json.dumps(weather, ensure_ascii=False)&#125;
作物: &#123;crop_type&#125;

输出JSON:
```json
&#123;&#123;
  "risk_level": "low/medium/high",
  "potential_pests": ["可能的病虫害"],
  "prevention": ["预防措施"]
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"risk_level": "low"&#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能农业管理助手。你可以：

1. **get_weather_data**: 获取气象数据
2. **get_soil_data**: 获取土壤数据
3. **analyze_irrigation**: 分析灌溉需求
4. **pest_warning**: 病虫害预警

## 工作流程
1. 获取气象和土壤数据
2. 分析灌溉需求
3. 病虫害预警
4. 综合给出建议

## 原则
- 数据驱动决策
- 建议要具体可操作
- 考虑天气和土壤条件"""

farm_agent = create_react_agent(
    llm,
    [get_weather_data, get_soil_data, analyze_irrigation, pest_warning],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await farm_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "地块A种的小麦，该浇水了吗？有什么病虫害风险？"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有气象数据 | ☐ |
| 有土壤数据 | ☐ |
| 有灌溉分析 | ☐ |
| 有病虫害预警 | ☐ |
