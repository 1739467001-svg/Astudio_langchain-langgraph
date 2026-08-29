# 实战案例 24：智能旅行规划 Agent

> 旅行规划涉及多步决策：选目的地→查天气→订机票→订酒店→做行程。这个案例构建一个旅行规划 Agent，综合运用多步骤推理、工具调用和个性化推荐。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"旅行规划Agent"}
        U["用户: '下周去东京'"] --> PLAN["制定计划<br/>多步推理"]
        PLAN --> S1["查天气"]
        PLAN --> S2["搜索景点"]
        PLAN --> S3["推荐住宿"]
        PLAN --> S4["生成行程"]
        S1 & S2 & S3 & S4 --> ITINERARY["完整行程"]
    end

    style PLAN fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ITINERARY fill:#C8E6C9
```

**核心技术：** 多步推理 + 工具调用 + 个性化 + 行程生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

@tool
async def get_weather(city: str, date: str = "") -> str:
    """查询城市天气。

    Args:
        city: 城市名称
        date: 日期（可选）
    """
    # 实际接入天气API
    return f"{city}: 晴 22-28°C, {date or '近期'}"

@tool
async def search_attractions(city: str, interests: str = "") -> str:
    """搜索城市景点。

    Args:
        city: 城市名称
        interests: 兴趣偏好（如历史/美食/购物）
    """
    # 实际接入搜索API
    return f"{city}推荐景点: 浅草寺(历史), 筑地市场(美食), 银座(购物)"

@tool
async def search_hotels(city: str, budget: str = "mid", checkin: str = "", checkout: str = "") -> str:
    """搜索住宿选项。

    Args:
        city: 城市名称
        budget: 预算等级(budget/mid/luxury)
        checkin: 入住日期
        checkout: 退房日期
    """
    budget_map = {"budget": "经济型", "mid": "中端", "luxury": "豪华"}
    return f"{city}住宿({budget_map.get(budget, '中端')}): 3个选项可选"

@tool
async def generate_itinerary(
    city: str,
    days: int,
    attractions: str,
    weather: str,
    hotels: str,
    preferences: str = "",
) -> str:
    """生成完整旅行行程。

    Args:
        city: 目的地
        days: 天数
        attractions: 景点信息
        weather: 天气信息
        hotels: 住宿信息
        preferences: 个人偏好
    """
    prompt = f"""你是旅行规划师。生成{city}{days}天行程。

景点: {attractions}
天气: {weather}
住宿: {hotels}
偏好: {preferences}

要求:
1. 按天安排，每天3-4个活动
2. 考虑天气（雨天安排室内）
3. 合理安排时间（不赶路）
4. 包含用餐建议
5. 简洁明了

行程:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content

from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能旅行规划助手。你可以：

1. **get_weather**: 查询目的地天气
2. **search_attractions**: 搜索景点
3. **search_hotels**: 搜索住宿
4. **generate_itinerary**: 生成完整行程

## 工作流程
1. 了解用户需求（目的地/时间/预算/偏好）
2. 查天气→搜索景点→搜索住宿
3. 综合生成完整行程
4. 给出实用建议（交通/注意事项）

## 原则
- 行程要合理，不赶路
- 考虑天气因素
- 住宿位置要方便
- 给具体的用餐和交通建议"""

travel_agent = create_react_agent(
    llm,
    [get_weather, search_attractions, search_hotels, generate_itinerary],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await travel_agent.ainvoke({
        "messages": [{
            "role": "user",
            "content": "下周末想去东京3天，预算中等，喜欢历史和美食"
        }]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有天气查询 | ☐ |
| 有景点搜索 | ☐ |
| 有住宿搜索 | ☐ |
| 有行程生成 | ☐ |
| 有Agent编排 | ☐ |
