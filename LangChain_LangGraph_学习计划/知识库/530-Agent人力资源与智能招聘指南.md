# Agent 人力资源与智能招聘指南

> HR 每天收到上百份简历——Agent 能自动筛选简历、安排面试、生成面试问题、评估候选人。本指南系统讲解 HR Agent 架构、简历解析、智能匹配、面试辅助、员工服务。

---

## 1. HR Agent 架构

### 工作流

```mermaid
graph TB
    JD["职位需求"] --> PUBLISH["发布招聘"]
    PUBLISH --> RESUME["简历收集"]
    RESUME --> PARSE["简历解析<br/>结构化提取"]
    PARSE --> MATCH["智能匹配<br/>岗位适配度"]
    MATCH --> SCREEN["筛选<br/>推荐/备选/淘汰"]
    SCREEN --> INTERVIEW["面试安排<br/>自动预约"]
    INTERVIEW --> QUESTIONS["面试题生成<br/>个性化"]
    QUESTIONS --> EVAL["候选人评估<br/>综合评分"]
    EVAL --> OFFER["Offer 建议"]

    style PARSE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style MATCH fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style EVAL fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 简历解析

```python
@dataclass
class ResumeParser:
    """简历解析器"""

    async def parse(self, resume_text: str) -> dict:
        """解析简历"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""解析简历，提取结构化信息。

简历内容:
{resume_text[:3000]}

输出 JSON:
{{
    "name": "姓名",
    "phone": "电话",
    "email": "邮箱",
    "education": [{{"school": "...", "degree": "...", "major": "...", "year": "..."}}],
    "experience": [{{"company": "...", "title": "...", "duration": "...", "description": "..."}}],
    "skills": ["技能1", "技能2"],
    "certifications": ["证书"],
    "languages": ["语言"],
    "projects": [{{"name": "...", "role": "...", "description": "..."}}],
    "summary": "一句话概括"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 3. 智能匹配

```python
@dataclass
class CandidateMatcher:
    """候选人匹配器"""

    async def match(self, candidate: dict, job_requirements: dict) -> dict:
        """计算岗位适配度"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""评估候选人与岗位的匹配度。

岗位要求:
{json.dumps(job_requirements, ensure_ascii=False)}

候选人信息:
{json.dumps(candidate, ensure_ascii=False)[:2000]}

评估维度:
1. 技能匹配度（必需技能/加分技能）
2. 经验匹配度（行业/年限/项目）
3. 学历匹配
4. 稳定性（跳槽频率）

输出 JSON:
{{
    "overall_score": 0-100,
    "skill_score": 0-100,
    "experience_score": 0-100,
    "education_score": 0-100,
    "stability_score": 0-100,
    "matching_skills": ["匹配的技能"],
    "missing_skills": ["缺失的技能"],
    "highlights": ["亮点"],
    "concerns": ["关注点"],
    "recommendation": "推荐面试/备选/不推荐"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def rank_candidates(self, candidates: list, job: dict) -> list:
        """对候选人排序"""
        results = []
        for c in candidates:
            match = await self.match(c, job)
            results.append({**c, "match_result": match})

        results.sort(key=lambda x: -x["match_result"]["overall_score"])
        return results
```

---

## 4. 面试辅助

```python
@dataclass
class InterviewAssistant:
    """面试辅助"""

    async def generate_questions(self, candidate: dict, job: dict) -> dict:
        """生成个性化面试问题"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        prompt = f"""为候选人生成面试问题。

岗位: {json.dumps(job, ensure_ascii=False)}
候选人: {json.dumps(candidate, ensure_ascii=False)[:1000]}

输出 JSON:
{{
    "technical_questions": [
        {{"question": "...", "intent": "考察什么", "expected_points": ["期望回答要点"]}}
    ],
    "behavioral_questions": [
        {{"question": "...", "intent": "考察什么"}}
    ],
    "case_questions": [
        {{"question": "...", "context": "背景"}}
    ],
    "culture_fit_questions": ["文化匹配问题"]
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def evaluate_answer(self, question: str, answer: str,
                               expected: list) -> dict:
        """评估面试回答"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""评估面试回答。

问题: {question}
期望要点: {json.dumps(expected, ensure_ascii=False)}
候选人回答: {answer}

输出 JSON:
{{
    "score": 0-100,
    "covered_points": ["覆盖的要点"],
    "missing_points": ["遗漏的要点"],
    "communication": 0-100,
    "depth": 0-100,
    "feedback": "具体反馈"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 5. 员工服务

```python
@dataclass
class EmployeeServiceAgent:
    """员工服务 Agent"""

    async def handle_query(self, employee_id: str, query: str) -> str:
        """处理员工咨询"""
        # 常见问题：请假/报销/福利/政策
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""你是 HR 助手。回答员工问题。

员工ID: {employee_id}
问题: {query}

可以查询：
- 请假政策（年假/病假/事假）
- 报销流程
- 福利待遇
- 公司政策
- 薪资计算

如果不清楚，建议联系 HR 专员。"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了简历解析 | ☐ |
| 实现了智能匹配（4 维度评分） | ☐ |
| 实现了候选人排序 | ☐ |
| 实现了面试问题生成 | ☐ |
| 实现了面试回答评估 | ☐ |
| 实现了员工服务 | ☐ |
| 有推荐/备选/淘汰分类 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 20 | 智能面试 Agent | 面试 |
| 19 | 智能简历优化 Agent | 简历 |
| 42 | 智能招聘全流程 Agent | 招聘 |
| 55 | 智能人力资源规划 Agent | HR |
| 66 | 智能招聘 Agent | 招聘 |
| 459 | Agent 个性化与画像 | 画像 |
| 461 | 企业 Agent 集成 | 集成 |
| 522 | Agent 教育 | 教育 |
