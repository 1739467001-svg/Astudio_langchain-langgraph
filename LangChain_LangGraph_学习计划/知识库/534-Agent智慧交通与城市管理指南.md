# Agent 智慧交通与城市管理指南

> 城市交通涉及信号灯、拥堵、事故、停车——Agent 能实时分析路况、优化信号灯、引导车流、发布预警。本指南系统讲解交通 Agent 架构、路况分析、信号优化、事故响应、城市管理。

---

## 1. 交通 Agent 架构

### 工作流

```mermaid
graph TB
    DATA["多源数据<br/>摄像头/GPS/线圈"] --> ANALYZE["路况分析<br/>拥堵/速度/流量"]
    ANALYZE --> SIGNAL["信号优化<br/>动态配时"]
    ANALYZE --> ROUTE["路径引导<br/>绕行建议"]
    ANALYZE --> INCIDENT["事件检测<br/>事故/施工"]
    INCIDENT --> DISPATCH["应急调度<br/>交警/拖车"]
    SIGNAL --> PUBLISH["信息发布<br/>导航/广播"]

    style DATA fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style SIGNAL fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style INCIDENT fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 路况分析

```python
@dataclass
class TrafficAnalyzer:
    """路况分析器"""

    async def analyze(self, road_data: dict) -> dict:
        """分析路况"""
        avg_speed = road_data.get("avg_speed_kmh", 60)
        density = road_data.get("vehicle_density", 0.3)
        free_flow_speed = road_data.get("free_flow_speed", 60)

        # 拥堵指数 = 1 - (当前速度 / 自由流速度)
        congestion_index = max(0, 1 - avg_speed / max(free_flow_speed, 1))

        level = "畅通" if congestion_index < 0.3 else "缓行" if congestion_index < 0.6 else "拥堵" if congestion_index < 0.8 else "严重拥堵"

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""分析交通状况。

路段: {road_data.get('road_name', '未知')}
平均速度: {avg_speed}km/h
车流密度: {density}
拥堵指数: {congestion_index:.2f} ({level})

输出 JSON:
{{
    "congestion_level": "{level}",
    "congestion_index": {congestion_index:.2f},
    "cause_analysis": "可能原因",
    "estimated_duration": "预计持续时间",
    "alternative_routes": ["建议绕行路线"],
    "advisory": "出行建议"
}}""")

        return json.loads(response.content)
```

---

## 3. 信号灯优化

```python
@dataclass
class SignalOptimizer:
    """信号灯优化器"""

    async def optimize(self, intersection_id: str, traffic_data: dict) -> dict:
        """优化信号灯配时"""
        # 各方向流量
        flows = traffic_data.get("directional_flows", {})

        # 按流量比例分配绿灯时间
        total_flow = sum(flows.values()) or 1
        cycle_time = 120  # 总周期 120 秒

        green_times = {}
        for direction, flow in flows.items():
            green_times[direction] = int(cycle_time * flow / total_flow * 0.8)  # 留 20% 黄灯

        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""优化信号灯配时。

路口: {intersection_id}
各方向流量: {json.dumps(flows, ensure_ascii=False)}
初步配时: {json.dumps(green_times, ensure_ascii=False)}
周期: {cycle_time}秒

输出 JSON:
{{
    "optimized_timing": {{"north_south_green": 45, "east_west_green": 60, "yellow": 5}},
    "expected_improvement": "预计通行效率提升15%",
    "rationale": "优化理由",
    "special_considerations": ["行人过街时间", "公交优先"]
}}""")

        return json.loads(response.content)
```

---

## 4. 事故响应

```python
@dataclass
class IncidentResponder:
    """事故响应器"""

    async def respond(self, incident: dict) -> dict:
        """事故响应"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        severity = incident.get("severity", "minor")
        response_level = "一级" if severity == "fatal" else "二级" if severity == "major" else "三级"

        prompt = f"""生成交通事故响应方案。

事故信息:
{json.dumps(incident, ensure_ascii=False)}

响应级别: {response_level}

输出 JSON:
{{
    "response_level": "{response_level}",
    "dispatch": [
        {{"unit": "交通警察", "count": 2, "priority": "高"}},
        {{"unit": "救护车", "count": 1, "priority": "高"}},
        {{"unit": "拖车", "count": 1, "priority": "中"}}
    ],
    "traffic_control": ["封闭车道", "设置绕行"],
    "estimated_clear_time": "30分钟",
    "public_notification": "导航推送+广播"
}}"""

        response = await llm.ainvoke(prompt)
        result = json.loads(response.content)

        # 自动发布绕行通知
        result["rerouting"] = await self._generate_rerouting(incident)

        return result

    async def _generate_rerouting(self, incident: dict) -> str:
        """生成绕行方案"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        response = await llm.ainvoke(
            f"生成简洁的绕行通知（100字内）。事故位置: {incident.get('location', '未知')}，建议绕行。"
        )
        return response.content
```

---

## 5. 城市管理

```python
@dataclass
class CityManagementAgent:
    """城市管理 Agent"""

    async def handle_complaint(self, complaint: str, location: dict) -> dict:
        """处理市民投诉"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""分类市民投诉。

投诉: {complaint}
位置: {json.dumps(location, ensure_ascii=False)}

分类: 市政设施/环境卫生/交通管理/噪音/违章建筑/其他
紧急度: 高/中/低
建议处理部门: ...

输出 JSON:
{{
    "category": "...",
    "urgency": "...",
    "department": "...",
    "auto_response": "自动回复市民的话",
    "ticket_id": "CMP-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
}}""")

        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了路况分析（拥堵指数） | ☐ |
| 实现了信号灯优化 | ☐ |
| 实现了事故响应（分级+调度） | ☐ |
| 实现了绕行通知 | ☐ |
| 实现了城市管理（投诉分类） | ☐ |
| 有信息发布机制 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 44 | 智能交通管理 Agent | 交通 |
| 50 | 智能城市规划 Agent | 城市 |
| 461 | 企业 Agent 集成 | 集成 |
| 469 | 分布式 Agent | 分布式 |
| 485 | Agent 搜索增强 | 搜索 |
| 527 | Agent 智能制造 | 工业 |
| 532 | Agent 智慧政务 | 政务 |
