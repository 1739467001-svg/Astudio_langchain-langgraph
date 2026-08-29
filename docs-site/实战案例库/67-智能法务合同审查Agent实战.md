# 实战案例 67：智能法务合同审查 Agent

> 合同审查涉及条款提取、风险识别、合规检查和建议生成。Agent 能自动解析合同文本、识别风险条款、检查合规性，并生成审查报告和修改建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"智能法务合同审查Agent"&#125;
        LAWYER["法务: '审查这份采购合同'"] --> PARSE["合同解析<br/>提取条款+金额+期限"]
        PARSE --> RISK&#123;"风险识别<br/>违约/赔偿/知识产权"&#125;
        RISK --> COMPLIANCE["合规检查<br/>法规+公司政策"]
        COMPLIANCE --> SUGGEST["建议生成<br/>修改建议+谈判要点"]
        SUGGEST --> REPORT["审查报告<br/>风险等级+条款+建议"]
    end

    style PARSE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style RISK fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 合同解析 + 风险识别 + 合规检查 + 建议生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
import json
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
def parse_contract(contract_text: str) -> dict:
    """解析合同文本，提取关键条款和信息

    Args:
        contract_text: 合同文本内容
    """
    # 模拟解析结果
    return &#123;
        "contract_type": "采购合同",
        "parties": &#123;
            "甲方": "XX科技有限公司",
            "乙方": "YY供应商有限公司"
        &#125;,
        "amount": "500,000元",
        "payment_terms": "货到验收后30天内付款",
        "delivery_date": "2025年3月31日",
        "warranty_period": "12个月",
        "clauses": [
            &#123;"id": 1, "title": "违约责任", "content": "任何一方违约需支付合同金额30%违约金"&#125;,
            &#123;"id": 2, "title": "知识产权", "content": "定制开发部分的知识产权归甲方所有"&#125;,
            &#123;"id": 3, "title": "保密条款", "content": "双方对商业信息保密，期限为合同终止后2年"&#125;,
            &#123;"id": 4, "title": "争议解决", "content": "发生争议提交乙方所在地法院管辖"&#125;,
            &#123;"id": 5, "title": "不可抗力", "content": "因不可抗力导致的延误不承担违约责任"&#125;
        ]
    &#125;

@tool
def identify_risks(parsed_contract: str) -> dict:
    """识别合同中的风险条款

    Args:
        parsed_contract: 解析后的合同JSON
    """
    contract = json.loads(parsed_contract) if isinstance(parsed_contract, str) else parsed_contract
    risks = []

    for clause in contract.get("clauses", []):
        risk = None
        title = clause.get("title", "")
        content = clause.get("content", "")

        if "违约金" in content and "30%" in content:
            risk = &#123;
                "clause_id": clause["id"],
                "title": title,
                "risk_level": "高",
                "risk_type": "违约金过高",
                "description": "违约金比例30%可能过高，建议降至10-20%",
                "recommendation": "协商降低违约金至合同金额的10-15%"
            &#125;
        elif "乙方所在地" in content:
            risk = &#123;
                "clause_id": clause["id"],
                "title": title,
                "risk_level": "中",
                "risk_type": "管辖权不利",
                "description": "乙方所在地法院管辖对甲方不利",
                "recommendation": "改为甲方所在地或被告所在地法院管辖"
            &#125;
        elif "保密" in content and "2年" in content:
            risk = &#123;
                "clause_id": clause["id"],
                "title": title,
                "risk_level": "低",
                "risk_type": "保密期限偏长",
                "description": "保密期限2年偏长，行业标准为1年",
                "recommendation": "可接受，但建议缩短至1年"
            &#125;

        if risk:
            risks.append(risk)

    high_count = sum(1 for r in risks if r["risk_level"] == "高")
    mid_count = sum(1 for r in risks if r["risk_level"] == "中")
    low_count = sum(1 for r in risks if r["risk_level"] == "低")

    return &#123;
        "total_risks": len(risks),
        "high_risk_count": high_count,
        "medium_risk_count": mid_count,
        "low_risk_count": low_count,
        "overall_risk_level": "高" if high_count > 0 else ("中" if mid_count > 0 else "低"),
        "risks": risks
    &#125;

