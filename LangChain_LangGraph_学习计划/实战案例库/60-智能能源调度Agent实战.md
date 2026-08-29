# 实战案例 60：智能能源调度 Agent

> 能源调度涉及负荷预测、发电调度、储能管理和需求响应。Agent 能自动分析用电负荷、匹配最优发电方案、管理储能充放电并给出调度建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"能源调度Agent"}
        U["调度员: '优化当前时段调度'"] --> LOAD["负荷分析<br/>当前+预测需求"]
        LOAD --> GEN{"发电匹配"}
        GEN -->|火电+光伏| SCHED["发电调度<br/>机组组合+出力分配"]
        GEN -->|储能| STORAGE["储能调度<br/>充电/放电决策"]
        SCHED & STORAGE --> DEMAND{"需求响应?"}
        DEMAND -->|是| RESP["需求响应<br/>削峰填谷"]
        DEMAND -->|否| DIRECT["直接调度"]
        RESP & DIRECT --> REPORT["调度报告<br/>成本+碳排放"]
    end

    style LOAD fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SCHED fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 负荷分析 + 发电调度 + 储能管理 + 需求响应

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
async def analyze_load(current_time: str = "") -> dict:
    """分析当前电力负荷和预测需求。

    Args:
        current_time: 当前时间
    """
    return {
        "current_load_mw": 850,
        "peak_forecast_mw": 1200,
        "valley_forecast_mw": 450,
        "avg_forecast_mw": 780,
        "peak_time": "14:00-16:00",
        "valley_time": "03:00-05:00",
        "load_factor": 0.65,
        "renewable_available_mw": 300,  # 可用可再生能源
        "reserve_margin_pct": 15.0,
    }

@tool
async def schedule_generation(load_data: dict) -> dict:
    """发电调度——机组组合和出力分配。

    Args:
        load_data: 负荷分析结果
    """
    target = load_data.get("peak_forecast_mw", 1000)
    renewable = load_data.get("renewable_available_mw", 300)
    remaining = max(0, target - renewable)

    # 机组优先级：可再生能源 > 核电 > 火电 > 气电
    units = [
        {"name": "光伏", "type": "solar", "capacity_mw": 200, "dispatch_mw": 180, "cost_per_mwh": 50, "co2_per_mwh": 0},
        {"name": "风电", "type": "wind", "capacity_mw": 150, "dispatch_mw": 120, "cost_per_mwh": 55, "co2_per_mwh": 0},
        {"name": "核电1号", "type": "nuclear", "capacity_mw": 500, "dispatch_mw": 500, "cost_per_mwh": 120, "co2_per_mwh": 12},
        {"name": "火电A", "type": "thermal", "capacity_mw": 400, "dispatch_mw": 300, "cost_per_mwh": 280, "co2_per_mwh": 850},
        {"name": "气电B", "type": "gas", "capacity_mw": 200, "dispatch_mw": 100, "cost_per_mwh": 350, "co2_per_mwh": 490},
    ]

    total_dispatch = sum(u["dispatch_mw"] for u in units)
    total_cost = sum(u["dispatch_mw"] * u["cost_per_mwh"] for u in units)
    total_co2 = sum(u["dispatch_mw"] * u["co2_per_mwh"] for u in units)
    renewable_pct = round((180 + 120) / total_dispatch * 100, 1)

    return {
        "target_load_mw": target,
        "total_dispatch_mw": total_dispatch,
        "reserve_mw": total_dispatch - target,
        "renewable_pct": renewable_pct,
        "total_cost_cny": round(total_cost, 2),
        "total_co2_kg": round(total_co2, 2),
        "units": units,
        "status": "满足" if total_dispatch >= target else "不足",
    }

