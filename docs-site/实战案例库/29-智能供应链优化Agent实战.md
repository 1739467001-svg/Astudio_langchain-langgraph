# 实战案例 29：智能供应链优化 Agent

> 供应链优化涉及库存预测、需求分析、供应商评估、物流规划。Agent 能综合多源数据，给出优化建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"供应链优化Agent"&#125;
        DATA["数据输入<br/>库存+销售+供应商"] --> FORECAST["需求预测<br/>基于历史数据"]
        FORECAST --> INVENTORY["库存分析<br/>过剩/不足"]
        INVENTORY --> SUPPLIER["供应商评估<br/>交期/质量/成本"]
        SUPPLIER --> PLAN["优化方案<br/>补货/调拨/更换供应商"]
        PLAN --> REPORT["优化报告"]
    end

    style FORECAST fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 数据分析 + 需求预测 + 库存优化 + 供应商评估

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def analyze_inventory(inventory_data: str) -> dict:
    """分析库存状态。

    Args:
        inventory_data: 库存数据(JSON)
    """
    prompt = f"""分析以下库存数据，找出问题。

库存数据:
&#123;inventory_data[:1000]&#125;

分析:
1. 过剩库存（库存>30天用量）
2. 不足库存（库存<7天用量）
3. 缺货风险
4. 库存周转率

输出JSON:
```json
&#123;&#123;
  "overstock": [&#123;&#123;"item": "...", "days_supply": 45&#125;&#125;],
  "understock": [&#123;&#123;"item": "...", "days_supply": 3&#125;&#125;],
  "stockout_risk": ["风险商品"],
  "avg_turnover_days": 15
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"overstock": [], "understock": []&#125;

@tool
async def forecast_demand(sales_history: str, days: int = 30) -> dict:
    """预测未来需求。

    Args:
        sales_history: 销售历史数据
        days: 预测天数
    """
    prompt = f"""基于历史销售数据预测未来&#123;days&#125;天需求。

销售历史:
&#123;sales_history[:1000]&#125;

输出JSON:
```json
&#123;&#123;
  "forecast": [&#123;&#123;"item": "...", "predicted_demand": 100, "confidence": 0.8&#125;&#125;],
  "trend": "上升/平稳/下降",
  "seasonal": true/false
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"forecast": [], "trend": "平稳"&#125;

@tool
async def evaluate_supplier(supplier_data: str) -> dict:
    """评估供应商表现。

    Args:
        supplier_data: 供应商数据
    """
    prompt = f"""评估以下供应商表现。

供应商数据:
&#123;supplier_data[:1000]&#125;

评估维度:
1. 交期准时率
2. 质量合格率
3. 价格竞争力
4. 响应速度

输出JSON:
```json
&#123;&#123;
  "suppliers": [
    &#123;&#123;"name": "...", "score": 8.5, "ontime_rate": 0.95, "quality_rate": 0.98, "recommendation": "维持/更换"&#125;&#125;
  ]
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"suppliers": []&#125;

@tool
async def generate_optimization_plan(
    inventory: dict,
    forecast: dict,
    suppliers: dict,
) -> str:
    """生成供应链优化方案。

    Args:
        inventory: 库存分析
        forecast: 需求预测
        suppliers: 供应商评估
    """
    prompt = f"""你是供应链优化专家。基于以下分析，生成优化方案。

库存分析: &#123;json.dumps(inventory, ensure_ascii=False)[:500]&#125;
需求预测: &#123;json.dumps(forecast, ensure_ascii=False)[:500]&#125;
供应商评估: &#123;json.dumps(suppliers, ensure_ascii=False)[:500]&#125;

优化建议:
1. 补货计划（什么商品什么时候补多少）
2. 调拨建议（过剩→不足）
3. 供应商调整（更换/增加备选）
4. 成本优化

方案:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能供应链优化助手。你可以：

1. **analyze_inventory**: 分析库存状态
2. **forecast_demand**: 预测未来需求
3. **evaluate_supplier**: 评估供应商
4. **generate_optimization_plan**: 生成优化方案

## 工作流程
1. 分析当前库存
2. 预测未来需求
3. 评估供应商
4. 生成优化方案

## 原则
- 数据驱动决策
- 优化要具体可执行
- 考虑成本和风险"""

supply_agent = create_react_agent(
    llm,
    [analyze_inventory, forecast_demand, evaluate_supplier, generate_optimization_plan],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    inventory = '[&#123;"item": "A产品", "stock": 500, "daily_usage": 10&#125;]'
    sales = '[&#123;"month": "1月", "sales": 300&#125;, &#123;"month": "2月", "sales": 350&#125;]'
    suppliers = '[&#123;"name": "供应商X", "ontime_rate": 0.95, "quality": 0.98&#125;]'

    result = await supply_agent.ainvoke(&#123;
        "messages": [&#123;
            "role": "user",
            "content": f"帮我分析并优化供应链。库存: &#123;inventory&#125;, 销售: &#123;sales&#125;, 供应商: &#123;suppliers&#125;"
        &#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有库存分析 | ☐ |
| 有需求预测 | ☐ |
| 有供应商评估 | ☐ |
| 有优化方案 | ☐ |
