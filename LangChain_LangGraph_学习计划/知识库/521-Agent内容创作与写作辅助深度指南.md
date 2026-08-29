# Agent 内容创作与写作辅助深度指南

> Agent 不仅是问答工具——它能写文章、写邮件、写营销文案、写技术博客。但"AI 写的东西一眼就能看出来"——模板化、缺乏个性、套话连篇。本指南深度讲解如何让 Agent 创作高质量内容：风格控制、结构规划、多轮打磨、原创性保障。

---

## 1. 创作型 Agent 架构

### 创作流程

```mermaid
graph TB
    TOPIC["创作主题"] --> PLAN["大纲规划<br/>结构+要点"]
    PLAN --> DRAFT["逐段起草<br/>分段生成"]
    DRAFT --> POLISH["润色打磨<br/>风格/流畅度"]
    POLISH --> CHECK["原创性检查<br/>查重/套话检测"]
    CHECK --> REVISE{"需要修改?"}
    REVISE -->|"是"| DRAFT
    REVISE -->|"否"| OUTPUT["输出成品"]

    style PLAN fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style POLISH fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 风格控制

```python
from langchain_openai import ChatOpenAI
from dataclasses import dataclass

@dataclass
class StyleController:
    """风格控制器"""

    styles = {
        "professional": {
            "description": "专业正式",
            "rules": "使用专业术语，避免口语化表达，语气客观，结构清晰",
            "example_tone": "研究表明，该方案在效率上提升了35%",
        },
        "casual": {
            "description": "轻松口语",
            "rules": "使用口语化表达，可以加emoji，语气亲切，像朋友聊天",
            "example_tone": "说真的，这个方案绝了，效率直接飙了35%🚀",
        },
        "technical": {
            "description": "技术深度",
            "rules": "多用技术术语，包含代码示例，注重准确性和细节",
            "example_tone": "实现方案采用了 PagedAttention 机制，throughput 提升至 3500 tok/s",
        },
        "storytelling": {
            "description": "叙事风格",
            "rules": "用故事开头，设置悬念，有起承转合，读者有代入感",
            "example_tone": "那是一个深夜，服务器突然告警...",
        },
    }

    def get_style_prompt(self, style: str) -> str:
        """获取风格 Prompt"""
        s = self.styles.get(style, self.styles["professional"])
        return f"""写作风格：{s['description']}
风格规则：{s['rules']}
参考语调：{s['example_tone']}"""

    async def detect_user_style(self, sample_text: str) -> str:
        """从用户已有文本推断风格"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"判断以下文本的写作风格。只回答: professional/casual/technical/storytelling。\n{sample_text[:500]}"
        )
        return response.content.strip().lower()
```

---

## 3. 大纲规划

```python
@dataclass
class OutlinePlanner:
    """大纲规划器"""

    async def plan(self, topic: str, content_type: str = "article",
                   target_length: int = 2000) -> dict:
        """规划文章大纲"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""为以下主题规划文章大纲。

主题: {topic}
类型: {content_type}（article/blog/email/report）
目标字数: {target_length}

输出 JSON:
{{
    "title": "文章标题",
    "sections": [
        {{"heading": "章节标题", "points": ["要点1", "要点2"], "estimated_words": 300}},
    ]
}}"""

        response = await llm.ainvoke(prompt)
        try:
            return json.loads(response.content)
        except:
            return {"title": topic, "sections": [{"heading": topic, "points": [], "estimated_words": target_length}]}
```

---

## 4. 逐段起草

```python
@dataclass
class SectionDrafter:
    """逐段起草器"""

    async def draft_section(self, section: dict, style: str, context: str = "") -> str:
        """起草单个章节"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        style_prompt = StyleController().get_style_prompt(style)
        points = "\n".join([f"- {p}" for p in section.get("points", [])])

        prompt = f"""撰写文章章节。

{style_prompt}

章节标题: {section['heading']}
章节要点:
{points}

补充上下文: {context}
目标字数: {section.get('estimated_words', 300)}

要求：
1. 直接输出章节内容（不要重复标题）
2. 内容充实、有具体例子
3. 与上下文衔接自然
4. 避免空洞的套话"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def draft_full_article(self, outline: dict, style: str = "professional") -> str:
        """起草完整文章"""
        sections = outline.get("sections", [])
        full_content = f"# {outline.get('title', '')}\n\n"
        context = ""

        for i, section in enumerate(sections):
            draft = await self.draft_section(section, style, context)
            full_content += f"## {section['heading']}\n\n{draft}\n\n"
            context = draft[-200:]  # 上一段结尾作为下一段上下文

        return full_content
```

---

## 5. 润色打磨

```python
@dataclass
class ContentPolisher:
    """内容润色器"""

    async def polish(self, content: str, style: str = "professional") -> str:
        """润色文章"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""润色以下文章。

