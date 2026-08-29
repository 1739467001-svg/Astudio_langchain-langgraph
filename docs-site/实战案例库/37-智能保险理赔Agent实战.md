# 实战案例 37：智能保险理赔 Agent

> 保险理赔涉及报案登记、材料审核、定损评估、赔付决策。Agent 能自动收集信息、初步审核、评估损失。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"保险理赔Agent"&#125;
        U["用户: '出险了'"] --> REPORT["报案登记<br/>险种+时间+地点"]
        REPORT --> REVIEW["材料审核<br/>保单+照片+证明"]
        REVIEW --> ASSESS&#123;"定损评估"&#125;
        ASSESS -->|金额<5000| AUTO["自动赔付"]
        ASSESS -->|金额≥5000| MANUAL["人工审核"]
        AUTO & MANUAL --> DECISION["赔付决策"]
    end

    style REPORT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style DECISION fill:#C8E6C9
```

**核心技术：** 报案登记 + 材料审核 + 定损评估 + 赔付决策

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def register_claim(claim_info: str) -> dict:
    """登记理赔报案。

    Args:
        claim_info: 报案信息
    """
    prompt = f"""整理理赔报案信息。

报案信息: &#123;claim_info&#125;

输出JSON:
```json
&#123;&#123;
  "claim_id": "CLM_&#123;claim_info[:6]&#125;",
  "insurance_type": "车险/意外/医疗/财产",
  "incident_date": "...",
  "incident_location": "...",
  "description": "...",
  "policy_number": "..."
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"claim_id": "CLM_UNKNOWN"&#125;

@tool
async def review_documents(claim: dict, documents: list[str]) -> dict:
    """审核理赔材料。

    Args:
        claim: 报案信息
        documents: 提交的材料列表
    """
    required = ["保单", "身份证", "事故照片", "损失清单"]
    missing = [d for d in required if not any(d in doc for doc in documents)]

    return &#123;
        "documents_submitted": documents,
        "required": required,
        "missing": missing,
        "complete": len(missing) == 0,
        "action": "材料齐全，进入定损" if not missing else f"缺少: &#123;', '.join(missing)&#125;",
    &#125;

@tool
async def assess_damage(claim: dict, documents: dict) -> dict:
    """评估损失和赔付金额。

    Args:
        claim: 报案信息
        documents: 材料审核结果
    """
    prompt = f"""评估保险理赔损失。

报案: &#123;json.dumps(claim, ensure_ascii=False)[:500]&#125;

评估:
1. 损失程度(轻微/中等/严重)
2. 预估赔付金额
3. 是否在保单范围内

输出JSON:
```json
&#123;&#123;
  "damage_level": "轻微/中等/严重",
  "estimated_amount": 3000,
  "covered": true/false,
  "deductible": 500,
  "estimated_payout": 2500,
  "assessment": "评估说明"
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"estimated_payout": 0&#125;

@tool
async def make_payout_decision(assessment: dict) -> dict:
    """赔付决策。

    Args:
        assessment: 定损评估
    """
    payout = assessment.get("estimated_payout", 0)
    auto_threshold = 5000

    if payout < auto_threshold:
        return &#123;
            "decision": "自动赔付",
            "amount": payout,
            "processing_time": "1-3个工作日",
            "status": "approved",
        &#125;
    else:
        return &#123;
            "decision": "转人工审核",
            "amount": payout,
            "reason": f"金额≥&#123;auto_threshold&#125;需人工审核",
            "status": "pending_review",
        &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能保险理赔助手。你可以：

1. **register_claim**: 登记理赔报案
2. **review_documents**: 审核理赔材料
3. **assess_damage**: 评估损失
4. **make_payout_decision**: 赔付决策

## 工作流程
1. 登记报案信息
2. 审核材料是否齐全
3. 评估损失和赔付金额
4. 按金额阈值决定自动赔付或转人工

## 原则
- 材料不齐需补件
- 大额理赔转人工
- 客观评估"""

claim_agent = create_react_agent(
    llm,
    [register_claim, review_documents, assess_damage, make_payout_decision],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await claim_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "我的车被追尾了，昨天在人民路，有保单和照片"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有报案登记 | ☐ |
| 有材料审核 | ☐ |
| 有定损评估 | ☐ |
| 有赔付决策 | ☐ |
