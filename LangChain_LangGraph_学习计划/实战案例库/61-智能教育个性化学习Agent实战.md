# 实战案例 61：智能教育个性化学习 Agent

> 个性化学习涉及学情评估、知识薄弱点分析、学习路径推荐和练习生成。Agent 能根据学生的学习数据自动分析薄弱知识点、生成个性化学习计划和练习题。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"教育个性化学习Agent"}
        U["学生: '帮我制定数学学习计划'"] --> ASSESS["学情评估<br/>成绩+知识点掌握度"]
        ASSESS --> WEAK["薄弱点分析<br/>知识图谱+掌握率"]
        WEAK --> PATH{"学习路径推荐"}
        PATH -->|基础薄弱| BASIC["基础巩固<br/>概念+例题"]
        PATH -->|进阶不足| ADVANCED["进阶提升<br/>难题+拓展"]
        BASIC & ADVANCED --> PRACTICE["练习生成<br/>针对性题目"]
        PRACTICE --> REPORT["学习报告<br/>计划+进度跟踪"]
    end

    style ASSESS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style WEAK fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 学情评估 + 薄弱点分析 + 学习路径推荐 + 练习生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def assess_student(student_id: str, subject: str = "数学") -> dict:
    """评估学生学习情况。

    Args:
        student_id: 学生ID
        subject: 学科
    """
    return {
        "student_id": student_id,
        "subject": subject,
        "grade_level": "高二",
        "recent_scores": [78, 82, 65, 70, 88],
        "avg_score": 76.6,
        "score_trend": "波动上升",
        "knowledge_points": {
            "函数": {"mastery": 0.85, "total_questions": 50, "correct": 43},
            "几何": {"mastery": 0.45, "total_questions": 40, "correct": 18},
            "概率": {"mastery": 0.70, "total_questions": 30, "correct": 21},
            "数列": {"mastery": 0.30, "total_questions": 25, "correct": 8},
            "三角函数": {"mastery": 0.60, "total_questions": 35, "correct": 21},
        },
        "study_time_per_week_h": 8,
        "learning_style": "视觉型",
    }

@tool
async def analyze_weak_points(assessment: dict) -> dict:
    """分析知识薄弱点。

    Args:
        assessment: 学情评估结果
    """
    knowledge = assessment.get("knowledge_points", {})
    weak_threshold = 0.6

    weak_points = []
    for topic, data in knowledge.items():
        mastery = data.get("mastery", 0)
        if mastery < weak_threshold:
            weak_points.append({
                "topic": topic,
                "mastery": mastery,
                "gap": round(1 - mastery, 2),
                "total_questions": data.get("total_questions", 0),
                "correct_rate": data.get("mastery", 0),
                "priority": "高" if mastery < 0.4 else "中",
            })

    weak_points.sort(key=lambda x: x["mastery"])

    return {
        "student_id": assessment.get("student_id", ""),
        "total_topics": len(knowledge),
        "weak_count": len(weak_points),
        "strong_count": len(knowledge) - len(weak_points),
        "weakest_topic": weak_points[0]["topic"] if weak_points else "无",
        "weak_points": weak_points,
        "recommendation_focus": [wp["topic"] for wp in weak_points[:3]],
    }

@tool
async def recommend_path(weak_analysis: dict, assessment: dict) -> dict:
    """推荐学习路径。

    Args:
        weak_analysis: 薄弱点分析结果
        assessment: 学情评估结果
    """
    weak_topics = [wp["topic"] for wp in weak_analysis.get("weak_points", [])]
    learning_style = assessment.get("learning_style", "视觉型")
    study_time = assessment.get("study_time_per_week_h", 6)

    path = []
    for i, topic in enumerate(weak_topics):
        mastery = next((wp["mastery"] for wp in weak_analysis["weak_points"] if wp["topic"] == topic), 0.5)

        if mastery < 0.4:
            phase = "基础巩固"
            activities = ["概念学习", "基础例题", "同类练习10道"]
            time_alloc = study_time * 0.4 / len(weak_topics)
        elif mastery < 0.6:
            phase = "强化提升"
            activities = ["错题回顾", "中等难度练习", "解题技巧"]
            time_alloc = study_time * 0.35 / len(weak_topics)
        else:
            phase = "进阶拓展"
            activities = ["难题挑战", "综合应用", "竞赛题选做"]
            time_alloc = study_time * 0.25 / len(weak_topics)

        path.append({
            "order": i + 1,
            "topic": topic,
            "phase": phase,
            "activities": activities,
            "time_hours": round(time_alloc, 1),
            "mastery_now": mastery,
            "target_mastery": min(mastery + 0.2, 0.9),
        })

    return {
        "student_id": assessment.get("student_id", ""),
        "total_weeks": 4,
        "weekly_hours": study_time,
        "learning_style": learning_style,
        "path": path,
        "estimated_improvement": "+10-15分",
    }

