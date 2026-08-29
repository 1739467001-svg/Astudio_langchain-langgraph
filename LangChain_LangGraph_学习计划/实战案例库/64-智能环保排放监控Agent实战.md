# 实战案例 64：智能环保排放监控 Agent

> 环保排放监控涉及实时数据采集、排放达标分析、异常检测和预警。Agent 能自动采集排放数据、分析达标情况、识别异常排放并生成环保报告。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"环保排放监控Agent"}
        U["环保员: '检查工厂A排放情况'"] --> COLLECT["数据采集<br/>废气+废水+噪声"]
        COLLECT --> CHECK{"达标分析<br/>对比排放标准"}
        CHECK -->|达标| OK["正常记录"]
        CHECK -->|超标| ALERT["超标预警<br/>标记违规项"]
        CHECK -->|异常趋势| TREND["趋势预警<br/>接近限值"]
        OK & ALERT & TREND --> REPORT["监控报告<br/>合规率+违规项"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CHECK fill:#E3F2FD,stroke:#1565C0
    style ALERT fill:#FFCDD2,stroke:#C62828
    style REPORT fill:#C8E6C9
```

**核心技术：** 多源数据采集 + 排放达标分析 + 异常检测 + 预警报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_emission_data(factory_id: str) -> dict:
    """采集工厂排放数据。

    Args:
        factory_id: 工厂ID
    """
    return {
        "factory_id": factory_id,
        "factory_name": "XX化工厂",
        "timestamp": datetime.now().isoformat(),
        "exhaust_gas": {
            "SO2_mg_m3": 85,        # 二氧化硫
            "NOx_mg_m3": 120,       # 氮氧化物
            "PM_mg_m3": 35,         # 颗粒物
            "CO_mg_m3": 45,         # 一氧化碳
            "VOCs_mg_m3": 28,       # 挥发性有机物
        },
        "wastewater": {
            "COD_mg_L": 58,         # 化学需氧量
            "NH3_N_mg_L": 8.5,     # 氨氮
            "PH": 7.2,
            "SS_mg_L": 42,         # 悬浮物
        },
        "noise_db": {
            "daytime_db": 62,
            "nighttime_db": 48,
        },
        "monitoring_status": "在线",
    }

@tool
async def check_compliance(emission_data: dict) -> dict:
    """排放达标分析。

    Args:
        emission_data: 排放数据
    """
    # 排放标准（GB 16297-1996 大气污染物综合排放标准）
    standards = {
        "exhaust_gas": {
            "SO2_mg_m3": {"limit": 100, "name": "二氧化硫"},
            "NOx_mg_m3": {"limit": 240, "name": "氮氧化物"},
            "PM_mg_m3": {"limit": 50, "name": "颗粒物"},
            "CO_mg_m3": {"limit": 100, "name": "一氧化碳"},
            "VOCs_mg_m3": {"limit": 50, "name": "挥发性有机物"},
        },
        "wastewater": {
            "COD_mg_L": {"limit": 80, "name": "化学需氧量"},
            "NH3_N_mg_L": {"limit": 15, "name": "氨氮"},
            "PH": {"min": 6.0, "max": 9.0, "name": "pH值"},
            "SS_mg_L": {"limit": 50, "name": "悬浮物"},
        },
        "noise_db": {
            "daytime_db": {"limit": 65, "name": "昼间噪声"},
            "nighttime_db": {"limit": 55, "name": "夜间噪声"},
        },
    }

    violations = []
    compliant_items = []
    warning_items = []

    # 检查废气
    for param, value in emission_data.get("exhaust_gas", {}).items():
        std = standards["exhaust_gas"].get(param)
        if std:
            limit = std["limit"]
            if value > limit:
                violations.append({
                    "category": "废气", "param": std["name"], "value": value,
                    "limit": limit, "excess_pct": round((value - limit) / limit * 100, 1),
                    "severity": "高" if value > limit * 1.5 else "中",
                })
            elif value > limit * 0.8:
                warning_items.append({
                    "category": "废气", "param": std["name"], "value": value,
                    "limit": limit, "ratio_pct": round(value / limit * 100, 1),
                })
            else:
                compliant_items.append({"category": "废气", "param": std["name"], "value": value, "limit": limit})

    # 检查废水
    for param, value in emission_data.get("wastewater", {}).items():
        std = standards["wastewater"].get(param)
        if std:
            if "min" in std:
                if value < std["min"] or value > std["max"]:
                    violations.append({
                        "category": "废水", "param": std["name"], "value": value,
                        "limit": f"{std['min']}-{std['max']}", "excess_pct": 0,
                        "severity": "高",
                    })
                else:
                    compliant_items.append({"category": "废水", "param": std["name"], "value": value, "limit": f"{std['min']}-{std['max']}"})
            else:
                limit = std["limit"]
                if value > limit:
                    violations.append({
                        "category": "废水", "param": std["name"], "value": value,
                        "limit": limit, "excess_pct": round((value - limit) / limit * 100, 1),
                        "severity": "高" if value > limit * 1.5 else "中",
                    })
                elif value > limit * 0.8:
                    warning_items.append({
                        "category": "废水", "param": std["name"], "value": value,
                        "limit": limit, "ratio_pct": round(value / limit * 100, 1),
                    })
                else:
                    compliant_items.append({"category": "废水", "param": std["name"], "value": value, "limit": limit})

    # 检查噪声
    for param, value in emission_data.get("noise_db", {}).items():
        std = standards["noise_db"].get(param)
        if std:
            limit = std["limit"]
            if value > limit:
                violations.append({
                    "category": "噪声", "param": std["name"], "value": value,
                    "limit": limit, "excess_pct": round((value - limit) / limit * 100, 1),
                    "severity": "低" if value <= limit * 1.1 else "中",
                })
            else:
                compliant_items.append({"category": "噪声", "param": std["name"], "value": value, "limit": limit})

    total_checks = len(violations) + len(warning_items) + len(compliant_items)
    compliance_rate = round(len(compliant_items) / max(total_checks, 1) * 100, 1)

    return {
        "factory_id": emission_data.get("factory_id", ""),
        "total_checks": total_checks,
        "violations_count": len(violations),
        "warnings_count": len(warning_items),
        "compliant_count": len(compliant_items),
        "compliance_rate_pct": compliance_rate,
        "overall_status": "不达标" if violations else ("预警" if warning_items else "达标"),
        "violations": violations,
        "warnings": warning_items,
        "compliant_items": compliant_items,
    }

@tool
async def generate_monitoring_report(emission_data: dict, compliance: dict) -> dict:
    """生成环保监控报告。

    Args:
        emission_data: 排放数据
        compliance: 达标分析结果
    """
    status = compliance.get("overall_status", "未知")

    if status == "不达标":
        recommendation = "建议立即停产整改，重点处理超标排放项"
    elif status == "预警":
        recommendation = "建议加强监控，排查接近限值的排放源"
    else:
        recommendation = "排放达标，维持正常监控"

    return {
        "report_id": f"EM-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "factory_id": emission_data.get("factory_id", ""),
        "factory_name": emission_data.get("factory_name", ""),
        "monitoring_status": emission_data.get("monitoring_status", ""),
        "emission_summary": {
            "exhaust_gas": emission_data.get("exhaust_gas", {}),
            "wastewater": emission_data.get("wastewater", {}),
            "noise": emission_data.get("noise_db", {}),
        },
        "compliance_summary": {
            "status": status,
            "compliance_rate": compliance.get("compliance_rate_pct", 0),
            "violations": compliance.get("violations", []),
            "warnings": compliance.get("warnings", []),
        },
        "recommendation": recommendation,
        "disclaimer": "本报告由AI辅助生成，仅供参考，具体执法以环保部门认定为准",
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能环保排放监控助手。你可以：

1. **collect_emission_data**: 采集工厂排放数据
2. **check_compliance**: 排放达标分析
3. **generate_monitoring_report**: 生成监控报告

## 工作流程
1. 采集废气、废水、噪声排放数据
2. 对比排放标准，分析达标情况
3. 标记违规项（超标）和预警项（接近限值80%）
4. 生成监控报告，给出整改建议

## 原则
- 严格对照国家标准
- 超标必须标记违规
- 接近限值80%标记预警
- 建议要可执行
- 所有结论标注仅供参考"""

environment_agent = create_react_agent(
    llm,
    [collect_emission_data, check_compliance, generate_monitoring_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await environment_agent.ainvoke({
        "messages": [{"role": "user", "content": "检查工厂F001的排放情况，分析是否达标"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
环保排放监控报告

报告编号：EM-20260827220000
工厂：F001（XX化工厂）
监控状态：在线

排放数据：
废气：
- SO₂: 85 mg/m³（标准≤100）
- NOx: 120 mg/m³（标准≤240）
- 颗粒物: 35 mg/m³（标准≤50）
- CO: 45 mg/m³（标准≤100）
- VOCs: 28 mg/m³（标准≤50）

废水：
- COD: 58 mg/L（标准≤80）
- 氨氮: 8.5 mg/L（标准≤15）
- pH: 7.2（标准6.0-9.0）
- 悬浮物: 42 mg/L（标准≤50）

噪声：
- 昼间: 62 dB（标准≤65）
- 夜间: 48 dB（标准≤55）

达标分析：
- 总检查项: 11
- 达标: 11项
- 违规: 0项
- 预警: 0项
- 合规率: 100%
- 整体状态: 达标

建议：排放达标，维持正常监控

⚠ 本报告由AI辅助生成，仅供参考，具体执法以环保部门认定为准
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据采集工具 | ☐ |
| 有达标分析 | ☐ |
| 有违规检测 | ☐ |
| 有预警检测 | ☐ |
| 有监控报告 | ☐ |
| 有整改建议 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
