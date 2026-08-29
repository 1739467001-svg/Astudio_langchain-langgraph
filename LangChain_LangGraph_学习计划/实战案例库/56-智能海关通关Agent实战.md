# 实战案例 56：智能海关通关 Agent

> 海关通关涉及货物申报、分类归类、税费计算、风险查验和报告生成。Agent 能自动处理通关全流程，提升通关效率，降低人工差错。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"海关通关Agent"}
        U["报关员: '申报一批电子设备'"] --> QUERY["通关查询<br/>商品+申报信息"]
        QUERY --> CLASSIFY["货物分类<br/>HS编码归类"]
        CLASSIFY --> TAX{"需缴税?"}
        TAX -->|是| CALC["税费计算<br/>关税+增值税+消费税"]
        TAX -->|否| EXEMPT["免税/退税"]
        CALC & EXEMPT --> REPORT["通关报告<br/>汇总+建议"]
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CALC fill:#FFE0B2,stroke:#E65100
    style REPORT fill:#C8E6C9
```

**核心技术：** 通关查询 + 货物分类(HS编码) + 税费计算 + 通关报告生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def query_clearance(declaration_no: str) -> dict:
    """查询通关申报信息。

    Args:
        declaration_no: 申报单号
    """
    return {
        "declaration_no": declaration_no,
        "status": "待审核",
        "import_export": "进口",
        "trade_mode": "一般贸易",
        "origin_country": "中国",
        "destination_country": "美国",
        "transport": "海运",
        "total_value_usd": 150000,
        "items_count": 3,
        "declarant": "深圳市XX科技有限公司",
    }

@tool
async def classify_goods(goods_description: str, declaration_data: dict) -> dict:
    """货物分类与HS编码归类。

    Args:
        goods_description: 货物描述
        declaration_data: 申报数据
    """
    hs_catalog = {
        "电子设备": {"hs_code": "8471.30.00", "category": "自动数据处理设备", "description": "便携式数字处理设备"},
        "手机": {"hs_code": "8517.13.00", "category": "电话机", "description": "智能手机"},
        "服装": {"hs_code": "6109.10.00", "category": "针织T恤", "description": "棉制针织T恤"},
    }

    matched = None
    for keyword, info in hs_catalog.items():
        if keyword in goods_description:
            matched = info
            break

    if not matched:
        matched = {"hs_code": "9999.99.00", "category": "其他", "description": "需人工确认分类"}

    return {
        "goods_description": goods_description,
        "hs_code": matched["hs_code"],
        "category": matched["category"],
        "description": matched["description"],
        "confidence": "high" if matched["hs_code"] != "9999.99.00" else "low",
        "declaration_value": declaration_data.get("total_value_usd", 0),
    }

@tool
async def calculate_tax(classification: dict, origin_country: str) -> dict:
    """计算关税、增值税和消费税。

    Args:
        classification: 货物分类结果
        origin_country: 原产国
    """
    value_usd = classification.get("declaration_value", 0)
    exchange_rate = 7.25
    value_cny = round(value_usd * exchange_rate, 2)

    tariff_rates = {"8471.30.00": 0.0, "8517.13.00": 0.0, "6109.10.00": 0.08}
    vat_rate = 0.13
    consumption_rate = 0.0

    hs_prefix = classification["hs_code"][:8]
    tariff_rate = tariff_rates.get(hs_prefix, 0.05)

    tariff = round(value_cny * tariff_rate, 2)
    consumption_tax = round(value_cny * consumption_rate, 2)
    vat_base = value_cny + tariff + consumption_tax
    vat = round(vat_base * vat_rate, 2)
    total_tax = round(tariff + vat + consumption_tax, 2)

    return {
        "hs_code": classification["hs_code"],
        "goods_value_cny": value_cny,
        "tariff_rate": f"{tariff_rate*100:.1f}%",
        "tariff": tariff,
        "vat_rate": f"{vat_rate*100:.1f}%",
        "vat": vat,
        "consumption_tax": consumption_tax,
        "total_tax": total_tax,
        "origin_country": origin_country,
        "has_fta_preference": origin_country in ["中国", "东盟国家"],
    }

@tool
async def generate_clearance_report(query_result: dict, classification: dict, tax_result: dict) -> dict:
    """生成通关报告。

    Args:
        query_result: 通关查询结果
        classification: 货物分类结果
        tax_result: 税费计算结果
    """
    return {
        "report_id": f"CR-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "declaration_no": query_result["declaration_no"],
        "declarant": query_result["declarant"],
        "trade_mode": query_result["trade_mode"],
        "goods": {
            "description": classification["goods_description"],
            "hs_code": classification["hs_code"],
            "category": classification["category"],
            "confidence": classification["confidence"],
        },
        "taxes": {
            "goods_value_cny": tax_result["goods_value_cny"],
            "tariff": tax_result["tariff"],
            "vat": tax_result["vat"],
            "total_tax": tax_result["total_tax"],
        },
        "recommendation": "准予通关" if classification["confidence"] == "high" else "需人工复核HS编码",
        "risk_level": "低" if total_check(tax_result) else "中",
    }

def total_check(tax_result):
    return tax_result["total_tax"] < 500000
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能海关通关助手。你可以：

1. **query_clearance**: 查询通关申报信息
2. **classify_goods**: 货物分类与HS编码归类
3. **calculate_tax**: 计算关税、增值税和消费税
4. **generate_clearance_report**: 生成通关报告

## 工作流程
1. 查询申报单基本信息
2. 根据货物描述进行HS编码归类
3. 计算应缴税费
4. 汇总生成通关报告

## 原则
- 准确归类HS编码
- 正确计算税费
- 低置信度分类需标注人工复核
- 报告信息完整可追溯"""

customs_agent = create_react_agent(
    llm,
    [query_clearance, classify_goods, calculate_tax, generate_clearance_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await customs_agent.ainvoke({
        "messages": [{"role": "user", "content": "申报单号 DECL-2026-001，货物为电子设备(笔记本电脑)，从中国进口到美国，帮我完成通关流程"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

预期输出示例：

```
已完成海关通关流程，汇总如下：

申报单号：DECL-2026-001
申报人：深圳市XX科技有限公司
贸易方式：一般贸易

货物分类：
- 货物描述：电子设备(笔记本电脑)
- HS编码：8471.30.00
- 分类：自动数据处理设备
- 归类置信度：高

税费计算：
- 货物价值：¥1,087,500.00
- 关税：¥0.00 (税率0%)
- 增值税：¥141,375.00 (税率13%)
- 合计税费：¥141,375.00

通关建议：准予通关
风险等级：低
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有通关查询工具 | ☐ |
| 有HS编码分类 | ☐ |
| 有关税+增值税计算 | ☐ |
| 有通关报告生成 | ☐ |
| 低置信度标注人工复核 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
