# Agent 法律辅助与合同审查指南

> 合同审查需要逐条阅读、识别风险条款、比对法规——费时且容易遗漏。Agent 可以辅助：合同解析、条款分类、风险识别、合规检查。本指南系统讲解法律 Agent 架构、合同智能审查、法律问答、以及必须的专业人员确认。

---

## 1. 法律 Agent 架构

### 工作流

```mermaid
graph TB
    CONTRACT["合同上传"] --> PARSE["合同解析<br/>结构化提取"]
    PARSE --> CLASSIFY["条款分类<br/>付款/违约/终止/保密"]
    CLASSIFY --> RISK["风险识别<br/>不利条款标记"]
    RISK --> COMPLIANCE["合规检查<br/>法规比对"]
    COMPLIANCE --> REPORT["审查报告<br/>风险等级+建议"]
    REPORT --> REVIEW["👨‍⚖️ 律师确认"]
    REVIEW --> OUTPUT["最终意见"]

    style PARSE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style RISK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style REVIEW fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 合同解析

```python
@dataclass
class ContractParser:
    """合同解析器"""

    async def parse(self, contract_text: str) -> dict:
        """解析合同结构"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""解析以下合同，提取结构化信息。

合同文本:
{contract_text[:5000]}

输出 JSON:
{{
    "contract_type": "合同类型(买卖/租赁/劳动/服务)",
    "parties": [{{"name": "...", "role": "甲方/乙方", "address": "..."}}],
    "effective_date": "生效日期",
    "term": "合同期限",
    "amount": "合同金额",
    "clauses": [
        {{
            "section": "条款编号",
            "title": "条款标题",
            "content": "条款内容(摘要)",
            "type": "付款/违约/终止/保密/知识产权/争议解决"
        }}
    ],
    "signatures": ["签署方"]
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 3. 风险识别

```python
@dataclass
class RiskIdentifier:
    """风险识别器"""

    async def identify_risks(self, clauses: list, contract_type: str) -> dict:
        """识别合同风险"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""审查以下合同条款的风险。

合同类型: {contract_type}
条款列表: {json.dumps(clauses, ensure_ascii=False)[:3000]}

审查维度:
1. 违约责任是否对等
2. 付款条件是否合理
3. 终止条款是否公平
4. 保密范围是否过宽
5. 知识产权归属
6. 争议解决条款
7. 不可抗力条款
8. 赔偿责任上限

输出 JSON:
{{
    "risks": [
        {{
            "clause": "条款编号",
            "risk_type": "风险类型",
            "severity": "高/中/低",
            "description": "风险描述",
            "favorable_to": "甲方/乙方/双方",
            "suggestion": "修改建议"
        }}
    ],
    "overall_risk": "高/中/低",
    "summary": "总体评价"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 4. 合规检查

```python
@dataclass
class ComplianceChecker:
    """合规检查器"""

    async def check(self, contract: dict, jurisdiction: str = "CN") -> dict:
        """检查合规性"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""检查合同合规性。

合同信息: {json.dumps(contract, ensure_ascii=False)[:2000]}
司法管辖区: {jurisdiction}

检查项:
1. 合同主体是否合法
2. 是否违反强制性规定
3. 格式条款是否合规
4. 知识产权条款是否符合法律
5. 劳动条款（如适用）是否符合劳动法
6. 数据保护条款是否符合个保法

输出 JSON:
{{
    "compliant": true/false,
    "issues": [{{"issue": "...", "law": "相关法律", "severity": "高/中/低", "suggestion": "..."}}],
    "missing_clauses": ["缺失的必要条款"],
    "disclaimer": "仅供参考，需律师确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 5. 法律问答

```python
@dataclass
class LegalQA:
    """法律问答 Agent"""

    async def answer(self, question: str, jurisdiction: str = "中国") -> str:
        """法律问答"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""你是法律顾问助手。回答以下法律问题。

司法管辖区: {jurisdiction}
问题: {question}

要求:
1. 引用具体法律条文
2. 给出客观分析
3. 不做最终法律意见
4. 建议咨询专业律师

回答:"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了合同解析 | ☐ |
| 实现了条款分类 | ☐ |
| 实现了风险识别 | ☐ |
| 实现了合规检查 | ☐ |
| 实现了法律问答 | ☐ |
| 有免责声明 | ☐ |
| 配置了律师确认流程 | ☐ |
| 审查报告生成 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 25 | 智能法律合同审查 Agent | 合同 |
| 30 | 智能法务咨询 Agent | 法务 |
| 57 | 智能法律合同审查 | 审查 |
| 443 | 多模态文档智能 | 文档 |
| 451 | LLM 应用合规 | 合规 |
| 458 | 人机协作 HITL | 律师确认 |
| 480 | Agent 日志管理 | 审计 |
| 501 | Agent 数据保护 | 隐私 |
