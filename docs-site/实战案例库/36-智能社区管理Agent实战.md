# 实战案例 36：智能社区管理 Agent

> 社区管理涉及报修、通知、缴费查询、访客管理。Agent 能自动处理居民需求、分派工单、发送通知。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"社区管理Agent"&#125;
        U["居民: '水管漏水'"] --> CLASSIFY["需求分类<br/>报修/缴费/咨询"]
        CLASSIFY --> DISPATCH["工单分派<br/>按类型分配"]
        DISPATCH --> NOTIFY["通知相关方<br/>物业+居民"]
        NOTIFY --> TRACK["进度跟踪<br/>状态更新"]
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
    """分类居民需求。

    Args:
        request: 居民请求
    """
    prompt = f"""分类以下社区请求。

请求: &#123;request&#125;

分类:
1. 报修（水电/门窗/电梯）
2. 缴费查询（物业费/水电费）
3. 咨询（政策/流程）
4. 投诉
5. 访客管理

输出JSON:
```json
&#123;&#123;
  "category": "...",
  "subcategory": "...",
  "urgency": "high/normal",
  "location": "...",
  "description": "..."
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"category": "咨询"&#125;

@tool
async def create_work_order(classification: dict) -> dict:
    """创建工单并分派。

    Args:
        classification: 分类结果
    """
    category = classification.get("category", "咨询")
    urgency = classification.get("urgency", "normal")

    # 按类型分派
    dispatch = &#123;
        "报修": "维修部门",
        "缴费查询": "财务部门",
        "咨询": "客服",
        "投诉": "物业经理",
        "访客管理": "保安部",
    &#125;

    return &#123;
        "order_id": f"WO_&#123;classification.get('location', '000')[:6]&#125;",
        "category": category,
        "dispatched_to": dispatch.get(category, "客服"),
        "priority": "紧急" if urgency == "high" else "普通",
        "status": "已分派",
        "estimated_response": "30分钟内" if urgency == "high" else "24小时内",
    &#125;

@tool
async def send_notification(resident_id: str, message: str, channel: str = "app") -> dict:
    """发送通知给居民。

    Args:
        resident_id: 居民ID
        message: 通知内容
        channel: 通知渠道(app/sms/wechat)
    """
    return &#123;
        "resident_id": resident_id,
        "channel": channel,
        "message": message[:200],
        "status": "已发送",
    &#125;

@tool
async def track_status(order_id: str) -> dict:
    """查询工单进度。

    Args:
        order_id: 工单号
    """
    return &#123;
        "order_id": order_id,
        "status": "处理中",
        "progress": "维修人员已出发",
        "eta": "15分钟",
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能社区管理助手。你可以：

1. **classify_request**: 分类居民需求
2. **create_work_order**: 创建工单并分派
3. **send_notification**: 发送通知
4. **track_status**: 查询进度

## 工作流程
1. 分类居民请求
2. 创建工单并分派
3. 通知居民
4. 可查询进度

## 原则
- 紧急需求优先处理
- 通知要及时
- 工单要可追溯"""

community_agent = create_react_agent(
    llm,
    [classify_request, create_work_order, send_notification, track_status],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await community_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "3栋502水管漏水，很急！"&#125;]
    &#125;)
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
| 有进度跟踪 | ☐ |
