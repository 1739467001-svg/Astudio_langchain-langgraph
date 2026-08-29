# 实战案例 55：智能人力资源规划 Agent

> 人力资源规划涉及人才盘点、能力差距分析、招聘计划、培训规划。Agent 能自动分析团队现状、识别人才缺口、给出规划建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"人力资源规划Agent"}
        U["HR: '分析研发团队'"] --> AUDIT["人才盘点<br/>人员+技能+绩效"]
        AUDIT --> GAP["差距分析<br/>当前vs需求"]
        GAP --> HIRE{"需招聘?"}
        HIRE -->|是| PLAN["招聘计划<br/>岗位+数量"]
        HIRE -->|否| TRAIN["培训计划"]
        PLAN & TRAIN --> REPORT["规划报告"]
    end

    style AUDIT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 人才盘点 + 差距分析 + 招聘计划 + 培训规划

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def audit_team(department: str) -> dict:
    """人才盘点。

    Args:
        department: 部门名称
    """
    return {
        "department": department,
        "headcount": 25,
        "members": [
            {"name": "张三", "role": "高级工程师", "skills": ["Python", "AI"], "performance": "A", "years": 5},
            {"name": "李四", "role": "工程师", "skills": ["Java"], "performance": "B", "years": 3},
            {"name": "王五", "role": "架构师", "skills": ["系统设计", "AI"], "performance": "A", "years": 8},
        ],
        "skill_distribution": {"AI": 8, "Python": 15, "Java": 5, "系统设计": 3},
        "avg_performance": "B+",
    }

@tool
async def analyze_gap(team_data: dict, target_skills: list[str] = None) -> dict:
    """分析能力差距。

    Args:
        team_data: 团队数据
        target_skills: 目标技能列表
    """
    current = team_data.get("skill_distribution", {})
    targets = target_skills or ["AI", "Python", "Cloud", "Data Engineering"]

    gaps = []
    for skill in targets:
        current_count = current.get(skill, 0)
        required = max(5, len(team_data.get("members", [])) // 3)
        if current_count < required:
            gaps.append({"skill": skill, "current": current_count, "required": required, "gap": required - current_count})

    return {
        "gaps": gaps,
        "has_gap": len(gaps) > 0,
        "priority_skills": [g["skill"] for g in gaps[:3]],
    }

@tool
async def generate_hiring_plan(gaps: dict, budget: int = 3) -> dict:
    """生成招聘计划。

    Args:
        gaps: 差距分析
        budget: 招聘名额
    """
    positions = []
    for gap in gaps.get("gaps", [])[:budget]:
        positions.append({
            "title": f"{gap['skill']}工程师",
            "level": "高级" if gap["gap"] > 2 else "中级",
            "count": min(gap["gap"], 1),
            "priority": "高" if gap["gap"] > 2 else "中",
        })

    return {
        "positions": positions,
        "total_hires": len(positions),
        "estimated_cost": len(positions) * 300000,
        "timeline": "Q1完成招聘",
    }

@tool
async def generate_training_plan(gaps: dict, team_data: dict) -> dict:
    """生成培训计划。

    Args:
        gaps: 差距分析
        team_data: 团队数据
    """
    programs = []
    for gap in gaps.get("gaps", []):
        programs.append({
            "skill": gap["skill"],
            "trainees": gap["gap"],
            "duration": "8小时" if gap["gap"] <= 2 else "16小时",
            "format": "线上+实践",
            "provider": "内部" if gap["current"] > 0 else "外部",
        })

    return {
        "programs": programs,
        "total_programs": len(programs),
        "total_hours": sum(int(p["duration"].replace("小时", "")) for p in programs),
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能人力资源规划助手。你可以：

1. **audit_team**: 人才盘点
2. **analyze_gap**: 分析能力差距
3. **generate_hiring_plan**: 生成招聘计划
4. **generate_training_plan**: 生成培训计划

## 工作流程
1. 盘点团队人员和技能
2. 分析能力差距
3. 有缺口→生成招聘计划+培训计划
4. 综合报告

## 原则
- 数据驱动
- 优先级排序
- 建议要可执行"""

hr_planning_agent = create_react_agent(
    llm,
    [audit_team, analyze_gap, generate_hiring_plan, generate_training_plan],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await hr_planning_agent.ainvoke({
        "messages": [{"role": "user", "content": "分析研发部的团队能力，找出技能差距并给出招聘和培训建议"}]
    })
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有人才盘点 | ☐ |
| 有差距分析 | ☐ |
| 有招聘计划 | ☐ |
| 有培训计划 | ☐ |
