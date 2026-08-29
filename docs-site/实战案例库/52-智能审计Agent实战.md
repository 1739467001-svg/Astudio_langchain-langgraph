# 实战案例 52：智能审计 Agent

> 审计涉及财务核查、合规检查、风险评估、报告生成。Agent 能自动核查数据、检测异常、生成审计报告。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"智能审计Agent"&#125;
        U["审计师: '核查Q4数据'"] --> COLLECT["数据收集<br/>财务+交易+合同"]
        COLLECT --> CHECK["自动核查<br/>异常检测"]
        CHECK --> RISK&#123;"有风险?"&#125;
        RISK -->|是| FLAG["风险标记<br/>详细分析"]
        RISK -->|否| REPORT["审计报告"]
        FLAG --> REPORT
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 数据核查 + 异常检测 + 风险评估 + 审计报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_audit_data(period: str, scope: str = "财务") -> dict:
    """收集审计数据。

    Args:
        period: 审计期间
        scope: 审计范围(财务/合规/运营)
    """
    return &#123;
        "period": period,
        "scope": scope,
        "financial_data": &#123;"revenue": 580000, "expenses": 420000, "profit": 160000&#125;,
        "transactions": [&#123;"id": "T001", "amount": 50000, "type": "收入"&#125;, &#123;"id": "T002", "amount": 120000, "type": "支出"&#125;],
        "contracts": [&#123;"id": "C001", "amount": 300000, "status": "已签"&#125;, &#123;"id": "C002", "amount": 150000, "status": "待签"&#125;],
    &#125;

@tool
async def check_anomalies(data: dict) -> dict:
    """检测数据异常。

    Args:
        data: 审计数据
    """
    anomalies = []
    
    # 大额交易检测
    for t in data.get("transactions", []):
        if t["amount"] > 100000:
            anomalies.append(&#123;"type": "大额交易", "detail": f"交易&#123;t['id']&#125;金额&#123;t['amount']&#125;"&#125;)
    
    # 利润率异常
    revenue = data.get("financial_data", &#123;&#125;).get("revenue", 0)
    profit = data.get("financial_data", &#123;&#125;).get("profit", 0)
    if revenue > 0:
        margin = profit / revenue
        if margin > 0.5:
            anomalies.append(&#123;"type": "利润率异常高", "detail": f"利润率&#123;margin:.0%&#125;"&#125;)
    
    # 未签合同
    unsigned = [c for c in data.get("contracts", []) if c["status"] == "待签"]
    if unsigned:
        anomalies.append(&#123;"type": "未签合同", "detail": f"&#123;len(unsigned)&#125;份待签合同"&#125;)

    return &#123;
        "total_anomalies": len(anomalies),
        "anomalies": anomalies,
        "has_risk": len(anomalies) > 0,
    &#125;

@tool
async def generate_audit_report(data: dict, check_result: dict) -> str:
    """生成审计报告。

    Args:
        data: 审计数据
        check_result: 核查结果
    """
    report = f"""# 审计报告

## 审计信息
- 期间: &#123;data.get('period', '未知')&#125;
- 范围: &#123;data.get('scope', '未知')&#125;

## 财务数据
- 收入: ¥&#123;data.get('financial_data', &#123;&#125;).get('revenue', 0):,&#125;
- 支出: ¥&#123;data.get('financial_data', &#123;&#125;).get('expenses', 0):,&#125;
- 利润: ¥&#123;data.get('financial_data', &#123;&#125;).get('profit', 0):,&#125;

## 核查结果
- 异常数量: &#123;check_result.get('total_anomalies', 0)&#125;
"""
    if check_result.get("has_risk"):
        report += f"\n## ⚠️ 风险标记\n"
        for a in check_result.get("anomalies", []):
            report += f"- [&#123;a['type']&#125;] &#123;a['detail']&#125;\n"
        report += "\n建议: 对异常项进行详细调查\n"
    else:
        report += "\n## ✅ 未发现异常\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能审计助手。你可以：

1. **collect_audit_data**: 收集审计数据
2. **check_anomalies**: 检测异常
3. **generate_audit_report**: 生成审计报告

## 工作流程
1. 收集审计数据
2. 自动核查异常
3. 生成审计报告

## 原则
- 数据驱动
- 异常要标记
- 报告要客观"""

audit_agent = create_react_agent(
    llm,
    [collect_audit_data, check_anomalies, generate_audit_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await audit_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "核查2024年Q4的财务数据"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据收集 | ☐ |
| 有异常检测 | ☐ |
| 有审计报告 | ☐ |
