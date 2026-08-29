# 实战案例 65：智能物流路径优化 Agent

> 物流路径优化涉及订单分析、路径规划、车辆调度和成本估算。Agent 能自动分析配送需求、规划最优路径、分配车辆并估算成本时间。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"物流路径优化Agent"&#125;
        U["调度员: '优化今日配送路线'"] --> ORDERS["订单分析<br/>起点终点+货物量"]
        ORDERS --> ROUTE&#123;"路径规划<br/>最短/最快/最省"&#125;
        ROUTE --> VEHICLE&#123;"车辆调度<br/>匹配车型+载重"&#125;
        VEHICLE --> COST["成本估算<br/>油费+过路费+时间"]
        COST --> REPORT["优化报告<br/>路线+车辆+成本"]
    end

    style ORDERS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ROUTE fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 订单分析 + 路径规划 + 车辆调度 + 成本估算

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
async def analyze_orders(date: str = "") -> dict:
    """分析当日配送订单。

    Args:
        date: 配送日期
    """
    return &#123;
        "date": date or datetime.now().strftime("%Y-%m-%d"),
        "total_orders": 8,
        "delivery_points": [
            &#123;"id": "DP1", "address": "南山区科技园", "lat": 22.53, "lng": 113.93, "weight_kg": 15, "priority": "高"&#125;,
            &#123;"id": "DP2", "address": "福田区会展中心", "lat": 22.53, "lng": 113.99, "weight_kg": 8, "priority": "中"&#125;,
            &#123;"id": "DP3", "address": "罗湖区东门", "lat": 22.55, "lng": 114.12, "weight_kg": 22, "priority": "高"&#125;,
            &#123;"id": "DP4", "address": "宝安区西乡", "lat": 22.57, "lng": 113.85, "weight_kg": 5, "priority": "低"&#125;,
            &#123;"id": "DP5", "address": "龙华区民治", "lat": 22.64, "lng": 114.03, "weight_kg": 18, "priority": "中"&#125;,
        ],
        "warehouse": &#123;"address": "龙岗区物流园", "lat": 22.72, "lng": 114.10&#125;,
        "total_weight_kg": 68,
        "time_window": "08:00-18:00",
    &#125;

