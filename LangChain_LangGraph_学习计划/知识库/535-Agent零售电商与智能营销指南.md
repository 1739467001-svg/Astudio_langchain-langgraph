# Agent 零售电商与智能营销指南

> 电商 Agent 能做个性化推荐、智能搜索、价格优化、库存管理、营销文案生成。本指南系统讲解零售 Agent 架构、商品推荐、智能客服、营销自动化、价格优化。

---

## 1. 零售 Agent 架构

### 工作流

```mermaid
graph TB
    USER["用户行为"] --> PROFILE["用户画像<br/>偏好+购买力"]
    PROFILE --> RECOMMEND["商品推荐<br/>个性化"]
    USER --> SEARCH["智能搜索<br/>语义+过滤"]
    SEARCH --> DISPLAY["商品展示<br/>排序+定价"]
    PROFILE --> MARKETING["营销自动化<br/>个性化文案"]
    USER --> SERVICE["智能客服<br/>咨询+售后"]

    style PROFILE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style RECOMMEND fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style MARKETING fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

---

## 2. 商品推荐

```python
@dataclass
class ProductRecommender:
    """商品推荐器"""

    async def recommend(self, user_id: str, browsing_history: list,
                        purchase_history: list, context: dict = None) -> dict:
        """个性化推荐"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""生成个性化商品推荐。

用户ID: {user_id}
浏览历史: {json.dumps(browsing_history[-10:], ensure_ascii=False)}
购买历史: {json.dumps(purchase_history[-5:], ensure_ascii=False)}
当前场景: {json.dumps(context or {}, ensure_ascii=False)}

输出 JSON:
{{
    "recommendations": [
        {{
            "product_id": "...",
            "product_name": "...",
            "reason": "推荐理由",
            "match_score": 0.9,
            "category": "..."
        }}
    ],
    "cross_sell": ["关联商品"],
    "upsell": ["升级推荐"],
    "strategy": "推荐策略说明"
}}""")

        return json.loads(response.content)
```

---

## 3. 智能搜索

```python
@dataclass
class SmartSearchAgent:
    """智能搜索"""

    async def search(self, query: str, user_id: str = None,
                     filters: dict = None) -> dict:
        """语义搜索"""
        # 意图理解
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"理解用户搜索意图。查询: {query}\n输出JSON: {{\"intent\": \"...\", \"keywords\": [], \"category\": \"...\", \"price_range\": {{\"min\": 0, \"max\": 0}}}}"
        )
        intent = json.loads(response.content)

        # 向量搜索+关键词搜索混合
        results = await vectorstore.asimilarity_search(query, k=20)

        # 重排序
        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        response = await llm.ainvoke(f"""重排序搜索结果。

用户意图: {json.dumps(intent, ensure_ascii=False)}
搜索结果: {[r.page_content[:100] for r in results[:10]]}

输出最相关的5个商品ID（按相关性排序）。""")

        return {
            "query": query,
            "intent": intent,
            "results": results[:10],
            "total": len(results),
        }
```

---

## 4. 营销自动化

```python
@dataclass
class MarketingAutomator:
    """营销自动化"""

    async def generate_copy(self, product: dict, target_audience: dict,
                            platform: str = "wechat") -> str:
        """生成营销文案"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

        platform_guides = {
            "wechat": "微信公众号：有故事感、情感共鸣",
            "weibo": "微博：简短有力、有话题",
            "douyin": "抖音：有冲击力、有场景",
            "email": "邮件：有标题、有优惠、有行动号召",
        }

        prompt = f"""写{platform}营销文案。

产品: {json.dumps(product, ensure_ascii=False)}
目标受众: {json.dumps(target_audience, ensure_ascii=False)}
平台风格: {platform_guides.get(platform, "")}

要求: 吸引注意力+突出价值+行动号召。200字内。"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def ab_test_subjects(self, product: dict, n: int = 3) -> list:
        """生成 A/B 测试标题"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.9)

        titles = []
        for i in range(n):
            response = await llm.ainvoke(
                f"为产品 {product.get('name', '')} 生成一个吸引人的标题。只要标题，20字内。"
            )
            titles.append(response.content.strip())

        return titles
```

---

## 5. 价格优化

```python
@dataclass
class PriceOptimizer:
    """价格优化器"""

    async def optimize(self, product_id: str, current_price: float,
                       cost: float, demand_data: list,
                       competitor_prices: list = None) -> dict:
        """优化定价"""
        # 需求弹性分析
        avg_demand = sum(demand_data) / max(len(demand_data), 1)
        profit_margin = (current_price - cost) / max(current_price, 1)

        # 竞品分析
        comp_avg = sum(competitor_prices) / max(len(competitor_prices or [current_price]), 1) if competitor_prices else current_price

        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""优化商品定价。

产品ID: {product_id}
当前价格: ¥{current_price}
成本: ¥{cost}
当前利润率: {profit_margin:.1%}
竞品均价: ¥{comp_avg:.0f}
历史需求: {avg_demand:.0f}/天

输出 JSON:
{{
    "recommended_price": 0,
    "expected_demand": 0,
    "expected_profit": 0,
    "strategy": "降价促销/维持/提价",
    "reasoning": "定价理由"
}}""")

        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了商品推荐（个性化） | ☐ |
| 实现了智能搜索（语义+意图） | ☐ |
| 实现了营销文案生成 | ☐ |
| 实现了 A/B 测试标题 | ☐ |
| 实现了价格优化 | ☐ |
| 有竞品分析 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 17 | 个性化推荐 Agent | 推荐 |
| 41 | 智能零售门店 Agent | 零售 |
| 459 | Agent 个性化与画像 | 画像 |
| 494 | Agent 混合搜索 | 搜索 |
| 521 | Agent 内容创作 | 文案 |
| 526 | Agent 客服自动化 | 客服 |
| 528 | Agent 供应链 | 供应链 |
