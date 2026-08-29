# 实战案例 41：智能零售门店 Agent

> 零售门店管理涉及库存监控、销售分析、顾客服务、促销决策。Agent 能自动整合多源数据给出经营建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"零售门店Agent"}
        U["店长: '今天经营情况'"] --> SALES["销售分析<br/>日销+趋势+热销"]
        SALES --> INVENTORY["库存检查<br/>缺货/过剩"]
        INVENTORY --> ACTION{"需要行动?"}
        ACTION -->|补货| RESTOCK["补货建议"]
        ACTION -->|促销| PROMO["促销建议"]
        ACTION -->|无| REPORT["经营报告"]
        RESTOCK & PROMO --> REPORT
    end

    style SALES fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 销售分析 + 库存监控 + 经营决策 + 报告生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def analyze_sales(store_id: str, date: str = "今天") -> dict:
    """分析门店销售数据。

    Args:
        store_id: 门店ID
        date: 日期
    """
    return {
        "store_id": store_id,
        "date": date,
        "total_sales": 15200,
        "transaction_count": 380,
        "avg_transaction": 40,
        "top_products": [
            {"name": "商品A", "sales": 60, "revenue": 3600},
            {"name": "商品B", "sales": 45, "revenue": 2250},
        ],
        "hourly_peak": "10:00-12:00",
        "vs_yesterday": "+12%",
    }

@tool
async def check_inventory(store_id: str) -> dict:
    """检查库存状态。

    Args:
        store_id: 门店ID
    """
    return {
        "store_id": store_id,
        "low_stock": [
            {"name": "商品A", "current": 5, "threshold": 20, "suggested_order": 50},
            {"name": "商品C", "current": 3, "threshold": 15, "suggested_order": 30},
        ],
        "overstock": [
            {"name": "商品D", "current": 200, "threshold": 50, "suggested_action": "促销"},
        ],
        "stockout_risk": ["商品A", "商品C"],
    }

@tool
async def generate_recommendations(sales: dict, inventory: dict) -> dict:
    """生成经营建议。

    Args:
        sales: 销售数据
        inventory: 库存数据
    """
    prompt = f"""基于销售和库存数据生成经营建议。

销售: {json.dumps(sales, ensure_ascii=False)[:500]}
库存: {json.dumps(inventory, ensure_ascii=False)[:500]}

建议:
1. 补货计划（紧急/常规）
2. 促销建议（过剩商品）
3. 陈列调整
4. 人员安排

输出JSON:
```json
{{
  "urgent_actions": ["紧急补货商品A"],
  "restock_list": [{{"item": "...", "quantity": 50, "urgency": "high"}}],
  "promo_suggestions": [{{"item": "...", "discount": "8折", "reason": "库存过剩"}}],
  "staffing": "高峰时段增加1人",
  "summary": "经营状况总评"
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"summary": "分析完成"}

@tool
async def generate_store_report(sales: dict, inventory: dict, recommendations: dict) -> str:
    """生成门店经营报告。

    Args:
        sales: 销售数据
        inventory: 库存数据
        recommendations: 经营建议
    """
    report = f"""# 门店经营报告

## 销售
- 日期: {sales.get('date', '今天')}
- 总销售额: ¥{sales.get('total_sales', 0)}
- 交易笔数: {sales.get('transaction_count', 0)}
- 客单价: ¥{sales.get('avg_transaction', 0)}
- 较昨日: {sales.get('vs_yesterday', '未知')}
- 高峰时段: {sales.get('hourly_peak', '未知')}

## 热销商品
"""
    for p in sales.get("top_products", []):
        report += f"- {p['name']}: 销量{p['sales']}件, ¥{p['revenue']}\n"

    if inventory.get("stockout_risk"):
        report += f"\n## ⚠️ 缺货风险\n{', '.join(inventory['stockout_risk'])}\n"

    if recommendations.get("urgent_actions"):
        report += f"\n## 紧急行动\n"
        for a in recommendations["urgent_actions"]:
            report += f"- {a}\n"

    report += f"\n## 总评\n{recommendations.get('summary', '经营正常')}\n"
    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能零售门店助手。你可以：

1. **analyze_sales**: 分析销售数据
2. **check_inventory**: 检查库存状态
3. **generate_recommendations**: 生成经营建议
4. **generate_store_report**: 生成报告

## 工作流程
1. 分析销售数据
2. 检查库存状态
3. 生成经营建议
4. 汇总报告

## 原则
- 数据驱动
- 缺货要紧急补货
- 过剩商品建议促销"""

retail_agent = create_react_agent(
    llm,
    [analyze_sales, check_inventory, generate_recommendations, generate_store_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await retail_agent.ainvoke({
        "messages": [{"role": "user", "content": "分析门店ST001今天的经营情况"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有销售分析 | ☐ |
| 有库存检查 | ☐ |
| 有经营建议 | ☐ |
| 有报告生成 | ☐ |
