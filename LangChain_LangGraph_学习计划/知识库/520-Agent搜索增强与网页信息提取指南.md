# Agent 搜索增强与网页信息提取指南

> 用户问"最新的 LangChain 0.3 有什么变化"——Agent 需要联网搜索、打开网页、提取信息、总结回答。本指南系统讲解搜索增强 Agent 架构、网页爬取策略、内容提取、信息验证、搜索结果聚合。

---

## 1. 搜索增强 Agent 架构

### 工作流

```mermaid
graph TB
    QUERY["用户查询"] --> SEARCH["搜索引擎查询<br/>DuckDuckGo/Google"]
    SEARCH --> RANK["结果排序<br/>相关性+权威性"]
    RANK --> FETCH["网页内容获取<br/>并发抓取"]
    FETCH --> EXTRACT["信息提取<br/>正文/表格/链接"]
    EXTRACT --> VERIFY["信息验证<br/>交叉验证"]
    VERIFY --> SUMMARIZE["总结回答<br/>引用来源"]
    SUMMARIZE --> OUTPUT["输出回答+引用"]

    style SEARCH fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style EXTRACT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 搜索工具

```python
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
import httpx
import asyncio
from bs4 import BeautifulSoup
from dataclasses import dataclass

@tool
def web_search(query: str, max_results: int = 10) -> str:
    """搜索互联网，返回相关网页列表

    Args:
        query: 搜索关键词
        max_results: 最大返回结果数
    """
    search = DuckDuckGoSearchRun()
    result = search.invoke(query)

    return result

@dataclass
class SmartSearchAgent:
    """智能搜索 Agent"""

    async def search_and_summarize(self, query: str) -> dict:
        """搜索并总结"""
        # 1. 生成搜索查询变体
        queries = await self._generate_query_variants(query)

        # 2. 并行搜索
        results = await asyncio.gather(*[
            self._search(q) for q in queries
        ])

        # 3. 合并去重
        all_results = []
        seen_urls = set()
        for result_list in results:
            for item in result_list:
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    all_results.append(item)

        # 4. 排序（相关性+权威性）
        all_results = self._rank_results(all_results, query)

        # 5. 抓取 Top-5 网页内容
        top_results = all_results[:5]
        contents = await asyncio.gather(*[
            self._fetch_content(r["url"]) for r in top_results
        ])

        # 6. 提取关键信息
        extracted = []
        for result, content in zip(top_results, contents):
            if content:
                extracted.append({
                    "url": result["url"],
                    "title": result["title"],
                    "content": content[:2000],
                    "snippet": result.get("snippet", ""),
                })

        # 7. LLM 总结
        summary = await self._summarize(query, extracted)

        return {
            "query": query,
            "sources": [{"url": r["url"], "title": r["title"]} for r in top_results],
            "summary": summary,
            "raw_results": extracted,
        }

    async def _generate_query_variants(self, query: str) -> list:
        """生成搜索查询变体"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        response = await llm.ainvoke(
            f"为以下查询生成 2 个不同的搜索关键词变体。每行一个，不要编号。\n{query}"
        )
        variants = [v.strip() for v in response.content.split("\n") if v.strip()]
        return [query] + variants[:2]

    async def _search(self, query: str) -> list:
        """执行搜索"""
        # 实际中用搜索 API
        return [{"url": f"https://example.com/{i}", "title": f"结果{i}", "snippet": "片段"} for i in range(3)]

    def _rank_results(self, results: list, query: str) -> list:
        """排序结果"""
        # 权威网站加分
        authority_domains = ["github.com", "stackoverflow.com", "arxiv.org", "wikipedia.org"]
        for r in results:
            r["authority_score"] = 1.0
            for domain in authority_domains:
                if domain in r["url"]:
                    r["authority_score"] = 1.5
                    break
        return sorted(results, key=lambda x: -x["authority_score"])

    async def _fetch_content(self, url: str) -> str:
        """抓取网页内容"""
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                soup = BeautifulSoup(response.text, "html.parser")

                # 移除脚本和样式
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                # 提取正文
                text = soup.get_text(separator="\n", strip=True)
                return text[:5000]  # 限制长度
        except Exception as e:
            return ""

    async def _summarize(self, query: str, sources: list) -> str:
        """LLM 总结"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        source_text = "\n\n".join([
            f"[来源{i+1}] {s['title']}\nURL: {s['url']}\n内容: {s['content'][:500]}"
            for i, s in enumerate(sources)
        ])

        prompt = f"""基于以下搜索结果回答用户问题。

问题: {query}

搜索结果:
{source_text}

要求：
1. 综合多个来源的信息
2. 在回答中标注来源 [1] [2] 等
3. 如果信息矛盾，指出差异
4. 用中文回答

回答："""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 3. 内容提取

