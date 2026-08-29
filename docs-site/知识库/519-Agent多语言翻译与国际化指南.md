# Agent 多语言翻译与国际化指南

> Agent 需要服务全球用户——中文、英文、日文、阿拉伯文。不仅是翻译文本，还涉及语言检测、文化适配、RTL 布局、术语一致性。本指南系统讲解多语言 Agent 架构、翻译质量控制、术语库管理、文化适配。

---

## 1. 多语言 Agent 架构

### 架构设计

```mermaid
graph TB
    INPUT["用户输入<br/>任意语言"] --> DETECT["语言检测"]
    DETECT --> ROUTE&#123;"语言路由"&#125;
    ROUTE -->|"中文"| ZH["中文处理<br/>中文Prompt+知识库"]
    ROUTE -->|"英文"| EN["英文处理<br/>英文Prompt+知识库"]
    ROUTE -->|"日文"| JA["日文处理<br/>日文Prompt+知识库"]
    ROUTE -->|"其他"| TRANSLATE["翻译到英文<br/>英文处理"]
    TRANSLATE --> BACK["翻译回原语言"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style TRANSLATE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
```

---

## 2. 语言检测与路由

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from dataclasses import dataclass

@dataclass
class LanguageDetector:
    """语言检测器"""

    async def detect(self, text: str) -> dict:
        """检测语言"""
        # 快速检测（基于字符）
        if any('\u4e00' <= c <= '\u9fff' for c in text):
            return &#123;"language": "zh", "confidence": 0.95&#125;
        if any('\u3040' <= c <= '\u309f' or '\u30a0' <= c <= '\u30ff' for c in text):
            return &#123;"language": "ja", "confidence": 0.95&#125;
        if any('\uac00' <= c <= '\ud7af' for c in text):
            return &#123;"language": "ko", "confidence": 0.95&#125;
        if any('\u0600' <= c <= '\u06ff' for c in text):
            return &#123;"language": "ar", "confidence": 0.95, "rtl": True&#125;

        # LLM 检测
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"检测以下文本的语言。只回答语言代码（zh/en/ja/ko/ar/fr/de/es/other）。\n&#123;text[:200]&#125;"
        )
        lang = response.content.strip().lower()

        return &#123;"language": lang if lang != "other" else "en", "confidence": 0.8&#125;

@dataclass
class LanguageRouter:
    """语言路由器"""

    language_configs = &#123;
        "zh": &#123;"prompt_lang": "中文", "kb_lang": "zh", "response_lang": "zh"&#125;,
        "en": &#123;"prompt_lang": "English", "kb_lang": "en", "response_lang": "en"&#125;,
        "ja": &#123;"prompt_lang": "日本語", "kb_lang": "ja", "response_lang": "ja"&#125;,
        "ko": &#123;"prompt_lang": "한국어", "kb_lang": "ko", "response_lang": "ko"&#125;,
        "ar": &#123;"prompt_lang": "العربية", "kb_lang": "ar", "response_lang": "ar", "rtl": True&#125;,
    &#125;

    def get_config(self, lang: str) -> dict:
        """获取语言配置"""
        return self.language_configs.get(lang, self.language_configs["en"])
