# Agent 供应链优化与物流管理指南

> 供应链涉及采购、库存、物流、配送多个环节——Agent 能预测需求、优化库存、规划路线、跟踪货物。本指南系统讲解供应链 Agent 架构、需求预测、库存优化、路径规划、物流跟踪。

---

## 1. 供应链 Agent 架构

### 工作流

```mermaid
graph TB
    DEMAND["需求预测<br/>历史+季节+趋势"] --> INVENTORY["库存优化<br/>安全库存+补货"]
    INVENTORY --> PROCUREMENT["采购建议<br/>供应商+价格"]
    PROCUREMENT --> WAREHOUSE["仓储管理<br/>入库/出库/拣货"]
    WAREHOUSE --> ROUTE["路径规划<br/>配送优化"]
    ROUTE --> TRACKING["物流跟踪<br/>实时位置+ETA"]
    TRACKING --> DELIVERY["送达确认<br/>签收+评价"]

    style DEMAND fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style ROUTE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style TRACKING fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 需求预测

```python
@dataclass
class DemandForecaster:
    """需求预测器"""

    async def forecast(self, product_id: str, history: list,
                       external_factors: dict = None) -> dict:
        """预测未来需求"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        # 统计分析
        avg_demand = sum(h["quantity"] for h in history[-30:]) / 30
        recent_trend = sum(h["quantity"] for h in history[-7:]) / 7

        trend = "上升" if recent_trend > avg_demand * 1.1 else "下降" if recent_trend < avg_demand * 0.9 else "平稳"

        response = await llm.ainvoke(f"""预测产品需求。

产品ID: {product_id}
历史30天平均: {avg_demand:.0f}
最近7天平均: {recent_trend:.0f}
趋势: {trend}
外部因素: {json.dumps(external_factors or {}, ensure_ascii=False)}

输出 JSON:
{{
    "next_7_days": [100, 105, 110, 108, 115, 120, 118],
    "next_30_days_avg": 112,
    "confidence": 0.85,
    "key_factors": ["促销活动", "季节性"],
    "recommendation": "建议备货量"
}}""")

        return json.loads(response.content)
```

---

## 3. 库存优化

```python
@dataclass
class InventoryOptimizer:
    """库存优化器"""

    async def optimize(self, product_id: str, current_stock: int,
                       forecast: dict, lead_time_days: int = 7) -> dict:
        """优化库存"""
        # 安全库存 = 平均需求 × 交货期 × 安全系数
        avg_daily = forecast.get("next_30_days_avg", 100)
        safety_stock = int(avg_daily * lead_time_days * 1.5)

        # 再订购点 = 安全库存 + 交货期需求
        reorder_point = safety_stock + int(avg_daily * lead_time_days)

        # 补货量 = 经济订货量
        eoq = self._calculate_eoq(avg_daily, lead_time_days)

        return {
            "product_id": product_id,
            "current_stock": current_stock,
            "safety_stock": safety_stock,
            "reorder_point": reorder_point,
            "recommended_order_quantity": max(0, reorder_point + eoq - current_stock),
            "status": "需要补货" if current_stock <= reorder_point else "库存充足",
            "urgency": "紧急" if current_stock < safety_stock else "正常",
        }

    def _calculate_eoq(self, daily_demand: int, lead_time: int) -> int:
        """经济订货量（简化版）"""
        annual_demand = daily_demand * 365
        ordering_cost = 100  # 每次订货成本
        holding_cost = 0.5   # 单位持有成本
        eoq = int((2 * annual_demand * ordering_cost / holding_cost) ** 0.5)
        return min(eoq, 1000)  # 上限
```

---

## 4. 路径规划

```python
@dataclass
class RouteOptimizer:
    """配送路径规划器"""

    async def optimize(self, deliveries: list, vehicle_capacity: int,
                       warehouse_location: dict) -> dict:
        """优化配送路径"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        # 分配车辆
        total_packages = sum(d["packages"] for d in deliveries)
        num_vehicles = (total_packages + vehicle_capacity - 1) // vehicle_capacity

        response = await llm.ainvoke(f"""优化配送路径。

配送点: {json.dumps(deliveries[:20], ensure_ascii=False)}
仓库位置: {json.dumps(warehouse_location, ensure_ascii=False)}
可用车辆: {num_vehicles}辆, 每辆容量{vehicle_capacity}件

输出 JSON:
{{
    "routes": [
        {{
            "vehicle_id": 1,
            "stops": [
                {{"address": "...", "packages": 10, "sequence": 1}},
            ],
            "total_distance_km": 45.2,
            "estimated_time_hours": 2.5
        }}
    ],
    "total_distance_km": 120.5,
    "total_time_hours": 6.0,
    "optimization_notes": "优化说明"
}}""")

        return json.loads(response.content)
```

---

## 5. 物流跟踪

```python
@dataclass
class LogisticsTracker:
    """物流跟踪器"""

    async def track(self, tracking_number: str) -> dict:
        """跟踪货物"""
        # 获取实时位置
        location = await self._get_location(tracking_number)
        eta = await self._calculate_eta(tracking_number, location)

        status = "运输中"
        if eta < 2:
            status = "即将送达"
        elif location.get("at_destination"):
            status = "已到达"

        return {
            "tracking_number": tracking_number,
            "current_location": location,
            "status": status,
            "eta_hours": eta,
            "history": await self._get_history(tracking_number),
        }

    async def handle_delay(self, tracking_number: str, delay_reason: str):
        """处理延迟"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""货物延迟，生成客户通知。

运单号: {tracking_number}
延迟原因: {delay_reason}

生成友好的客户通知短信（100字内）。""")

        # 发送通知
        await self._notify_customer(tracking_number, response.content)
        return {"notified": True, "message": response.content}
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了需求预测 | ☐ |
| 实现了库存优化（安全库存+EOQ） | ☐ |
| 实现了路径规划 | ☐ |
| 实现了物流跟踪 | ☐ |
| 实现了延迟通知 | ☐ |
| 供应链全流程覆盖 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 29 | 智能供应链优化 Agent | 供应链 |
| 59 | 智能供应链优化 Agent | 供应链 |
| 65 | 智能物流路径优化 Agent | 物流 |
| 31 | 智能物流跟踪 Agent | 物流 |
| 517 | Agent 数据分析 | 数据分析 |
| 461 | 企业 Agent 集成 | ERP 集成 |
| 527 | Agent 智能制造 | 制造 |
