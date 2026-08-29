# Agent 个性化与用户画像系统指南

> 同一个 Agent 对不同用户应该有不同的回答——技术用户看到代码示例、产品用户看到操作步骤、管理用户看到数据看板。个性化不是"你好 XXX"，而是根据用户画像动态调整回答策略、工具选择、交互风格。本指南系统讲解用户画像构建、画像驱动的 Prompt 动态组装、个性化推荐策略，以及 LangGraph 中的实现。

---

## 1. 用户画像维度

### 画像数据模型

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class UserProfile:
    """用户画像模型"""
    user_id: str

    # 基础信息
    name: str = ""
    role: str = ""                # developer / pm / designer / executive
    language: str = "zh"          # 首选语言
    timezone: str = "Asia/Shanghai"

    # 技术画像
    technical_level: str = "intermediate"  # beginner / intermediate / expert
    preferred_frameworks: list = field(default_factory=list)  # ["LangChain", "FastAPI"]
    code_language: str = "python"           # 首选编程语言

    # 偏好
    response_style: str = "detailed"  # concise / detailed / bullet_points
    detail_level: str = "medium"      # low / medium / high
    examples_needed: bool = True     # 是否需要代码示例
    use_emoji: bool = False          # 是否使用 emoji

    # 行为模式
    frequent_topics: list = field(default_factory=list)   # ["RAG", "Agent", "部署"]
    query_patterns: dict = field(default_factory=dict)    # {"how-to": 0.6, "why": 0.3}
    active_hours: dict = field(default_factory=dict)     # {"9-12": 0.4, "14-18": 0.5}

    # 历史交互
    total_interactions: int = 0
    avg_satisfaction: float = 0.0    # 用户反馈平均分
    last_interaction: str = ""

    # 动态标签
    tags: list = field(default_factory=list)  # ["power_user", "rag_enthusiast"]
```

### 画像维度详解

| 维度 | 字段 | 影响 |
|------|------|------|
| 技术水平 | technical_level | 决定解释深度 |
| 回答风格 | response_style | 决定输出格式 |
| 常见话题 | frequent_topics | 决定推荐方向 |
| 编程语言 | code_language | 决定代码示例语言 |
| 细节偏好 | detail_level | 决定内容长度 |
| 满意度 | avg_satisfaction | 决定是否需要调整策略 |

---

## 2. 画像构建

### 显式画像（用户填写）

```python
@dataclass
class ExplicitProfileBuilder:
    """显式画像构建器"""

    QUESTIONS = [
        {"key": "role", "question": "你的角色是？",
         "options": ["开发者", "产品经理", "设计师", "管理层", "其他"]},
        {"key": "technical_level", "question": "你的技术水平？",
         "options": ["入门", "中级", "专家"]},
        {"key": "response_style", "question": "偏好回答风格？",
         "options": ["简洁", "详细", "要点列表"]},
        {"key": "code_language", "question": "首选编程语言？",
         "options": ["Python", "JavaScript", "Java", "Go", "其他"]},
    ]

    async def onboarding(self, user_id: str) -> UserProfile:
        """用户注册时的画像采集"""
        # 在聊天界面中逐步提问
        profile = UserProfile(user_id=user_id)
        # 实际中通过对话收集
        return profile
```

### 隐式画像（行为推断）

```python
@dataclass
class ImplicitProfileBuilder:
    """隐式画像构建器：从交互历史推断"""

    async def build_from_history(self, user_id: str, interactions: list) -> dict:
        """从交互历史推断画像"""
        profile_updates = {}

        # 1. 推断技术水平
        profile_updates["technical_level"] = self._infer_tech_level(interactions)

        # 2. 推断常见话题
        profile_updates["frequent_topics"] = self._infer_topics(interactions)

        # 3. 推断查询模式
        profile_updates["query_patterns"] = self._infer_query_patterns(interactions)

        # 4. 推断活跃时间
        profile_updates["active_hours"] = self._infer_active_hours(interactions)

        # 5. 推断回答风格偏好
        profile_updates["response_style"] = self._infer_style_preference(interactions)

        return profile_updates

    def _infer_tech_level(self, interactions: list) -> str:
        """推断技术水平"""
        # 简单启发式：高级用户问的问题更复杂
        complex_keywords = ["架构", "性能", "并发", "分布式", "优化", "内核"]
        simple_keywords = ["怎么用", "入门", "教程", "是什么"]

        complex_count = sum(1 for i in interactions
                           if any(k in i.get("query", "") for k in complex_keywords))
        simple_count = sum(1 for i in interactions
                          if any(k in i.get("query", "") for k in simple_keywords))

        if complex_count > simple_count and complex_count > 3:
            return "expert"
        elif simple_count > complex_count:
            return "beginner"
        return "intermediate"

    def _infer_topics(self, interactions: list) -> list:
        """推断常见话题"""
        from collections import Counter
        topics = []
        keywords_map = {
            "RAG": ["rag", "检索", "向量", "embedding"],
            "Agent": ["agent", "工具", "react", "规划"],
            "部署": ["部署", "docker", "k8s", "生产"],
            "LangChain": ["langchain", "lcel", "chain"],
            "LangGraph": ["langgraph", "graph", "state"],
        }

        for interaction in interactions:
            query = interaction.get("query", "").lower()
            for topic, keywords in keywords_map.items():
                if any(k in query for k in keywords):
                    topics.append(topic)

        # 返回 Top-5 话题
        return [t for t, _ in Counter(topics).most_common(5)]

    def _infer_style_preference(self, interactions: list) -> str:
        """推断回答风格偏好"""
        # 分析用户反馈：对哪种风格回答评分高
        detailed_scores = []
        concise_scores = []

        for i in interactions:
            if i.get("response_length", 0) > 500 and i.get("rating", 0) > 3:
                detailed_scores.append(i["rating"])
            elif i.get("response_length", 0) < 200 and i.get("rating", 0) > 3:
                concise_scores.append(i["rating"])

        if detailed_scores and not concise_scores:
            return "detailed"
        elif concise_scores and not detailed_scores:
            return "concise"
        return "medium"
