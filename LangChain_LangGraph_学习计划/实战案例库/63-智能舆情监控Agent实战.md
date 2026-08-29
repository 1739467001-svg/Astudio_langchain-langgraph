# 实战案例 63：智能舆情监控 Agent

> 舆情监控涉及多源数据采集、情感分析、热点识别和预警。Agent 能自动采集全网信息、分析情感倾向、识别热点话题并生成舆情报告。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"舆情监控Agent"}
        U["运营: '监控AI行业舆情'"] --> COLLECT["数据采集<br/>新闻+社媒+论坛"]
        COLLECT --> SENTIMENT["情感分析<br/>正面/负面/中性"]
        SENTIMENT --> HOTSPOT{"热点识别"}
        HOTSPOT -->|有热点| ALERT["热点预警<br/>关键词+来源+趋势"]
        HOTSPOT -->|无热点| NORMAL["常规监控"]
        ALERT & NORMAL --> REPORT["舆情报告<br/>趋势+建议"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SENTIMENT fill:#E3F2FD,stroke:#1565C0
    style ALERT fill:#FFE0B2,stroke:#E65100
    style REPORT fill:#C8E6C9
```

**核心技术：** 多源数据采集 + 情感分析 + 热点识别 + 预警报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime, timedelta

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_sources(keyword: str, hours: int = 24) -> dict:
    """采集多源舆情数据。

    Args:
        keyword: 监控关键词
        hours: 时间范围（小时）
    """
    # 模拟多源采集（实际可调用搜索API、社媒API）
    sources = [
        {"source": "新浪新闻", "type": "news", "count": 15, "avg_sentiment": 0.2},
        {"source": "微博", "type": "social", "count": 85, "avg_sentiment": -0.1},
        {"source": "知乎", "type": "forum", "count": 23, "avg_sentiment": 0.3},
        {"source": "微信公众号", "type": "article", "count": 8, "avg_sentiment": 0.4},
        {"source": "抖音", "type": "video", "count": 42, "avg_sentiment": 0.1},
    ]
    total = sum(s["count"] for s in sources)
    return {
        "keyword": keyword,
        "time_range_hours": hours,
        "total_mentions": total,
        "source_count": len(sources),
        "sources": sources,
        "peak_hour": "14:00-16:00",
        "trend": "上升",
        "trend_pct": 35.0,
    }

@tool
async def analyze_sentiment(collect_data: dict) -> dict:
    """情感分析。

    Args:
        collect_data: 采集结果
    """
    sources = collect_data.get("sources", [])
    total = collect_data.get("total_mentions", 0)

    # 汇总情感
    positive = sum(s["count"] for s in sources if s["avg_sentiment"] > 0.1)
    negative = sum(s["count"] for s in sources if s["avg_sentiment"] < -0.1)
    neutral = total - positive - negative

    # 各源情感分析
    source_analysis = []
    for s in sources:
        if s["avg_sentiment"] > 0.2:
            sentiment = "正面"
        elif s["avg_sentiment"] < -0.2:
            sentiment = "负面"
        else:
            sentiment = "中性"

        source_analysis.append({
            "source": s["source"],
            "type": s["type"],
            "mentions": s["count"],
            "sentiment": sentiment,
            "score": s["avg_sentiment"],
        })

    overall_score = sum(s["avg_sentiment"] * s["count"] for s in sources) / max(total, 1)
    if overall_score > 0.2:
        overall = "正面"
    elif overall_score < -0.2:
        overall = "负面"
    else:
        overall = "中性"

    return {
        "keyword": collect_data.get("keyword", ""),
        "total_mentions": total,
        "overall_sentiment": overall,
        "overall_score": round(overall_score, 2),
        "positive_count": positive,
        "negative_count": negative,
        "neutral_count": neutral,
        "positive_pct": round(positive / max(total, 1) * 100, 1),
        "negative_pct": round(negative / max(total, 1) * 100, 1),
        "source_analysis": source_analysis,
    }

@tool
async def identify_hotspots(sentiment_data: dict, collect_data: dict) -> dict:
    """识别热点话题。

    Args:
        sentiment_data: 情感分析结果
        collect_data: 采集结果
    """
    total = sentiment_data.get("total_mentions", 0)
    negative_pct = sentiment_data.get("negative_pct", 0)
    trend = collect_data.get("trend", "稳定")
    trend_pct = collect_data.get("trend_pct", 0)

    # 热点判定规则
    hotspots = []

    if negative_pct > 30:
        hotspots.append({
            "type": "负面舆情",
            "level": "高",
            "description": f"负面声量占比{negative_pct}%，需重点关注",
            "affected_sources": [s["source"] for s in sentiment_data.get("source_analysis", []) if s["sentiment"] == "负面"],
        })

    if trend == "上升" and trend_pct > 20:
        hotspots.append({
            "type": "声量激增",
            "level": "中" if trend_pct < 50 else "高",
            "description": f"讨论量较前日增长{trend_pct}%",
            "peak_time": collect_data.get("peak_hour", ""),
        })

    if total > 100:
        hotspots.append({
            "type": "高关注度",
            "level": "中",
            "description": f"24小时内{total}条讨论，关注度较高",
        })

    # 找负面最严重的来源
    source_analysis = sentiment_data.get("source_analysis", [])
    negative_sources = [s for s in source_analysis if s["sentiment"] == "负面"]
    if negative_sources:
        worst = min(negative_sources, key=lambda x: x["score"])
        hotspots.append({
            "type": "来源异常",
            "level": "中",
            "description": f"{worst['source']}负面情感最高(score={worst['score']})",
        })

    return {
        "keyword": sentiment_data.get("keyword", ""),
        "hotspot_count": len(hotspots),
        "has_hotspot": len(hotspots) > 0,
        "max_level": max((h["level"] for h in hotspots), default="无"),
        "hotspots": hotspots,
    }

@tool
async def generate_monitoring_report(collect: dict, sentiment: dict, hotspots: dict) -> dict:
    """生成舆情监控报告。

    Args:
        collect: 采集结果
        sentiment: 情感分析结果
        hotspots: 热点识别结果
    """
    has_hotspot = hotspots.get("has_hotspot", False)
    max_level = hotspots.get("max_level", "无")

    if max_level == "高":
        recommendation = "建议立即启动危机公关预案，重点关注负面来源"
    elif max_level == "中":
        recommendation = "建议加强监控频率，准备应对方案"
    else:
        recommendation = "舆情平稳，维持常规监控"

    return {
        "report_id": f"PR-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "keyword": collect.get("keyword", ""),
        "monitoring_period": f"近{collect.get('time_range_hours', 24)}小时",
        "data_summary": {
            "total_mentions": collect.get("total_mentions", 0),
            "source_count": collect.get("source_count", 0),
            "trend": collect.get("trend", ""),
            "trend_pct": collect.get("trend_pct", 0),
            "peak_hour": collect.get("peak_hour", ""),
        },
        "sentiment_summary": {
            "overall": sentiment.get("overall_sentiment", ""),
            "score": sentiment.get("overall_score", 0),
            "positive_pct": sentiment.get("positive_pct", 0),
            "negative_pct": sentiment.get("negative_pct", 0),
            "neutral_pct": sentiment.get("neutral_pct", 0) if "neutral_pct" in sentiment else round(100 - sentiment.get("positive_pct", 0) - sentiment.get("negative_pct", 0), 1),
        },
        "hotspot_summary": {
            "has_hotspot": has_hotspot,
            "count": hotspots.get("hotspot_count", 0),
            "max_level": max_level,
            "details": hotspots.get("hotspots", []),
        },
        "recommendation": recommendation,
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能舆情监控助手。你可以：

1. **collect_sources**: 采集多源舆情数据
2. **analyze_sentiment**: 情感分析
3. **identify_hotspots**: 识别热点话题
4. **generate_monitoring_report**: 生成监控报告

## 工作流程
1. 采集新闻、社媒、论坛等多源数据
2. 分析整体情感倾向和各源情感
3. 识别热点话题（负面声量/声量激增/高关注度/来源异常）
4. 生成完整监控报告和建议

## 原则
- 多源覆盖，不只看单一渠道
- 情感分析要分正/负/中三向
- 热点分级（高/中/无）
- 负面舆情必须预警
- 建议要可执行"""

sentiment_agent = create_react_agent(
    llm,
    [collect_sources, analyze_sentiment, identify_hotspots, generate_monitoring_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await sentiment_agent.ainvoke({
        "messages": [{"role": "user", "content": "监控AI行业的舆情，分析情感倾向并识别热点"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
舆情监控报告

报告编号：PR-20260827210000
监控关键词：AI行业
监控周期：近24小时

数据采集：
- 总提及量：173条
- 数据来源：5个
- 趋势：上升（+35%）
- 峰值时段：14:00-16:00

来源分布：
- 微博：85条（负面）
- 抖音：42条（中性）
- 知乎：23条（正面）
- 新浪新闻：15条（中性）
- 微信公众号：8条（正面）

情感分析：
- 整体情感：中性（score=0.12）
- 正面：38.7%
- 负面：49.1%
- 中性：12.2%

热点识别：
- 热点数量：3个
- 最高级别：高
  1. [高] 负面舆情：负面声量占比49.1%，需重点关注
     受影响来源：微博
  2. [中] 声量激增：讨论量较前日增长35%
     峰值时段：14:00-16:00
  3. [中] 高关注度：24小时内173条讨论

建议：建议立即启动危机公关预案，重点关注负面来源
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据采集工具 | ☐ |
| 有情感分析 | ☐ |
| 有热点识别 | ☐ |
| 有监控报告 | ☐ |
| 热点分级 | ☐ |
| 有可执行建议 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