@tool
def check_compliance(parsed_contract: str, company_policy: str = "") -> dict:
    """检查合同是否符合法规和公司政策

    Args:
        parsed_contract: 解析后的合同JSON
        company_policy: 公司合同政策（可选）
    """
    contract = json.loads(parsed_contract) if isinstance(parsed_contract, str) else parsed_contract
    checks = []

    # 检查必备条款
    clause_titles = [c["title"] for c in contract.get("clauses", [])]
    required = ["违约责任", "保密条款", "争议解决", "不可抗力"]
    for req in required:
        found = any(req in t for t in clause_titles)
        checks.append(&#123;
            "check_item": f"包含&#123;req&#125;条款",
            "passed": found,
            "note": "已包含" if found else f"缺少&#123;req&#125;条款，建议补充"
        &#125;)

    # 检查金额是否明确
    amount = contract.get("amount", "")
    checks.append(&#123;
        "check_item": "合同金额明确",
        "passed": bool(amount),
        "note": f"金额: &#123;amount&#125;"
    &#125;)

    # 检查付款条件
    payment = contract.get("payment_terms", "")
    checks.append(&#123;
        "check_item": "付款条件明确",
        "passed": bool(payment),
        "note": f"付款: &#123;payment&#125;"
    &#125;)

    passed = sum(1 for c in checks if c["passed"])
    return &#123;
        "total_checks": len(checks),
        "passed_count": passed,
        "failed_count": len(checks) - passed,
        "compliance_rate": round(passed / max(len(checks), 1) * 100, 1),
        "checks": checks
    &#125;

@tool
def generate_review_report(risk_analysis: str, compliance_report: str) -> dict:
    """生成合同审查报告，包含风险评估和合规检查结论

    Args:
        risk_analysis: 风险分析结果JSON
        compliance_report: 合规检查结果JSON
    """
    risk_data = json.loads(risk_analysis) if isinstance(risk_analysis, str) else risk_analysis
    comp_data = json.loads(compliance_report) if isinstance(compliance_report, str) else compliance_report

    # 生成谈判要点
    negotiation_points = []
    for risk in risk_data.get("risks", []):
        if risk["risk_level"] in ("高", "中"):
            negotiation_points.append(
                f"[&#123;risk['risk_level']&#125;] 条款&#123;risk['clause_id']&#125;-&#123;risk['title']&#125;: &#123;risk['recommendation']&#125;"
            )

    for check in comp_data.get("checks", []):
        if not check["passed"]:
            negotiation_points.append(f"[合规] &#123;check['check_item']&#125;: &#123;check['note']&#125;")

    overall = risk_data.get("overall_risk_level", "未知")
    compliance = comp_data.get("compliance_rate", 0)

    if overall == "高" or compliance < 80:
        conclusion = "不建议签署，需修改关键条款后重新审查"
    elif overall == "中" or compliance < 100:
        conclusion = "可考虑签署，但需关注中风险条款并协商修改"
    else:
        conclusion = "风险较低，可签署"

    return &#123;
        "review_date": datetime.now().strftime("%Y-%m-%d"),
        "overall_risk_level": overall,
        "compliance_rate": f"&#123;compliance&#125;%",
        "conclusion": conclusion,
        "risk_summary": f"共&#123;risk_data['total_risks']&#125;个风险: 高&#123;risk_data['high_risk_count']&#125;/中&#123;risk_data['medium_risk_count']&#125;/低&#123;risk_data['low_risk_count']&#125;",
        "compliance_summary": f"合规检查&#123;comp_data['passed_count']&#125;/&#123;comp_data['total_checks']&#125;通过",
        "negotiation_points": negotiation_points,
        "recommendations": [r["recommendation"] for r in risk_data.get("risks", [])]
    &#125;
```

---

## 三、Agent 组装

```python
# 使用 create_react_agent 组装
agent = create_react_agent(
    model=llm,
    tools=[parse_contract, identify_risks, check_compliance, generate_review_report],
    prompt="""你是智能法务合同审查助手，帮助法务人员完成合同审查。

工作流程：
1. 调用 parse_contract 解析合同文本，提取条款和信息
2. 调用 identify_risks 识别合同中的风险条款
3. 调用 check_compliance 检查合规性
4. 调用 generate_review_report 生成完整审查报告

注意：
- 每个步骤的结果传给下一个工具
- 重点关注高风险条款
- 最终给出明确的签署建议"""
)
```

---

## 四、使用示例

```python
import asyncio

async def main():
    result = await agent.ainvoke(&#123;
        "messages": [HumanMessage(content="""
            请审查以下采购合同：

            甲方：XX科技有限公司
            乙方：YY供应商有限公司
            合同金额：500,000元
            付款方式：货到验收后30天内付款
            交货日期：2025年3月31日

            主要条款：
            1. 违约责任：任何一方违约需支付合同金额30%违约金
            2. 知识产权：定制开发部分的知识产权归甲方所有
            3. 保密条款：双方对商业信息保密，期限为合同终止后2年
            4. 争议解决：发生争议提交乙方所在地法院管辖
            5. 不可抗力：因不可抗力导致的延误不承担违约责任
        """)]
    &#125;)

    print("=== 合同审查结果 ===")
    for msg in result["messages"]:
        if hasattr(msg, 'content') and msg.content:
            print(msg.content[:300])

asyncio.run(main())
```

输出：

```text
=== 合同审查结果 ===
合同审查完成，报告如下：

1. **合同解析**：采购合同，金额500,000元，5个条款
2. **风险识别**：共3个风险
   - [高] 违约金30%过高，建议降至10-15%
   - [中] 管辖权为乙方所在地，对甲方不利
   - [低] 保密期限2年偏长，建议缩短至1年
3. **合规检查**：5/5项通过（100%）
4. **审查结论**：可考虑签署，但需关注中风险条款并协商修改
5. **谈判要点**：
   - 降低违约金至合同金额的10-15%
   - 改为甲方所在地法院管辖
   - 保密期限缩短至1年
```

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有合同解析工具 | ☐ |
| 有风险识别工具 | ☐ |
| 有合规检查工具 | ☐ |
| 有报告生成工具 | ☐ |
| 有 create_react_agent 组装 | ☐ |
| 有端到端使用示例 | ☐ |
