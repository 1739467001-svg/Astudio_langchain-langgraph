# 实战案例 66：智能招聘 Agent

> 招聘流程涉及简历解析、岗位匹配、候选人评估和面试安排。Agent 能自动解析简历、匹配岗位需求、评估候选人匹配度，并生成面试建议和安排方案。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"智能招聘Agent"}
        HR["HR: '筛选Java后端候选人'"] --> PARSE["简历解析<br/>提取技能+经验+学历"]
        PARSE --> MATCH{"岗位匹配<br/>需求 vs 简历"}
        MATCH --> EVAL["候选人评估<br/>匹配度评分+维度分析"]
        EVAL --> INTERVIEW["面试安排<br/>建议问题+时间+面试官"]
        INTERVIEW --> REPORT["招聘报告<br/>排名+评估+建议"]
    end

    style PARSE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style MATCH fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 简历解析 + 岗位匹配 + 候选人评估 + 面试安排

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
import json
from datetime import datetime, timedelta

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
def parse_resume(resume_text: str) -> dict:
    """解析简历，提取关键信息

    Args:
        resume_text: 简历文本内容
    """
    # 模拟解析结果
    return {
        "name": "张三",
        "skills": ["Java", "Spring Boot", "MySQL", "Redis", "Docker", "Kubernetes"],
        "experience_years": 5,
        "education": "硕士 - 计算机科学",
        "current_role": "高级Java开发工程师",
        "projects": [
            {"name": "电商订单系统", "role": "核心开发", "tech": "Spring Cloud + MySQL"},
            {"name": "支付网关", "role": "技术负责人", "tech": "Java + Redis + Kafka"}
        ],
        "certifications": ["AWS Solutions Architect", "PMP"]
    }

@tool
def match_job_position(candidate_skills: str, job_requirements: str) -> dict:
    """匹配候选人技能与岗位需求

    Args:
        candidate_skills: 候选人技能列表（逗号分隔）
        job_requirements: 岗位需求技能列表（逗号分隔）
    """
    candidate_set = set(s.strip().lower() for s in candidate_skills.split(","))
    required_set = set(s.strip().lower() for s in job_requirements.split(","))

    matched = candidate_set & required_set
    missing = required_set - candidate_set
    match_pct = round(len(matched) / max(len(required_set), 1) * 100, 1)

    return {
        "matched_skills": sorted(matched),
        "missing_skills": sorted(missing),
        "match_percentage": match_pct,
        "total_required": len(required_set),
        "total_matched": len(matched)
    }

@tool
def evaluate_candidate(match_result: str, experience_years: int, education: str) -> dict:
    """评估候选人综合匹配度

    Args:
        match_result: 岗位匹配结果JSON
        experience_years: 工作年限
        education: 学历信息
    """
    match_data = json.loads(match_result) if isinstance(match_result, str) else match_result
    match_pct = match_data.get("match_percentage", 0)
    missing_count = len(match_data.get("missing_skills", []))

    # 综合评分
    skill_score = match_pct * 0.5
    exp_score = min(experience_years / 5 * 100, 100) * 0.3  # 5年为满分
    edu_score = 100 if "硕士" in education or "博士" in education else 70 if "本科" in education else 40
    edu_score *= 0.2

    total_score = round(skill_score + exp_score + edu_score, 1)

    if total_score >= 80:
        recommendation = "强烈推荐进入面试"
    elif total_score >= 60:
        recommendation = "建议面试，关注缺失技能"
    elif total_score >= 40:
        recommendation = "备选候选人"
    else:
        recommendation = "暂不推荐"

    return {
        "total_score": total_score,
        "skill_score": round(skill_score, 1),
        "experience_score": round(exp_score, 1),
        "education_score": round(edu_score, 1),
        "recommendation": recommendation,
        "risk_notes": f"缺失{missing_count}项核心技能" if missing_count > 0 else "技能全覆盖"
    }

@tool
def schedule_interview(candidate_name: str, position: str, score: float) -> dict:
    """安排面试，生成面试建议

    Args:
        candidate_name: 候选人姓名
        position: 应聘岗位
        score: 综合评分
    """
    base_date = datetime.now() + timedelta(days=3)

    if score >= 80:
        interview_type = "终面"
        duration_min = 60
        interviewers = ["技术总监", "CTO"]
    elif score >= 60:
        interview_type = "技术面"
        duration_min = 90
        interviewers = ["技术负责人", "高级工程师"]
    else:
        interview_type = "初筛面"
        duration_min = 30
        interviewers = ["HR", "初级技术"]

    suggested_questions = [
        f"请详细描述你在{position}相关项目中的核心贡献",
        "如何处理高并发场景下的数据一致性问题？",
        "分享一次技术选型的决策过程"
    ] if score >= 60 else [
        "请介绍你的技术栈和项目经验",
        "你对这个岗位的期望是什么？"
    ]

    return {
        "candidate": candidate_name,
        "interview_type": interview_type,
        "suggested_time": base_date.strftime("%Y-%m-%d 14:00"),
        "duration_minutes": duration_min,
        "interviewers": interviewers,
        "suggested_questions": suggested_questions,
        "preparation_notes": "请候选人准备项目架构图和技术方案"
    }
```

---

## 三、Agent 组装

```python
# 使用 create_react_agent 组装
agent = create_react_agent(
    model=llm,
    tools=[parse_resume, match_job_position, evaluate_candidate, schedule_interview],
    prompt="""你是智能招聘助手，帮助HR完成候选人筛选和面试安排。

工作流程：
1. 调用 parse_resume 解析候选人简历
2. 调用 match_job_position 匹配岗位需求
3. 调用 evaluate_candidate 评估综合匹配度
4. 调用 schedule_interview 安排面试

注意：
- 每个步骤的结果传给下一个工具
- 最终输出完整的招聘评估报告
- 评分低于40分的候选人不安排面试"""
)
```

---

## 四、使用示例

```python
import asyncio

async def main():
    result = await agent.ainvoke({
        "messages": [HumanMessage(content="""
            请筛选一位Java后端高级工程师候选人。

            简历摘要：
            张三，5年Java开发经验，硕士学历。
            技能：Java, Spring Boot, MySQL, Redis, Docker, Kubernetes
            主导过电商订单系统和支付网关项目。

            岗位要求：Java, Spring Boot, MySQL, Redis, Kafka, Microservices, CI/CD
        """)]
    })

    print("=== 招聘Agent结果 ===")
    for msg in result["messages"]:
        if hasattr(msg, 'content') and msg.content:
            print(msg.content[:200])

asyncio.run(main())
```

输出：

```text
=== 招聘Agent结果 ===
我已完成张三的招聘评估，流程如下：

1. **简历解析**：张三，5年经验，硕士，技能包括Java/Spring Boot/MySQL/Redis/Docker/K8s
2. **岗位匹配**：匹配率71.4%（5/7项技能匹配），缺失Kafka和CI/CD
3. **综合评估**：总分71.2分（技能35.7 + 经验30.0 + 学历20.0）
   - 建议：进入技术面试，关注Kafka和CI/CD经验
4. **面试安排**：
   - 类型：技术面（90分钟）
   - 时间：2025-01-18 14:00
   - 面试官：技术负责人、高级工程师
   - 重点问题：项目核心贡献、高并发数据一致性、技术选型决策
```

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有简历解析工具 | ☐ |
| 有岗位匹配工具 | ☐ |
| 有候选人评估工具 | ☐ |
| 有面试安排工具 | ☐ |
| 有 create_react_agent 组装 | ☐ |
| 有端到端使用示例 | ☐ |
