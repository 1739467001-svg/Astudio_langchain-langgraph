# 实战案例 42：智能人力资源 HR Agent

> HR 管理涉及员工查询、请假审批、考勤统计、培训推荐。Agent 能自动处理常见 HR 事务。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"HR Agent"&#125;
        U["员工: '我想请假'"] --> CLASSIFY["意图分类<br/>请假/查询/培训"]
        CLASSIFY --> PROCESS["流程处理"]
        PROCESS --> DECIDE&#123;"需审批?"&#125;
        DECIDE -->|是| APPROVE["提交审批<br/>通知主管"]
        DECIDE -->|否| ANSWER["直接回答"]
        APPROVE & ANSWER --> CONFIRM["确认+记录"]
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CONFIRM fill:#C8E6C9
```

**核心技术：** 意图分类 + 流程处理 + 审批 + 知识库查询

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def classify_intent(request: str) -> dict:
    """分类HR请求意图。

    Args:
        request: 员工请求
    """
    prompt = f"""分类以下HR请求。

请求: &#123;request&#125;

分类:
1. 请假（年假/病假/事假）
2. 政策查询（制度/福利/薪资）
3. 培训（推荐/报名）
4. 考勤查询
5. 其他

输出JSON:
```json
&#123;&#123;"intent": "...", "details": &#123;&#123;&#125;&#125;, "needs_approval": true/false&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"intent": "其他", "needs_approval": False&#125;

@tool
async def query_hr_policy(query: str) -> str:
    """查询HR政策。

    Args:
        query: 查询内容
    """
    # 实际接入HR知识库
    return f"政策查询: &#123;query&#125;——年假每年10天，需提前3天申请"

@tool
async def submit_leave(employee_id: str, leave_type: str, start_date: str, days: int) -> dict:
    """提交请假申请。

    Args:
        employee_id: 员工ID
        leave_type: 请假类型
        start_date: 开始日期
        days: 天数
    """
    return &#123;
        "application_id": f"LV_&#123;employee_id&#125;_&#123;start_date.replace('-','')&#125;",
        "status": "待审批",
        "submitted_to": "直属主管",
        "leave_type": leave_type,
        "days": days,
        "message": f"已提交&#123;leave_type&#125;申请&#123;days&#125;天，等待主管审批",
    &#125;

@tool
async def recommend_training(employee_id: str, role: str, skills_gap: list[str] = None) -> dict:
    """推荐培训课程。

    Args:
        employee_id: 员工ID
        role: 岗位
        skills_gap: 技能缺口
    """
    return &#123;
        "employee_id": employee_id,
        "role": role,
        "recommended_courses": [
            &#123;"name": "领导力基础", "reason": "管理岗位必备", "duration": "8小时"&#125;,
            &#123;"name": "项目管理", "reason": "提升执行能力", "duration": "16小时"&#125;,
        ],
        "enrollment_link": "https://hr.company.com/training",
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能HR助手。你可以：

1. **classify_intent**: 分类HR请求
2. **query_hr_policy**: 查询HR政策
3. **submit_leave**: 提交请假申请
4. **recommend_training**: 推荐培训课程

## 工作流程
1. 分类员工请求
2. 按意图处理（查询/请假/培训）
3. 需审批的提交审批
4. 记录并确认

## 原则
- 政策信息准确
- 请假需主管审批
- 培训推荐要有理由"""

hr_agent = create_react_agent(
    llm,
    [classify_intent, query_hr_policy, submit_leave, recommend_training],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await hr_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "我是EMP001，想请3天年假，从下周一开始"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有意图分类 | ☐ |
| 有政策查询 | ☐ |
| 有请假处理 | ☐ |
| 有培训推荐 | ☐ |
