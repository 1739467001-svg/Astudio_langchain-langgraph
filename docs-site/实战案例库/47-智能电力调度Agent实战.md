# 实战案例 47：智能电力调度 Agent

> 电力调度涉及负荷预测、发电调度、故障响应、供需平衡。Agent 能自动分析电网数据、优化调度方案。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"电力调度Agent"&#125;
        U["查询: '当前负荷情况'"] --> MONITOR["电网监控<br/>负荷+发电+频率"]
        MONITOR --> FORECAST["负荷预测<br/>未来1-4小时"]
        FORECAST --> BALANCE&#123;"供需平衡?"&#125;
        BALANCE -->|不平衡| ADJUST["调度调整<br/>增减发电"]
        BALANCE -->|平衡| REPORT["调度报告"]
        ADJUST --> REPORT
    end

    style MONITOR fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 电网监控 + 负荷预测 + 调度优化 + 供需平衡

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def monitor_grid(area: str = "全区") -> dict:
    """监控电网运行数据。

    Args:
        area: 监控区域
    """
    return &#123;
        "area": area,
        "load_mw": 8500,           # 当前负荷(MW)
        "generation_mw": 8800,     # 当前发电(MW)
        "frequency_hz": 50.02,     # 频率(Hz)
        "voltage_kv": 220,
        "status": "正常运行",
        "renewable_ratio": 0.35,   # 可再生能源占比
    &#125;

@tool
async def forecast_load(history_hours: int = 24, forecast_hours: int = 4) -> dict:
    """预测未来负荷。

    Args:
        history_hours: 历史数据小时数
        forecast_hours: 预测小时数
    """
    return &#123;
        "forecast_hours": forecast_hours,
        "predicted_loads": [
            &#123;"hour": 1, "predicted_mw": 8600, "confidence": 0.92&#125;,
            &#123;"hour": 2, "predicted_mw": 8700, "confidence": 0.88&#125;,
            &#123;"hour": 3, "predicted_mw": 8400, "confidence": 0.85&#125;,
            &#123;"hour": 4, "predicted_mw": 8200, "confidence": 0.80&#125;,
        ],
        "peak_predicted": 8700,
        "trend": "先升后降",
    &#125;

@tool
async def check_balance(grid_data: dict, forecast: dict) -> dict:
    """检查供需平衡。

    Args:
        grid_data: 电网数据
        forecast: 负荷预测
    """
    current_load = grid_data.get("load_mw", 0)
    current_gen = grid_data.get("generation_mw", 0)
    balance = current_gen - current_load

    peak_predicted = forecast.get("peak_predicted", current_load)

    imbalances = []
    if balance < 200:
        imbalances.append(f"当前裕量不足(&#123;balance&#125;MW)")
    if peak_predicted > current_gen:
        imbalances.append(f"预测峰值&#123;peak_predicted&#125;MW将超过发电&#123;current_gen&#125;MW")

    return &#123;
        "current_balance_mw": balance,
        "is_balanced": len(imbalances) == 0,
        "imbalances": imbalances,
        "recommended_action": "增加发电" if imbalances else "保持现状",
    &#125;

@tool
async def generate_dispatch_report(grid: dict, forecast: dict, balance: dict) -> str:
    """生成电力调度报告。

    Args:
        grid: 电网数据
        forecast: 负荷预测
        balance: 供需平衡
    """
    report = f"""# 电力调度报告

## 电网状态
- 区域: &#123;grid.get('area', '未知')&#125;
- 状态: &#123;grid.get('status', '未知')&#125;
- 当前负荷: &#123;grid.get('load_mw', 0)&#125; MW
- 当前发电: &#123;grid.get('generation_mw', 0)&#125; MW
- 频率: &#123;grid.get('frequency_hz', 0)&#125; Hz
- 电压: &#123;grid.get('voltage_kv', 0)&#125; kV
- 可再生占比: &#123;grid.get('renewable_ratio', 0):.0%&#125;

## 负荷预测
"""
    for item in forecast.get("predicted_loads", []):
        report += f"- +&#123;item['hour']&#125;h: &#123;item['predicted_mw']&#125;MW (置信度&#123;item['confidence']:.0%&#125;)\n"

    report += f"\n## 供需平衡\n"
    report += f"- 当前裕量: &#123;balance.get('current_balance_mw', 0)&#125; MW\n"
    report += f"- 状态: &#123;'✅ 平衡' if balance.get('is_balanced') else '⚠️ 不平衡'&#125;\n"

    if not balance.get("is_balanced"):
        report += f"\n## ⚠️ 不平衡预警\n"
        for imb in balance.get("imbalances", []):
            report += f"- &#123;imb&#125;\n"
        report += f"- 建议: &#123;balance.get('recommended_action', '')&#125;\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能电力调度助手。你可以：

1. **monitor_grid**: 监控电网数据
2. **forecast_load**: 预测负荷
3. **check_balance**: 检查供需平衡
4. **generate_dispatch_report**: 生成调度报告

## 工作流程
1. 监控当前电网状态
2. 预测未来负荷
3. 检查供需平衡
4. 生成调度报告

## 原则
- 供需不平衡要预警
- 安全裕量>200MW
- 调度建议要可执行"""

power_agent = create_react_agent(
    llm,
    [monitor_grid, forecast_load, check_balance, generate_dispatch_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await power_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "检查当前电网负荷和未来4小时预测"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有电网监控 | ☐ |
| 有负荷预测 | ☐ |
| 有供需平衡 | ☐ |
| 有调度报告 | ☐ |
