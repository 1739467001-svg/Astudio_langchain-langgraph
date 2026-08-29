# 实战案例 44：智能交通管理 Agent

> 交通管理涉及路况监控、信号灯控制、事故处理、出行建议。Agent 能自动采集交通数据、分析拥堵、给出疏导方案。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"交通管理Agent"}
        U["查询: '人民路堵吗'"] --> MONITOR["路况监控<br/>车流+速度+拥堵"]
        MONITOR --> ANALYZE["拥堵分析<br/>程度+原因"]
        ANALYZE --> ACTION{"需疏导?"}
        ACTION -->|是| DIVERGE["疏导方案<br/>信号灯调整+绕行"]
        ACTION -->|否| REPORT["路况报告"]
        DIVERGE --> REPORT
    end

    style MONITOR fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 路况监控 + 拥堵分析 + 疏导方案 + 出行建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def monitor_traffic(road_name: str) -> dict:
    """监控路况数据。

    Args:
        road_name: 道路名称
    """
    return {
        "road": road_name,
        "traffic_flow": 850,        # 车辆/小时
        "avg_speed": 15,            # km/h
        "congestion_index": 7.5,   # 0-10
        "congestion_level": "严重拥堵",
        "incidents": ["前方300米施工"],
        "estimated_delay": "15分钟",
    }

@tool
async def analyze_congestion(traffic_data: dict) -> dict:
    """分析拥堵原因和程度。

    Args:
        traffic_data: 路况数据
    """
    prompt = f"""分析交通拥堵。

路况: {json.dumps(traffic_data, ensure_ascii=False)[:500]}

分析:
1. 拥堵原因
2. 影响范围
3. 预计持续时间
4. 建议措施

输出JSON:
```json
{{
  "cause": "...",
  "impact_scope": "...",
  "estimated_duration": "...",
  "severity": "high/medium/low",
  "suggested_actions": ["措施1"]
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"severity": "low", "suggested_actions": []}

@tool
async def generate_diversion(congestion: dict, road_name: str) -> dict:
    """生成疏导方案。

    Args:
        congestion: 拥堵分析
        road_name: 拥堵道路
    """
    return {
        "road": road_name,
        "actions": [
            {"type": "信号灯调整", "detail": "延长绿灯15秒"},
            {"type": "绕行建议", "detail": "建议走解放路→建设路"},
            {"type": "信息发布", "detail": "通过导航APP推送拥堵提醒"},
        ],
        "estimated_improvement": "预计15分钟后缓解",
    }

@tool
async def generate_traffic_report(traffic_data: dict, analysis: dict, diversion: dict = None) -> str:
    """生成交通报告。

    Args:
        traffic_data: 路况数据
        analysis: 拥堵分析
        diversion: 疏导方案(可选)
    """
    report = f"""# 交通路况报告

## 路况
- 道路: {traffic_data.get('road', '未知')}
- 拥堵等级: {traffic_data.get('congestion_level', '未知')}
- 拥堵指数: {traffic_data.get('congestion_index', 0)}/10
- 车流量: {traffic_data.get('traffic_flow', 0)}辆/小时
- 平均车速: {traffic_data.get('avg_speed', 0)}km/h
- 预计延误: {traffic_data.get('estimated_delay', '未知')}
"""
    if traffic_data.get("incidents"):
        report += f"\n## 事件\n"
        for inc in traffic_data["incidents"]:
            report += f"- {inc}\n"

    report += f"\n## 分析\n"
    report += f"- 原因: {analysis.get('cause', '未知')}\n"
    report += f"- 严重程度: {analysis.get('severity', '未知')}\n"
    report += f"- 预计持续: {analysis.get('estimated_duration', '未知')}\n"

    if diversion:
        report += f"\n## 疏导方案\n"
        for action in diversion.get("actions", []):
            report += f"- {action['type']}: {action['detail']}\n"
        report += f"\n{diversion.get('estimated_improvement', '')}\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能交通管理助手。你可以：

1. **monitor_traffic**: 监控路况数据
2. **analyze_congestion**: 分析拥堵原因
3. **generate_diversion**: 生成疏导方案
4. **generate_traffic_report**: 生成交通报告

## 工作流程
1. 采集路况数据
2. 分析拥堵原因和程度
3. 如需疏导→生成方案
4. 生成报告

## 原则
- 数据驱动
- 严重拥堵立即疏导
- 疏导要可执行"""

traffic_agent = create_react_agent(
    llm,
    [monitor_traffic, analyze_congestion, generate_diversion, generate_traffic_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await traffic_agent.ainvoke({
        "messages": [{"role": "user", "content": "人民路现在堵不堵？"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有路况监控 | ☐ |
| 有拥堵分析 | ☐ |
| 有疏导方案 | ☐ |
| 有报告生成 | ☐ |
