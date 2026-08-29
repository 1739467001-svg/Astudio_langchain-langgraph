# 实战案例 32：智能能源管理 Agent

> 能源管理涉及用电分析、能耗预测、节能优化。Agent 能自动分析能耗数据、识别浪费、给出节能建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"能源管理Agent"}
        U["用户: '分析用电情况'"] --> COLLECT["数据收集<br/>电表+设备"]
        COLLECT --> ANALYZE["能耗分析<br/>峰值/低谷/异常"]
        ANALYZE --> OPTIMIZE["优化建议<br/>节能方案"]
        OPTIMIZE --> REPORT["能源报告<br/>用量+费用+建议"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 能耗数据分析 + 峰谷识别 + 节能优化建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_energy_data(building_id: str, period: str = "最近30天") -> dict:
    """收集能耗数据。

    Args:
        building_id: 建筑ID
        period: 时间范围
    """
    # 实际接入能源管理系统API
    return {
        "building": building_id,
        "period": period,
        "total_kwh": 15000,
        "peak_kwh": 800,
        "avg_daily_kwh": 500,
        "peak_hours": ["9:00-11:00", "14:00-16:00"],
        "cost_cny": 12000,
        "devices": [
            {"name": "空调系统", "kwh": 6000, "ratio": 0.4},
            {"name": "照明系统", "kwh": 3000, "ratio": 0.2},
            {"name": "电梯系统", "kwh": 1500, "ratio": 0.1},
            {"name": "其他", "kwh": 4500, "ratio": 0.3},
        ],
    }

@tool
async def analyze_energy(data: dict) -> dict:
    """分析能耗模式，识别异常和节能机会。

    Args:
        data: 能耗数据
    """
    prompt = f"""分析以下能耗数据。

数据: {json.dumps(data, ensure_ascii=False)[:1000]}

分析:
1. 能耗结构（各设备占比）
2. 峰谷时段分析
3. 异常检测（是否有异常高耗能）
4. 节能机会识别

输出JSON:
```json
{{
  "structure_analysis": "能耗结构分析",
  "peak_analysis": "峰谷分析",
  "anomalies": ["异常1"],
  "saving_opportunities": [{{"action": "...", "estimated_saving_kwh": 500, "estimated_saving_cny": 400}}],
  "efficiency_score": 7.5
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"efficiency_score": 5}

@tool
async def generate_energy_report(data: dict, analysis: dict) -> str:
    """生成能源管理报告。

    Args:
        data: 能耗数据
        analysis: 分析结果
    """
    saving = analysis.get("saving_opportunities", [])
    total_saving_kwh = sum(s.get("estimated_saving_kwh", 0) for s in saving)
    total_saving_cny = sum(s.get("estimated_saving_cny", 0) for s in saving)

    report = f"""# 能源管理报告

## 概况
- 时间: {data.get('period', '未知')}
- 总用电: {data.get('total_kwh', 0)} kWh
- 总费用: ¥{data.get('cost_cny', 0)}
- 日均用电: {data.get('avg_daily_kwh', 0)} kWh

## 能耗结构
"""
    for device in data.get("devices", []):
        report += f"- {device['name']}: {device['kwh']} kWh ({device['ratio']:.0%})\n"

    report += f"\n## 分析\n"
    report += f"- 效率评分: {analysis.get('efficiency_score', 0)}/10\n"
    report += f"- 结构分析: {analysis.get('structure_analysis', '未知')}\n"
    report += f"- 峰谷分析: {analysis.get('peak_analysis', '未知')}\n"

    if analysis.get("anomalies"):
        report += f"\n## ⚠️ 异常\n"
        for a in analysis["anomalies"]:
            report += f"- {a}\n"

    if saving:
        report += f"\n## 节能建议\n"
        for i, s in enumerate(saving, 1):
            report += f"{i}. {s.get('action', '')}\n"
            report += f"   预计节省: {s.get('estimated_saving_kwh', 0)} kWh (¥{s.get('estimated_saving_cny', 0)})\n"
        report += f"\n**总预计节省: {total_saving_kwh} kWh (¥{total_saving_cny})**\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能能源管理助手。你可以：

1. **collect_energy_data**: 收集能耗数据
2. **analyze_energy**: 分析能耗模式
3. **generate_energy_report**: 生成能源报告

## 工作流程
1. 收集能耗数据
2. 分析能耗模式和节能机会
3. 生成完整报告

## 原则
- 数据驱动分析
- 节能建议要具体可量化
- 关注异常高耗能"""

energy_agent = create_react_agent(
    llm,
    [collect_energy_data, analyze_energy, generate_energy_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await energy_agent.ainvoke({
        "messages": [{"role": "user", "content": "分析大楼A最近30天的用电情况并给节能建议"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据收集 | ☐ |
| 有能耗分析 | ☐ |
| 有报告生成 | ☐ |
