# Agent 食品安全与质量追溯指南

> 从农田到餐桌——食品经过生产、加工、运输、销售多个环节。Agent 能检测食品质量、追溯来源、预警风险、生成合规报告。本指南系统讲解食品安全 Agent 架构、质量检测、全链追溯、风险预警。

---

## 1. 食品安全 Agent 架构

### 工作流

```mermaid
graph TB
    SAMPLE["食品样品"] --> DETECT["质量检测<br/>感官/理化/微生物"]
    DETECT --> COMPARE&#123;"符合标准?"&#125;
    COMPARE -->|"是"| PASS["合格放行"]
    COMPARE -->|"否"| TRACE["问题追溯<br/>源头定位"]
    TRACE --> RECALL["召回建议"]
    SUPPLY["供应链数据"] --> TRACE
    DETECT --> REPORT["合规报告"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style TRACE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style RECALL fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style PASS fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 质量检测

```python
@dataclass
class FoodQualityDetector:
    """食品质量检测器"""

    async def detect(self, food_type: str, test_results: dict,
                     image_path: str = None) -> dict:
        """检测食品质量"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 如果有图片，VLM 检查外观
        visual_analysis = ""
        if image_path:
            import base64
            with open(image_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode()
            from langchain_core.messages import HumanMessage
            vlm_response = await llm.ainvoke([
                HumanMessage(content=[
                    &#123;"type": "text", "text": f"检测&#123;food_type&#125;的外观质量。输出JSON: &#123;&#123;\"appearance\": \"正常/异常\", \"defects\": [], \"freshness\": \"新鲜/一般/不新鲜\"&#125;&#125;"&#125;,
                    &#123;"type": "image_url", "image_url": &#123;"url": f"data:image/png;base64,&#123;img_b64&#125;"&#125;&#125;,
                ])
            ])
            visual_analysis = vlm_response.content

        # 综合评估
        response = await llm.ainvoke(f"""评估食品安全。

食品类型: &#123;food_type&#125;
检测结果: &#123;json.dumps(test_results, ensure_ascii=False)&#125;
外观分析: &#123;visual_analysis[:500]&#125;

输出 JSON:
&#123;&#123;
    "quality_grade": "A/B/C/不合格",
    "safety_status": "安全/关注/不合格",
    "issues": [&#123;&#123;"item": "...", "value": 0, "standard": 0, "severity": "high/medium/low"&#125;&#125;],
    "recommendation": "放行/复检/销毁/召回",
    "health_risk": "无/低/中/高"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 3. 全链追溯

```python
@dataclass
class FoodTraceability:
    """食品全链追溯"""

    async def trace(self, product_id: str) -> dict:
        """追溯产品全链"""
        # 获取供应链记录
        chain = await self._get_supply_chain(product_id)

        return &#123;
            "product_id": product_id,
            "trace": [
                &#123;
                    "stage": "原料",
                    "source": "XX农场",
                    "batch": "LOT-2025-001",
                    "date": "2025-08-01",
                    "quality": "合格",
                &#125;,
                &#123;
                    "stage": "加工",
                    "factory": "XX食品厂",
                    "batch": "PROD-2025-0801",
                    "date": "2025-08-05",
                    "temperature_log": "正常",
                &#125;,
                &#123;
                    "stage": "运输",
                    "carrier": "XX物流",
                    "vehicle": "京A12345",
                    "date": "2025-08-06",
                    "cold_chain": "0-4°C 全程达标",
                &#125;,
                &#123;
                    "stage": "销售",
                    "store": "XX超市",
                    "date": "2025-08-07",
                    "shelf_life": "2025-08-15",
                &#125;,
            ],
            "complete": True,
        &#125;

    async def find_root_cause(self, problem: str, chain: list) -> dict:
        """定位问题根源"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""分析食品安全问题根源。

问题: &#123;problem&#125;
供应链记录: &#123;json.dumps(chain, ensure_ascii=False)&#125;

输出 JSON:
&#123;&#123;
    "root_cause_stage": "原料/加工/运输/销售",
    "root_cause_detail": "具体原因",
    "affected_batches": ["受影响批次"],
    "recall_scope": "召回范围",
    "corrective_action": "纠正措施",
    "preventive_action": "预防措施"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 4. 风险预警

```python
@dataclass
class FoodRiskAlert:
    """食品风险预警"""

    async def check(self, product_data: dict, external_alerts: list = None) -> dict:
        """检查风险"""
        risks = []

        # 保质期检查
        expiry = product_data.get("expiry_date", "")
        if expiry:
            from datetime import datetime
            days_left = (datetime.fromisoformat(expiry) - datetime.utcnow()).days
            if days_left < 0:
                risks.append(&#123;"type": "过期", "severity": "high", "action": "立即下架"&#125;)
            elif days_left < 3:
                risks.append(&#123;"type": "即将过期", "severity": "medium", "action": "促销处理"&#125;)

        # 外部预警（监管部门通报）
        if external_alerts:
            for alert in external_alerts:
                if alert.get("product_type") == product_data.get("type"):
                    risks.append(&#123;
                        "type": "监管预警",
                        "severity": "high",
                        "detail": alert.get("description", ""),
                        "action": "停止销售+排查",
                    &#125;)

        return &#123;
            "product_id": product_data.get("id"),
            "risk_count": len(risks),
            "risks": risks,
            "action": "需处理" if risks else "正常",
        &#125;
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了质量检测（VLM+理化） | ☐ |
| 实现了全链追溯 | ☐ |
| 实现了根源定位 | ☐ |
| 实现了风险预警 | ☐ |
| 实现了召回建议 | ☐ |
| 有供应链数据管理 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 40 | 智能制造 Agent | 制造 |
| 528 | Agent 供应链 | 供应链 |
| 533 | Agent 农业 | 农业 |
| 541 | Agent 医药研发 | 医药 |
| 443 | 多模态文档智能 | 多模态 |
| 451 | LLM 应用合规 | 合规 |
