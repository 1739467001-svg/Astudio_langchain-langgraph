# Agent 工具调用成本归因

> 哪个工具消耗了最多 Token？哪步最贵？成本归因帮你精确定位花费来源。

---

## 一、成本归因的价值

```mermaid
graph TB
    subgraph 无归因 &#123;"❌ 无成本归因"&#125;
        N1["月花费$50"] --> N2["不知道哪花的最多"]
        N2 --> N3["无法优化"]
    end

    subgraph 有归因 &#123;"✅ 有成本归因"&#125;
        S1["月花费$50"] --> S2["搜索工具: $20(40%)<br/>LLM推理: $25(50%)<br/>嵌入: $5(10%)"]
        S2 --> S3["重点优化搜索工具"]
    end

    style 无归因 fill:'#FFCDD2'
    style 有归因 fill:'#C8E6C9'
```

## 二、成本归因模型

```python
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class CostRecord:
    """成本记录"""
    timestamp: str
    category: str           # 成本类别: llm/embedding/tool/vector_search
    sub_category: str = ""   # 子类别: gpt-4o-mini/search_web/...
    input_tokens: int = 0
    output_tokens: int = 0
    cost: float = 0.0
    request_id: str = ""
    user_id: str = ""

class CostAttributor:
    """成本归因器"""
    def __init__(self):
        self.records: list[CostRecord] = []

    def record_llm(self, model: str, input_tokens: int, output_tokens: int, request_id: str = "", user_id: str = ""):
        """记录LLM调用成本"""
        prices = &#123;
            "gpt-4o-mini": (0.15, 0.60),
            "gpt-4o": (2.50, 10.00),
        &#125;
        in_price, out_price = prices.get(model, (0.15, 0.60))
        cost = (input_tokens * in_price + output_tokens * out_price) / 1_000_000

        self.records.append(CostRecord(
            timestamp=datetime.now().isoformat(),
            category="llm",
            sub_category=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            request_id=request_id,
            user_id=user_id,
        ))

    def record_embedding(self, tokens: int, model: str = "text-embedding-3-small", request_id: str = ""):
        """记录Embedding成本"""
        price = 0.02  # $0.02 per 1M tokens
        cost = tokens * price / 1_000_000
        self.records.append(CostRecord(
            timestamp=datetime.now().isoformat(),
            category="embedding",
            sub_category=model,
            input_tokens=tokens,
            cost=cost,
            request_id=request_id,
        ))

    def report_by_category(self) -> dict:
        """按类别汇总"""
        from collections import defaultdict
        totals = defaultdict(lambda: &#123;"cost": 0, "count": 0, "tokens": 0&#125;)
        for r in self.records:
            totals[r.category]["cost"] += r.cost
            totals[r.category]["count"] += 1
            totals[r.category]["tokens"] += r.input_tokens + r.output_tokens

        total_cost = sum(t["cost"] for t in totals.values())
        report = &#123;&#125;
        for cat, data in sorted(totals.items(), key=lambda x: -x[1]["cost"]):
            report[cat] = &#123;
                "cost": f"$&#123;data['cost']:.4f&#125;",
                "percentage": f"&#123;data['cost']/total_cost*100:.0f&#125;%" if total_cost > 0 else "0%",
                "count": data["count"],
                "tokens": data["tokens"],
            &#125;
        return &#123;"total": f"$&#123;total_cost:.4f&#125;", "breakdown": report&#125;

    def report_by_user(self, user_id: str) -> dict:
        """按用户汇总"""
        user_records = [r for r in self.records if r.user_id == user_id]
        total = sum(r.cost for r in user_records)
        return &#123;
            "user_id": user_id,
            "total_cost": f"$&#123;total:.4f&#125;",
            "call_count": len(user_records),
            "avg_cost": f"$&#123;total/len(user_records):.6f&#125;" if user_records else "$0",
        &#125;
```

## 三、在 Agent 中集成

```python
from langchain_core.callbacks import BaseCallbackHandler

class CostTrackingCallback(BaseCallbackHandler):
    """成本追踪回调"""
    def __init__(self, attributor: CostAttributor, request_id: str = "", user_id: str = ""):
        self.attributor = attributor
        self.request_id = request_id
        self.user_id = user_id

    def on_llm_end(self, response, **kwargs):
        usage = response.llm_output or &#123;&#125;
        token_usage = usage.get("token_usage", &#123;&#125;)
        model = usage.get("model_name", "gpt-4o-mini")

        self.attributor.record_llm(
            model=model,
            input_tokens=token_usage.get("prompt_tokens", 0),
            output_tokens=token_usage.get("completion_tokens", 0),
            request_id=self.request_id,
            user_id=self.user_id,
        )

# 使用
attributor = CostAttributor()
callback = CostTrackingCallback(attributor, request_id="req_001", user_id="user_A")

llm = ChatOpenAI(model="gpt-4o-mini", callbacks=[callback])
llm.invoke("你好")
llm.invoke("解释AI")

# 报告
report = attributor.report_by_category()
print(f"总成本: &#123;report['total']&#125;")
for cat, data in report["breakdown"].items():
    print(f"  &#123;cat&#125;: &#123;data['cost']&#125; (&#123;data['percentage']&#125;) &#123;data['count']&#125;次")
```

## 四、成本归因报告示例

```
总成本: $0.0034
  llm: $0.0030 (88%) 2次
  embedding: $0.0004 (12%) 5次
```

## 五、检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| LLM调用成本记录 | 每次LLM调用记录Token+成本 | ☐ |
| Embedding成本记录 | 向量化成本 | ☐ |
| 按类别汇总 | 能看到各类别占比 | ☐ |
| 按用户汇总 | 能看到每个用户的花费 | ☐ |
| 成本告警 | 超预算时告警 | ☐ |
