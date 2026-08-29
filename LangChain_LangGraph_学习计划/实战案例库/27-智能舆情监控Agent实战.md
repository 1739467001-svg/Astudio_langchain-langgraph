# 实战案例 27：智能舆情监控 Agent

> 企业需要实时监控品牌舆情——新闻、社交媒体、评论。Agent 能自动收集、分类情感、识别危机、生成报告。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"舆情监控Agent"}
        SRC["数据源<br/>新闻/微博/评论"] --> COLLECT["收集"]
        COLLECT --> CLASSIFY["情感分类<br/>正面/负面/中性"]
        CLASSIFY --> CRISIS{"危机检测"}
        CRISIS -->|危机| ALERT["⚠️ 实时告警"]
        CRISIS -->|正常| TREND["趋势分析"]
        ALERT & TREND --> REPORT["舆情报告"]
    end

    style COLLECT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style ALERT fill:#FFCDD2,stroke:#C62828,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 数据收集 + 情感分析 + 危机检测 + 趋势报告

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_mentions(brand: str, hours: int = 24) -> list[dict]:
    """收集品牌提及。

    Args:
        brand: 品牌名称
        hours: 时间范围（小时）
    """
    # 实际接入搜索API/社交媒体API
    return [
        {"source": "微博", "content": f"{brand}产品很好用", "time": "2小时前", "author": "用户A"},
        {"source": "新闻", "content": f"{brand}发布新品", "time": "5小时前", "author": "媒体B"},
        {"source": "评论", "content": f"{brand}服务太差了", "time": "1小时前", "author": "用户C"},
    ]

SENTIMENT_PROMPT = """分析以下提及的情感倾向。

提及列表:
{mentions}

对每条提及分类:
- positive: 正面
- negative: 负面
- neutral: 中性

输出JSON:
```json
[{{"content": "...", "sentiment": "positive/negative/neutral", "reason": "原因"}}]
```"""

@tool
async def analyze_sentiment(mentions: list[dict]) -> dict:
    """分析提及的情感倾向。

    Args:
        mentions: 提及列表
    """
    mentions_text = "\n".join(f"[{m.get('source')}] {m.get('content', '')}" for m in mentions)
    prompt = SENTIMENT_PROMPT.format(mentions=mentions_text[:2000])
    response = await llm.ainvoke([HumanMessage(content=prompt)])

    match = re.search(r'\[.*\]', response.content, re.DOTALL)
    results = json.loads(match.group()) if match else []

    positive = sum(1 for r in results if r.get("sentiment") == "positive")
    negative = sum(1 for r in results if r.get("sentiment") == "negative")
    neutral = sum(1 for r in results if r.get("sentiment") == "neutral")

    return {
        "total": len(results),
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "sentiment_ratio": round(positive / max(len(results), 1), 4),
        "details": results,
    }

CRISIS_PROMPT = """基于以下舆情分析，判断是否有公关危机。

品牌: {brand}
情感分析: {analysis}

危机判断标准:
1. 负面提及占比>40%
2. 有媒体负面报道
3. 有集中投诉
4. 有病毒式传播风险

输出JSON:
```json
{{
  "is_crisis": true/false,
  "crisis_level": "high/medium/low/none",
  "crisis_type": "产品质量/服务投诉/公关事件/无",
  "affected_scope": "影响范围",
  "recommendation": "应对建议"
}}
```"""

@tool
async def detect_crisis(brand: str, analysis: dict) -> dict:
    """检测是否有公关危机。

    Args:
        brand: 品牌名称
        analysis: 情感分析结果
    """
    prompt = CRISIS_PROMPT.format(
        brand=brand,
        analysis=json.dumps(analysis, ensure_ascii=False)[:1000],
    )
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"is_crisis": False, "crisis_level": "none"}

@tool
async def generate_report(brand: str, mentions: list, sentiment: dict, crisis: dict) -> str:
    """生成舆情监控报告。

    Args:
        brand: 品牌名称
        mentions: 提及列表
        sentiment: 情感分析
        crisis: 危机检测结果
    """
    report = f"""# {brand} 舆情监控报告

## 概况
- 监控时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}
- 总提及数: {sentiment.get('total', 0)}
- 正面: {sentiment.get('positive', 0)} ({sentiment.get('sentiment_ratio', 0):.0%})
- 负面: {sentiment.get('negative', 0)}
- 中性: {sentiment.get('neutral', 0)}

## 危机评估
- 危机等级: {crisis.get('crisis_level', '未知')}
- 是否危机: {'⚠️ 是' if crisis.get('is_crisis') else '✅ 否'}
"""
    if crisis.get("is_crisis"):
        report += f"- 危机类型: {crisis.get('crisis_type', '未知')}\n"
        report += f"- 影响范围: {crisis.get('affected_scope', '未知')}\n"
        report += f"- 应对建议: {crisis.get('recommendation', '未知')}\n"

    report += f"\n## 情感趋势\n正面占比 {sentiment.get('sentiment_ratio', 0):.0%}"
    if sentiment.get("sentiment_ratio", 0) > 0.7:
        report += " — 舆情正面为主\n"
    elif sentiment.get("negative", 0) > sentiment.get("positive", 0):
        report += " — ⚠️ 负面情绪较多，需关注\n"
    else:
        report += " — 舆情中性\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能舆情监控助手。你可以：

1. **collect_mentions**: 收集品牌提及
2. **analyze_sentiment**: 分析情感倾向
3. **detect_crisis**: 检测公关危机
4. **generate_report**: 生成舆情报告

## 监控流程
1. 收集最近24小时的品牌提及
2. 分析情感倾向（正面/负面/中性）
3. 检测是否有危机
4. 生成完整报告

## 原则
- 危机要实时告警
- 数据驱动分析
- 报告要可操作"""

sentiment_agent = create_react_agent(
    llm,
    [collect_mentions, analyze_sentiment, detect_crisis, generate_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await sentiment_agent.ainvoke({
        "messages": [{"role": "user", "content": "监控'科大讯飞'最近24小时的舆情"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有数据收集工具 | ☐ |
| 有情感分析 | ☐ |
| 有危机检测 | ☐ |
| 有报告生成 | ☐ |
