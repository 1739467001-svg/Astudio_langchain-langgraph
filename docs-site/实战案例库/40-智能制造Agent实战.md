# 实战案例 40：智能制造 Agent

> 智能制造涉及设备监控、故障预测、生产调度、质量检测。Agent 能自动采集设备数据、预测故障、优化生产排程。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"智能制造Agent"&#125;
        U["查询: '设备状态'"] --> MONITOR["设备监控<br/>温度/振动/产能"]
        MONITOR --> PREDICT["故障预测<br/>异常模式识别"]
        PREDICT --> SCHEDULE&#123;"需调度?"&#125;
        SCHEDULE -->|是| OPTIMIZE["生产优化<br/>排程调整"]
        SCHEDULE -->|否| REPORT["状态报告"]
        OPTIMIZE --> REPORT
    end

    style MONITOR fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 设备监控 + 故障预测 + 生产调度优化

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def monitor_equipment(equipment_id: str) -> dict:
    """采集设备运行数据。

    Args:
        equipment_id: 设备ID
    """
    return &#123;
        "equipment_id": equipment_id,
        "status": "运行中",
        "temperature": 75,
        "vibration": 0.8,
        "output_rate": 120,
        "runtime_hours": 1580,
        "efficiency": 0.85,
    &#125;

@tool
async def predict_failure(equipment_data: dict) -> dict:
    """预测设备故障风险。

    Args:
        equipment_data: 设备数据
    """
    temp = equipment_data.get("temperature", 0)
    vibration = equipment_data.get("vibration", 0)
    runtime = equipment_data.get("runtime_hours", 0)

    risk_score = 0
    risks = []

    if temp > 80:
        risk_score += 30
        risks.append(f"温度偏高(&#123;temp&#125;°C)")
    if vibration > 1.0:
        risk_score += 30
        risks.append(f"振动异常(&#123;vibration&#125;)")
    if runtime > 2000:
        risk_score += 20
        risks.append(f"运行时间长(&#123;runtime&#125;小时)")

    risk_level = "high" if risk_score >= 50 else "medium" if risk_score >= 30 else "low"

    return &#123;
        "risk_level": risk_level,
        "risk_score": risk_score,
        "risks": risks,
        "recommended_action": "安排检修" if risk_level == "high" else "持续监控" if risk_level == "medium" else "正常运行",
    &#125;

@tool
async def optimize_schedule(equipment_data: dict, failure_prediction: dict) -> dict:
    """优化生产排程。

    Args:
        equipment_data: 设备数据
        failure_prediction: 故障预测
    """
    efficiency = equipment_data.get("efficiency", 0)
    risk = failure_prediction.get("risk_level", "low")

    if risk == "high":
        return &#123;
            "action": "暂停该设备，安排检修",
            "reallocation": "将生产任务转移到备用设备",
            "estimated_downtime": "4-8小时",
        &#125;
    elif efficiency < 0.7:
        return &#123;
            "action": "降低产能目标，安排维护",
            "reallocation": "无",
            "estimated_downtime": "2小时",
        &#125;
    return &#123;
        "action": "正常运行",
        "reallocation": "无",
        "estimated_downtime": "无",
    &#125;

@tool
async def generate_report(equipment_data: dict, prediction: dict, schedule: dict) -> str:
    """生成智能制造报告。

    Args:
        equipment_data: 设备数据
        prediction: 故障预测
        schedule: 排程优化
    """
    report = f"""# 智能制造报告

## 设备状态
- ID: &#123;equipment_data.get('equipment_id', '未知')&#125;
- 状态: &#123;equipment_data.get('status', '未知')&#125;
- 温度: &#123;equipment_data.get('temperature', 0)&#125;°C
- 振动: &#123;equipment_data.get('vibration', 0)&#125;
- 产能: &#123;equipment_data.get('output_rate', 0)&#125;/小时
- 效率: &#123;equipment_data.get('efficiency', 0):.0%&#125;
- 运行时长: &#123;equipment_data.get('runtime_hours', 0)&#125;小时

## 故障预测
- 风险等级: &#123;prediction.get('risk_level', '未知')&#125;
- 风险评分: &#123;prediction.get('risk_score', 0)&#125;
- 风险项: &#123;', '.join(prediction.get('risks', [])) or '无'&#125;
- 建议: &#123;prediction.get('recommended_action', '无')&#125;

## 排程优化
- 动作: &#123;schedule.get('action', '无')&#125;
- 任务转移: &#123;schedule.get('reallocation', '无')&#125;
- 预计停机: &#123;schedule.get('estimated_downtime', '无')&#125;
"""
    if prediction.get("risk_level") == "high":
        report += "\n⚠️ 高故障风险，建议立即检修！\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能制造助手。你可以：

1. **monitor_equipment**: 采集设备运行数据
2. **predict_failure**: 预测设备故障风险
3. **optimize_schedule**: 优化生产排程
4. **generate_report**: 生成报告

## 工作流程
1. 采集设备数据
2. 预测故障风险
3. 优化排程
4. 生成报告

## 原则
- 数据驱动
- 高风险立即预警
- 排程优化要可执行"""

manufacturing_agent = create_react_agent(
    llm,
    [monitor_equipment, predict_failure, optimize_schedule, generate_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await manufacturing_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "检查设备CNC-001的运行状态和故障风险"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有设备监控 | ☐ |
| 有故障预测 | ☐ |
| 有排程优化 | ☐ |
| 有报告生成 | ☐ |