```

### 画像自动更新

```python
@dataclass
class ProfileUpdater:
    """画像自动更新器"""

    async def update_after_interaction(self, user_id: str, interaction: dict):
        """每次交互后更新画像"""
        profile = await self._load_profile(user_id)

        # 更新交互计数
        profile.total_interactions += 1
        profile.last_interaction = datetime.utcnow().isoformat()

        # 更新满意度
        if interaction.get("rating"):
            profile.avg_satisfaction = (
                profile.avg_satisfaction * 0.9 +
                interaction["rating"] * 0.1  # 指数移动平均
            )

        # 更新话题
        new_topics = self._extract_topics(interaction.get("query", ""))
        for topic in new_topics:
            if topic not in profile.frequent_topics:
                profile.frequent_topics.append(topic)
        # 保持 Top-10
        profile.frequent_topics = profile.frequent_topics[:10]

        # 每 10 次交互重新推断画像
        if profile.total_interactions % 10 == 0:
            interactions = await self._load_recent(user_id, limit=50)
            updates = await ImplicitProfileBuilder().build_from_history(user_id, interactions)
            for key, value in updates.items():
                setattr(profile, key, value)

        await self._save_profile(profile)
```

---

## 3. 画像驱动的 Prompt 动态组装

```python
@dataclass
class PersonalizedPromptBuilder:
    """个性化 Prompt 构建器"""

    async def build_system_prompt(self, profile: UserProfile) -> str:
        """根据用户画像构建 System Prompt"""
        parts = []

        # 基础角色
        parts.append("你是一个专业的 AI 助手。")

        # 技术水平适配
        tech_guides = {
            "beginner": "用户是初学者，请用通俗的语言解释，避免专业术语，提供详细步骤。",
            "intermediate": "用户有一定基础，可以使用专业术语，提供适当深度的解释。",
            "expert": "用户是专家，可以直接讨论技术细节，不需要过多解释基础概念。",
        }
        parts.append(tech_guides.get(profile.technical_level, tech_guides["intermediate"]))

        # 回答风格
        style_guides = {
            "concise": "回答要简洁，直接给结论，不要冗长的解释。",
            "detailed": "回答要详细，包含原理说明和背景信息。",
            "bullet_points": "回答用要点列表，清晰结构化。",
        }
        parts.append(style_guides.get(profile.response_style, ""))

        # 代码示例
        if profile.examples_needed:
            parts.append(f"请提供 {profile.code_language} 代码示例。")

        # 语言
        if profile.language == "zh":
            parts.append("请用中文回答。")

        # 已知兴趣
        if profile.frequent_topics:
            topics_str = "、".join(profile.frequent_topics[:3])
            parts.append(f"用户关注的话题包括：{topics_str}。可以适当关联这些话题。")

        return "\n".join(parts)

    async def build_with_context(self, profile: UserProfile,
                                  query: str, context: str = "") -> list:
        """构建完整的消息列表"""
        system_prompt = await self.build_system_prompt(profile)

        messages = [{"role": "system", "content": system_prompt}]

        if context:
            messages.append({"role": "system", "content": f"参考资料:\n{context}"})

        messages.append({"role": "user", "content": query})

        return messages
