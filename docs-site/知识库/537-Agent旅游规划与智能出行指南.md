# Agent 旅游规划与智能出行指南

> 用户说"帮我规划一个三天的杭州亲子游"——Agent 需要考虑景点、路线、住宿、餐饮、天气、亲子适配。本指南系统讲解旅游 Agent 架构、行程规划、实时导航、突发应对、个性化推荐。

---

## 1. 旅游 Agent 架构

### 工作流

```mermaid
graph TB
    REQ["用户需求<br/>目的地/天数/偏好"] --> SEARCH["信息搜索<br/>景点/酒店/餐厅"]
    SEARCH --> PLAN["行程规划<br/>路线优化+时间分配"]
    PLAN --> BOOKING["预订建议<br/>酒店/门票/交通"]
    BOOKING --> GUIDE["实时导览<br/>导航+讲解"]
    GUIDE --> ADAPT["动态调整<br/>天气/排队/突发"]

    style PLAN fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style GUIDE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ADAPT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 2. 行程规划

```python
@dataclass
class TripPlanner:
    """行程规划器"""

    async def plan(self, destination: str, days: int, preferences: dict) -> dict:
        """生成行程"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        prompt = f"""规划旅游行程。

目的地: &#123;destination&#125;
天数: &#123;days&#125;天
偏好: &#123;json.dumps(preferences, ensure_ascii=False)&#125;

输出 JSON:
&#123;&#123;
    "itinerary": [
        &#123;&#123;
            "day": 1,
            "date": "建议日期",
            "morning": &#123;&#123;"activity": "...", "location": "...", "duration_hours": 2, "tips": "..."&#125;&#125;,
            "afternoon": &#123;&#123;"activity": "...", "location": "...", "duration_hours": 3, "tips": "..."&#125;&#125;,
            "evening": &#123;&#123;"activity": "...", "location": "...", "duration_hours": 2&#125;&#125;,
            "dining": &#123;&#123;"breakfast": "...", "lunch": "...", "dinner": "..."&#125;&#125;,
            "accommodation": "推荐住宿区域"
        &#125;&#125;
    ],
    "estimated_budget": &#123;&#123;"transport": 0, "accommodation": 0, "food": 0, "tickets": 0, "total": 0&#125;&#125;,
    "packing_list": ["必备物品"],
    "tips": ["注意事项"]
&#125;&#125;"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def optimize_route(self, attractions: list, start_location: dict) -> list:
        """优化游览路线（TSP 近似）"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""优化游览路线。

景点列表: &#123;json.dumps(attractions, ensure_ascii=False)&#125;
起点: &#123;json.dumps(start_location, ensure_ascii=False)&#125;

按地理位置和游览时间优化排序，减少路程。
输出排序后的景点列表（JSON数组）。""")

        return json.loads(response.content)
```

---

## 3. 实时导览

```python
@dataclass
class RealTimeGuide:
    """实时导览"""

    async def narrate(self, attraction: str, language: str = "zh") -> str:
        """景区讲解"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        response = await llm.ainvoke(
            f"作为导游，用&#123;language&#125;为&#123;attraction&#125;写一段生动的讲解词（200字内），包含历史、特色和有趣的故事。"
        )
        return response.content

    async def handle_queue(self, attraction: str) -> dict:
        """排队应对"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

        response = await llm.ainvoke(
            f"景点 &#123;attraction&#125; 排队较长，推荐附近可以同时游览的替代景点或活动。输出JSON: &#123;&#123;\"alternatives\": [], \"estimated_wait\": \"...\", \"tips\": \"...\"&#125;&#125;"
        )
        return json.loads(response.content)

    async def weather_adjust(self, weather: dict, plan: dict) -> dict:
        """根据天气调整行程"""
        if weather.get("rain_probability", 0) > 0.5:
            # 换成室内活动
            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
            response = await llm.ainvoke(
                f"雨天，原计划：&#123;json.dumps(plan, ensure_ascii=False)[:500]&#125;。推荐室内替代活动。输出JSON: &#123;&#123;\"adjusted_plan\": [], \"reason\": \"...\"&#125;&#125;"
            )
            return json.loads(response.content)
        return &#123;"adjusted": False, "plan": plan&#125;
```

---

## 4. 突发应对

```python
@dataclass
class EmergencyHandler:
    """突发应对"""

    async def handle(self, incident: str, location: dict) -> dict:
        """处理突发情况"""
        handlers = &#123;
            "missed_flight": "联系改签+重新规划行程",
            "lost_luggage": "报失+紧急购买建议",
            "illness": "附近医院+保险理赔指引",
            "theft": "报警+使馆联系",
            "natural_disaster": "紧急避难+撤离路线",
        &#125;

        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""处理旅行突发情况。

情况: &#123;incident&#125;
位置: &#123;json.dumps(location, ensure_ascii=False)&#125;

输出 JSON:
&#123;&#123;
    "immediate_action": "立即做什么",
    "contacts": ["紧急联系电话"],
    "documents_needed": ["需要的文件"],
    "insurance_steps": "保险理赔步骤",
    "alternative_plan": "替代方案"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了行程规划 | ☐ |
| 实现了路线优化 | ☐ |
| 实现了实时讲解 | ☐ |
| 实现了排队应对 | ☐ |
| 实现了天气调整 | ☐ |
| 实现了突发应对 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 24 | 智能旅行规划 Agent | 旅行 |
| 48 | 智能酒店管理 Agent | 酒店 |
| 494 | Agent 混合搜索 | 搜索 |
| 520 | Agent 搜索增强 | 搜索 |
| 535 | Agent 零售电商 | 营销 |
| 536 | Agent 心理咨询 | 心理 |
