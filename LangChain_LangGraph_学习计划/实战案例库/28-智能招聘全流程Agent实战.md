# 实战案例 28：智能招聘全流程 Agent

> 招聘流程长且碎片——简历筛选→面试安排→面试评估→录用决策。这个案例构建一个覆盖招聘全流程的 Agent，串联前面的简历优化和面试 Agent。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"招聘全流程Agent"}
        JD["职位需求"] --> SCREEN["简历筛选<br/>匹配评分"]
        SCREEN --> SCHEDULE["面试安排<br/>时间协调"]
        SCHEDULE --> INTERVIEW["面试评估<br/>问答+评分"]
        INTERVIEW --> DECISION["录用决策<br/>综合评估"]
        DECISION --> OFFER{"发Offer?"}
        OFFER -->|是| SEND["发送Offer"]
        OFFER -->|否| REJECT["委婉拒绝"]
    end

    style SCREEN fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style DECISION fill:#C8E6C9
```

**核心技术：** 简历匹配 + 面试安排 + 评估评分 + 决策建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def screen_resume(jd_text: str, resume_text: str) -> dict:
    """简历筛选：计算匹配度。

    Args:
        jd_text: 职位描述
        resume_text: 简历文本
    """
    prompt = f"""评估简历与职位的匹配度。

职位: {jd_text[:500]}
简历: {resume_text[:500]}

输出JSON:
```json
{{
  "match_score": 0-100,
  "matched_skills": ["匹配技能"],
  "missing_skills": ["缺失技能"],
  "experience_match": "符合/不足/超出",
  "recommendation": "面试/待定/不推荐"
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"match_score": 50, "recommendation": "待定"}

@tool
async def schedule_interview(candidate_name: str, available_slots: list) -> dict:
    """安排面试时间。

    Args:
        candidate_name: 候选人姓名
        available_slots: 可用时间段
    """
    return {
        "candidate": candidate_name,
        "scheduled_time": available_slots[0] if available_slots else "待定",
        "interview_type": "技术面试",
        "duration_minutes": 60,
        "status": "scheduled",
    }

@tool
async def evaluate_interview(
    candidate_name: str,
    jd_text: str,
    interview_notes: str,
) -> dict:
    """评估面试表现。

    Args:
        candidate_name: 候选人姓名
        jd_text: 职位描述
        interview_notes: 面试记录
    """
    prompt = f"""评估候选人面试表现。

职位要求: {jd_text[:300]}
面试记录: {interview_notes[:500]}

评估维度(0-10):
1. 技术能力
2. 沟通能力
3. 问题解决
4. 文化匹配

输出JSON:
```json
{{
  "scores": {{"technical": 8, "communication": 7, "problem_solving": 8, "culture": 7}},
  "overall": 7.5,
  "strengths": ["优点1"],
  "weaknesses": ["不足1"],
  "recommendation": "录用/待定/不录用"
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"overall": 5, "recommendation": "待定"}

@tool
async def make_hiring_decision(
    resume_score: dict,
    interview_score: dict,
    jd_text: str,
) -> dict:
    """综合评估，做出录用决策。

    Args:
        resume_score: 简历评分
        interview_score: 面试评分
        jd_text: 职位描述
    """
    resume_match = resume_score.get("match_score", 50)
    interview_overall = interview_score.get("overall", 5)

    # 综合评分（简历40% + 面试60%）
    combined = resume_match * 0.4 + interview_overall * 10 * 0.6

    if combined >= 75:
        decision = "录用"
        action = "发送Offer"
    elif combined >= 60:
        decision = "待定"
        action = "安排二面"
    else:
        decision = "不录用"
        action = "发送感谢信"

    return {
        "resume_score": resume_match,
        "interview_score": interview_overall,
        "combined_score": round(combined, 1),
        "decision": decision,
        "action": action,
        "rationale": f"简历匹配{resume_match}%，面试评分{interview_overall}/10",
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能招聘助手。你可以：

1. **screen_resume**: 筛选简历，计算匹配度
2. **schedule_interview**: 安排面试时间
3. **evaluate_interview**: 评估面试表现
4. **make_hiring_decision**: 综合评估做录用决策

## 招聘流程
1. 接收职位需求和候选人简历
2. 筛选简历→匹配度评分
3. 匹配度高→安排面试
4. 面试后→评估表现
5. 综合→录用决策

## 原则
- 客观评估，不带偏见
- 决策要数据驱动
- 不推荐/不录用都要有理由"""

hiring_agent = create_react_agent(
    llm,
    [screen_resume, schedule_interview, evaluate_interview, make_hiring_decision],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await hiring_agent.ainvoke({
        "messages": [{
            "role": "user",
            "content": "我们在招高级Python工程师，候选人张三有3年经验，熟悉FastAPI/Docker，做过RAG项目。帮我评估并给出建议。"
        }]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有简历筛选 | ☐ |
| 有面试安排 | ☐ |
| 有面试评估 | ☐ |
| 有录用决策 | ☐ |
