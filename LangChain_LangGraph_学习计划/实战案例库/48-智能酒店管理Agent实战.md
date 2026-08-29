# 实战案例 48：智能酒店管理 Agent

> 酒店管理涉及预订、入住、退房、服务请求、客房管理。Agent 能自动处理客户需求、管理房态、调度服务。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"酒店管理Agent"}
        U["客户: '预订房间'"] --> CHECK["查询房态<br/>可用房型"]
        CHECK --> BOOK["预订登记<br/>确认+价格"]
        BOOK --> SERVICE{"需要服务?"}
        SERVICE -->|是| REQ["服务请求<br/>餐食/清洁/行李"]
        SERVICE -->|否| CONFIRM["预订确认"]
    end

    style CHECK fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CONFIRM fill:#C8E6C9
```

**核心技术：** 房态查询 + 预订管理 + 服务调度 + 入住退房

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re
from datetime import datetime, timedelta

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def check_room_availability(check_in: str, check_out: str, room_type: str = "") -> dict:
    """查询房态。

    Args:
        check_in: 入住日期
        check_out: 退房日期
        room_type: 房型(标准/豪华/套房，空=所有)
    """
    return {
        "check_in": check_in,
        "check_out": check_out,
        "available_rooms": [
            {"type": "标准间", "price": 388, "count": 5, "area": "5楼"},
            {"type": "豪华间", "price": 688, "count": 3, "area": "8楼"},
            {"type": "套房", "price": 1288, "count": 1, "area": "12楼"},
        ],
    }

@tool
async def make_reservation(guest_name: str, room_type: str, check_in: str, check_out: str) -> dict:
    """预订房间。

    Args:
        guest_name: 客人姓名
        room_type: 房型
        check_in: 入住日期
        check_out: 退房日期
    """
    days = 2  # 简化计算
    pricing = {"标准间": 388, "豪华间": 688, "套房": 1288}
    price = pricing.get(room_type, 388)
    return {
        "reservation_id": f"HTL{datetime.now().strftime('%Y%m%d')}{guest_name[:2]}",
        "guest": guest_name,
        "room_type": room_type,
        "check_in": check_in,
        "check_out": check_out,
        "nights": days,
        "total_price": price * days,
        "status": "已确认",
        "message": f"{guest_name}的{room_type}预订成功，{check_in}至{check_out}，共{days}晚，总价¥{price*days}",
    }

@tool
async def request_service(room_number: str, service_type: str) -> dict:
    """请求服务。

    Args:
        room_number: 房间号
        service_type: 服务类型(餐食/清洁/行李/维修)
    """
    return {
        "room": room_number,
        "service": service_type,
        "status": "已派单",
        "estimated_time": "15分钟" if service_type == "餐食" else "30分钟",
        "handler": {"餐食": "餐饮部", "清洁": "客房部", "行李": "礼宾部", "维修": "工程部"}.get(service_type, "前台"),
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能酒店管理助手。你可以：

1. **check_room_availability**: 查询房态
2. **make_reservation**: 预订房间
3. **request_service**: 请求服务

## 工作流程
1. 查询可用房型
2. 确认预订
3. 处理服务请求

## 原则
- 预订要确认日期和价格
- 服务请求要派单到对应部门"""

hotel_agent = create_react_agent(
    llm,
    [check_room_availability, make_reservation, request_service],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await hotel_agent.ainvoke({
        "messages": [{"role": "user", "content": "帮我预订明后天的一间豪华间，我叫王五"}]
    })
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有房态查询 | ☐ |
| 有预订管理 | ☐ |
| 有服务调度 | ☐ |