```

---

## 4. 个性化推荐

### 推荐策略

```python
@dataclass
class PersonalizationEngine:
    """个性化推荐引擎"""

    async def recommend_content(self, profile: UserProfile, query: str) -> dict:
        """基于用户画像推荐内容"""
        recommendations = {
            "related_topics": await self._related_topics(profile, query),
            "depth_level": self._recommended_depth(profile),
            "model_choice": self._recommend_model(profile, query),
            "tools_enabled": self._recommend_tools(profile),
        }
        return recommendations

    async def _related_topics(self, profile: UserProfile, query: str) -> list:
        """推荐相关话题"""
        # 基于用户常聊话题 + 当前查询
        related = []
        if "RAG" in query and "Agent" in profile.frequent_topics:
            related.append("Agentic RAG：结合 Agent 和 RAG 的高级模式")
        if "部署" in query and profile.technical_level == "expert":
            related.append("vLLM 生产部署优化")
        return related

    def _recommended_depth(self, profile: UserProfile) -> str:
        """推荐回答深度"""
        if profile.technical_level == "expert":
            return "deep"
        elif profile.total_interactions > 50:
            return "medium"
        return "shallow"

    def _recommend_model(self, profile: UserProfile, query: str) -> str:
        """推荐模型"""
        # VIP 用户用更好的模型
        if profile.avg_satisfaction < 3.0:
            return "gpt-4o"  # 满意度低，换更好的模型
        if profile.technical_level == "beginner":
            return "gpt-4o-mini"  # 简单问题用便宜模型
        return "gpt-4o"  # 默认

    def _recommend_tools(self, profile: UserProfile) -> list:
        """推荐工具集"""
        tools = ["search"]  # 基础搜索

        if profile.technical_level in ("intermediate", "expert"):
            tools.extend(["code_runner", "database_query"])

        if profile.role == "developer":
            tools.append("github_search")

        return tools
```

---

## 5. LangGraph 个性化 Agent

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class PersonalizedState(TypedDict):
    messages: list
    user_id: str
    profile: dict          # 用户画像
    recommendations: dict   # 个性化推荐
    model_used: str

# 全局组件
profile_store = {}  # 实际用 PostgresStore
prompt_builder = PersonalizedPromptBuilder()
engine = PersonalizationEngine()

async def load_profile_node(state: PersonalizedState):
    """加载用户画像"""
    user_id = state["user_id"]
    profile = profile_store.get(user_id)

    if not profile:
        profile = UserProfile(user_id=user_id)
        profile_store[user_id] = profile

    return {"profile": profile.__dict__}

async def recommend_node(state: PersonalizedState):
    """个性化推荐"""
    profile = UserProfile(**state["profile"])
    query = state["messages"][-1]["content"]

    recommendations = await engine.recommend_content(profile, query)

    return {
        "recommendations": recommendations,
        "model_used": recommendations["model_choice"],
    }

async def personalized_chat_node(state: PersonalizedState):
    """个性化对话"""
    profile = UserProfile(**state["profile"])
    query = state["messages"][-1]["content"]

    # 构建个性化 Prompt
    messages = await prompt_builder.build_with_context(profile, query)

    # 使用推荐的模型
    model_name = state.get("model_used", "gpt-4o-mini")
    llm = ChatOpenAI(model=model_name, temperature=0.7)

    response = await llm.ainvoke(messages)

    # 更新画像
    await ProfileUpdater().update_after_interaction(
        state["user_id"],
        {"query": query, "response": response.content, "rating": None}
    )

    return {"messages": state["messages"] + [
        {"role": "assistant", "content": response.content}
    ]}

# 构建个性化 Agent
graph = StateGraph(PersonalizedState)
graph.add_node("load_profile", load_profile_node)
graph.add_node("recommend", recommend_node)
graph.add_node("chat", personalized_chat_node)

graph.add_edge(START, "load_profile")
graph.add_edge("load_profile", "recommend")
graph.add_edge("recommend", "chat")
graph.add_edge("chat", END)

personalized_agent = graph.compile()
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解用户画像维度 | ☐ |
| 实现了显式画像采集 | ☐ |
| 实现了隐式画像推断 | ☐ |
| 实现了画像自动更新 | ☐ |
| 实现了画像驱动 Prompt 组装 | ☐ |
| 实现了个性化推荐策略 | ☐ |
| 在 LangGraph 中集成了个性化 | ☐ |
| 画像数据持久化 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 43 | 用户画像架构 | 画像基础 |
| 54 | 用户画像与个性化 | 个性化 |
| 60 | 用户画像与个性化 | 画像 |
| 147 | Agent 用户体验设计 | UX |
| 180 | RAG 查询路由与多路检索 | 个性化检索 |
| 222 | 用户画像图解 | 画像图解 |
| 254 | 用户画像与个性化 | 个性化 |
| 350 | Agent 记忆持久化 | 画像存储 |
| 446 | Agent 记忆架构与长期记忆 | 记忆=画像基础 |
