# 实战案例 59：智能供应链优化 Agent

> 供应链优化涉及库存分析、需求预测、供应商评估和补货决策。Agent 能自动分析库存水位、预测需求波动、评估供应商表现并给出补货建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"供应链优化Agent"&#125;
        U["运营: '优化SKU-A001的库存'"] --> INV["库存分析<br/>当前水位+周转率"]
        INV --> DEMAND["需求预测<br/>历史趋势+季节性"]
        DEMAND --> SUPP&#123;"供应商评估"&#125;
        SUPP -->|推荐| ORDER["补货建议<br/>数量+时机+供应商"]
        SUPP -->|延迟| ALERT["缺货预警<br/>安全库存不足"]
        ORDER & ALERT --> REPORT["优化报告"]
    end

    style INV fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style DEMAND fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 库存分析 + 需求预测 + 供应商评估 + 补货决策

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime, timedelta

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def analyze_inventory(sku: str) -> dict:
    """分析库存水位和周转率。

    Args:
        sku: 商品SKU编号
    """
    return &#123;
        "sku": sku,
        "current_stock": 450,
        "safety_stock": 200,
        "max_stock": 2000,
        "avg_daily_sales": 30,
        "days_of_supply": 15,  # 当前库存可支撑天数
        "turnover_rate": 4.2,  # 年周转率
        "last_restock_date": "2026-08-10",
        "stock_status": "正常" if 450 > 200 else "偏低",
        "warehouse_location": "深圳主仓",
    &#125;

@tool
async def forecast_demand(sku: str, inventory_data: dict) -> dict:
    """预测未来需求。

    Args:
        sku: 商品SKU编号
        inventory_data: 库存分析结果
    """
    avg_daily = inventory_data.get("avg_daily_sales", 20)
    # 模拟需求预测（实际可用时间序列模型）
    forecast_7d = avg_daily * 7
    forecast_30d = avg_daily * 30
    # 季节性调整
    seasonality = 1.15  # 旺季系数
    forecast_peak = int(forecast_30d * seasonality)

    current_stock = inventory_data.get("current_stock", 0)
    days_until_stockout = current_stock // avg_daily if avg_daily > 0 else 999

    return &#123;
        "sku": sku,
        "forecast_7d": int(forecast_7d),
        "forecast_30d": int(forecast_30d),
        "forecast_peak_30d": forecast_peak,
        "seasonality_factor": seasonality,
        "trend": "上升",
        "days_until_stockout": days_until_stockout,
        "reorder_needed": days_until_stockout <= 20,
        "recommended_reorder_point": int(avg_daily * 20),  # 20天预警点
    &#125;

@tool
async def evaluate_suppliers(sku: str) -> dict:
    """评估可用供应商。

    Args:
        sku: 商品SKU编号
    """
    suppliers = [
        &#123;
            "supplier_id": "SUP-001",
            "name": "深圳明华电子",
            "lead_time_days": 7,
            "min_order_qty": 500,
            "unit_price": 12.50,
            "quality_score": 0.92,
            "on_time_rate": 0.95,
            "total_score": 0.93,
        &#125;,
        &#123;
            "supplier_id": "SUP-002",
            "name": "东莞永盛科技",
            "lead_time_days": 5,
            "min_order_qty": 300,
            "unit_price": 13.20,
            "quality_score": 0.88,
            "on_time_rate": 0.98,
            "total_score": 0.90,
        &#125;,
        &#123;
            "supplier_id": "SUP-003",
            "name": "广州利通贸易",
            "lead_time_days": 10,
            "min_order_qty": 200,
            "unit_price": 11.80,
            "quality_score": 0.85,
            "on_time_rate": 0.90,
            "total_score": 0.87,
        &#125;,
    ]

    # 按综合评分排序
    suppliers.sort(key=lambda s: s["total_score"], reverse=True)

    return &#123;
        "sku": sku,
        "total_suppliers": len(suppliers),
        "best_supplier": suppliers[0]["name"],
        "suppliers": suppliers,
    &#125;