@tool
async def generate_practice(topic: str, difficulty: str = "medium", count: int = 5) -> dict:
    """生成针对性练习题。

    Args:
        topic: 知识点
        difficulty: 难度(easy/medium/hard)
        count: 题目数量
    """
    # 模拟题目生成（实际可用LLM生成）
    template = {
        "函数": [
            {"q": "求函数f(x)=x²+2x-3的最小值", "a": "最小值为-4，当x=-1时取得", "type": "计算"},
            {"q": "判断函数f(x)=x³在R上的单调性", "a": "在R上单调递增", "type": "证明"},
        ],
        "几何": [
            {"q": "在三角形ABC中，已知两边和夹角，求第三边", "a": "用余弦定理", "type": "计算"},
            {"q": "证明三角形内角和为180度", "a": "过顶点作平行线，利用内错角", "type": "证明"},
        ],
        "数列": [
            {"q": "求等差数列2,5,8,...的第20项", "a": "a₂₀=2+19×3=59", "type": "计算"},
            {"q": "证明等比数列前n项和公式", "a": "错位相减法", "type": "证明"},
        ],
    }

    questions = template.get(topic, [
        {"q": f"{topic}基础题1", "a": f"{topic}基础答案1", "type": "基础"},
        {"q": f"{topic}基础题2", "a": f"{topic}基础答案2", "type": "基础"},
    ])

    difficulty_label = {"easy": "基础", "medium": "中等", "hard": "挑战"}.get(difficulty, "中等")

    return {
        "topic": topic,
        "difficulty": difficulty_label,
        "count": len(questions[:count]),
        "questions": questions[:count],
        "estimated_time_min": len(questions[:count]) * 8,
    }

@tool
async def generate_learning_report(assessment: dict, weak_analysis: dict, path: dict) -> dict:
    """生成学习报告。

    Args:
        assessment: 学情评估结果
        weak_analysis: 薄弱点分析结果
        path: 学习路径
    """
    return {
        "report_id": f"EDU-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "student_id": assessment.get("student_id", ""),
        "subject": assessment.get("subject", "数学"),
        "grade_level": assessment.get("grade_level", ""),
        "score_summary": {
            "avg_score": assessment.get("avg_score", 0),
            "trend": assessment.get("score_trend", ""),
            "recent_scores": assessment.get("recent_scores", []),
        },
        "weak_points_summary": {
            "count": weak_analysis.get("weak_count", 0),
            "weakest": weak_analysis.get("weakest_topic", ""),
            "focus_areas": weak_analysis.get("recommendation_focus", []),
        },
        "learning_plan": {
            "total_weeks": path.get("total_weeks", 4),
            "weekly_hours": path.get("weekly_hours", 0),
            "phases": [{"topic": p["topic"], "phase": p["phase"], "hours": p["time_hours"]} for p in path.get("path", [])],
            "estimated_improvement": path.get("estimated_improvement", ""),
        },
        "recommendation": f"重点突破{', '.join(weak_analysis.get('recommendation_focus', [])[:2])}",
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能教育个性化学习助手。你可以：

1. **assess_student**: 评估学生学习情况
2. **analyze_weak_points**: 分析知识薄弱点
3. **recommend_path**: 推荐学习路径
4. **generate_practice**: 生成针对性练习题
5. **generate_learning_report**: 生成学习报告

## 工作流程
1. 评估学生成绩和知识点掌握情况
2. 分析薄弱知识点（掌握率低于60%）
3. 根据薄弱点推荐个性化学习路径
4. 生成针对性练习题
5. 汇总生成学习报告

## 原则
- 薄弱点优先（掌握率最低的先学）
- 分阶段（基础巩固→强化提升→进阶拓展）
- 匹配学习风格
- 时间分配合理
- 给出预估提升目标"""

education_agent = create_react_agent(
    llm,
    [assess_student, analyze_weak_points, recommend_path, generate_practice, generate_learning_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await education_agent.ainvoke({
        "messages": [{"role": "user", "content": "学生S001数学成绩波动，请分析薄弱点并制定学习计划"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
个性化学习报告

报告编号：EDU-20260827190000
学生：S001 | 学科：数学 | 年级：高二

成绩概况：
- 平均分：76.6
- 趋势：波动上升
- 近5次：78, 82, 65, 70, 88

薄弱知识点分析：
- 数列（掌握率30%）← 最薄弱，优先突破
- 几何（掌握率45%）
- 三角函数（掌握率60%）
- 强项：函数（85%）

学习路径（4周计划）：
1. 数列 → 基础巩固（3.2h/周）
   - 概念学习 → 基础例题 → 同类练习10道
   - 目标：30% → 50%
2. 几何 → 基础巩固（2.8h/周）
   - 概念学习 → 基础例题 → 同类练习10道
   - 目标：45% → 65%
3. 三角函数 → 强化提升（2.5h/周）
   - 错题回顾 → 中等难度 → 解题技巧
   - 目标：60% → 80%

练习题示例（数列-中等）：
1. 求等差数列2,5,8,...的第20项 → a₂₀=59
2. 证明等比数列前n项和公式 → 错位相减法

建议：重点突破数列和几何，预估提升10-15分
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有学情评估工具 | ☐ |
| 有薄弱点分析 | ☐ |
| 有学习路径推荐 | ☐ |
| 有练习题生成 | ☐ |
| 有学习报告 | ☐ |
| 薄弱点优先排序 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
