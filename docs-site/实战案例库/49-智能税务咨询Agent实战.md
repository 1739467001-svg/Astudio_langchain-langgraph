# 实战案例 49：智能税务咨询 Agent

> 税务咨询涉及政策查询、个税计算、发票问题、申报指导。Agent 能自动回答税务问题（不替代专业税务师）。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"税务咨询Agent"&#125;
        U["用户: '个税怎么算'"] --> CLASSIFY["问题分类<br/>个税/企业/发票"]
        CLASSIFY --> CALC&#123;"需计算?"&#125;
        CALC -->|是| COMPUTE["税额计算<br/>按税率表"]
        CALC -->|否| SEARCH["政策检索"]
        COMPUTE & SEARCH --> ANSWER["回答+免责声明"]
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ANSWER fill:#C8E6C9
```

**核心技术：** 问题分类 + 税额计算 + 政策检索 + 免责声明

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def calculate_income_tax(annual_income: float, deductions: float = 60000) -> dict:
    """计算个人所得税。

    Args:
        annual_income: 年收入
        deductions: 扣除额(默认6万/年)
    """
    taxable = max(0, annual_income - deductions)
    brackets = [
        (36000, 0.03, 0),
        (144000, 0.10, 2520),
        (300000, 0.20, 16920),
        (420000, 0.25, 31920),
        (660000, 0.30, 52920),
        (960000, 0.35, 85920),
        (float('inf'), 0.45, 181920),
    ]
    for limit, rate, deduction in brackets:
        if taxable <= limit:
            tax = taxable * rate - deduction
            break
    return &#123;
        "annual_income": annual_income,
        "deductions": deductions,
        "taxable_income": taxable,
        "tax_rate": f"&#123;rate*100:.0f&#125;%",
        "tax_amount": round(tax, 2),
        "after_tax": round(annual_income - tax, 2),
    &#125;

@tool
async def search_tax_policy(query: str) -> str:
    """搜索税务政策。

    Args:
        query: 查询内容
    """
    return f"政策查询: &#123;query&#125;——个税起征点5000元/月(6万/年)，七级超额累进税率3%-45%"

@tool
async def answer_tax_question(question: str) -> str:
    """回答税务问题（含免责声明）。

    Args:
        question: 税务问题
    """
    prompt = f"""回答以下税务问题。

问题: &#123;question&#125;

要求:
1. 基于中国现行税法
2. 简洁明了
3. 必须包含免责声明

回答:"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content + "\n\n⚠️ 以上仅供参考，不构成税务建议。具体请咨询专业税务师或12366纳税服务热线。"
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能税务咨询助手。你可以：

1. **calculate_income_tax**: 计算个税
2. **search_tax_policy**: 搜索税务政策
3. **answer_tax_question**: 回答税务问题

## 原则
- 基于中国现行税法
- 必须含免责声明
- 不替代专业税务师"""

tax_agent = create_react_agent(
    llm,
    [calculate_income_tax, search_tax_policy, answer_tax_question],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await tax_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "年收入20万要交多少个税？"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有个税计算 | ☐ |
| 有政策检索 | ☐ |
| 有免责声明 | ☐ |