检查项：
1. 段落间过渡是否流畅
2. 是否有重复表述
3. 是否有空洞套话（如"众所周知"、"不言而喻"）
4. 句式是否多样
5. 用词是否精准

原文:
{content[:5000]}

输出润色后的全文。"""

        response = await llm.ainvoke(prompt)
        return response.content

    async def check_originality(self, content: str) -> dict:
        """原创性检查"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(
            f"""检查以下内容的原创性。

检查项：
1. 是否有常见 AI 套话模式（如"作为一个AI"、"总而言之"过多）
2. 是否有重复表述
3. 是否过于模板化
4. 是否有独特观点或表达

内容:
{content[:2000]}

输出 JSON:
{{
    "originality_score": 0-1,
    "ai_patterns": ["检测到的AI套话"],
    "repetitions": ["重复表述"],
    "suggestions": ["改进建议"]
}}"""
        )
        try:
            return json.loads(response.content)
        except:
            return {"originality_score": 0.8, "suggestions": []}
```

---

## 6. 创作场景实现

### 技术博客

```python
async def write_tech_blog(topic: str, code_examples: list = None) -> str:
    """写技术博客"""
    # 1. 规划
    outline = await OutlinePlanner().plan(topic, "blog", 3000)

    # 2. 起草
    draft = await SectionDrafter().draft_full_article(outline, "technical")

    # 3. 润色
    polished = await ContentPolisher().polish(draft, "technical")

    # 4. 原创性检查
    originality = await ContentPolisher().check_originality(polished)

    if originality.get("originality_score", 1) < 0.7:
        # 原创性不足，重新润色
        polished = await ContentPolisher().polish(polished, "technical")

    return polished
```

### 营销文案

```python
async def write_marketing_copy(product: str, audience: str, platform: str = "wechat") -> str:
    """写营销文案"""
    llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

    platform_guides = {
        "wechat": "微信公众号风格：有故事感、情感共鸣、引导关注",
        "weibo": "微博风格：简短有力、有话题感、限140字",
        "email": "邮件风格：有标题、有号召行动、有链接",
    }

    prompt = f"""写一段{platform}营销文案。

产品: {product}
目标受众: {audience}
平台风格: {platform_guides.get(platform, "")}

要求：
1. 吸引注意力
2. 突出产品价值
3. 有明确的行动号召
4. 避免过度夸张

只输出文案内容。"""

    response = await llm.ainvoke(prompt)
    return response.content
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了风格控制器（4 种风格） | ☐ |
| 实现了大纲规划 | ☐ |
| 实现了逐段起草 | ☐ |
| 实现了润色打磨 | ☐ |
| 实现了原创性检查 | ☐ |
| 实现了技术博客创作 | ☐ |
| 实现了营销文案创作 | ☐ |
| 能检测用户已有风格 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 09 | Prompt 工程实战 | Prompt |
| 12 | Prompt 工程模式 | 模式 |
| 21 | 高级 Prompt 技巧 | 技巧 |
| 70 | LLM 应用设计文档模板 | 文档 |
| 138 | Prompt 工程进阶 | 进阶 |
| 363 | 提示词模板库 | 模板 |
| 483 | Agent 内容生成与文档自动化 | 生成 |
| 519 | Agent 多语言翻译 | 翻译 |