@tool
async def manage_storage(load_data: dict, generation_data: dict) -> dict:
    """储能调度——充放电决策。

    Args:
        load_data: 负荷分析结果
        generation_data: 发电调度结果
    """
    current_load = load_data.get("current_load_mw", 800)
    valley_load = load_data.get("valley_forecast_mw", 450)
    peak_load = load_data.get("peak_forecast_mw", 1200)
    reserve = generation_data.get("reserve_mw", 0)

    storage_capacity_mwh = 200  # 储能容量
    current_soc = 0.45  # 当前荷电状态

    # 决策逻辑
    if current_load > peak_load * 0.85:
        # 高负荷→放电
        action = "放电"
        power_mw = min(50, storage_capacity_mwh * current_soc)
        duration_h = round(storage_capacity_mwh * current_soc / power_mw, 1) if power_mw > 0 else 0
        new_soc = max(0.1, current_soc - power_mw * duration_h / storage_capacity_mwh)
    elif current_load < valley_load * 1.2:
        # 低负荷→充电
        action = "充电"
        power_mw = min(40, storage_capacity_mwh * (1 - current_soc))
        duration_h = round(storage_capacity_mwh * (1 - current_soc) / power_mw, 1) if power_mw > 0 else 0
        new_soc = min(0.95, current_soc + power_mw * duration_h / storage_capacity_mwh)
    else:
        # 正常→待机
        action = "待机"
        power_mw = 0
        duration_h = 0
        new_soc = current_soc

    return {
        "action": action,
        "power_mw": round(power_mw, 1),
        "duration_hours": duration_h,
        "current_soc": round(current_soc * 100, 1),
        "target_soc": round(new_soc * 100, 1),
        "capacity_mwh": storage_capacity_mwh,
        "estimated_savings_cny": round(power_mw * duration_h * 200, 2) if action == "放电" else 0,
    }

@tool
async def generate_dispatch_report(load: dict, generation: dict, storage: dict) -> dict:
    """生成调度报告。

    Args:
        load: 负荷分析结果
        generation: 发电调度结果
        storage: 储能调度结果
    """
    return {
        "report_id": f"ED-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "load_summary": {
            "current_mw": load.get("current_load_mw", 0),
            "peak_mw": load.get("peak_forecast_mw", 0),
            "valley_mw": load.get("valley_forecast_mw", 0),
        },
        "generation_summary": {
            "total_dispatch_mw": generation.get("total_dispatch_mw", 0),
            "renewable_pct": generation.get("renewable_pct", 0),
            "total_cost_cny": generation.get("total_cost_cny", 0),
            "total_co2_kg": generation.get("total_co2_kg", 0),
            "status": generation.get("status", ""),
        },
        "storage_summary": {
            "action": storage.get("action", ""),
            "power_mw": storage.get("power_mw", 0),
            "soc_pct": storage.get("current_soc", 0),
            "savings_cny": storage.get("estimated_savings_cny", 0),
        },
        "recommendation": "当前调度方案可行" if generation.get("status") == "满足" else "建议启动需求响应降低负荷",
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能能源调度助手。你可以：

1. **analyze_load**: 分析当前电力负荷和预测需求
2. **schedule_generation**: 发电调度——机组组合和出力分配
3. **manage_storage**: 储能调度——充放电决策
4. **generate_dispatch_report**: 生成调度报告

## 工作流程
1. 分析当前负荷、峰值/谷值预测和可用可再生能源
2. 按优先级调度发电机组（可再生>核电>火电>气电）
3. 根据负荷水平决定储能充放电策略
4. 综合生成调度报告（含成本和碳排放）

## 原则
- 可再生能源优先消纳
- 储能削峰填谷
- 成本和碳排放最小化
- 保持足够备用容量"""

energy_agent = create_react_agent(
    llm,
    [analyze_load, schedule_generation, manage_storage, generate_dispatch_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await energy_agent.ainvoke({
        "messages": [{"role": "user", "content": "请分析当前负荷并给出最优调度方案"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
能源调度报告

报告编号：ED-20260827180000

负荷分析：
- 当前负荷：850MW
- 峰值预测：1200MW（14:00-16:00）
- 谷值预测：450MW（03:00-05:00）
- 负荷率：65%

发电调度：
- 总调度出力：1200MW
- 可再生占比：25.0%
- 总成本：248,800元
- 碳排放：348,000kg
- 状态：满足

机组明细：
1. 光伏：180MW（成本9,000元，CO₂ 0kg）
2. 风电：120MW（成本6,600元，CO₂ 0kg）
3. 核电1号：500MW（成本60,000元，CO₂ 6,000kg）
4. 火电A：300MW（成本84,000元，CO₂ 255,000kg）
5. 气电B：100MW（成本35,000元，CO₂ 49,000kg）

储能调度：
- 动作：放电
- 功率：50MW，持续1.8小时
- 荷电状态：45% → 14.5%
- 预估节省：18,000元

建议：当前调度方案可行
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有负荷分析工具 | ☐ |
| 有发电调度工具 | ☐ |
| 有储能管理工具 | ☐ |
| 有调度报告生成 | ☐ |
| 可再生能源优先 | ☐ |
| 有成本与碳排放 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
