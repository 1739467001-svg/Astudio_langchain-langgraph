# Agent 保险理赔与智能核保指南

> 保险理赔需要审核材料、定损、计算赔付——流程长且依赖人工经验。Agent 能自动初审理赔材料、辅助定损、计算赔付金额、检测欺诈。本指南系统讲解保险 Agent 架构、智能核保、理赔自动化、反欺诈检测。

---

## 1. 保险 Agent 架构

### 工作流

```mermaid
graph TB
    CLAIM["理赔申请"] --> DOC["材料审核<br/>完整性/真实性"]
    DOC --> ASSESS["损失评估<br/>定损+计算"]
    ASSESS --> FRAUD&#123;"欺诈检测?"&#125;
    FRAUD -->|"无"| APPROVE["赔付审批"]
    FRAUD -->|"有风险"| INVESTIGATE["人工调查"]
    APPROVE --> PAY["理赔支付"]
    APPROVE --> NOTIFY["通知客户"]

    style DOC fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style FRAUD fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style PAY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 智能核保

```python
@dataclass
class UnderwritingAgent:
    """智能核保"""

    async def underwrite(self, applicant: dict, product_type: str) -> dict:
        """核保评估"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 风险评分
        risk_score = self._calculate_risk(applicant)

        response = await llm.ainvoke(f"""核保评估。

险种: &#123;product_type&#125;
投保人信息: &#123;json.dumps(applicant, ensure_ascii=False)&#125;
风险评分: &#123;risk_score&#125;/100

输出 JSON:
&#123;&#123;
    "decision": "承保/加费承保/延期/拒保",
    "risk_level": "低/中/高",
    "premium_adjustment": "标准/加费10%/拒保",
    "exclusions": ["除外责任"],
    "conditions": ["承保条件"],
    "reasoning": "核保理由"
&#125;&#125;""")

        return json.loads(response.content)

    def _calculate_risk(self, applicant: dict) -> int:
        score = 50
        age = applicant.get("age", 30)
        if age > 60: score += 20
        elif age > 45: score += 10

        if applicant.get("smoking"): score += 15
        if applicant.get("pre_existing_conditions"): score += 25
        if applicant.get("occupation_risk") == "high": score += 15
        return min(100, score)
```

---

## 3. 理赔自动化

```python
@dataclass
class ClaimsProcessor:
    """理赔处理"""

    async def process(self, claim: dict, policy: dict) -> dict:
        """处理理赔"""
        # 1. 材料审核
        doc_check = await self._check_documents(claim)

        # 2. 定损
        assessment = await self._assess_damage(claim)

        # 3. 计算赔付
        payout = await self._calculate_payout(assessment, policy)

        # 4. 欺诈检测
        fraud = await self._check_fraud(claim, policy)

        if fraud.get("risk_level") == "high":
            return &#123;"status": "需人工调查", "fraud_alert": fraud&#125;

        return &#123;
            "claim_id": claim["claim_id"],
            "doc_check": doc_check,
            "assessment": assessment,
            "recommended_payout": payout,
            "fraud_check": fraud,
            "status": "建议赔付" if fraud.get("risk_level") != "high" else "需调查",
        &#125;

    async def _check_documents(self, claim: dict) -> dict:
        """材料审核"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""审核理赔材料。

理赔类型: &#123;claim.get('type')&#125;
提交材料: &#123;json.dumps(claim.get('documents', []), ensure_ascii=False)&#125;

输出 JSON:
&#123;&#123;
    "complete": true/false,
    "missing": ["缺失材料"],
    "issues": [&#123;&#123;"doc": "...", "issue": "...", "severity": "high/low"&#125;&#125;]
&#125;&#125;""")

        return json.loads(response.content)

    async def _assess_damage(self, claim: dict) -> dict:
        """损失评估"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 如果有图片，用 VLM 定损
        if claim.get("damage_images"):
            import base64
            # VLM 分析损伤
            response = await llm.ainvoke(f"""基于以下信息评估损失。

理赔信息: &#123;json.dumps(claim, ensure_ascii=False)[:1000]&#125;

输出 JSON:
&#123;&#123;
    "damage_description": "损失描述",
    "estimated_repair_cost": 0,
    "actual_cash_value": 0,
    "replacement_cost": 0,
    "salvage_value": 0,
    "confidence": 0.8
&#125;&#125;""")
        else:
            response = await llm.ainvoke(f"评估损失: &#123;json.dumps(claim, ensure_ascii=False)[:1000]&#125;\n输出损失评估JSON。")

        return json.loads(response.content)

    async def _calculate_payout(self, assessment: dict, policy: dict) -> dict:
        """计算赔付"""
        # 赔付 = min(实际价值, 保额) × 赔付比例 - 免赔额
        actual_value = assessment.get("actual_cash_value", 0)
        coverage = policy.get("coverage_amount", 0)
        deductible = policy.get("deductible", 0)
        payout_ratio = policy.get("payout_ratio", 1.0)

        payout = min(actual_value, coverage) * payout_ratio - deductible
        payout = max(0, payout)

        return &#123;
            "base_amount": min(actual_value, coverage),
            "payout_ratio": payout_ratio,
            "deductible": deductible,
            "final_payout": payout,
            "calculation": f"min(&#123;actual_value&#125;, &#123;coverage&#125;) × &#123;payout_ratio&#125; - &#123;deductible&#125; = &#123;payout&#125;",
        &#125;

    async def _check_fraud(self, claim: dict, policy: dict) -> dict:
        """欺诈检测"""
        risk_score = 0
        reasons = []

        # 规则1：短期出险
        if claim.get("days_since_inception", 999) < 30:
            risk_score += 30
            reasons.append("投保后短期出险")

        # 规则2：重复理赔
        # 规则3：金额异常高
        if claim.get("claimed_amount", 0) > policy.get("coverage_amount", 0) * 0.8:
            risk_score += 20
            reasons.append("理赔金额接近保额上限")

        return &#123;
            "risk_score": risk_score,
            "risk_level": "high" if risk_score > 50 else "medium" if risk_score > 25 else "low",
            "reasons": reasons,
        &#125;
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了智能核保 | ☐ |
| 实现了理赔材料审核 | ☐ |
| 实现了损失评估 | ☐ |
| 实现了赔付计算 | ☐ |
| 实现了欺诈检测 | ☐ |
| 有人工调查触发 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 37 | 智能保险理赔 Agent | 保险 |
| 53 | 智能保险核保 Agent | 核保 |
| 524 | Agent 金融风控 | 风控 |
| 536 | Agent 心理咨询 | 心理 |
| 461 | 企业 Agent 集成 | 集成 |
| 480 | Agent 日志管理 | 审计 |
