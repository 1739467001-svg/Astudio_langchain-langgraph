# LLM 应用容量规划

> 上线前需要估算：你的服务器能撑住多少用户？需要多大的向量库？API额度够不够？

---

## 一、容量规划的关键指标

```mermaid
graph TB
    subgraph 指标 {"容量规划四指标"}
        I1["QPS: 每秒查询数<br/>(决定需要多少实例)"]
        I2["并发数: 同时处理的请求<br/>(决定Worker数量)"]
        I3["延迟: P50/P95<br/>(决定用户体验)"]
        I4["API额度: 每日/每月限制<br/>(决定成本上限)"]
    end

    style 指标 fill:'#E3F2FD'
```

## 二、QPS 估算

```python
def estimate_qps(daily_users: int, avg_calls_per_user: int, peak_multiplier: float = 3.0) -> dict:
    """估算QPS"""
    total_daily = daily_users * avg_calls_per_user
    avg_qps = total_daily / 86400  # 24小时平均
    peak_qps = avg_qps * peak_multiplier  # 峰值通常是平均的3倍

    return {
        "日总调用": total_daily,
        "平均QPS": round(avg_qps, 1),
        "峰值QPS": round(peak_qps, 1),
        "需要实例数": max(1, int(peak_qps / 5)),  # 每实例~5 QPS
    }

# 示例
result = estimate_qps(daily_users=500, avg_calls_per_user=10, peak_multiplier=3)
# 日总调用: 5000, 平均QPS: 0.1, 峰值QPS: 0.3, 需要1个实例
```

## 三、资源需求估算

```mermaid
graph TB
    subgraph 资源 {"不同规模的资源需求"}
        SMALL["小型<br/>100用户/天<br/>CPU: 2核<br/>内存: 4GB<br/>磁盘: 10GB<br/>实例: 1"]
        MEDIUM["中型<br/>1000用户/天<br/>CPU: 4核<br/>内存: 8GB<br/>磁盘: 50GB<br/>实例: 2"]
        LARGE["大型<br/>10000用户/天<br/>CPU: 8核×2<br/>内存: 16GB×2<br/>磁盘: 200GB<br/>实例: 4+"]
    end

    SMALL --> MEDIUM --> LARGE

    style SMALL fill:'#C8E6C9'
    style LARGE fill:'#FFCDD2'
```

## 四、API 额度规划

```python
def plan_api_quota(daily_calls: int, avg_input_tokens: int = 2500, avg_output_tokens: int = 300) -> dict:
    """API额度规划"""
    daily_input = daily_calls * avg_input_tokens
    daily_output = daily_calls * avg_output_tokens
    monthly_input = daily_input * 30
    monthly_output = daily_output * 30

    # OpenAI额度限制（Tier 1: $100/月）
    monthly_cost = (monthly_input * 0.15 + monthly_output * 0.60) / 1_000_000

    return {
        "日调用": daily_calls,
        "日输入Token": daily_input,
        "日输出Token": daily_output,
        "月Token总量": monthly_input + monthly_output,
        "月成本估算": f"${monthly_cost:.2f}",
        "是否超限": monthly_cost > 100,
        "建议": "升级Tier或启用缓存" if monthly_cost > 100 else "充足",
    }
```

## 五、容量规划决策表

| 用户规模 | 日调用 | 模型 | 实例数 | 向量库 | 月成本 |
|---------|--------|------|--------|--------|--------|
| <100 | <500 | mini | 1 | FAISS | ~$3 |
| 100-1K | 500-5K | mini | 1-2 | FAISS/Chroma | ~$15 |
| 1K-10K | 5K-50K | mini | 2-4 | Chroma/Milvus | ~$80 |
| >10K | >50K | mini+缓存 | 4+ | Milvus/Pinecone | ~$200+ |

## 六、扩展策略

```mermaid
graph TD
    subgraph 扩展 {"从单机到集群的扩展路径"}
        S1["单机部署<br/>1个实例<br/>FAISS+SQLite"] --> S2["双机部署<br/>2个实例+Nginx<br/>Chroma+PostgreSQL"]
        S2 --> S3["集群部署<br/>K8s自动扩缩<br/>Milvus+PostgreSQL主从"]
        S3 --> S4["全球部署<br/>多区域+CDN<br/>Pinecone云托管"]
    end

    style S1 fill:'#C8E6C9'
    style S4 fill:'#F3E5F5'
```
