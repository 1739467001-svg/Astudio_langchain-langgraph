# Agent 税务申报与智能审计指南

> 税务申报涉及税法、发票、抵扣——规则复杂且年年变化。Agent 能自动计算税额、生成申报表、审计合规性。本指南系统讲解税务 Agent 架构、发票管理、税额计算、申报自动化、智能审计。

---

## 1. 税务 Agent 架构

### 工作流

```mermaid
graph TB
    INVOICE["发票管理<br/>进项/销项"] --> VERIFY["发票验真<br/>真伪/重复"]
    VERIFY --> CALC["税额计算<br/>增值税/所得税"]
    CALC --> DECLARE["申报表生成<br/>自动填写"]
    DECLARE --> REVIEW["合规审核<br/>异常检测"]
    REVIEW --> FILE["电子申报<br/>直连税局"]
    FILE --> ARCHIVE["归档<br/>可追溯"]

    style INVOICE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style CALC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style REVIEW fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style FILE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 发票管理

```python
@dataclass
class InvoiceManager:
    """发票管理器"""

    async def parse_invoice(self, invoice_text: str) -> dict:
        """解析发票"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""解析发票信息。

发票内容:
{invoice_text[:1000]}

输出 JSON:
{{
    "invoice_number": "发票号码",
    "invoice_type": "增值税专用发票/普通发票/电子发票",
    "issue_date": "开票日期",
    "seller": {{"name": "...", "tax_id": "...", "address": "...", "bank": "..."}},
    "buyer": {{"name": "...", "tax_id": "...", "address": "...", "bank": "..."}},
    "items": [{{"name": "...", "quantity": 1, "unit_price": 100, "amount": 100, "tax_rate": 0.13, "tax_amount": 13}}],
    "subtotal": 100,
    "tax_total": 13,
    "total": 113
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def verify_invoice(self, invoice: dict) -> dict:
        """验真"""
        # 调用税局验真接口
        return {
            "valid": True,
            "invoice_number": invoice["invoice_number"],
            "verification_date": datetime.utcnow().isoformat(),
        }

    async def check_duplicate(self, invoice: dict, existing: list) -> bool:
        """查重"""
        return any(e["invoice_number"] == invoice["invoice_number"] for e in existing)
```

---

## 3. 税额计算

```python
@dataclass
class TaxCalculator:
    """税额计算器"""

    async def calculate_vat(self, sales_invoices: list,
                            purchase_invoices: list) -> dict:
        """计算增值税"""
        # 销项税
        output_tax = sum(i.get("tax_total", 0) for i in sales_invoices)
        # 进项税
        input_tax = sum(i.get("tax_total", 0) for i in purchase_invoices)
        # 应纳税额 = 销项 - 进项
        payable = max(0, output_tax - input_tax)

        return {
            "output_tax": output_tax,
            "input_tax": input_tax,
            "vat_payable": payable,
            "tax_period": datetime.utcnow().strftime("%Y-%m"),
            "detail": {
                "sales_count": len(sales_invoices),
                "purchase_count": len(purchase_invoices),
            },
        }

    async def calculate_income_tax(self, revenue: float, costs: dict,
                                    deductions: dict) -> dict:
        """计算企业所得税"""
        total_costs = sum(costs.values())
        taxable_income = revenue - total_costs - sum(deductions.values())
        # 25% 基本税率（简化）
        tax_rate = 0.25
        # 小微优惠
        if taxable_income < 1000000:
            tax_rate = 0.025  # 实际按政策

        tax = max(0, taxable_income * tax_rate)

        return {
            "revenue": revenue,
            "total_costs": total_costs,
            "deductions": sum(deductions.values()),
            "taxable_income": taxable_income,
            "tax_rate": f"{tax_rate:.1%}",
            "income_tax": tax,
        }
```

---

## 4. 申报自动化

```python
@dataclass
class TaxDeclaration:
    """申报自动化"""

    async def generate_declaration(self, tax_data: dict, tax_type: str) -> dict:
        """生成申报表"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""生成{tax_type}申报表。

税务数据:
{json.dumps(tax_data, ensure_ascii=False)}

输出 JSON:
{{
    "form_type": "申报表类型",
    "tax_period": "所属期",
    "taxpayer": {{"name": "...", "tax_id": "..."}},
    "items": [{{"field": "项目", "value": "金额"}}],
    "total_tax": "应纳税额",
    "declaration_date": "申报日期",
    "notes": "注意事项"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def compliance_check(self, declaration: dict) -> dict:
        """合规检查"""
        issues = []

        # 检查异常
        if declaration.get("total_tax", 0) < 0:
            issues.append("应纳税额为负数")

        if declaration.get("items"):
            for item in declaration["items"]:
                if item.get("value", 0) > 10000000:
                    issues.append(f"大额项目: {item['field']}")

        return {
            "compliant": len(issues) == 0,
            "issues": issues,
            "recommendation": "直接申报" if not issues else "需人工审核",
        }
```

---

## 5. 智能审计

```python
@dataclass
class SmartAuditor:
    """智能审计器"""

    async def audit(self, financial_data: dict) -> dict:
        """审计财务数据"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""智能审计分析。

财务数据:
{json.dumps(financial_data, ensure_ascii=False)[:3000]}

审计重点:
1. 收入与发票匹配
2. 进项发票真实性
3. 税率适用正确性
4. 异常大额交易
5. 关联交易

输出 JSON:
{{
    "audit_result": "通过/有风险/不合规",
    "risk_level": "低/中/高",
    "findings": [
        {{"type": "异常类型", "description": "描述", "amount": 0, "recommendation": "建议"}}
    ],
    "overall_assessment": "总体评价",
    "disclaimer": "仅供参考，需专业税务师确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def tax_optimization(self, company_profile: dict) -> dict:
        """税务优化建议"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""提供合法的税务优化建议。

企业信息:
{json.dumps(company_profile, ensure_ascii=False)}

建议方向:
1. 可享受的税收优惠
2. 合规的节税措施
3. 高新技术企业认定
4. 研发费用加计扣除

输出 JSON:
{{
    "suggestions": [{{"title": "...", "description": "...", "potential_saving": "...","legal_basis": "..."}}],
    "disclaimer": "需税务师确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了发票解析 | ☐ |
| 实现了发票验真+查重 | ☐ |
| 实现了增值税计算 | ☐ |
| 实现了所得税计算 | ☐ |
| 实现了申报表生成 | ☐ |
| 实现了合规检查 | ☐ |
| 实现了智能审计 | ☐ |
| 实现了税务优化建议 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 49 | 智能税务咨询 Agent | 税务 |
| 68 | 智能税务申报 Agent | 申报 |
| 52 | 智能审计 Agent | 审计 |
| 451 | LLM 应用合规 | 合规 |
| 480 | Agent 日志管理 | 审计日志 |
| 501 | Agent 数据保护 | 隐私 |
| 524 | Agent 金融风控 | 金融 |
