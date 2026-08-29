# 实战案例 39：智能环保监测 Agent

> 环保监测涉及空气质量、水质、噪声、排放。Agent 能自动采集数据、分析超标、发出预警。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"环保监测Agent"}
        U["查询: '今天空气质量'"] --> COLLECT["数据采集<br/>空气/水质/噪声"]
        COLLECT --> ANALYZE["超标分析<br/>对比标准"]
        ANALYZE --> ALERT{"有超标?"}
        ALERT -->|是| WARN["⚠️ 预警<br/>超标项+影响+建议"]
        ALERT -->|否| REPORT["环境报告"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style WARN fill:#FFCDD2
    style REPORT fill:#C8E6C9
```

**核心技术：** 多源数据采集 + 超标分析 + 预警 + 环境报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_env_data(location: str, data_type: str = "air") -> dict:
    """采集环境数据。

    Args:
        location: 监测点位置
        data_type: 数据类型(air/water/noise)
    """
    # 模拟不同类型的环境数据
    data = {
        "air": {"pm25": 75, "pm10": 120, "no2": 45, "so2": 20, "o3": 80, "aqi": 125},
        "water": {"ph": 7.2, "cod": 25, "nh3n": 1.5, "do": 6.5},
        "noise": {"day_db": 65, "night_db": 52},
    }
    result = data.get(data_type, data["air"])
    return {"location": location, "type": data_type, **result}

@tool
async def analyze_standards(env_data: dict) -> dict:
    """分析是否超标。

    Args:
        env_data: 环境数据
    """
    standards = {
        "pm25": 75, "pm10": 150, "no2": 80, "so2": 50, "o3": 160,
        "cod": 30, "nh3n": 2.0, "do": 5.0,
        "day_db": 70, "night_db": 55,
    }

    exceedances = []
    for key, limit in standards.items():
        value = env_data.get(key)
        if value and value > limit:
            exceedances.append({
                "item": key, "value": value, "limit": limit,
                "exceedance_ratio": round(value / limit, 2),
            })

    return {
        "total_checked": len(standards),
        "exceedances_count": len(exceedances),
        "exceedances": exceedances,
        "has_alert": len(exceedances) > 0,
    }

@tool
async def generate_env_report(env_data: dict, analysis: dict) -> str:
    """生成环境监测报告。

    Args:
        env_data: 环境数据
        analysis: 超标分析
    """
    report = f"""# 环境监测报告

## 监测信息
- 位置: {env_data.get('location', '未知')}
- 类型: {env_data.get('type', '空气')}

## 监测数据
"""
    for key, value in env_data.items():
        if key not in ("location", "type"):
            report += f"- {key}: {value}\n"

    if analysis.get("has_alert"):
        report += f"\n## ⚠️ 超标预警\n"
        report += f"超标项目: {analysis['exceedances_count']}项\n"
        for exc in analysis["exceedances"]:
            report += f"- {exc['item']}: {exc['value']} (标准: {exc['limit']}, 超标{exc['exceedance_ratio']}倍)\n"
        report += "\n### 建议\n- 减少户外活动\n- 关闭门窗\n- 敏感人群注意防护\n"
    else:
        report += "\n## ✅ 达标\n所有指标均在标准范围内。\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能环保监测助手。你可以：

1. **collect_env_data**: 采集环境数据
2. **analyze_standards**: 分析是否超标
3. **generate_env_report**: 生成环境报告

## 工作流程
1. 采集环境数据
2. 对比标准分析超标
3. 生成报告（有超标则预警）

## 原则
- 数据驱动
- 超标要预警
- 建议要可操作"""

env_agent = create_react_agent(
    llm,
    [collect_env_data, analyze_standards, generate_env_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await env_agent.ainvoke({
        "messages": [{"role": "user", "content": "检查北京朝阳区今天的空气质量"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据采集 | ☐ |
| 有超标分析 | ☐ |
| 有报告生成 | ☐ |
