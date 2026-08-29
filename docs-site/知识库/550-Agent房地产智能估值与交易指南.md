# Agent 房地产智能估值与交易指南

> 房产估值需要考虑位置、面积、楼层、朝向、装修、周边配套——Agent 能自动分析房产数据、生成估值、匹配买卖双方、生成交易报告。本指南系统讲解房产 Agent 架构、智能估值、房源推荐、交易辅助、市场分析。

---

## 1. 房产 Agent 架构

### 工作流

```mermaid
graph TB
    PROPERTY["房产信息"] --> VALUE["智能估值<br/>多因素模型"]
    VALUE --> MATCH["买卖匹配<br/>需求匹配"]
    MATCH --> TOUR["看房安排<br/>智能预约"]
    TOUR --> DEAL["交易辅助<br/>合同/贷款/过户"]
    MARKET["市场数据"] --> ANALYZE["市场分析<br/>趋势/区域对比"]

    style VALUE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style MATCH fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DEAL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 智能估值

```python
@dataclass
class PropertyValuer:
    """房产智能估值器"""

    async def value(self, property_data: dict, comparables: list = None) -> dict:
        """估值"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        # 基础评分
        base_score = 50
        adjustments = []

        # 位置
        if property_data.get("location_score", 5) >= 8:
            base_score += 20
            adjustments.append("优质地段 +20%")
        elif property_data.get("location_score", 5) <= 3:
            base_score -= 15
            adjustments.append("偏远地段 -15%")

        # 楼层
        floor = property_data.get("floor", 1)
        total = property_data.get("total_floors", 6)
        if floor == total: base_score -= 5; adjustments.append("顶层 -5%")
        elif floor <= 1: base_score -= 3; adjustments.append("底层 -3%")
        else: base_score += 5; adjustments.append("中间楼层 +5%")

        # 装修
        renovation = property_data.get("renovation", "毛坯")
        reno_bonus = &#123;"精装": 10, "简装": 5, "毛坯": 0&#125;
        base_score += reno_bonus.get(renovation, 0)
        if reno_bonus.get(renovation, 0):
            adjustments.append(f"&#123;renovation&#125; +&#123;reno_bonus[renovation]&#125;%")

        # 周边配套
        facilities = property_data.get("nearby_facilities", [])
        if "地铁" in facilities: base_score += 8; adjustments.append("近地铁 +8%")
        if "学校" in facilities: base_score += 6; adjustments.append("近学校 +6%")
        if "医院" in facilities: base_score += 4; adjustments.append("近医院 +4%")

        response = await llm.ainvoke(f"""房产估值。

房产信息: &#123;json.dumps(property_data, ensure_ascii=False)&#125;
可比案例: &#123;json.dumps(comparables[:5] if comparables else [], ensure_ascii=False)&#125;
调整因素: &#123;adjustments&#125;
基础评分: &#123;base_score&#125;

输出 JSON:
&#123;&#123;
    "estimated_value": 0,
    "value_range": &#123;&#123;"low": 0, "high": 0&#125;&#125;,
    "price_per_sqm": 0,
    "confidence": 0.8,
    "value_factors": [&#123;&#123;"factor": "...", "impact": "+/-X%", "reason": "..."&#125;&#125;],
    "market_comparison": "与周边对比分析",
    "investment_potential": "高/中/低",
    "recommendation": "买入/持有/卖出"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 3. 房源推荐

```python
@dataclass
class PropertyMatcher:
    """房源匹配器"""

    async def match(self, buyer_requirement: dict, listings: list) -> dict:
        """匹配房源"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""匹配房源。

买家需求: &#123;json.dumps(buyer_requirement, ensure_ascii=False)&#125;
房源列表: &#123;json.dumps(listings[:20], ensure_ascii=False)[:3000]&#125;

输出 JSON:
&#123;&#123;
    "recommended": [
        &#123;&#123;
            "property_id": "...",
            "match_score": 0.9,
            "matching_points": ["匹配点"],
            "missing_points": ["不足"],
            "estimated_value": 0,
            "listing_price": 0,
            "value_assessment": "低估/合理/高估",
            "recommendation_reason": "推荐理由"
        &#125;&#125;
    ],
    "total_matched": 5,
    "best_deal": "性价比最高的房源ID"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 4. 市场分析

```python
@dataclass
class RealEstateMarketAnalyzer:
    """房地产市场分析器"""

    async def analyze(self, region: str, market_data: dict) -> dict:
        """市场分析"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""分析房地产市场。

区域: &#123;region&#125;
市场数据: &#123;json.dumps(market_data, ensure_ascii=False)[:2000]&#125;

输出 JSON:
&#123;&#123;
    "market_trend": "上涨/平稳/下跌",
    "avg_price_sqm": 0,
    "price_change_yoy": "同比变化",
    "supply_demand": "供大于求/供需平衡/供不应求",
    "hot_areas": ["热门区域"],
    "investment_advice": "投资建议",
    "risk_factors": ["风险因素"],
    "outlook_6_months": "6个月展望"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了智能估值（多因素） | ☐ |
| 实现了房源匹配 | ☐ |
| 实现了市场分析 | ☐ |
| 有估值区间 | ☐ |
| 有投资建议 | ☐ |
| 有性价比分析 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 43 | 智能物业管理 Agent | 物业 |
| 535 | Agent 零售电商 | 零售 |
| 540 | Agent 智能建筑 | 建筑 |
| 546 | Agent 城市规划 | 城市 |
| 524 | Agent 金融风控 | 贷款 |