@tool
async def generate_restock_plan(inventory: dict, forecast: dict, suppliers: dict) -> dict:
    """生成补货计划。

    Args:
        inventory: 库存分析结果
        forecast: 需求预测结果
        suppliers: 供应商评估结果
    """
    days_until_stockout = forecast.get("days_until_stockout", 999)
    forecast_30d = forecast.get("forecast_30d", 600)
    peak_demand = forecast.get("forecast_peak_30d", 700)
    current_stock = inventory.get("current_stock", 0)
    max_stock = inventory.get("max_stock", 2000)

    # 计算补货量：覆盖30天峰值需求 - 当前库存
    needed = max(0, peak_demand - current_stock)
    # 考虑最小起订量
    best_supplier = suppliers.get("suppliers", [&#123;&#125;])[0]
    min_order = best_supplier.get("min_order_qty", 500)
    order_qty = max(needed, min_order)
    # 不超过最大库存
    order_qty = min(order_qty, max_stock - current_stock)

    # 时机判断
    lead_time = best_supplier.get("lead_time_days", 7)
    reorder_point = forecast.get("recommended_reorder_point", 600)

    if days_until_stockout <= lead_time:
        urgency = "紧急"
        action = "立即下单"
        order_date = datetime.now().strftime("%Y-%m-%d")
    elif days_until_stockout <= lead_time + 5:
        urgency = "高"
        action = "3天内下单"
        order_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    else:
        urgency = "常规"
        action = "按计划补货"
        order_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    estimated_cost = round(order_qty * best_supplier.get("unit_price", 12), 2)

    return &#123;
        "report_id": f"SC-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;",
        "generated_at": datetime.now().isoformat(),
        "sku": inventory.get("sku", ""),
        "current_stock": current_stock,
        "forecast_30d": forecast_30d,
        "peak_demand_30d": peak_demand,
        "recommended_order_qty": order_qty,
        "recommended_supplier": best_supplier.get("name", ""),
        "supplier_lead_time": lead_time,
        "estimated_cost_cny": estimated_cost,
        "urgency": urgency,
        "action": action,
        "recommended_order_date": order_date,
        "expected_delivery": (datetime.now() + timedelta(days=lead_time)).strftime("%Y-%m-%d"),
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能供应链优化助手。你可以：

1. **analyze_inventory**: 分析库存水位和周转率
2. **forecast_demand**: 预测未来需求
3. **evaluate_suppliers**: 评估可用供应商
4. **generate_restock_plan**: 生成补货计划

## 工作流程
1. 分析当前库存水位、周转率和可支撑天数
2. 基于历史数据预测未来30天需求（含季节性调整）
3. 评估可用供应商（交期、价格、质量、准时率）
4. 综合生成补货计划（数量、时机、供应商、成本）

## 原则
- 需求预测考虑季节性
- 优先选择综合评分高的供应商
- 补货量不低于最小起订量
- 库存不足时标记紧急
- 成本预估要准确"""

supply_chain_agent = create_react_agent(
    llm,
    [analyze_inventory, forecast_demand, evaluate_suppliers, generate_restock_plan],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await supply_chain_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "请优化SKU-A001的库存，分析当前库存状态、预测需求并给出补货建议"&#125;]
    &#125;)
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
供应链优化报告

报告编号：SC-20260827170000
SKU：A001

库存分析：
- 当前库存：450件
- 安全库存：200件
- 可支撑天数：15天
- 周转率：4.2次/年
- 状态：正常

需求预测（30天）：
- 常规预测：900件
- 旺季峰值：1035件（季节系数1.15）
- 趋势：上升
- 预计耗尽：15天后

供应商评估：
1. 深圳明华电子（综合0.93）— 交期7天/单价12.50元/起订500件
2. 东莞永盛科技（综合0.90）— 交期5天/单价13.20元/起订300件
3. 广州利通贸易（综合0.87）— 交期10天/单价11.80元/起订200件

补货建议：
- 补货数量：585件（覆盖峰值需求）
- 推荐供应商：深圳明华电子
- 紧急程度：高（3天内下单）
- 预计成本：7,312.50元
- 建议下单日期：2026-08-30
- 预计到货日期：2026-09-06
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有库存分析工具 | ☐ |
| 有需求预测工具 | ☐ |
| 有供应商评估 | ☐ |
| 有补货计划生成 | ☐ |
| 考虑季节性调整 | ☐ |
| 有成本预估 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
