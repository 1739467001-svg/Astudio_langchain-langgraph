# Agent 多模态情感计算与共情能力指南

> Agent 不应只回答事实——它需要感知用户情绪、表达共情、调整语气。本指南讲解情感识别、情感生成、共情对话策略、以及应用场景。

---

## 1. 情感计算架构

```mermaid
graph TB
    INPUT["用户输入<br/>文字/语音/表情"] --> DETECT["情感识别"]
    DETECT --> ANALYZE["情感分析<br/>情绪+强度+原因"]
    ANALYZE --> STRATEGY["共情策略<br/>匹配回应方式"]
    STRATEGY --> GENERATE["情感化回应<br/>语气+内容+表情"]

    style DETECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style STRATEGY fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style GENERATE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 情感识别与共情

```python
@dataclass
class EmotionAwareAgent:
    """情感感知 Agent"""

    async def detect_emotion(self, text: str, voice_tone: dict = None) -> dict:
        """多模态情感识别"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""多模态情感分析。

文字: {text}
语音特征: {json.dumps(voice_tone or {}, ensure_ascii=False)}

输出 JSON:
{{
    "primary_emotion": "happy/sad/angry/fearful/surprised/neutral",
    "intensity": 0.8,
    "secondary_emotion": "frustrated",
    "likely_cause": "可能原因",
    "user_needs": "用户需要什么(安慰/解决/倾听/认可)"
}}""")

        return json.loads(response.content)

    async def empathic_response(self, query: str, emotion: dict) -> str:
        """共情式回应"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        strategy = {
            "sad": "先共情认可，再提供帮助，语气温柔",
            "angry": "先道歉认可，再解决问题，语气专业",
            "frustrated": "先理解挫败感，再提供方案",
            "happy": "一起开心，增强正面情绪",
            "neutral": "正常专业回答",
        }

        response_strategy = strategy.get(emotion.get("primary_emotion", "neutral"), strategy["neutral"])

        response = await llm.ainvoke(f"""共情式回应。

用户情绪: {emotion['primary_emotion']} (强度{emotion['intensity']})
用户需要: {emotion.get('user_needs', '帮助')}
回应策略: {response_strategy}

用户消息: {query}

要求: 先共情再帮助，语气匹配情绪。""")

        return response.content
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了情感识别 | ☐ |
| 实现了共情策略 | ☐ |
| 有情感化回应 | ☐ |
| 理解多模态情感 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 536 | 心理咨询 Agent | 心理 |
| 565 | 数字人虚拟助手 | 数字人 |
| 571 | 对话体验设计 | 体验 |
| 575 | 认知架构 | 认知 |
