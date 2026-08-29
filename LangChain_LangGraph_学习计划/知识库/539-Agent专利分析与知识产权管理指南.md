# Agent 专利分析与知识产权管理指南

> 企业拥有数百件专利——哪些有价值、哪些即将到期、竞争对手在申请什么。Agent 能自动分析专利文本、评估价值、监控竞品、管理续展。本指南系统讲解专利 Agent 架构、专利文本分析、价值评估、侵权检测、知识产权管理。

---

## 1. 专利 Agent 架构

### 工作流

```mermaid
graph TB
    PATENT["专利文本"] --> PARSE["专利解析<br/>权利要求/说明书"]
    PARSE --> VALUATION["价值评估<br/>技术/法律/市场"]
    PARSE --> INFRINGEMENT["侵权检测<br/>权利要求对比"]
    VALUATION --> PORTFOLIO["组合管理<br/>续展/放弃"]
    INFRINGEMENT --> ALERT["侵权告警"]

    style PARSE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style VALUATION fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style ALERT fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 专利解析

```python
@dataclass
class PatentParser:
    """专利解析器"""

    async def parse(self, patent_text: str) -> dict:
        """解析专利文本"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""解析专利文件。

专利文本:
{patent_text[:5000]}

输出 JSON:
{{
    "patent_number": "专利号",
    "title": "专利名称",
    "abstract": "摘要",
    "applicant": "申请人",
    "inventors": ["发明人"],
    "filing_date": "申请日",
    "publication_date": "公开日",
    "grant_date": "授权日",
    "expiry_date": "到期日",
    "classification": ["IPC分类"],
    "independent_claims": ["独立权利要求"],
    "dependent_claims": ["从属权利要求"],
    "technical_field": "技术领域",
    "background": "背景技术",
    "summary": "发明内容",
    "key_features": ["技术要点"]
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 3. 价值评估

```python
@dataclass
class PatentValuation:
    """专利价值评估"""

    async def evaluate(self, patent: dict, market_data: dict = None) -> dict:
        """评估专利价值"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 计算剩余有效期
        from datetime import datetime
        expiry = patent.get("expiry_date", "")
        remaining_years = 0
        if expiry:
            try:
                remaining_years = max(0, (datetime.fromisoformat(expiry) - datetime.utcnow()).days / 365)
            except: pass

        response = await llm.ainvoke(f"""评估专利价值。

专利信息:
{json.dumps(patent, ensure_ascii=False)[:2000]}
剩余有效期: {remaining_years:.1f}年
市场数据: {json.dumps(market_data or {}, ensure_ascii=False)}

评估维度（每项 1-10 分）:
1. 技术价值: 技术先进性/创新程度
2. 法律价值: 权利要求保护范围/稳定性
3. 市场价值: 市场需求/商业化潜力
4. 战略价值: 对竞争的壁垒作用

输出 JSON:
{{
    "technical_score": 0, "legal_score": 0, "market_score": 0, "strategic_score": 0,
    "overall_score": 0,
    "estimated_value_range": {{"min": "100万", "max": "500万"}},
    "strengths": ["优势"],
    "weaknesses": ["弱点"],
    "recommendation": "维持/许可/出售/放弃"
}}""")

        return json.loads(response.content)
```

---

## 4. 侵权检测

```python
@dataclass
class InfringementDetector:
    """侵权检测器"""

    async def detect(self, patent_claims: list, product_description: str) -> dict:
        """检测产品是否侵犯专利"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""分析产品是否侵犯专利权利要求。

专利权利要求:
{json.dumps(patent_claims, ensure_ascii=False)}

产品描述:
{product_description[:2000]}

分析每个独立权利要求是否被产品技术特征覆盖。

输出 JSON:
{{
    "infringement_risk": "high/medium/low",
    "analyzed_claims": [
        {{
            "claim": "权利要求1",
            "covered": true/false,
            "matching_features": ["匹配的技术特征"],
            "missing_features": ["缺失的技术特征"],
            "analysis": "分析说明"
        }}
    ],
    "overall_assessment": "总体评估",
    "recommendation": "建议",
    "disclaimer": "仅供参考，需专利律师确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 5. 知识产权管理

```python
@dataclass
class IPPortfolioManager:
    """知识产权组合管理"""

    async def manage_renewal(self, patents: list) -> dict:
        """管理专利续展"""
        from datetime import datetime, timedelta

        alerts = []
        for patent in patents:
            expiry = patent.get("expiry_date", "")
            if expiry:
                try:
                    expiry_date = datetime.fromisoformat(expiry)
                    days_remaining = (expiry_date - datetime.utcnow()).days

                    if days_remaining < 90:
                        alerts.append({
                            "patent_number": patent.get("patent_number"),
                            "expiry_date": expiry,
                            "days_remaining": days_remaining,
                            "action": "立即续展" if days_remaining < 30 else "准备续展",
                            "urgency": "critical" if days_remaining < 30 else "warning",
                        })
                except: pass

        return {"renewal_alerts": alerts, "total_patents": len(patents)}

    async def portfolio_analysis(self, patents: list) -> dict:
        """专利组合分析"""
        classifications = {}
        for p in patents:
            for c in p.get("classification", []):
                classifications[c] = classifications.get(c, 0) + 1

        return {
            "total_patents": len(patents),
            "by_classification": classifications,
            "active_patents": sum(1 for p in patents if p.get("status") == "active"),
            "expired_patents": sum(1 for p in patents if p.get("status") == "expired"),
        }
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了专利解析 | ☐ |
| 实现了价值评估（4 维度） | ☐ |
| 实现了侵权检测 | ☐ |
| 实现了续展管理 | ☐ |
| 实现了组合分析 | ☐ |
| 有律师确认流程 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 54 | 智能专利分析 Agent | 专利 |
| 525 | Agent 法律辅助 | 法律 |
| 524 | Agent 金融风控 | 金融 |
| 461 | 企业 Agent 集成 | 集成 |
| 463 | GraphRAG | 图谱 |
