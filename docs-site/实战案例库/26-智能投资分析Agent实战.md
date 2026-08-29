# 实战案例 26：智能投资分析 Agent

> 投资者需要快速了解一家公司——财务状况、行业对比、风险评估。Agent 能自动收集数据、分析指标、给出投资建议（不构成投资建议）。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"投资分析Agent"&#125;
        U["用户: '分析茅台'"] --> COLLECT["数据收集<br/>财务+行业"]
        COLLECT --> ANALYZE["指标分析<br/>PE/PB/ROE等"]
        ANALYZE --> COMPARE["行业对比"]
        COMPARE --> RISK["风险评估"]
        RISK & ANALYZE & COMPARE --> REPORT["分析报告<br/>+投资建议"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 数据收集 + 指标计算 + 行业对比 + 风险评估

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def get_financial_data(company: str) -> dict:
    """获取公司财务数据。

    Args:
        company: 公司名称或代码
    """
    # 实际接入财务API（如Tushare/AKShare）
    return &#123;
        "company": company,
        "revenue": "1000亿",
        "profit": "500亿",
        "pe_ratio": 30,
        "pb_ratio": 8,
        "roe": 25,
        "debt_ratio": 0.2,
        "market_cap": "20000亿",
    &#125;

@tool
async def get_industry_comparison(company: str) -> dict:
    """获取行业对比数据。

    Args:
        company: 公司名称
    """
    # 实际接入行业数据API
    return &#123;
        "company": company,
        "industry_avg_pe": 25,
        "industry_avg_pb": 6,
        "industry_avg_roe": 18,
        "industry_rank": "前10%",
    &#125;

ANALYZE_PROMPT = """分析以下公司财务数据。

公司: &#123;company&#125;
财务数据: &#123;financial&#125;
行业对比: &#123;industry&#125;

分析维度:
1. 估值分析: PE/PB与行业对比
2. 盈利能力: ROE/利润率
3. 偿债能力: 负债率
4. 成长性: 收入/利润增长
5. 综合评分: 0-10分

输出JSON:
```json
&#123;&#123;
  "valuation": "高估/合理/低估",
  "profitability": "强/中/弱",
  "debt_risk": "低/中/高",
  "growth": "高/中/低",
  "overall_score": 7.5,
  "analysis": "详细分析文本"
&#125;&#125;
```"""

@tool
async def analyze_financials(company: str, financial: dict, industry: dict) -> dict:
    """分析财务指标。

    Args:
        company: 公司名称
        financial: 财务数据
        industry: 行业对比数据
    """
    prompt = ANALYZE_PROMPT.format(
        company=company,
        financial=json.dumps(financial, ensure_ascii=False),
        industry=json.dumps(industry, ensure_ascii=False),
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"overall_score": 5&#125;

RISK_PROMPT = """基于以下分析评估投资风险。

公司: &#123;company&#125;
财务分析: &#123;analysis&#125;

风险评估:
1. 市场风险: 行业波动/竞争
2. 财务风险: 负债/现金流
3. 估值风险: 是否高估
4. 政策风险: 监管/政策变化

输出JSON:
```json
&#123;&#123;
  "risk_level": "low/medium/high",
  "risk_factors": ["风险1"],
  "mitigations": ["缓解措施"],
  "recommendation": "买入/持有/观望/回避",
  "disclaimer": "不构成投资建议"
&#125;&#125;
```"""

@tool
async def assess_risk(company: str, analysis: dict) -> dict:
    """评估投资风险。

    Args:
        company: 公司名称
        analysis: 财务分析结果
    """
    prompt = RISK_PROMPT.format(
        company=company,
        analysis=json.dumps(analysis, ensure_ascii=False)[:1000],
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"risk_level": "medium", "disclaimer": "不构成投资建议"&#125;

@tool
async def generate_report(company: str, financial: dict, analysis: dict, risk: dict) -> str:
    """生成投资分析报告。

    Args:
        company: 公司名称
        financial: 财务数据
        analysis: 分析结果
        risk: 风险评估
    """
    report = f"""# &#123;company&#125; 投资分析报告

## 公司概况
- 市值: &#123;financial.get('market_cap', '未知')&#125;
- 营收: &#123;financial.get('revenue', '未知')&#125;
- 利润: &#123;financial.get('profit', '未知')&#125;

## 财务分析
- 估值: &#123;analysis.get('valuation', '未知')&#125; (PE: &#123;financial.get('pe_ratio')&#125;, 行业均值: &#123;financial.get('industry_avg_pe', '?')&#125;)
- 盈利能力: &#123;analysis.get('profitability', '未知')&#125; (ROE: &#123;financial.get('roe')&#125;%)
- 偿债风险: &#123;analysis.get('debt_risk', '未知')&#125; (负债率: &#123;financial.get('debt_ratio')&#125;)
- 综合评分: &#123;analysis.get('overall_score', 0)&#125;/10

## 风险评估
- 风险等级: &#123;risk.get('risk_level', '未知')&#125;
- 风险因素: &#123;', '.join(risk.get('risk_factors', []))&#125;

## 投资建议
&#123;risk.get('recommendation', '观望')&#125;

---
⚠️ 以上分析仅供参考，不构成投资建议。投资有风险，决策需谨慎。
"""
    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能投资分析助手。你可以：

1. **get_financial_data**: 获取公司财务数据
2. **get_industry_comparison**: 获取行业对比
3. **analyze_financials**: 分析财务指标
4. **assess_risk**: 评估投资风险
5. **generate_report**: 生成分析报告

## 分析流程
1. 获取财务数据
2. 获取行业对比
3. 分析财务指标
4. 评估风险
5. 生成完整报告

## 原则
- 数据驱动，客观分析
- 必须包含免责声明
- 不构成投资建议"""

investment_agent = create_react_agent(
    llm,
    [get_financial_data, get_industry_comparison, analyze_financials, assess_risk, generate_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await investment_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "帮我分析贵州茅台的投资价值"&#125;]
    &#125;)
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据获取工具 | ☐ |
| 有财务分析工具 | ☐ |
| 有风险评估 | ☐ |
| 有报告生成 | ☐ |
| 有免责声明 | ☐ |
