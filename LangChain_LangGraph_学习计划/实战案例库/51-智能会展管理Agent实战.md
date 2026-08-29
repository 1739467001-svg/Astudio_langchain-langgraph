# 实战案例 51：智能会展管理 Agent

> 会展管理涉及展位预订、展商服务、观众引导、活动安排。Agent 能自动处理参展需求、管理展位、协调服务。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"会展管理Agent"}
        U["展商: '预订展位'"] --> AVAIL["展位查询<br/>可用展位"]
        AVAIL --> BOOK["展位预订<br/>确认+价格"]
        BOOK --> SERVICE{"需要服务?"}
        SERVICE -->|是| REQ["服务请求<br/>电力/网络/清洁"]
        SERVICE -->|否| CONFIRM["预订确认"]
        REQ --> CONFIRM
    end

    style AVAIL fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CONFIRM fill:#C8E6C9
```

**核心技术：** 展位查询 + 预订管理 + 服务协调 + 活动安排

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def check_booths(event_id: str, booth_type: str = "") -> dict:
    """查询可用展位。

    Args:
        event_id: 展会ID
        booth_type: 展位类型(标准/特装/岛式，空=全部)
    """
    return {
        "event_id": event_id,
        "available_booths": [
            {"booth_id": "A01", "type": "标准", "area": "9㎡", "price": 12000, "zone": "A区"},
            {"booth_id": "B03", "type": "特装", "area": "36㎡", "price": 48000, "zone": "B区"},
            {"booth_id": "C05", "type": "岛式", "area": "72㎡", "price": 96000, "zone": "C区"},
        ],
    }

@tool
async def book_booth(exhibitor_name: str, booth_id: str, event_id: str) -> dict:
    """预订展位。

    Args:
        exhibitor_name: 展商名称
        booth_id: 展位号
        event_id: 展会ID
    """
    return {
        "booking_id": f"EX{datetime.now().strftime('%Y%m%d')}{booth_id}",
        "exhibitor": exhibitor_name,
        "booth_id": booth_id,
        "event_id": event_id,
        "status": "已确认",
        "payment_due": "2025-02-15",
        "message": f"{exhibitor_name}已预订{booth_id}展位",
    }

@tool
async def request_service(booth_id: str, service_type: str) -> dict:
    """请求展商服务。

    Args:
        booth_id: 展位号
        service_type: 服务类型(电力/网络/清洁/安保/翻译)
    """
    return {
        "booth": booth_id,
        "service": service_type,
        "status": "已派单",
        "department": {
            "电力": "工程部", "网络": "IT部", "清洁": "物业部",
            "安保": "安保部", "翻译": "服务部",
        }.get(service_type, "服务台"),
        "estimated_setup": "展前1天完成",
    }

@tool
async def get_event_schedule(event_id: str) -> str:
    """获取展会日程。

    Args:
        event_id: 展会ID
    """
    return f"""展会{event_id}日程:
- 布展: 2025-03-01至03-02
- 开展: 2025-03-03至03-05
- 撤展: 2025-03-06
- 开幕式: 03-03 09:00
- 研讨会: 03-03 14:00
- 颁奖: 03-05 16:00"""
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能会展管理助手。你可以：

1. **check_booths**: 查询可用展位
2. **book_booth**: 预订展位
3. **request_service**: 请求展商服务
4. **get_event_schedule**: 获取展会日程

## 工作流程
1. 查询可用展位
2. 确认预订
3. 处理服务请求
4. 提供展会日程

## 原则
- 预订要确认展位和价格
- 服务请求要派单到对应部门
- 日程要清晰"""

expo_agent = create_react_agent(
    llm,
    [check_booths, book_booth, request_service, get_event_schedule],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await expo_agent.ainvoke({
        "messages": [{"role": "user", "content": "我是科技公司ABC，想预订展位EXPO2025的一个特装展位"}]
    })
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有展位查询 | ☐ |
| 有展位预订 | ☐ |
| 有服务协调 | ☐ |
| 有展会日程 | ☐ |
