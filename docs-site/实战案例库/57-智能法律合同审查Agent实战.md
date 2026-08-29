# 实战案例 57：智能法律合同审查 Agent

> 合同审查涉及条款提取、风险识别、合规检查和审查报告生成。Agent 能自动解析合同文本、标记风险条款、给出修改建议，大幅提升法务团队效率。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"法律合同审查Agent"&#125;
        U["法务: '审查这份采购合同'"] --> EXTRACT["条款提取<br/>付款/违约/保密/期限"]
        EXTRACT --> RISK["风险识别<br/>不利条款+缺失条款"]
        RISK --> COMPLIANCE&#123;"合规检查"&#125;
        COMPLIANCE -->|违规| FLAG["标记违规项"]
        COMPLIANCE -->|合规| PASS["通过"]
        FLAG & PASS --> REPORT["审查报告<br/>风险等级+修改建议"]
    end

    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style RISK fill:#FFE0B2,stroke:#E65100
    style REPORT fill:#C8E6C9
```

**核心技术：** 条款提取 + 风险识别 + 合规检查 + 审查报告生成

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
async def extract_clauses(contract_text: str) -> dict:
    """提取合同关键条款。

    Args:
        contract_text: 合同文本
    """
    # 模拟条款提取（实际可用LLM或规则引擎）
    clauses = &#123;
        "payment": &#123;
            "found": "付款方式" in contract_text or "支付" in contract_text,
            "content": "乙方应在收到发票后30日内支付货款。",
            "risk_note": "付款周期30天，偏长",
        &#125;,
        "breach": &#123;
            "found": "违约" in contract_text,
            "content": "任何一方违约，应支付合同金额的5%作为违约金。",
            "risk_note": "违约金比例偏低，建议5%-10%",
        &#125;,
        "confidentiality": &#123;
            "found": "保密" in contract_text,
            "content": "双方应对商业信息保密，期限为合同终止后2年。",
            "risk_note": "保密期限2年合理",
        &#125;,
        "term": &#123;
            "found": "期限" in contract_text or "有效期" in contract_text,
            "content": "本合同有效期为1年，到期自动续签。",
            "risk_note": "自动续签需注意，建议增加终止通知条款",
        &#125;,
        "dispute": &#123;
            "found": "争议" in contract_text or "仲裁" in contract_text,
            "content": "",
            "risk_note": "未发现争议解决条款，建议补充",
        &#125;,
    &#125;
    found_count = sum(1 for c in clauses.values() if c["found"])
    return &#123;
        "total_clauses": len(clauses),
        "found_clauses": found_count,
        "missing_clauses": len(clauses) - found_count,
        "clauses": clauses,
    &#125;

@tool
async def identify_risks(clauses_data: dict) -> dict:
    """识别合同风险条款。

    Args:
        clauses_data: 条款提取结果
    """
    risks = []
    clauses = clauses_data.get("clauses", &#123;&#125;)

    risk_rules = &#123;
        "payment": &#123;"max_days": 30, "issue": "付款周期过长"&#125;,
        "breach": &#123;"min_rate": 5, "issue": "违约金比例偏低"&#125;,
        "dispute": &#123;"required": True, "issue": "缺失争议解决条款"&#125;,
    &#125;

    for clause_type, rule in risk_rules.items():
        clause = clauses.get(clause_type, &#123;&#125;)
        if not clause.get("found"):
            risks.append(&#123;
                "clause": clause_type,
                "level": "高" if rule.get("required") else "中",
                "issue": rule["issue"],
                "suggestion": f"建议补充&#123;clause_type&#125;相关条款" if not clause.get("found") else "调整条款内容",
            &#125;)
        elif clause.get("risk_note") and "偏低" in clause.get("risk_note", ""):
            risks.append(&#123;
                "clause": clause_type,
                "level": "中",
                "issue": clause["risk_note"],
                "suggestion": "建议提高违约金比例至5%-10%",
            &#125;)

    risk_count = len(risks)
    high_count = sum(1 for r in risks if r["level"] == "高")

    return &#123;
        "total_risks": risk_count,
        "high_risks": high_count,
        "medium_risks": risk_count - high_count,
        "overall_risk_level": "高" if high_count >= 2 else ("中" if risk_count > 0 else "低"),
        "risks": risks,
    &#125;

@tool
async def check_compliance(clauses_data: dict, contract_type: str = "采购合同") -> dict:
    """合规检查。

    Args:
        clauses_data: 条款提取结果
        contract_type: 合同类型
    """
    compliance_rules = &#123;
        "采购合同": &#123;
            "required_clauses": ["payment", "breach", "confidentiality", "term", "dispute"],
            "prohibited_terms": ["无条件放弃诉权", "无限期保密"],
        &#125;,
        "销售合同": &#123;
            "required_clauses": ["payment", "breach", "term"],
            "prohibited_terms": ["无条件退换"],
        &#125;,
    &#125;

    rules = compliance_rules.get(contract_type, compliance_rules["采购合同"])
    clauses = clauses_data.get("clauses", &#123;&#125;)

    violations = []
    for required in rules["required_clauses"]:
        if not clauses.get(required, &#123;&#125;).get("found"):
            violations.append(&#123;
                "type": "missing_clause",
                "clause": required,
                "severity": "高",
                "description": f"缺少必要条款: &#123;required&#125;",
            &#125;)

    for clause_type, clause_info in clauses.items():
        content = clause_info.get("content", "")
        for prohibited in rules["prohibited_terms"]:
            if prohibited in content:
                violations.append(&#123;
                    "type": "prohibited_term",
                    "clause": clause_type,
                    "severity": "高",
                    "description": f"发现禁止性条款: &#123;prohibited&#125;",
                &#125;)

    return &#123;
        "contract_type": contract_type,
        "total_violations": len(violations),
        "is_compliant": len(violations) == 0,
        "violations": violations,
    &#125;

@tool
async def generate_review_report(extract_result: dict, risk_result: dict, compliance_result: dict) -> dict:
    """生成合同审查报告。

    Args:
        extract_result: 条款提取结果
        risk_result: 风险识别结果
        compliance_result: 合规检查结果
    """
    overall_risk = risk_result.get("overall_risk_level", "未知")
    is_compliant = compliance_result.get("is_compliant", False)

    if not is_compliant:
        recommendation = "不建议签署，需修改违规条款"
    elif overall_risk == "高":
        recommendation = "高风险，需法务总监审批后签署"
    elif overall_risk == "中":
        recommendation = "中等风险，修改建议项后可签署"
    else:
        recommendation = "低风险，可签署"

    return &#123;
        "report_id": f"LR-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;",
        "generated_at": datetime.now().isoformat(),
        "contract_type": compliance_result.get("contract_type", "未指定"),
        "clause_summary": &#123;
            "total": extract_result.get("total_clauses", 0),
            "found": extract_result.get("found_clauses", 0),
            "missing": extract_result.get("missing_clauses", 0),
        &#125;,
        "risk_summary": &#123;
            "level": overall_risk,
            "total_risks": risk_result.get("total_risks", 0),
            "high_risks": risk_result.get("high_risks", 0),
            "details": risk_result.get("risks", []),
        &#125;,
        "compliance_summary": &#123;
            "is_compliant": is_compliant,
            "violations": compliance_result.get("violations", []),
        &#125;,
        "recommendation": recommendation,
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能法律合同审查助手。你可以：

1. **extract_clauses**: 提取合同关键条款
2. **identify_risks**: 识别合同风险条款
3. **check_compliance**: 合规检查
4. **generate_review_report**: 生成审查报告

## 工作流程
1. 提取合同中的关键条款（付款、违约、保密、期限、争议解决）
2. 识别风险条款并评估风险等级
3. 进行合规检查（必要条款是否齐全、是否有禁止性条款）
4. 汇总生成审查报告，给出签署建议

## 原则
- 条款提取要完整
- 风险等级评估要客观
- 合规检查要严格
- 报告要有明确的签署建议"""

contract_review_agent = create_react_agent(
    llm,
    [extract_clauses, identify_risks, check_compliance, generate_review_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    contract_text = """
    采购合同
    甲方：XX科技有限公司  乙方：YY供应商
    一、甲方购买乙方服务器设备，合同金额50万元。
    二、付款方式：乙方应在收到发票后30日内支付货款。
    三、违约责任：任何一方违约，应支付合同金额的5%作为违约金。
    四、保密条款：双方应对商业信息保密，期限为合同终止后2年。
    五、合同期限：本合同有效期为1年，到期自动续签。
    """

    result = await contract_review_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": f"请审查以下采购合同：\n&#123;contract_text&#125;"&#125;]
    &#125;)
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
合同审查报告

报告编号：LR-20260827143000
合同类型：采购合同

条款提取：
- 应提取条款：5项
- 已找到条款：4项
- 缺失条款：1项（争议解决）

风险识别：
- 风险等级：中
- 风险总数：2
  1. [中] 违约金比例偏低 → 建议提高至5%-10%
  2. [高] 缺失争议解决条款 → 建议补充仲裁或诉讼条款

合规检查：
- 合规状态：不合规
- 违规项：1项
  1. [高] 缺少必要条款: dispute

签署建议：不建议签署，需修改违规条款
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有条款提取工具 | ☐ |
| 有风险识别工具 | ☐ |
| 有合规检查工具 | ☐ |
| 有审查报告生成 | ☐ |
| 有风险等级评估 | ☐ |
| 有明确签署建议 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
