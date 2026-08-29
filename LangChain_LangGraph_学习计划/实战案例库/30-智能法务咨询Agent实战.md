# 实战案例 30：智能法务咨询 Agent

> 法务咨询需求高频——劳动合同、租赁纠纷、知识产权。Agent 能理解法律问题、检索法规、给出初步建议（不替代律师）。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"法务咨询Agent"}
        U["用户: '公司要裁员'"] --> CLASSIFY["问题分类<br/>劳动/合同/知产"]
        CLASSIFY --> SEARCH["法规检索<br/>相关法条"]
        SEARCH --> ANALYZE["法律分析<br/>适用条款+风险"]
        ANALYZE --> ADVICE["初步建议<br/>+免责声明"]
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ADVICE fill:#C8E6C9
```

**核心技术：** 问题分类 + 法规检索 + 法律分析 + 免责声明

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o", temperature=0)

@tool
async def classify_legal_question(question: str) -> dict:
    """分类法律问题。

    Args:
        question: 用户法律问题
    """
    prompt = f"""分类以下法律问题。

问题: {question}

分类:
1. 劳动法（裁员/工资/合同/社保）
2. 合同法（违约/解除/赔偿）
3. 知识产权（专利/商标/著作权）
4. 婚姻家庭（离婚/继承）
5. 其他

输出JSON:
```json
{{
  "category": "...",
  "subcategory": "...",
  "urgency": "high/medium/low",
  "key_issues": ["关键问题1"]
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"category": "其他"}

@tool
async def search_law(question: str, category: str) -> str:
    """检索相关法律法规。

    Args:
        question: 法律问题
        category: 问题分类
    """
    # 实际接入法律知识库
    return f"[{category}]相关法规: 《劳动法》第41条、《劳动合同法》第40条"

@tool
async def analyze_legal(question: str, laws: str, classification: dict) -> dict:
    """法律分析。

    Args:
        question: 用户问题
        laws: 检索到的法规
        classification: 问题分类
    """
    prompt = f"""你是法律顾问。分析以下问题。

问题: {question}
分类: {json.dumps(classification, ensure_ascii=False)}
相关法规: {laws[:500]}

分析:
1. 适用法律条款
2. 用户权利
3. 可能的风险
4. 建议步骤

输出JSON:
```json
{{
  "applicable_laws": ["法条1"],
  "user_rights": ["权利1"],
  "risks": ["风险1"],
  "recommended_steps": ["步骤1"],
  "needs_lawyer": true/false
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"applicable_laws": [], "needs_lawyer": True}

@tool
async def give_advice(analysis: dict, classification: dict) -> str:
    """给出初步法律建议。

    Args:
        analysis: 法律分析
        classification: 问题分类
    """
    advice = f"""## 法律咨询初步建议

### 问题类型
{classification.get('category', '未知')} - {classification.get('subcategory', '')}

### 适用法律
"""
    for law in analysis.get("applicable_laws", []):
        advice += f"- {law}\n"

    advice += f"\n### 您的权利\n"
    for right in analysis.get("user_rights", []):
        advice += f"- {right}\n"

    advice += f"\n### 建议步骤\n"
    for i, step in enumerate(analysis.get("recommended_steps", []), 1):
        advice += f"{i}. {step}\n"

    if analysis.get("needs_lawyer"):
        advice += "\n⚠️ 建议咨询专业律师获取详细法律意见。\n"

    advice += "\n---\n⚠️ 以上建议仅供参考，不构成法律意见。具体问题请咨询执业律师。"
    return advice
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能法务咨询助手。你可以：

1. **classify_legal_question**: 分类法律问题
2. **search_law**: 检索相关法规
3. **analyze_legal**: 法律分析
4. **give_advice**: 给出初步建议

## 原则
- 不替代律师，只给初步建议
- 必须包含免责声明
- 复杂问题建议找专业律师
- 客观分析，不带立场"""

legal_agent = create_react_agent(
    llm,
    [classify_legal_question, search_law, analyze_legal, give_advice],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await legal_agent.ainvoke({
        "messages": [{"role": "user", "content": "公司突然通知裁员，我在公司干了5年，能拿到多少补偿？"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有问题分类 | ☐ |
| 有法规检索 | ☐ |
| 有法律分析 | ☐ |
| 有免责声明 | ☐ |
