# 实战案例 35：智能教育评测 Agent

> 教育评测涉及作业批改、能力评估、学习诊断、个性化建议。Agent 能自动批改作业、分析知识薄弱点、给出个性化学习路径。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"教育评测Agent"&#125;
        U["教师: '批改这份试卷'"] --> GRADE["自动批改<br/>逐题评分"]
        GRADE --> ANALYZE["能力分析<br/>知识点掌握度"]
        ANALYZE --> DIAGNOSE["薄弱诊断<br/>知识盲区识别"]
        DIAGNOSE --> SUGGEST["学习建议<br/>个性化路径"]
    end

    style GRADE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SUGGEST fill:#C8E6C9
```

**核心技术：** 作业批改 + 知识点分析 + 薄弱诊断 + 个性化建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def grade_assignment(questions: list, student_answers: list) -> dict:
    """批改作业。

    Args:
        questions: 题目列表
        student_answers: 学生答案列表
    """
    prompt = f"""批改以下作业。

题目: &#123;json.dumps(questions, ensure_ascii=False)[:1000]&#125;
学生答案: &#123;json.dumps(student_answers, ensure_ascii=False)[:1000]]

逐题评分:
- 正确/错误
- 得分
- 错误原因

输出JSON:
```json
&#123;&#123;
  "total_score": 0,
  "max_score": 100,
  "details": [
    &#123;&#123;"question_id": 1, "correct": true/false, "score": 10, "error_reason": "..."&#125;&#125;
  ]
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"total_score": 0, "details": []&#125;

@tool
async def analyze_knowledge(grading_result: dict, knowledge_points: list) -> dict:
    """分析知识点掌握情况。

    Args:
        grading_result: 批改结果
        knowledge_points: 知识点列表
    """
    prompt = f"""分析学生知识点掌握情况。

批改结果: &#123;json.dumps(grading_result, ensure_ascii=False)[:1000]&#125;
知识点: &#123;knowledge_points&#125;

分析每个知识点的掌握度:
```json
&#123;&#123;
  " mastery": [
    &#123;&#123;"knowledge_point": "...", "mastery_level": "掌握/部分掌握/未掌握", "correct_count": 3, "total_count": 5&#125;&#125;
  ],
  "overall_mastery_rate": 0.65
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"mastery": [], "overall_mastery_rate": 0&#125;

@tool
async def diagnose_weakness(mastery_analysis: dict) -> dict:
    """诊断知识薄弱点。

    Args:
        mastery_analysis: 掌握度分析
    """
    prompt = f"""诊断学生知识薄弱点。

掌握度分析: &#123;json.dumps(mastery_analysis, ensure_ascii=False)[:1000]&#125;

输出JSON:
```json
&#123;&#123;
  "weak_points": ["薄弱知识点1"],
  "partial_points": ["部分掌握知识点"],
  "strong_points": ["掌握良好知识点"],
  "priority": ["优先学习的知识点排序"]
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"weak_points": []&#125;

@tool
async def generate_study_plan(weakness: dict, student_level: str = "初中") -> str:
    """生成个性化学习计划。

    Args:
        weakness: 薄弱点诊断
        student_level: 学生年级
    """
    prompt = f"""基于诊断结果生成个性化学习计划。

诊断: &#123;json.dumps(weakness, ensure_ascii=False)[:800]&#125;
年级: &#123;student_level&#125;

计划包含:
1. 优先学习内容
2. 推荐练习类型
3. 学习时间分配
4. 检验标准

计划:"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能教育评测助手。你可以：

1. **grade_assignment**: 批改作业
2. **analyze_knowledge**: 分析知识点掌握
3. **diagnose_weakness**: 诊断薄弱点
4. **generate_study_plan**: 生成学习计划

## 工作流程
1. 批改作业
2. 分析知识点掌握度
3. 诊断薄弱点
4. 生成个性化学习计划

## 原则
- 客观评分
- 诊断要具体到知识点
- 建议要可操作"""

edu_agent = create_react_agent(
    llm,
    [grade_assignment, analyze_knowledge, diagnose_weakness, generate_study_plan],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await edu_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "批改这份数学作业: 题1: 2+3=? 答: 5; 题2: 7*8=? 答: 54; 题3: 10-4=? 答: 6"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有作业批改 | ☐ |
| 有知识分析 | ☐ |
| 有薄弱诊断 | ☐ |
| 有学习计划 | ☐ |
