# 实战案例 53：智能保险核保 Agent

> 保险核保涉及风险评估、健康告知核查、费率计算、承保决策。Agent 能自动收集信息、评估风险、给出核保建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"保险核保Agent"&#125;
        U["投保人: '申请重疾险'"] --> INFO["信息收集<br/>年龄/职业/健康"]
        INFO --> RISK["风险评估<br/>年龄/职业/病史"]
        RISK --> RATE&#123;"费率计算"&#125;
        RATE --> DECIDE&#123;"核保决策"&#125;
        DECIDE -->|标准| ACCEPT["标准承保"]
        DECIDE -->|加费| LOADING["加费承保"]
        DECIDE -->|拒保| REJECT["拒保+原因"]
    end

    style INFO fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ACCEPT fill:#C8E6C9
```

**核心技术：** 信息收集 + 风险评估 + 费率计算 + 核保决策

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_info(applicant_info: str) -> dict:
    """收集投保人信息。

    Args:
        applicant_info: 投保人信息
    """
    prompt = f"""整理投保人信息。

信息: &#123;applicant_info&#125;

输出JSON:
```json
&#123;&#123;
  "name": "...", "age": 35, "gender": "...",
  "occupation": "...", "product": "重疾险",
  "sum_insured": 500000,
  "health_history": ["高血压"],
  "family_history": [],
  "lifestyle": &#123;&#123;"smoking": false, "drinking": "偶尔"&#125;&#125;
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"age": 35, "product": "重疾险"&#125;

@tool
async def assess_risk(applicant: dict) -> dict:
    """评估核保风险。

    Args:
        applicant: 投保人信息
    """
    age = applicant.get("age", 35)
    health = applicant.get("health_history", [])
    smoking = applicant.get("lifestyle", &#123;&#125;).get("smoking", False)

    risk_score = 0
    risk_factors = []

    if age > 50:
        risk_score += 30
        risk_factors.append(f"年龄&#123;age&#125;岁（>50）")
    if age > 40:
        risk_score += 10
    if "高血压" in health:
        risk_score += 20
        risk_factors.append("高血压病史")
    if "糖尿病" in health:
        risk_score += 25
        risk_factors.append("糖尿病病史")
    if smoking:
        risk_score += 15
        risk_factors.append("吸烟")

    risk_level = "high" if risk_score >= 50 else "medium" if risk_score >= 25 else "low"

    return &#123;
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "max_coverage": 1000000 if risk_level == "low" else 500000 if risk_level == "medium" else 200000,
    &#125;

@tool
async def calculate_premium(applicant: dict, risk: dict) -> dict:
    """计算保费。

    Args:
        applicant: 投保人信息
        risk: 风险评估
    """
    age = applicant.get("age", 35)
    sum_insured = applicant.get("sum_insured", 500000)
    risk_score = risk.get("risk_score", 0)

    # 基础费率（每万元保额）
    base_rate = 50 + (age - 30) * 5  # 30岁=50元/万, 40岁=100元/万
    # 风险加成
    risk_loading = 1.0 + risk_score / 100  # 风险分越高费率越高
    # 最终保费
    premium = int(sum_insured / 10000 * base_rate * risk_loading)

    return &#123;
        "annual_premium": premium,
        "base_rate": base_rate,
        "risk_loading": round(risk_loading, 2),
        "sum_insured": sum_insured,
        "payment_years": 20,
        "total_premium": premium * 20,
    &#125;

@tool
async def make_decision(risk: dict, premium: dict) -> dict:
    """核保决策。

    Args:
        risk: 风险评估
        premium: 保费计算
    """
    level = risk.get("risk_level", "low")

    if level == "low":
        return &#123;"decision": "标准承保", "conditions": "无附加条件", "message": "风险可控，标准费率承保"&#125;
    elif level == "medium":
        return &#123;"decision": "加费承保", "conditions": f"加费&#123;premium.get('risk_loading', 1.0)-1:.0%&#125;", "message": "存在风险因素，加费承保"&#125;
    else:
        return &#123;"decision": "拒保", "conditions": "风险过高", "message": f"风险评分&#123;risk.get('risk_score', 0)&#125;，建议拒保", "suggestion": "建议申请定期寿险或减低保额"&#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能保险核保助手。你可以：

1. **collect_info**: 收集投保人信息
2. **assess_risk**: 评估核保风险
3. **calculate_premium**: 计算保费
4. **make_decision**: 核保决策

## 工作流程
1. 收集投保人信息
2. 评估风险等级
3. 计算保费
4. 做出核保决策

## 原则
- 风险评估客观
- 高风险要拒保或加费
- 决策要给理由"""

underwriting_agent = create_react_agent(
    llm,
    [collect_info, assess_risk, calculate_premium, make_decision],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await underwriting_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "我35岁男性，IT工程师，想投保50万重疾险。有高血压，不吸烟。"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有信息收集 | ☐ |
| 有风险评估 | ☐ |
| 有保费计算 | ☐ |
| 有核保决策 | ☐ |
