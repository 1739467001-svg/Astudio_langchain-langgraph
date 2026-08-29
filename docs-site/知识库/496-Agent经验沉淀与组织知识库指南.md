# Agent 经验沉淀与组织知识库指南

> Agent 每天处理上千次请求，遇到各种问题——有的解决得好、有的解决得差。这些经验如果不沉淀，下次还会犯同样的错。本指南系统讲解如何从 Agent 日常运行中提取经验、构建组织知识库、把经验反馈到改进中，形成"越用越聪明"的飞轮。

---

## 1. 经验沉淀飞轮

### 闭环模型

```mermaid
graph TB
    RUN["Agent 日常运行"] --> COLLECT["收集经验<br/>成功案例+失败案例"]
    COLLECT --> ANALYZE["分析归类<br/>问题模式+最佳实践"]
    ANALYZE --> STORE["沉淀到知识库<br/>经验条目"]
    STORE --> FEEDBACK["反馈到 Agent<br/>Few-shot/规则/工具改进"]
    FEEDBACK --> RUN

    style COLLECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style STORE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style FEEDBACK fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 经验类型

| 类型 | 来源 | 价值 | 反馈方式 |
|------|------|------|---------|
| 成功案例 | 用户高评分回答 | 正面模板 | 加入 Few-shot |
| 失败案例 | 用户低评分/投诉 | 负面教训 | 加入评估集 |
| 工具选择经验 | 工具调用正确/错误 | 选对/选错模式 | 优化工具描述 |
| 错误恢复经验 | 错误后成功恢复 | 恢复策略 | 加入 Runbook |
| 边界案例 | 极端/异常输入 | 鲁棒性提升 | 加入测试集 |
| 用户偏好 | 用户反馈 | 个性化 | 更新用户画像 |

---

## 2. 经验收集

### 自动收集

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class ExperienceCollector:
    """经验收集器"""

    async def collect_from_interaction(self, interaction: dict):
        """从单次交互中提取经验"""
        experience = &#123;
            "timestamp": interaction["timestamp"],
            "query": interaction["query"],
            "response": interaction["response"],
            "tools_used": interaction.get("tools_used", []),
            "user_rating": interaction.get("rating"),  # 1-5
            "user_feedback": interaction.get("feedback", ""),
            "model": interaction.get("model", ""),
            "latency_ms": interaction.get("latency_ms", 0),
            "tokens": interaction.get("tokens", 0),
            "session_id": interaction.get("session_id", ""),
        &#125;

        # 分类
        if experience["user_rating"] and experience["user_rating"] >= 4:
            experience["type"] = "success"
        elif experience["user_rating"] and experience["user_rating"] <= 2:
            experience["type"] = "failure"
        else:
            experience["type"] = "neutral"

        # 存入经验库
        await db.experiences.insert(experience)

        # 低分立即分析
        if experience["type"] == "failure":
            await self._analyze_failure(experience)

        return experience

    async def collect_from_error(self, error: dict):
        """从错误中提取经验"""
        experience = &#123;
            "timestamp": datetime.utcnow().isoformat(),
            "type": "error",
            "error_type": error["type"],
            "error_message": error["message"],
            "context": error.get("context", &#123;&#125;),
            "recovery_action": error.get("recovery", ""),
            "recovered": error.get("recovered", False),
        &#125;
        await db.experiences.insert(experience)

    async def collect_from_tool_usage(self, tool_record: dict):
        """从工具使用中提取经验"""
        experience = &#123;
            "timestamp": datetime.utcnow().isoformat(),
            "type": "tool_usage",
            "tool_name": tool_record["tool"],
            "query": tool_record.get("query", ""),
            "tool_input": tool_record.get("input", &#123;&#125;),
            "tool_output": str(tool_record.get("output", ""))[:500],
            "success": tool_record.get("success", True),
            "latency_ms": tool_record.get("latency_ms", 0),
        &#125;
        await db.experiences.insert(experience)

    async def _analyze_failure(self, experience: dict):
        """分析失败原因"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        analysis = await llm.ainvoke(
            f"""分析以下 Agent 交互失败的原因。

用户问题: &#123;experience['query']&#125;
Agent回答: &#123;experience['response'][:500]&#125;
用户评分: &#123;experience['user_rating']&#125;/5
用户反馈: &#123;experience['user_feedback']&#125;

分析：
1. 失败原因分类（理解错误/信息不足/工具选择错误/格式问题/幻觉/其他）
2. 具体问题描述
3. 改进建议
4. 是否可通过 Few-shot 改善

输出 JSON。"""
        )

        await db.experience_analysis.insert(&#123;
            "experience_id": experience.get("_id"),
            "analysis": analysis.content,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;)
```