```python
@dataclass
class ContentExtractor:
    """网页内容提取器"""

    async def extract_article(self, html: str) -> dict:
        """提取文章内容"""
        soup = BeautifulSoup(html, "html.parser")

        # 标题
        title = soup.find("title")
        title = title.text if title else ""

        # 正文（优先 article 标签）
        article = soup.find("article") or soup.find("main") or soup.find("div", class_="content")
        if article:
            content = article.get_text(separator="\n", strip=True)
        else:
            content = soup.get_text(separator="\n", strip=True)

        # 表格
        tables = []
        for table in soup.find_all("table"):
            rows = []
            for tr in table.find_all("tr"):
                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                rows.append(cells)
            tables.append(rows)

        # 链接
        links = []
        for a in soup.find_all("a", href=True):
            links.append({"text": a.get_text(strip=True), "url": a["href"]})

        # 代码块
        code_blocks = []
        for code in soup.find_all("pre"):
            code_blocks.append(code.get_text(strip=True))

        return {
            "title": title,
            "content": content[:5000],
            "tables": tables[:5],
            "links": links[:20],
            "code_blocks": code_blocks[:5],
        }

    async def extract_structured_data(self, html: str) -> dict:
        """提取结构化数据（JSON-LD/微数据）"""
        soup = BeautifulSoup(html, "html.parser")

        # JSON-LD
        json_ld = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                json_ld.append(data)
            except:
                pass

        # Open Graph
        og_data = {}
        for meta in soup.find_all("meta"):
            property_attr = meta.get("property", "")
            if property_attr.startswith("og:"):
                og_data[property_attr[3:]] = meta.get("content", "")

        return {"json_ld": json_ld, "open_graph": og_data}
```

---

## 4. 信息验证

```python
@dataclass
class InformationVerifier:
    """信息验证器"""

    async def verify_claim(self, claim: str, sources: list) -> dict:
        """验证声明是否被多个来源支持"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        supporting = 0
        contradicting = 0

        for source in sources:
            response = await llm.ainvoke(
                f"判断以下来源是否支持这个声明。\n\n声明: {claim}\n来源: {source[:500]}\n\n只回答 SUPPORT 或 CONTRADICT 或 NEUTRAL。"
            )
            if "SUPPORT" in response.content.upper():
                supporting += 1
            elif "CONTRADICT" in response.content.upper():
                contradicting += 1

        return {
            "claim": claim,
            "supporting_sources": supporting,
            "contradicting_sources": contradicting,
            "neutral_sources": len(sources) - supporting - contradicting,
            "confidence": supporting / len(sources) if sources else 0,
            "verified": supporting >= 2 and contradicting == 0,
        }
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了搜索增强 Agent | ☐ |
| 实现了查询变体生成 | ☐ |
| 实现了并发网页抓取 | ☐ |
| 实现了内容提取（正文/表格/链接/代码） | ☐ |
| 实现了结构化数据提取 | ☐ |
| 实现了搜索结果排序 | ☐ |
| 实现了信息交叉验证 | ☐ |
| 实现了引用来源标注 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 工具调用全链路 | 工具 |
| 49 | Web 搜索与浏览 Agent | Web |
| 83 | Agent 工具链编排 | 编排 |
| 199 | Agent 工具集成大全 | 集成 |
| 432 | Computer Use 与浏览器自动化 | 浏览器 |
| 461 | 企业 Agent 集成 | 集成 |
| 494 | Agent 混合搜索与语义检索 | 混合搜索 |
| 514 | Agent 工具编排 | 工具编排 |
