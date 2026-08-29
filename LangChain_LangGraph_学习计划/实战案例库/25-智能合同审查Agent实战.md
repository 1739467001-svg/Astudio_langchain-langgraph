# 实战案例 25：智能合同审查 Agent

> 合同审查耗时且容易遗漏风险条款。Agent 能自动提取关键条款、检测风险、对比标准模板、给出修改建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"合同审查Agent"}
        CONTRACT["合同文本"] --> EXTRACT["条款提取<br/>关键条款结构化"]
        EXTRACT --> RISK["风险检测<br/>异常条款识别"]
        RISK --> COMPARE{"对比标准模板?"}
        COMPARE -->|有模板| DIFF["差异分析"]
        COMPARE -->|无模板| ADVICE["直接建议"]
        DIFF & ADVICE --> REPORT["审查报告<br/>风险+建议"]
    end

    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 条款提取 + 风险检测 + 模板对比 + 修改建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o", temperature=0)

EXTRACT_PROMPT = """你是合同审查专家。从以下合同中提取关键条款。

合同文本:
{contract}

提取以下条款（如果存在）:
1. 合同金额
2. 付款条件
3. 违约责任
4. 知识产权归属
5. 保密条款
6. 终止条件
7. 争议解决方式
8. 有效期限

输出JSON:
```json
{{
  "amount": "...",
  "payment_terms": "...",
  "breach_liability": "...",
  "ip_ownership": "...",
  "confidentiality": "...",
  "termination": "...",
  "dispute_resolution": "...",
  "validity_period": "..."
}}
```"""

@tool
async def extract_clauses(contract_text: str) -> dict:
    """从合同中提取关键条款。

    Args:
        contract_text: 合同全文
    """
    prompt = EXTRACT_PROMPT.format(contract=contract_text[:3000])
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {}

RISK_PROMPT = """分析以下合同条款的风险。

条款:
{clauses}

风险检测维度:
1. 金额异常: 过高/过低/无明确金额
2. 付款风险: 无付款条件/条件不利
3. 违约不对等: 责任不对等
4. 知识产权风险: 归属不清/对己不利
5. 保密缺失: 无保密条款
6. 终止风险: 单方终止权不利
7. 管辖风险: 争议解决方式不利

输出JSON:
```json
{{
  "risks": [
    {{"category": "...", "severity": "high/medium/low", "description": "...", "clause": "...", "suggestion": "..."}}
  ],
  "overall_risk_level": "high/medium/low",
  "recommend_sign": true/false
}}
```"""

@tool
async def detect_risks(clauses: dict) -> dict:
    """检测合同条款中的风险。

    Args:
        clauses: 提取的条款
    """
    prompt = RISK_PROMPT.format(clauses=json.dumps(clauses, ensure_ascii=False)[:2000])
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"risks": [], "overall_risk_level": "unknown"}

@tool
async def compare_with_template(contract_clauses: dict, template_clauses: dict) -> dict:
    """对比合同与标准模板的差异。

    Args:
        contract_clauses: 合同条款
        template_clauses: 标准模板条款
    """
    differences = []
    for key in set(list(contract_clauses.keys()) + list(template_clauses.keys())):
        contract_val = contract_clauses.get(key, "未提及")
        template_val = template_clauses.get(key, "未提及")
        if str(contract_val) != str(template_val):
            differences.append({
                "clause": key,
                "contract": str(contract_val)[:100],
                "template": str(template_val)[:100],
                "difference": "合同与模板不一致",
            })

    return {
        "total_differences": len(differences),
        "differences": differences,
        "alignment_score": round(1 - len(differences) / max(len(template_clauses), 1), 4),
    }

@tool
async def generate_review_report(
    clauses: dict,
    risks: dict,
    differences: dict = None,
) -> str:
    """生成合同审查报告。

    Args:
        clauses: 提取的条款
        risks: 风险检测结果
        differences: 模板对比差异（可选）
    """
    risk_list = risks.get("risks", [])
    report = f"""# 合同审查报告

## 合同概要
- 金额: {clauses.get('amount', '未明确')}
- 有效期: {clauses.get('validity_period', '未明确')}
- 争议解决: {clauses.get('dispute_resolution', '未明确')}

## 风险评估
整体风险等级: {risks.get('overall_risk_level', '未知')}
建议签署: {'✅ 是' if risks.get('recommend_sign') else '❌ 否，需修改'}

## 风险详情
"""
    for risk in risk_list:
        report += f"\n### [{risk.get('severity', 'unknown').upper()}] {risk.get('category', '')}\n"
        report += f"- 问题描述: {risk.get('description', '')}\n"
        report += f"- 相关条款: {risk.get('clause', '')[:100]}\n"
        report += f"- 修改建议: {risk.get('suggestion', '')}\n"

    if differences and differences.get("total_differences", 0) > 0:
        report += f"\n## 模板对比\n"
        report += f"- 一致性评分: {differences.get('alignment_score', 0):.1%}\n"
        report += f"- 差异数量: {differences.get('total_differences', 0)}\n"

    report += "\n## 总结\n"
    if risks.get("recommend_sign"):
        report += "合同基本可行，建议关注上述风险条款。\n"
    else:
        report += "⚠️ 存在重大风险，建议修改后再签署。\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能合同审查助手。你可以：

1. **extract_clauses**: 从合同中提取关键条款
2. **detect_risks**: 检测合同中的风险
3. **compare_with_template**: 对比标准模板差异
4. **generate_review_report**: 生成审查报告

## 审查流程
1. 提取合同关键条款
2. 检测风险条款
3. 如有标准模板，对比差异
4. 生成完整审查报告

## 原则
- 客观分析，不带偏见
- 风险要具体到条款
- 建议要可操作
- 不能替代律师"""

contract_agent = create_react_agent(
    llm,
    [extract_clauses, detect_risks, compare_with_template, generate_review_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    contract = """
    甲方将向乙方支付服务费人民币50万元。
    付款方式：合同签订后7日内支付50%，验收后支付50%。
    如甲方违约，需支付违约金10万元。
    如乙方违约，需支付违约金5万元。
    知识产权归甲方所有。
    保密期限为合同终止后3年。
    争议由甲方所在地法院管辖。
    """

    result = await contract_agent.ainvoke({
        "messages": [{"role": "user", "content": f"请审查以下合同:\n\n{contract}"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有条款提取 | ☐ |
| 有风险检测 | ☐ |
| 有模板对比 | ☐ |
| 有报告生成 | ☐ |
