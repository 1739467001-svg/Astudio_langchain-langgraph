# Agent 心理咨询与心理健康服务指南

> 心理健康 Agent 不是替代心理咨询师——而是在日常场景中提供情绪支持、心理教育、早期筛查、危机干预。本指南系统讲解心理健康 Agent 架构、情绪支持对话、风险筛查、危机干预、以及严格的伦理边界。

---

## 1. 心理健康 Agent 架构

### 工作流

```mermaid
graph TB
    USER["用户对话"] --> EMOTION["情绪评估<br/>情绪状态/严重度"]
    EMOTION --> RISK&#123;"风险等级?"&#125;
    RISK -->|"低"| SUPPORT["情绪支持<br/>倾听/共情"]
    RISK -->|"中"| EDUCATE["心理教育<br/>认知行为技巧"]
    RISK -->|"高"| CRISIS["⚠️ 危机干预<br/>紧急资源"]
    RISK -->|"危急"| EMERGENCY["🚨 立即转介<br/>心理热线/120"]
    SUPPORT --> TRACK["情绪追踪<br/>趋势分析"]

    style EMOTION fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style CRISIS fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style EMERGENCY fill:#FFCCBC,stroke:#D84315,stroke-width=3px
```

### 伦理边界

```
心理健康 Agent 伦理边界：
1. 不做诊断：不给出精神疾病诊断
2. 不开处方：不推荐具体药物
3. 危机转介：自伤/伤人风险立即转人工
4. 知情同意：用户知道在与AI对话
5. 数据保护：心理健康数据特别敏感
6. 不替代专业：始终建议专业咨询
```

---

## 2. 情绪评估

```python
@dataclass
class EmotionAssessor:
    """情绪评估器"""

    async def assess(self, message: str, history: list = None) -> dict:
        """评估情绪状态"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""评估用户的心理状态。

用户消息: &#123;message&#125;
对话历史: &#123;json.dumps(history[-5:], ensure_ascii=False) if history else '无'&#125;

评估维度（PHQ-9/GAD-7 简化版）:
1. 情绪状态: 抑郁/焦虑/愤怒/平静/积极
2. 严重度: 0-10
3. 风险因素: 是否有自伤/伤人念头
4. 功能影响: 是否影响日常生活

输出 JSON:
&#123;&#123;
    "emotion": "...",
    "severity": 0-10,
    "risk_level": "low/medium/high/critical",
    "risk_factors": ["风险因素"],
    "protective_factors": ["保护因素"],
    "recommended_response": "support/educate/crisis/emergency"
&#125;&#125;"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    def check_crisis(self, message: str) -> bool:
        """检查危机关键词"""
        crisis_keywords = [
            "不想活", "自杀", "自伤", "自残", "结束生命",
            "活着没意义", "想死", "伤害自己", "跳楼", "吃药自杀",
        ]
        return any(kw in message for kw in crisis_keywords)
```

---

## 3. 情绪支持对话

```python
@dataclass
class EmotionalSupportAgent:
    """情绪支持对话"""

    async def support(self, message: str, user_state: dict) -> str:
        """提供情绪支持"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        prompt = f"""你是心理健康支持助手。

用户消息: &#123;message&#125;
用户状态: &#123;json.dumps(user_state, ensure_ascii=False)&#125;

对话原则（共情式倾听）:
1. 先共情："我理解你现在..."
2. 不评判：不要说"你不应该这样想"
3. 正常化："这些感受是合理的"
4. 赋能："你已经做了..."
5. 提供选择：不是命令，而是选项
6. 不做诊断：不贴标签
7. 始终提醒可获得专业帮助

如果用户提到自伤，立即提供心理援助热线。

回答:"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 4. 心理教育

```python
@dataclass
class PsychoeducationAgent:
    """心理教育"""

    async def educate(self, topic: str, user_context: dict = None) -> dict:
        """提供心理教育"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        topics = &#123;
            "anxiety": "焦虑管理：呼吸练习、认知重构、暴露疗法基础",
            "depression": "抑郁理解：行为激活、认知扭曲识别、日常结构化",
            "stress": "压力管理：时间管理、放松技巧、边界设定",
            "sleep": "睡眠卫生：睡眠环境、作息规律、刺激控制",
            "anger": "愤怒管理：情绪识别、暂停技巧、沟通方式",
        &#125;

        response = await llm.ainvoke(f"""提供心理教育。

