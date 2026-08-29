# Agent 智能建筑与物业管理指南

> 智能建筑有暖通、照明、安防、电梯等子系统——Agent 能统一管理、节能优化、预测维护、响应业主需求。本指南系统讲解建筑 Agent 架构、能耗优化、设备管理、安防联动、物业服务。

---

## 1. 建筑 Agent 架构

### 工作流

```mermaid
graph TB
    BMS["楼宇管理系统<br/>BMS/BMS数据"] --> AGENT["建筑Agent"]
    AGENT --> HVAC["暖通优化<br/>温度+新风"]
    AGENT --> LIGHT["照明控制<br/>自然光+人感"]
    AGENT --> SECURITY["安防联动<br/>门禁+监控+报警"]
    AGENT --> ELEVATOR["电梯调度<br/>分组+预测"]
    AGENT --> ENERGY["能耗优化<br/>峰谷+光伏"]

    style BMS fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style AGENT fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style ENERGY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 能耗优化

```python
@dataclass
class EnergyOptimizer:
    """能耗优化器"""

    async def optimize_hvac(self, zones: list, outdoor_temp: float,
                            occupancy: dict, electricity_price: float) -> dict:
        """优化暖通空调"""
        recommendations = []

        for zone in zones:
            current_temp = zone.get("current_temp", 22)
            target_temp = zone.get("target_temp", 22)
            zone_occupancy = occupancy.get(zone["id"], 0)

            # 无人区降低标准
            if zone_occupancy == 0:
                target_temp = 18 if outdoor_temp < 25 else 28
                recommendations.append(&#123;
                    "zone": zone["id"],
                    "action": "节能模式",
                    "new_target": target_temp,
                    "reason": "无人区域降低空调",
                    "estimated_saving_kw": 2.5,
                &#125;)

            # 峰电时预冷
            if electricity_price > 0.8 and zone_occupancy > 0:
                recommendations.append(&#123;
                    "zone": zone["id"],
                    "action": "峰前预冷",
                    "new_target": target_temp - 2,
                    "reason": "峰电前预冷降低峰电消耗",
                    "estimated_saving_yuan": 15,
                &#125;)

        return &#123;
            "recommendations": recommendations,
            "total_estimated_saving_kw": sum(r.get("estimated_saving_kw", 0) for r in recommendations),
        &#125;

    async def optimize_lighting(self, zones: list, natural_light: dict,
                                occupancy: dict) -> list:
        """优化照明"""
        actions = []
        for zone in zones:
            natural = natural_light.get(zone["id"], 0)
            people = occupancy.get(zone["id"], 0)

            if people == 0:
                actions.append(&#123;"zone": zone["id"], "action": "关灯", "reason": "无人"&#125;)
            elif natural > 500:  # 自然光充足
                actions.append(&#123;"zone": zone["id"], "action": "调暗到30%", "reason": "自然光充足"&#125;)
            else:
                actions.append(&#123;"zone": zone["id"], "action": "正常照明", "reason": "正常"&#125;)

        return actions
```

---

## 3. 设备管理

```python
@dataclass
class BuildingEquipmentManager:
    """建筑设备管理"""

    async def monitor_equipment(self, equipment_id: str, sensor_data: dict) -> dict:
        """监控设备"""
        health = 1.0
        alerts = []

        if sensor_data.get("vibration", 0) > 8:
            health -= 0.3
            alerts.append("振动异常，可能轴承磨损")

        if sensor_data.get("temperature", 25) > 75:
            health -= 0.2
            alerts.append("温度偏高")

        if sensor_data.get("current", 0) > sensor_data.get("rated_current", 100):
            health -= 0.3
            alerts.append("电流超标")

        status = "正常" if health > 0.7 else "需关注" if health > 0.4 else "需维修"

        return &#123;
            "equipment_id": equipment_id,
            "health": f"&#123;health:.0%&#125;",
            "status": status,
            "alerts": alerts,
            "next_maintenance": "建议1个月内" if health < 0.7 else "按计划",
        &#125;
```

---

## 4. 安防联动

```python
@dataclass
class SecurityCoordinator:
    """安防联动"""

    async def handle_alarm(self, alarm: dict) -> dict:
        """处理报警"""
        severity = alarm.get("severity", "low")
        alarm_type = alarm.get("type", "")

        response = &#123;
            "fire": &#123;"action": "联动消防+疏散广播+电梯迫降", "priority": "P0"&#125;,
            "intrusion": &#123;"action": "联动监控+门禁锁定+保安通知", "priority": "P1"&#125;,
            "access_denied": &#123;"action": "记录+通知物业", "priority": "P3"&#125;,
        &#125;

        handler = response.get(alarm_type, &#123;"action": "通知物业", "priority": "P3"&#125;)

        return &#123;
            "alarm_type": alarm_type,
            "severity": severity,
            "response": handler["action"],
            "priority": handler["priority"],
            "auto_actions": self._get_auto_actions(alarm_type),
        &#125;

    def _get_auto_actions(self, alarm_type: str) -> list:
        actions = &#123;
            "fire": ["启动消防系统", "播报疏散广播", "电梯迫降首层", "解锁应急通道", "通知消防"],
            "intrusion": ["锁定相关区域门禁", "调取监控录像", "通知保安", "报警"],
            "access_denied": ["记录日志", "通知物业"],
        &#125;
        return actions.get(alarm_type, ["通知物业"])
```

---

## 5. 物业服务

```python
@dataclass
class PropertyServiceAgent:
    """物业服务 Agent"""

    async def handle_request(self, owner_id: str, request: str) -> dict:
        """处理业主请求"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""分类业主请求。

请求: &#123;request&#125;

分类: 维修/缴费/投诉/咨询/访客/停车/装修
紧急度: 高/中/低
建议处理部门: ...

输出 JSON:
&#123;&#123;
    "category": "...",
    "urgency": "...",
    "department": "...",
    "auto_response": "自动回复",
    "ticket_id": "REQ-&#123;datetime.utcnow().strftime('%Y%m%d%H%M%S')&#125;"
&#125;&#125;""")

        result = json.loads(response.content)

        # 自动派单
        if result["category"] == "维修" and result["urgency"] == "高":
            result["auto_dispatch"] = True
            result["estimated_response_time"] = "30分钟内"

        return result
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了 HVAC 优化 | ☐ |
| 实现了照明控制 | ☐ |
| 实现了设备监控 | ☐ |
| 实现了安防联动 | ☐ |
| 实现了物业服务 | ☐ |
| 有能耗节省统计 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 43 | 智能物业管理 Agent | 物业 |
| 48 | 智能酒店管理 Agent | 酒店 |
| 527 | Agent 智能制造 | 工业 |
| 529 | Agent 能源管理 | 能源 |
| 534 | Agent 智慧交通 | 交通 |
| 471 | 数字孪生 | 仿真 |
