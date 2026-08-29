# Agent 海洋探索与海事管理指南

> 海洋覆盖地球 71%——航行安全、海洋环境、渔业管理、海上搜救都需要 Agent 辅助。本指南系统讲解海事 Agent 架构、航行安全、海洋环境监测、渔业管理、搜救辅助。

---

## 1. 海事 Agent 架构

### 工作流

```mermaid
graph TB
    AIS["AIS数据<br/>船舶位置/航向"] --> NAV["航行安全<br/>碰撞预警"]
    BUOY["浮标/卫星<br/>海况/洋流"] --> ENV["海洋环境<br/>监测预警"]
    VESSEL["渔船数据"] --> FISH["渔业管理<br/>配额/区域"]
    SOS["遇险信号"] --> SAR["搜救辅助<br/>方案+协调"]

    style NAV fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style SAR fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style FISH fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 航行安全

```python
@dataclass
class NavigationSafety:
    """航行安全"""

    async def check_collision(self, own_vessel: dict, nearby_vessels: list,
                              sea_state: dict) -> dict:
        """碰撞预警"""
        alerts = []

        for vessel in nearby_vessels:
            distance = self._calc_distance(own_vessel["position"], vessel["position"])
            tcpa = self._calc_tcpa(own_vessel, vessel)  # 最近会遇时间

            if distance < 5 and tcpa > 0 and tcpa < 15:
                alerts.append({
                    "vessel": vessel["name"],
                    "distance_nm": distance,
                    "tcpa_minutes": tcpa,
                    "action": "改向避让" if tcpa < 10 else "保持监控",
                    "urgency": "high" if tcpa < 10 else "medium",
                })

        return {
            "own_vessel": own_vessel["name"],
            "alerts": alerts,
            "sea_state": sea_state.get("wave_height", "unknown"),
            "recommendation": "减速" if sea_state.get("wave_height", 0) > 3 else "正常航行",
        }

    def _calc_distance(self, pos1: dict, pos2: dict) -> float:
        # 简化距离计算
        return abs(pos1.get("lat", 0) - pos2.get("lat", 0)) * 60

    def _calc_tcpa(self, own: dict, other: dict) -> float:
        # 简化 TCPA 计算
        return 10
```

---

## 3. 海洋环境

```python
@dataclass
class MarineEnvironment:
    """海洋环境监测"""

    async def monitor(self, buoy_data: dict, satellite_data: dict) -> dict:
        """监测海洋环境"""
        alerts = []

        # 海啸预警
        if buoy_data.get("wave_anomaly"):
            alerts.append({"type": "海啸", "severity": "critical", "action": "发布海啸预警"})

        # 赤潮
        if buoy_data.get("chlorophyll", 0) > 20:
            alerts.append({"type": "赤潮", "severity": "medium", "action": "通知渔业部门"})

        # 风暴
        if satellite_data.get("storm_within_100km"):
            alerts.append({"type": "风暴", "severity": "high", "action": "建议回港"})

        return {
            "alerts": alerts,
            "wave_height": buoy_data.get("wave_height", 0),
            "sea_temp": buoy_data.get("temperature", 0),
            "current_speed": buoy_data.get("current", 0),
            "visibility": buoy_data.get("visibility", "good"),
        }
```

---

## 4. 渔业管理

```python
@dataclass
class FisheryManager:
    """渔业管理"""

    async def manage(self, vessel_id: str, catch_data: dict, regulations: dict) -> dict:
        """管理渔获"""
        violations = []

        # 配额检查
        if catch_data.get("total_catch_kg", 0) > regulations.get("quota_kg", 10000):
            violations.append("超出配额")

        # 禁渔区
        if catch_data.get("location") in regulations.get("restricted_zones", []):
            violations.append("在禁渔区作业")

        # 网目尺寸
        if catch_data.get("mesh_size", 50) < regulations.get("min_mesh_size", 40):
            violations.append("网目尺寸不符合")

        return {
            "vessel_id": vessel_id,
            "violations": violations,
            "action": "警告" if not violations else "罚款+扣船",
            "compliant": len(violations) == 0,
        }
```

---

## 5. 搜救辅助

```python
@dataclass
class SearchAndRescue:
    """搜救辅助"""

    async def plan(self, distress: dict, weather: dict,
                   available_resources: list) -> dict:
        """搜救方案"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""生成海上搜救方案。

遇险信息: {json.dumps(distress, ensure_ascii=False)}
海况: {json.dumps(weather, ensure_ascii=False)}
可用资源: {json.dumps(available_resources, ensure_ascii=False)}

输出 JSON:
{{
    "search_area": {{"center": {{}}, "radius_nm": 20, "pattern": "扇形/方形/螺旋"}},
    "dispatch": [{{"resource": "...", "task": "...", "eta_minutes": 0}}],
    "on_scene_commander": "指定指挥船",
    "communication_plan": "通信方案",
    "medical_support": "医疗支援",
    "estimated_search_time": "预计搜索时间"
}}""")

        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了碰撞预警 | ☐ |
| 实现了海洋环境监测 | ☐ |
| 实现了渔业管理 | ☐ |
| 实现了搜救方案 | ☐ |
| 有海况分析 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 534 | Agent 智慧交通 | 交通 |
| 537 | Agent 旅游规划 | 出行 |
| 542 | Agent 环保监测 | 环境 |
| 549 | Agent 气象预报 | 气象 |
| 546 | Agent 城市规划 | 应急 |