```

---

## 3. 翻译引擎

```python
@dataclass
class TranslationEngine:
    """翻译引擎"""

    async def translate(self, text: str, source: str, target: str,
                        context: str = "", domain: str = "general") -> str:
        """翻译文本"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""翻译以下文本从 &#123;source&#125; 到 &#123;target&#125;。

领域: &#123;domain&#125;
上下文: &#123;context&#125;

原文: &#123;text&#125;

要求：
1. 保持原文含义
2. 适应目标语言的表达习惯
3. 专业术语保持一致
4. 不要添加解释

只输出翻译结果。"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def translate_with_glossary(self, text: str, source: str, target: str,
                                       glossary: dict) -> str:
        """带术语库翻译"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        glossary_text = "\n".join([f"- &#123;k&#125; → &#123;v&#125;" for k, v in glossary.items()])

        prompt = f"""翻译从 &#123;source&#125; 到 &#123;target&#125;。必须使用以下术语表：

术语表:
&#123;glossary_text&#125;

原文: &#123;text&#125;

只输出翻译结果。"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 4. 术语库管理

```python
@dataclass
class GlossaryManager:
    """术语库管理器"""

    glossaries: dict = None

    def __post_init__(self):
        self.glossaries = &#123;
            ("en", "zh"): &#123;
                "LangChain": "LangChain",  # 保留原文
                "Agent": "智能体",
                "RAG": "检索增强生成",
                "LLM": "大语言模型",
                "Prompt": "提示词",
                "Token": "Token",  # 保留
                "Embedding": "嵌入",
                "Vector Store": "向量库",
                "Fine-tuning": "微调",
                "Chain of Thought": "思维链",
            &#125;,
            ("en", "ja"): &#123;
                "LangChain": "LangChain",
                "Agent": "エージェント",
                "RAG": "検索拡張生成",
                "LLM": "大規模言語モデル",
            &#125;,
        &#125;

    def get_glossary(self, source: str, target: str) -> dict:
        """获取术语表"""
        return self.glossaries.get((source, target), &#123;&#125;)

    async def maintain_consistency(self, translations: list) -> dict:
        """检查翻译一致性"""
        # 检查同一术语是否被翻译成不同结果
        term_translations = &#123;&#125;
        inconsistencies = []

        for t in translations:
            for source_term, target_term in t.get("glossary_used", &#123;&#125;).items():
                if source_term not in term_translations:
                    term_translations[source_term] = set()
                term_translations[source_term].add(target_term)

        for term, translations_set in term_translations.items():
            if len(translations_set) > 1:
                inconsistencies.append(&#123;
                    "term": term,
                    "translations": list(translations_set),
                &#125;)

        return &#123;
            "total_terms": len(term_translations),
            "inconsistencies": inconsistencies,
            "consistency_rate": 1 - len(inconsistencies) / max(len(term_translations), 1),
        &#125;
```

---

## 5. 文化适配

```python
@dataclass
class CulturalAdapter:
    """文化适配器"""

    async def adapt(self, text: str, target_culture: str) -> str:
        """文化适配"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        cultural_guides = &#123;
            "zh": "中文文化：委婉表达、避免直接否定、重视面子",
            "ja": "日本文化：敬语使用、含蓄表达、注重礼仪",
            "ar": "阿拉伯文化：右到左书写、宗教敏感性、正式称谓",
            "en": "英语文化：直接表达、简洁明了",
        &#125;

        guide = cultural_guides.get(target_culture, cultural_guides["en"])

        prompt = f"""将以下文本适配到&#123;target_culture&#125;文化。

文化指南: &#123;guide&#125;

原文: &#123;text&#125;

适配要求：
1. 表达方式符合目标文化习惯
2. 示例和比喻使用目标文化熟悉的
3. 避免文化禁忌
4. 保持核心含义

输出适配后的文本。"""

        response = await llm.ainvoke(prompt)
        return response.content

    def get_layout_direction(self, lang: str) -> str:
        """获取布局方向"""
        rtl_languages = ["ar", "he", "fa", "ur"&#125;
        return "rtl" if lang in rtl_languages else "ltr"
```

---

## 6. 多语言知识库

```python
@dataclass
class MultiLanguageKnowledgeBase:
    """多语言知识库"""

    async def store_document(self, doc: str, lang: str, translations: dict = None):
        """存储文档（多语言版本）"""
        # 存储原文
        await vectorstore.add_texts(
            texts=[doc],
            metadatas=[&#123;"lang": lang, "type": "original"&#125;],
        )

        # 存储翻译版本
        if translations:
            for target_lang, translated in translations.items():
                await vectorstore.add_texts(
                    texts=[translated],
                    metadatas=[&#123;"lang": target_lang, "type": "translation", "original_lang": lang&#125;],
                )

    async def search(self, query: str, lang: str, top_k: int = 5) -> list:
        """搜索（按语言过滤）"""
        # 优先搜索目标语言
        results = await vectorstore.asimilarity_search(
            query, k=top_k, filter=&#123;"lang": lang&#125;
        )

        # 如果不够，搜索其他语言并翻译
        if len(results) < top_k:
            other_results = await vectorstore.asimilarity_search(
                query, k=top_k - len(results), filter=&#123;"lang": &#123;"$ne": lang&#125;&#125;
            )
            for r in other_results:
                source_lang = r.metadata.get("lang", "en")
                if source_lang != lang:
                    translated = await TranslationEngine().translate(
                        r.page_content, source_lang, lang
                    )
                    r.page_content = translated
                    r.metadata["translated_from"] = source_lang
            results.extend(other_results)

        return results
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了语言检测 | ☐ |
| 实现了语言路由 | ☐ |
| 实现了翻译引擎 | ☐ |
| 实现了术语库管理 | ☐ |
| 实现了文化适配 | ☐ |
| 实现了 RTL 布局支持 | ☐ |
| 实现了多语言知识库 | ☐ |
| 实现了翻译一致性检查 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 28 | 多语言与翻译 Agent | 多语言 |
| 38 | 多语言架构图解 | 架构 |
| 162 | 国际化与多语言部署 | 国际化 |
| 185 | Agent 多语言处理 | 多语言 |
| 217 | Agent 多语言处理 | 多语言 |
| 309 | 多语言处理 | 处理 |
| 484 | Agent 跨平台与多端部署 | 跨平台 |