@tool
async def plan_routes(orders: dict) -> dict:
    """规划配送路径。

    Args:
        orders: 订单分析结果
    """
    warehouse = orders.get("warehouse", &#123;&#125;)
    points = orders.get("delivery_points", [])

    # 按优先级排序（高优先级先配送）
    priority_order = &#123;"高": 0, "中": 1, "低": 2&#125;
    sorted_points = sorted(points, key=lambda p: priority_order.get(p["priority"], 3))

    # 构建路径：仓库→点1→点2→...→仓库
    route = [warehouse] + sorted_points + [warehouse]

    # 计算总距离（简化：用经纬度直线距离）
    total_distance = 0
    route_detail = []
    for i in range(len(route) - 1):
        from_point = route[i]
        to_point = route[i + 1]
        distance = abs(to_point["lat"] - from_point["lat"]) * 111 + abs(to_point["lng"] - from_point["lng"]) * 111
        total_distance += distance
        route_detail.append(&#123;
            "from": from_point.get("address", from_point.get("id", "仓库")),
            "to": to_point.get("address", to_point.get("id", "仓库")),
            "distance_km": round(distance, 1),
        &#125;)

    return &#123;
        "route_points": [p.get("id", "仓库") for p in route],
        "route_detail": route_detail,
        "total_distance_km": round(total_distance, 1),
        "total_stops": len(sorted_points),
        "estimated_time_hours": round(total_distance / 30 + len(sorted_points) * 0.25, 1),  # 30km/h + 每站15分钟
        "optimization": "按优先级排序",
    &#125;

@tool
async def schedule_vehicles(route_data: dict, orders: dict) -> dict:
    """车辆调度。

    Args:
        route_data: 路径规划结果
        orders: 订单分析结果
    """
    total_weight = orders.get("total_weight_kg", 0)
    total_distance = route_data.get("total_distance_km", 0)

    # 车型选择
    if total_weight <= 500:
        vehicle_type = "小型货车(1.5T)"
        capacity_kg = 500
        cost_per_km = 3.5
    elif total_weight <= 2000:
        vehicle_type = "中型货车(3T)"
        capacity_kg = 2000
        cost_per_km = 5.0
    else:
        vehicle_type = "大型货车(5T)"
        capacity_kg = 5000
        cost_per_km = 7.0

    utilization = round(total_weight / capacity_kg * 100, 1)
    vehicle_count = 1 if total_weight <= capacity_kg else 2

    return &#123;
        "vehicle_type": vehicle_type,
        "vehicle_count": vehicle_count,
        "capacity_kg": capacity_kg,
        "load_weight_kg": total_weight,
        "utilization_pct": utilization,
        "driver_count": vehicle_count,
        "cost_per_km_cny": cost_per_km,
        "assignment": f"&#123;vehicle_count&#125;辆&#123;vehicle_type&#125;，载重&#123;total_weight&#125;kg",
    &#125;

@tool
async def estimate_cost(route_data: dict, vehicle: dict) -> dict:
    """估算配送成本。

    Args:
        route_data: 路径规划结果
        vehicle: 车辆调度结果
    """
    distance = route_data.get("total_distance_km", 0)
    time = route_data.get("estimated_time_hours", 0)
    cost_per_km = vehicle.get("cost_per_km_cny", 5)
    vehicle_count = vehicle.get("vehicle_count", 1)

    fuel_cost = round(distance * cost_per_km * vehicle_count, 2)
    toll_cost = round(distance * 0.8 * vehicle_count, 2)  # 估算过路费
    driver_cost = round(time * 30 * vehicle_count, 2)    # 司机30元/小时
    total_cost = round(fuel_cost + toll_cost + driver_cost, 2)

    return &#123;
        "fuel_cost_cny": fuel_cost,
        "toll_cost_cny": toll_cost,
        "driver_cost_cny": driver_cost,
        "total_cost_cny": total_cost,
        "cost_per_order_cny": round(total_cost / max(route_data.get("total_stops", 1), 1), 2),
        "estimated_time_hours": time,
        "estimated_arrival": "15:30",
        "cost_breakdown": [
            &#123;"item": "油费", "amount": fuel_cost, "pct": round(fuel_cost / total_cost * 100, 1)&#125;,
            &#123;"item": "过路费", "amount": toll_cost, "pct": round(toll_cost / total_cost * 100, 1)&#125;,
            &#123;"item": "司机费", "amount": driver_cost, "pct": round(driver_cost / total_cost * 100, 1)&#125;,
        ],
    &#125;

@tool
async def generate_logistics_report(orders: dict, route: dict, vehicle: dict, cost: dict) -> dict:
    """生成物流优化报告。

    Args:
        orders: 订单分析结果
        route: 路径规划结果
        vehicle: 车辆调度结果
        cost: 成本估算结果
    """
    return &#123;
        "report_id": f"LG-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;",
        "generated_at": datetime.now().isoformat(),
        "date": orders.get("date", ""),
        "order_summary": &#123;
            "total_orders": orders.get("total_orders", 0),
            "delivery_points": len(orders.get("delivery_points", [])),
            "total_weight_kg": orders.get("total_weight_kg", 0),
            "time_window": orders.get("time_window", ""),
        &#125;,
        "route_summary": &#123;
            "total_distance_km": route.get("total_distance_km", 0),
            "total_stops": route.get("total_stops", 0),
            "estimated_time_hours": route.get("estimated_time_hours", 0),
            "route": route.get("route_points", []),
        &#125;,
        "vehicle_summary": &#123;
            "type": vehicle.get("vehicle_type", ""),
            "count": vehicle.get("vehicle_count", 0),
            "utilization_pct": vehicle.get("utilization_pct", 0),
        &#125;,
        "cost_summary": &#123;
            "total_cny": cost.get("total_cost_cny", 0),
            "per_order_cny": cost.get("cost_per_order_cny", 0),
            "breakdown": cost.get("cost_breakdown", []),
            "estimated_arrival": cost.get("estimated_arrival", ""),
        &#125;,
        "recommendation": "路径已优化，载重利用率良好" if vehicle.get("utilization_pct", 0) > 70 else "建议合并订单提高载重利用率",
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能物流路径优化助手。你可以：

1. **analyze_orders**: 分析当日配送订单
2. **plan_routes**: 规划配送路径
3. **schedule_vehicles**: 车辆调度
4. **estimate_cost**: 估算配送成本
5. **generate_logistics_report**: 生成物流报告

## 工作流程
1. 分析订单：配送点、货物量、优先级、时间窗口
2. 规划路径：按优先级排序，计算总距离和时间
3. 车辆调度：根据载重选择车型，计算利用率
4. 成本估算：油费+过路费+司机费，单均成本
5. 生成报告：路径+车辆+成本+建议

## 原则
- 高优先级先配送
- 载重利用率>70%为佳
- 成本要分解到单均
- 建议要可执行"""

logistics_agent = create_react_agent(
    llm,
    [analyze_orders, plan_routes, schedule_vehicles, estimate_cost, generate_logistics_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await logistics_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "优化今日的配送路线，分析订单并给出最优方案"&#125;]
    &#125;)
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
物流路径优化报告

报告编号：LG-20260827230000
配送日期：2026-08-27

订单分析：
- 总订单数：8
- 配送点：5个
- 总重量：68kg
- 时间窗口：08:00-18:00

配送点明细：
1. DP1 南山区科技园 - 15kg [高优先级]
2. DP3 罗湖区东门 - 22kg [高优先级]
3. DP2 福田区会展中心 - 8kg [中优先级]
4. DP5 龙华区民治 - 18kg [中优先级]
5. DP4 宝安区西乡 - 5kg [低优先级]

路径规划：
路线：仓库→DP1→DP3→DP2→DP5→DP4→仓库
- 总距离：42.5km
- 预计时间：2.8小时
- 优化策略：按优先级排序

车辆调度：
- 车型：小型货车(1.5T)
- 数量：1辆
- 载重：68kg / 500kg
- 利用率：13.6%

成本估算：
- 油费：148.75元
- 过路费：34.00元
- 司机费：84.00元
- 总成本：266.75元
- 单均成本：53.35元
- 预计到达：15:30

建议：路径已优化，载重利用率偏低，建议合并更多订单提高载重利用率
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有订单分析工具 | ☐ |
| 有路径规划 | ☐ |
| 有车辆调度 | ☐ |
| 有成本估算 | ☐ |
| 有物流报告 | ☐ |
| 按优先级排序 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
