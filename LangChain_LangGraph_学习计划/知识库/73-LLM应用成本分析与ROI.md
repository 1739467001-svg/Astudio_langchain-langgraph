# LLM 应用成本分析与 ROI

> 构建 LLM 应用不只是技术问题，更是经济问题。这份指南帮你算清成本、优化投入产出比。

---

## 一、成本构成

```mermaid
graph TB
    subgraph 成本构成 {"LLM应用总成本"}
        C1["🔴 LLM API费用<br/>(输入+输出Token)<br/>占比: 60-80%"]
        C2["🟡 向量数据库<br/>(存储+检索)<br/>占比: 5-10%"]
        C3["🟡 服务器<br/>(API服务+Worker)<br/>占比: 10-20%"]
        C4["🟢 其他<br/>(Embedding/搜索API)<br/>占比: 5%"]
        C5["🟢 人力<br/>(开发+维护)<br/>占比: 一次性"]
    end

    style C1 fill:'#FFCDD2'
    style C2 fill:'#FFE0B2'
    style C3 fill:'#FFE0B2'
    style C4 fill:'#C8E6C9'
    style C5 fill:'#C8E6C9'
```

## 二、LLM API 成本估算

### 2.1 单次调用成本

```python
def calculate_call_cost(input_tokens: int, output_tokens: int, model: str = "gpt-4o-mini") -> float:
    """计算单次LLM调用的成本"""
    prices = {
        "gpt-4o-mini": (0.15, 0.60),    # (输入$/1M, 输出$/1M)
        "gpt-4o": (2.50, 10.00),
        "claude-3.5-sonnet": (3.00, 15.00),
        "deepseek-chat": (0.14, 0.28),
        "qwen-plus": (0.40, 1.20),
    }
    in_price, out_price = prices.get(model, (0.15, 0.60))
    return (input_tokens * in_price + output_tokens * out_price) / 1_000_000

# 示例：一次RAG调用
cost = calculate_call_cost(input_tokens=2500, output_tokens=300, model="gpt-4o-mini")
print(f"单次成本: ${cost:.6f}")  # 约$0.000563
```

### 2.2 月度成本估算

```python
def estimate_monthly_cost(
    daily_calls: int = 1000,
    avg_input_tokens: int = 2500,
    avg_output_tokens: int = 300,
    model: str = "gpt-4o-mini",
    cache_hit_rate: float = 0.0,
) -> dict:
    """月度成本估算"""
    days = 30
    total_calls = daily_calls * days
    cache_hits = int(total_calls * cache_hit_rate)
    actual_calls = total_calls - cache_hits

    # LLM成本(缓存命中的不消耗)
    cost_per_call = calculate_call_cost(avg_input_tokens, avg_output_tokens, model)
    llm_cost = actual_calls * cost_per_call

    # Embedding成本（入库+查询）
    embedding_cost_per_query = 50 * 0.02 / 1_000_000  # 查询约50 tokens
    embedding_cost = total_calls * embedding_cost_per_query

    # 向量库存储（FAISS免费，Pinecone按月）
    vectorstore_cost = 0  # FAISS本地

    # 总计
    total = llm_cost + embedding_cost + vectorstore_cost

    # 节省
    cache_savings = cache_hits * cost_per_call

    return {
        "model": model,
        "daily_calls": daily_calls,
        "monthly_calls": total_calls,
        "cache_hit_rate": f"{cache_hit_rate:.0%}",
        "llm_cost": f"${llm_cost:.2f}",
        "embedding_cost": f"${embedding_cost:.2f}",
        "vectorstore_cost": f"${vectorstore_cost:.2f}",
        "total_cost": f"${total:.2f}",
        "cache_savings": f"${cache_savings:.2f}",
        "cost_per_call": f"${cost_per_call:.6f}",
    }
```

### 2.3 不同规模和模型对比

| 场景 | 日调用 | 模型 | 月LLM成本 | 月总成本 |
|------|--------|------|-----------|---------|
| 个人学习 | 50 | GPT-4o-mini | ~$0.6 | ~$0.7 |
| 小型应用 | 500 | GPT-4o-mini | ~$6 | ~$7 |
| 中型应用 | 2000 | GPT-4o-mini | ~$25 | ~$27 |
| 中型+缓存30% | 2000 | GPT-4o-mini | ~$18 | ~$19 |
| 大型应用 | 5000 | GPT-4o-mini | ~$63 | ~$66 |
| 大型+GPT-4o | 5000 | GPT-4o | ~$1050 | ~$1060 |
| 企业级 | 10000 | GPT-4o-mini | ~$126 | ~$130 |

## 三、ROI 计算

```python
def calculate_roi(
    monthly_cost: float,
    value_per_call: float,  # 每次调用产生的价值
    daily_calls: int = 1000,
) -> dict:
    """计算投资回报率"""
    monthly_value = value_per_call * daily_calls * 30
    net_value = monthly_value - monthly_cost
    roi = (net_value / monthly_cost * 100) if monthly_cost > 0 else 0

    return {
        "月度成本": f"${monthly_cost:.2f}",
        "月度价值": f"${monthly_value:.2f}",
        "净收益": f"${net_value:.2f}",
        "ROI": f"{roi:.0f}%",
        "回本周期": "即时" if net_value > 0 else "无法回本",
    }

# 示例：客服机器人
# 每次自动回复节省人工客服成本约$2
roi = calculate_roi(monthly_cost=27, value_per_call=2.0, daily_calls=2000)
# ROI: 4430%
```

## 四、成本优化策略

```mermaid
graph TD
    subgraph 优化策略 {"成本优化七策略"}
        O1["1. 用小模型<br/>GPT-4o-mini代替GPT-4o<br/>节省90%+"]
        O2["2. 启用缓存<br/>30%命中率节省30%<br/>70%命中率节省70%"]
        O3["3. 截断历史<br/>保留最近10轮<br/>节省40%输入Token"]
        O4["4. 减小k值<br/>k=3代替k=5<br/>节省30%上下文"]
        O5["5. 设max_tokens<br/>限制输出长度<br/>节省输出Token"]
        O6["6. 精简Prompt<br/>缩短System Prompt<br/>节省10-30%输入"]
        O7["7. 本地模型<br/>Ollama免费<br/>节省100%API费"]
    end

    style O1 fill:'#C8E6C9'
    style O2 fill:'#C8E6C9'
    style O7 fill:'#E3F2FD'
```

## 五、成本监控

```python
class CostMonitor:
    """实时成本监控"""
    def __init__(self, budget: float = 100.0):
        self.budget = budget
        self.daily_spent = 0.0
        self.monthly_spent = 0.0
        self.alert_threshold = 0.8  # 80%告警

    def record(self, cost: float):
        """记录一次调用成本"""
        self.daily_spent += cost
        self.monthly_spent += cost

    def check_budget(self) -> dict:
        """检查预算"""
        monthly_pct = self.monthly_spent / self.budget
        return {
            "monthly_spent": f"${self.monthly_spent:.2f}",
            "budget": f"${self.budget:.2f}",
            "usage_pct": f"{monthly_pct:.0%}",
            "status": "⚠️ 接近预算" if monthly_pct > self.alert_threshold else "✅ 正常",
        }
```
