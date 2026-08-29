# Agent 新闻媒体与内容采编指南

> 新闻生产需要采编、写稿、审校、发布——Agent 能自动采集新闻、生成稿件、事实核查、多渠道发布。本指南系统讲解新闻 Agent 架构、信息采集、新闻写作、事实核查、版权管理。

---

## 1. 新闻 Agent 架构

### 工作流

```mermaid
graph TB
    SOURCES["信息源<br/>RSS/社交媒体/通稿"] --> GATHER["信息采集<br/>去重+筛选"]
    GATHER --> VERIFY["事实核查<br/>多源交叉验证"]
    VERIFY --> WRITE["新闻写作<br/>多风格"]
    WRITE --> EDIT["审校<br/>质量+合规"]
    EDIT --> PUBLISH["多渠道发布<br/>网站/App/社交"]

    style GATHER fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style VERIFY fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style WRITE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style PUBLISH fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 信息采集

```python
@dataclass
class NewsGatherer:
    """新闻采集器"""

    async def gather(self, keywords: list, sources: list = None) -> dict:
        """采集新闻"""
        import asyncio

        # 并行采集多源
        tasks = [self._fetch_source(s, keywords) for s in (sources or ["web", "social", "rss"])]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 去重
        all_news = []
        seen = set()
        for result in results:
            if isinstance(result, list):
                for item in result:
                    key = item.get("title", "")[:50]
                    if key not in seen:
                        seen.add(key)
                        all_news.append(item)

        # 排序（时效性+重要性）
        all_news.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return {
            "total_gathered": len(all_news),
            "top_news": all_news[:20],
            "keywords": keywords,
        }

    async def _fetch_source(self, source: str, keywords: list) -> list:
        """获取单个信息源"""
        # 实际中调用各平台 API
        return [{"title": f"关于{keywords[0]}的最新报道", "source": source, "timestamp": datetime.utcnow().isoformat()}]
```

---

## 3. 新闻写作

```python
@dataclass
class NewsWriter:
    """新闻写作器"""

    async def write(self, topic: str, facts: list, style: str = "objective") -> str:
        """写新闻稿"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.5)

        styles = {
            "objective": "客观报道风格，事实为主，不带立场",
            "analysis": "深度分析风格，提供背景和解读",
            "breaking": "突发新闻风格，简洁有力，快速传达",
            "feature": "特写风格，有人物有故事",
        }

        prompt = f"""写一篇新闻报道。

主题: {topic}
素材: {json.dumps(facts, ensure_ascii=False)[:2000]}
风格: {styles.get(style, styles["objective"])}

要求:
1. 标题吸引人但不夸大
2. 导语包含5W1H
3. 正文结构清晰
4. 引用来源
5. 不编造信息

输出新闻稿:"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def write_multi_format(self, article: str, formats: list) -> dict:
        """多格式改编"""
        results = {}
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        format_guides = {
            "web": "网站版：完整文章+配图建议",
            "app": "App推送：标题+摘要（100字）",
            "weibo": "微博：140字内+话题标签",
            "wechat": "公众号：标题+摘要+正文",
            "video_script": "视频脚本：旁白+画面描述",
        }

        for fmt in formats:
            guide = format_guides.get(fmt, format_guides["web"])
            response = await llm.ainvoke(f"将以下新闻改编为{guide}。\n\n原文:\n{article[:2000]}")
            results[fmt] = response.content

        return results
```

---

## 4. 事实核查

```python
@dataclass
class FactChecker:
    """事实核查器"""

    async def check(self, article: str) -> dict:
        """核查新闻事实"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""事实核查。

新闻内容:
{article[:3000]}

检查:
1. 提取所有可验证的事实声明
2. 评估每个声明的可信度
3. 标记需要进一步核实的内容

输出 JSON:
{{
    "claims": [
        {{
            "claim": "事实声明",
            "verifiability": "可验证/需核实/无法验证",
            "confidence": 0.8,
            "potential_issues": ["潜在问题"],
            "verification_needed": ["需要查证的信息"]
        }}
    ],
    "overall_credibility": "高/中/低",
    "red_flags": ["风险标记"],
    "recommendation": "可发布/需修改/需核实"
}}""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了多源信息采集 | ☐ |
| 实现了新闻写作（4 风格） | ☐ |
| 实现了多格式改编 | ☐ |
| 实现了事实核查 | ☐ |
| 有审校流程 | ☐ |
| 有多渠道发布 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 28 | 智能舆情监控 Agent | 舆情 |
| 521 | Agent 内容创作 | 创作 |
| 520 | Agent 搜索增强 | 搜索 |
| 519 | Agent 多语言翻译 | 翻译 |
| 537 | Agent 旅游规划 | 旅游 |