---

## 3. 经验分析与归类

```python
@dataclass
class ExperienceAnalyzer:
    """经验分析与归类"""

    async def find_patterns(self, days: int = 30) -> dict:
        """发现经验模式"""
        # 获取最近的经验
        cutoff = datetime.utcnow() - timedelta(days=days)
        experiences = await db.experiences.find(&#123;
            "timestamp": &#123;"$gte": cutoff.isoformat()&#125;,
        &#125;).to_list(1000)

        # 按类型分组
        by_type = &#123;"success": [], "failure": [], "error": [], "tool_usage": []&#125;
        for exp in experiences:
            exp_type = exp.get("type", "neutral")
            if exp_type in by_type:
                by_type[exp_type].append(exp)

        # 分析失败模式
        failure_patterns = await self._analyze_failure_patterns(by_type["failure"])

        # 分析成功模式
        success_patterns = await self._analyze_success_patterns(by_type["success"])

        # 工具使用模式
        tool_patterns = await self._analyze_tool_patterns(by_type["tool_usage"])

        return &#123;
            "total_experiences": len(experiences),
            "by_type": &#123;k: len(v) for k, v in by_type.items()&#125;,
            "failure_patterns": failure_patterns,
            "success_patterns": success_patterns,
            "tool_patterns": tool_patterns,
            "recommendations": self._generate_recommendations(failure_patterns, success_patterns),
        &#125;

    async def _analyze_failure_patterns(self, failures: list) -> list:
        """分析失败模式"""
        if not failures:
            return []

        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        failure_text = "\n".join([
            f"- 问题: &#123;f['query'][:100]&#125;, 回答: &#123;f['response'][:100]&#125;, 评分: &#123;f.get('user_rating', '?')&#125;"
            for f in failures[:20]
        ])

        response = await llm.ainvoke(
            f"""分析以下失败案例，归类为 3-5 个失败模式。

失败案例:
&#123;failure_text&#125;

输出 JSON 数组，每个元素包含：
- pattern: 模式名称
- description: 描述
- count: 大致数量
- fix_suggestion: 修复建议"""
        )

        try:
            return json.loads(response.content)
        except:
            return [&#123;"pattern": "分析失败", "description": response.content[:200]&#125;]

    def _generate_recommendations(self, failures: list, successes: list) -> list:
        """生成改进建议"""
        recs = []

        for pattern in failures:
            if pattern.get("fix_suggestion"):
                recs.append(&#123;
                    "action": "fix_failure_pattern",
                    "pattern": pattern["pattern"],
                    "suggestion": pattern["fix_suggestion"],
                &#125;)

        if len(successes) > 10:
            recs.append(&#123;
                "action": "create_few_shot",
                "description": f"有 &#123;len(successes)&#125; 个成功案例，可精选加入 Few-shot",
            &#125;)

        return recs
```

---

## 4. 经验反馈到 Agent