主题: &#123;topic&#125;
用户情况: &#123;json.dumps(user_context or &#123;&#125;, ensure_ascii=False)&#125;

输出 JSON:
&#123;&#123;
    "understanding": "什么是&#123;topic&#125;（通俗解释）",
    "common_signs": ["常见表现"],
    "self_help_techniques": [
        &#123;&#123;"technique": "技巧名", "steps": ["步骤1", "步骤2"], "duration": "5分钟"&#125;&#125;
    ],
    "when_to_seek_help": "什么时候需要寻求专业帮助",
    "resources": ["推荐资源"]
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 5. 危机干预

```python
@dataclass
class CrisisIntervention:
    """危机干预"""

    emergency_resources = &#123;
        "national_hotline": "全国心理援助热线: 400-161-9995",
        "beijing_hotline": "北京心理危机研究热线: 010-82951332",
        "shanghai_hotline": "上海心理援助热线: 021-12320-5",
        "emergency": "紧急情况请拨打 120 或前往最近医院急诊",
    &#125;

    async def intervene(self, message: str, user_state: dict) -> dict:
        """危机干预"""
        # 立即提供热线
        response = &#123;
            "immediate_action": "您的安全和健康最重要。请现在拨打心理援助热线。",
            "hotlines": list(self.emergency_resources.values()),
            "message": "您此刻的感受是真实的，您不需要独自承受。专业人士可以帮助您。",
            "next_steps": [
                "1. 立即拨打热线电话",
                "2. 告知身边信任的人",
                "3. 如果有立即危险，拨打120",
            ],
            "follow_up": "稍后我们再一起讨论如何应对",
        &#125;

        # 如果有明确自伤计划，标记为紧急
        if any(kw in message for kw in ["计划", "已经准备好", "今天就要"]):
            response["level"] = "emergency"
            response["action"] = "立即联系紧急服务"
        else:
            response["level"] = "crisis"
            response["action"] = "提供热线+持续支持"

        return response
```

---

## 6. 情绪追踪

```python
@dataclass
class MoodTracker:
    """情绪追踪"""

    async def track(self, user_id: str, mood_score: int, note: str = "") -> dict:
        """记录情绪"""
        await db.mood_records.insert(&#123;
            "user_id": user_id,
            "mood_score": mood_score,  # 1-10
            "note": note,
            "timestamp": datetime.utcnow().isoformat(),
        &#125;)

    async def trend(self, user_id: str, days: int = 30) -> dict:
        """情绪趋势"""
        records = await db.mood_records.find(&#123;
            "user_id": user_id,
            "timestamp": &#123;"$gte": (datetime.utcnow() - timedelta(days=days)).isoformat()&#125;,
        &#125;).to_list(100)

        avg_mood = sum(r["mood_score"] for r in records) / max(len(records), 1)

        # 趋势
        if len(records) >= 7:
            recent = sum(r["mood_score"] for r in records[-7:]) / 7
            older = sum(r["mood_score"] for r in records[:7]) / 7
            trend = "改善" if recent > older + 0.5 else "下降" if recent < older - 0.5 else "稳定"
        else:
            trend = "数据不足"

        return &#123;
            "avg_mood": f"&#123;avg_mood:.1f&#125;/10",
            "trend": trend,
            "records": len(records),
            "concern": avg_mood < 4,
        &#125;
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解伦理边界（6 条） | ☐ |
| 实现了情绪评估（PHQ-9/GAD-7 简化） | ☐ |
| 实现了危机关键词检测 | ☐ |
| 实现了情绪支持对话（共情式） | ☐ |
| 实现了心理教育 | ☐ |
| 实现了危机干预（热线+转介） | ☐ |
| 实现了情绪追踪 | ☐ |
| 配置了紧急转介机制 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 38 | 智能心理健康 Agent | 心理 |
| 447 | AI 伦理与偏见检测 | 伦理 |
| 451 | LLM 应用合规 | 合规 |
| 458 | 人机协作 HITL | 转人工 |
| 501 | Agent 数据保护 | 隐私 |
| 522 | Agent 教育 | 教育 |
| 526 | Agent 客服 | 客服 |
