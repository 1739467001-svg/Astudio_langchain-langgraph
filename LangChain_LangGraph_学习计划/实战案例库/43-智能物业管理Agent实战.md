# 实战案例 43：智能物业管理 Agent

> 物业管理涉及报修、缴费、通知、访客管理、投诉处理。Agent 能自动处理业主需求、分派工单、发送通知。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"物业管理Agent"}
        U["业主: '电梯坏了'"] --> CLASSIFY["需求分类<br/>报修/缴费/投诉"]
        CLASSIFY --> DISPATCH["工单分派<br/>按类型分配部门"]
        DISPATCH --> NOTIFY["通知相关方"]
        NOTIFY --> TRACK["进度跟踪"]
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style TRACK fill:#C8E6C9
```

**核心技术：** 需求分类 + 工单分派 + 通知 + 进度跟踪

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def classify_request(request: str) -> dict:
    """分类物业需求。

    Args:
        request: 业主请求
    """
    prompt = f"""分类以下物业请求。

请求: {request}

分类:
1. 报修（电梯/水电/门窗/绿化）
2. 缴费查询（物业费/水电费/停车费）
3. 投诉建议
4. 访客管理
5. 其他

输出JSON:
```json
{{"category": "...", "subcategory": "...", "urgency": "high/normal", "location": "...", "description": "..."}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"category": "其他", "urgency": "normal"}

@tool
async def create_work_order(classification: dict) -> dict:
    """创建工单并分派。

    Args:
        classification: 分类结果
    """
    category = classification.get("category", "其他")
    urgency = classification.get("urgency", "normal")

    dispatch = {
        "报修": "工程部",
        "缴费查询": "财务部",
        "投诉建议": "物业经理",
        "访客管理": "保安部",
    }

    return {
        "order_id": f"PM_{category[:2]}_{classification.get('location', '000')[:4]}",
        "category": category,
        "dispatched_to": dispatch.get(category, "客服"),
        "priority": "紧急" if urgency == "high" else "普通",
        "status": "已分派",
        "estimated_response": "30分钟内" if urgency == "high" else "24小时内",
    }

@tool
async def send_notification(resident_id: str, message: str) -> dict:
    """发送通知给业主。

    Args:
        resident_id: 业主ID
        message: 通知内容
    """
    return {
        "resident_id": resident_id,
        "message": message[:200],
        "channel": "APP推送",
        "status": "已发送",
        "timestamp": datetime.now().isoformat(),
    }

@tool
async def query_fee(resident_id: str, fee_type: str = "物业费") -> dict:
    """查询缴费情况。

    Args:
        resident_id: 业主ID
        fee_type: 费用类型
    """
    return {
        "resident_id": resident_id,
        "fee_type": fee_type,
        "amount": 350.00,
        "period": "2025年1月",
        "status": "未缴",
        "due_date": "2025-01-15",
    }
```

### Agent 组装

```python
from datetime import datetime
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能物业管理助手。你可以：

1. **classify_request**: 分类物业需求
2. **create_work_order**: 创建工单并分派
3. **send_notification**: 发送通知
4. **query_fee**: 查询缴费

## 工作流程
1. 分类业主请求
2. 创建工单并分派
3. 通知业主
4. 可查询缴费

## 原则
- 紧急需求优先
- 通知要及时
- 工单可追溯"""

property_agent = create_react_agent(
    llm,
    [classify_request, create_work_order, send_notification, query_fee],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await property_agent.ainvoke({
        "messages": [{"role": "user", "content": "3栋502电梯坏了，很急！"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有需求分类 | ☐ |
| 有工单分派 | ☐ |
| 有通知 | ☐ |
| 有缴费查询 | ☐ |
