# 实战案例 45：智能财务分析 Agent

> 财务分析涉及收支统计、预算对比、趋势预测、风险预警。Agent 能自动整合财务数据给出分析建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"财务分析Agent"&#125;
        U["查询: '本月财务状况'"] --> COLLECT["数据收集<br/>收入+支出+预算"]
        COLLECT --> ANALYZE["财务分析<br/>收支比+趋势"]
        ANALYZE --> RISK&#123;"有风险?"&#125;
        RISK -->|是| WARN["⚠️ 风险预警<br/>超支/异常"]
        RISK -->|否| REPORT["财务报告"]
        WARN --> REPORT
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 财务数据整合 + 收支分析 + 风险预警 + 报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_financial_data(period: str = "本月") -> dict:
    """收集财务数据。

    Args:
        period: 时间范围
    """
    return &#123;
        "period": period,
        "income": &#123;"total": 580000, "by_category": &#123;"销售": 450000, "服务": 130000&#125;&#125;,
        "expenses": &#123;"total": 420000, "by_category": &#123;"人力": 250000, "运营": 120000, "营销": 50000&#125;&#125;,
        "budget": &#123;"income_target": 600000, "expense_limit": 400000&#125;,
        "cash_flow": 160000,
    &#125;

@tool
async def analyze_financials(data: dict) -> dict:
    """分析财务状况。

    Args:
        data: 财务数据
    """
    income = data.get("income", &#123;&#125;).get("total", 0)
    expenses = data.get("expenses", &#123;&#125;).get("total", 0)
    budget = data.get("budget", &#123;&#125;)

    profit = income - expenses
    profit_margin = profit / income * 100 if income > 0 else 0
    budget_used = expenses / budget.get("expense_limit", 1) * 100

    risks = []
    if budget_used > 100:
        risks.append(f"支出超预算&#123;budget_used:.0f&#125;%")
    if profit_margin < 10:
        risks.append(f"利润率偏低(&#123;profit_margin:.1f&#125;%)")

    return &#123;
        "profit": profit,
        "profit_margin": round(profit_margin, 1),
        "budget_used_pct": round(budget_used, 1),
        "income_achievement": round(income / budget.get("income_target", 1) * 100, 1),
        "risks": risks,
        "has_risk": len(risks) > 0,
    &#125;

@tool
async def generate_financial_report(data: dict, analysis: dict) -> str:
    """生成财务报告。

    Args:
        data: 财务数据
        analysis: 分析结果
    """
    report = f"""# 财务分析报告

## 概况
- 期间: &#123;data.get('period', '未知')&#125;
- 收入: ¥&#123;data.get('income', &#123;&#125;).get('total', 0):,&#125;
- 支出: ¥&#123;data.get('expenses', &#123;&#125;).get('total', 0):,&#125;
- 净利润: ¥&#123;analysis.get('profit', 0):,&#125;
- 利润率: &#123;analysis.get('profit_margin', 0)&#125;%
- 现金流: ¥&#123;data.get('cash_flow', 0):,&#125;

## 预算执行
- 收入达成: &#123;analysis.get('income_achievement', 0)&#125;%
- 预算使用: &#123;analysis.get('budget_used_pct', 0)&#125;%
"""
    if analysis.get("has_risk"):
        report += f"\n## ⚠️ 风险预警\n"
        for risk in analysis["risks"]:
            report += f"- &#123;risk&#125;\n"

    report += f"\n## 收入结构\n"
    for cat, amount in data.get("income", &#123;&#125;).get("by_category", &#123;&#125;).items():
        report += f"- &#123;cat&#125;: ¥&#123;amount:,&#125;\n"

    report += f"\n## 支出结构\n"
    for cat, amount in data.get("expenses", &#123;&#125;).get("by_category", &#123;&#125;).items():
        report += f"- &#123;cat&#125;: ¥&#123;amount:,&#125;\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能财务分析助手。你可以：

1. **collect_financial_data**: 收集财务数据
2. **analyze_financials**: 分析财务状况
3. **generate_financial_report**: 生成财务报告

## 工作流程
1. 收集财务数据
2. 分析收支状况和风险
3. 生成报告

## 原则
- 数据驱动
- 超支要预警
- 利润率偏低要提醒"""

finance_agent = create_react_agent(
    llm,
    [collect_financial_data, analyze_financials, generate_financial_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await finance_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "分析本月财务状况"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据收集 | ☐ |
| 有财务分析 | ☐ |
| 有风险预警 | ☐ |
| 有报告生成 | ☐ |