```python
@dataclass
class ExperienceFeedback:
    """把经验反馈到 Agent 改进"""

    async def generate_few_shot_from_success(self, top_n: int = 5) -> list:
        """从成功案例生成 Few-shot 示例"""
        successes = await db.experiences.find(&#123;
            "type": "success",
            "user_rating": &#123;"$gte": 4&#125;,
        &#125;).sort("user_rating", -1).limit(50).to_list(50)

        # 用 LLM 精选最佳示例
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        candidates = "\n".join([
            f"[&#123;i+1&#125;] Q: &#123;s['query'][:100]&#125;\n    A: &#123;s['response'][:200]&#125;"
            for i, s in enumerate(successes)
        ])

        response = await llm.ainvoke(
            f"""从以下成功案例中选择 &#123;top_n&#125; 个最有代表性的作为 Few-shot 示例。
选择标准：1.问题常见 2.回答质量高 3.覆盖不同类型

&#123;candidates&#125;

输出选中的编号（逗号分隔）。"""
        )

        selected_indices = [int(i.strip()) - 1 for i in response.content.split(",") if i.strip().isdigit()]
        selected = [successes[i] for i in selected_indices if 0 <= i < len(successes)]

        # 格式化为 Few-shot
        few_shot_examples = []
        for s in selected:
            few_shot_examples.append(&#123;
                "input": s["query"],
                "output": s["response"],
                "source": "experience",
            &#125;)

        return few_shot_examples

    async def create_evaluation_set(self) -> list:
        """从经验创建评估集"""
        # 失败案例 → 负面测试
        failures = await db.experiences.find(&#123;"type": "failure"&#125;).limit(50).to_list(50)
        # 成功案例 → 正面测试
        successes = await db.experiences.find(&#123;"type": "success"&#125;).limit(50).to_list(50)

        eval_set = []

        for f in failures:
            eval_set.append(&#123;
                "query": f["query"],
                "expected_bad": f["response"],  # 不应该生成这种回答
                "user_rating": f.get("user_rating"),
                "category": "avoid_this_pattern",
            &#125;)

        for s in successes:
            eval_set.append(&#123;
                "query": s["query"],
                "expected_good": s["response"],
                "user_rating": s.get("user_rating"),
                "category": "follow_this_pattern",
            &#125;)

        return eval_set

    async def update_tool_descriptions(self):
        """根据工具使用经验优化工具描述"""
        # 找出经常选错的工具
        tool_stats = await db.experiences.aggregate([
            &#123;"$match": &#123;"type": "tool_usage"&#125;&#125;,
            &#123;"$group": &#123;
                "_id": "$tool_name",
                "total": &#123;"$sum": 1&#125;,
                "success": &#123;"$sum": &#123;"$cond": ["$success", 1, 0]&#125;&#125;,
            &#125;&#125;,
        ]).to_list(None)

        for stat in tool_stats:
            success_rate = stat["success"] / stat["total"]
            if success_rate < 0.7:
                # 该工具成功率低，优化描述
                print(f"⚠️ 工具 &#123;stat['_id']&#125; 成功率 &#123;success_rate:.1%&#125;，需要优化描述")
                # 进一步分析为什么失败
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了经验收集器 | ☐ |
| 能从交互/错误/工具使用收集 | ☐ |
| 实现了经验分析归类 | ☐ |
| 能发现失败模式 | ☐ |
| 能从成功案例生成 Few-shot | ☐ |
| 能创建评估集 | ☐ |
| 能优化工具描述 | ☐ |
| 形成了经验反馈飞轮 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 35 | 用户反馈闭环 | 反馈闭环 |
| 69 | 知识库冷启动 | 冷启动 |
| 97 | 知识沉淀与组织记忆 | 沉淀 |
| 153 | Agent 反馈学习 | 反馈学习 |
| 165 | 反馈闭环 | 闭环 |
| 180 | 知识管理 | 管理 |
| 197 | Agent 反馈闭环 | 闭环 |
| 212 | 知识沉淀 | 沉淀 |
| 341 | 反馈闭环 | 闭环 |
| 371 | Agent 用户反馈闭环 | 反馈 |
| 384 | 数据飞轮 | 飞轮 |
| 414 | 数据飞轮与持续学习 | 飞轮 |
| 446 | Agent 记忆架构 | 记忆 |
| 457 | LLMOps | 生命周期 |
