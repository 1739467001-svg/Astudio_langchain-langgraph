# Agent 自然语言交互与对话体验设计指南

> Agent 不只是回答问题——它需要设计完整的对话体验：开场白、追问引导、错误恢复、满意度收尾。本指南深度讲解对话设计原则、交互模式、体验度量、以及 NLU 优化。

---

## 1. 对话体验设计原则

### 五大原则

```mermaid
graph TB
    DESIGN["对话体验设计"]

    DESIGN --> P1["简洁性<br/>不啰嗦，给用户想要的"]
    DESIGN --> P2["主动性<br/>预判需求，提前追问"]
    DESIGN --> P3["容错性<br/>理解错误时优雅恢复"]
    DESIGN --> P4["一致性<br/>人格/语气/风格统一"]
    DESIGN --> P5["可中断性<br/>用户随时能打断/切换"]

    style DESIGN fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style P3 fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 对话状态设计

```python
@dataclass
class ConversationExperience:
    """对话体验管理器"""

    async def design_response(self, query: str, context: dict,
                              conversation_state: str) -> dict:
        """设计回复（不只是回答，还有交互引导）"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        prompts = &#123;
            "opening": "这是对话开始。请友好开场，介绍能力，引导用户。",
            "answering": "正常回答问题。简洁准确。结束后问'还有其他问题吗？'",
            "clarifying": "用户意图不明确。请提供选项让用户选择，而不是开放式追问。",
            "error_recovery": "之前理解有误。请道歉并重新确认用户需求。",
            "closing": "对话即将结束。请总结要点，提供后续帮助途径。",
        &#125;

        prompt = prompts.get(conversation_state, prompts["answering"])

        response = await llm.ainvoke(f"""&#123;prompt&#125;

用户消息: &#123;query&#125;
对话历史: &#123;json.dumps(context.get('history', [])[-3:], ensure_ascii=False)&#125;

要求:
1. 回答简洁（不超过 200 字）
2. 语气友好但专业
3. 包含下一步引导
4. 如果不确定，说明并提供选项

回答:""")

        return &#123;
            "response": response.content,
            "state": conversation_state,
            "next_action": self._suggest_next(conversation_state),
        &#125;

    def _suggest_next(self, state: str) -> str:
        next_actions = &#123;
            "opening": "等待用户提问",
            "answering": "等待用户继续或结束",
            "clarifying": "等待用户选择",
            "error_recovery": "等待用户重新描述",
            "closing": "结束对话",
        &#125;
        return next_actions.get(state, "继续对话")

    async def detect_intent(self, message: str) -> dict:
        """意图检测"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""检测用户意图。

消息: &#123;message&#125;

输出 JSON:
&#123;&#123;
    "intent": "提问/指令/闲聊/投诉/确认/否认/求助/结束",
    "confidence": 0.9,
    "entities": &#123;&#123;"product": "...", "order_id": "..."&#125;&#125;,
    "sentiment": "positive/neutral/negative",
    "urgency": "low/medium/high"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 3. 体验度量

```python
@dataclass
class ConversationMetrics:
    """对话体验度量"""

    async def measure(self, conversation: list) -> dict:
        """度量对话质量"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""评估对话质量。

对话记录:
&#123;json.dumps(conversation, ensure_ascii=False)[:2000]&#125;

评估维度 (1-5分):
1. 相关性: 回答是否切题
2. 准确性: 信息是否正确
3. 简洁性: 是否简洁不啰嗦
4. 友好性: 语气是否友好
5. 引导性: 是否引导下一步
6. 完整性: 是否完整解决用户需求

输出 JSON:
&#123;&#123;
    "scores": &#123;&#123;"relevance": 5, "accuracy": 4, "conciseness": 3, "friendliness": 5, "guidance": 4, "completeness": 4&#125;&#125;,
    "overall": 4.2,
    "highlights": ["亮点"],
    "improvements": ["改进建议"],
    "user_satisfaction_estimate": "满意/一般/不满意"
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 4. 对话模式库

| 场景 | 模式 | 示例 |
|------|------|------|
| 开场 | 友好+能力介绍 | "你好！我是 AI 助手，可以帮你..." |
| 追问 | 选项式而非开放式 | "你是想问 A 还是 B？" |
| 澄清 | 复述+确认 | "确认一下，你是说...对吗？" |
| 错误 | 道歉+重启 | "抱歉理解有误，请重新描述..." |
| 中断 | 确认+保存 | "好的先暂停，稍后可以继续..." |
| 收尾 | 总结+后续 | "总结一下：1...2... 有问题随时找我" |

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解五大设计原则 | ☐ |
| 实现了对话状态管理 | ☐ |
| 实现了意图检测 | ☐ |
| 实现了体验度量 | ☐ |
| 有对话模式库 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 32 | 对话系统设计模式 | 对话 |
| 147 | Agent 用户体验设计 | UX |
| 512 | 对话状态机 | 状态机 |
| 526 | 客服自动化 | 客服 |
| 540 | Agent 对话压缩 | 压缩 |
