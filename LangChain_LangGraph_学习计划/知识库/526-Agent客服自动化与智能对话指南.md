# Agent 客服自动化与智能对话指南

> 客服是 Agent 落地最广泛的场景——但"转人工"什么时候转、FAQ 如何自动回答、工单如何自动创建、情绪如何识别？本指南系统讲解客服 Agent 全流程：意图分类→自动回答→情绪检测→工单创建→人工转接→满意度追踪。

---

## 1. 客服 Agent 全流程

### 工作流

```mermaid
graph TB
    USER["用户消息"] --> INTENT["意图识别"]
    INTENT --> FAQ{"是FAQ?"}
    FAQ -->|"是"| ANSWER["知识库回答"]
    FAQ -->|"否"| COMPLEX["需要Agent处理"]
    COMPLEX --> EMOTION["情绪检测"]
    EMOTION --> ANGRY{"愤怒?"}
    ANGRY -->|"是"| HUMAN["立即转人工"]
    ANGRY -->|"否"| SOLVE["尝试解决"]
    SOLVE --> SOLVED{"解决?"}
    SOLVED -->|"是"| SATISFY["满意度调查"]
    SOLVED -->|"否"| TICKET["创建工单"]
    TICKET --> HUMAN
    ANSWER --> SATISFY

    style INTENT fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style EMOTION fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style HUMAN fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style SATISFY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 意图识别

```python
@dataclass
class IntentClassifier:
    """意图识别器"""

    intents = {
        "faq": "常见问题（退货/价格/物流）",
        "complaint": "投诉（不满/问题）",
        "inquiry": "咨询（产品/服务）",
        "transaction": "交易（下单/支付/退款）",
        "account": "账户（注册/密码/绑定）",
        "chitchat": "闲聊",
    }

    async def classify(self, message: str, history: list = None) -> dict:
        """分类意图"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""分类用户消息的意图。

消息: {message}
对话历史: {json.dumps(history[-3:], ensure_ascii=False) if history else '无'}

可选意图: {json.dumps(self.intents, ensure_ascii=False)}

输出 JSON:
{{
    "intent": "意图",
    "confidence": 0.95,
    "entities": {{"product": "...", "order_id": "..."}},
    "urgency": "low/medium/high"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 3. 情绪检测

```python
@dataclass
class EmotionDetector:
    """情绪检测器"""

    async def detect(self, message: str) -> dict:
        """检测用户情绪"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        prompt = f"""检测用户情绪。

消息: {message}

输出 JSON:
{{
    "emotion": "happy/neutral/frustrated/angry/sad",
    "intensity": 1-5,
    "action": "normal/comfort/escalate",
    "suggested_tone": "友好/道歉/正式"
}}

注意：愤怒(intensity>=4)需立即转人工。"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    async def should_escalate(self, emotion: dict, context: dict) -> bool:
        """判断是否需要转人工"""
        if emotion.get("emotion") == "angry" and emotion.get("intensity", 0) >= 4:
            return True
        if context.get("retry_count", 0) >= 3:
            return True
        if context.get("user_explicitly_asked_human"):
            return True
        return False
```

---

## 4. FAQ 自动回答

```python
@dataclass
class FAQResponder:
    """FAQ 自动回答器"""

    async def answer(self, question: str, kb_results: list) -> str:
        """基于知识库回答"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        context = "\n\n".join([doc.page_content[:500] for doc in kb_results[:3]])

        prompt = f"""你是客服助手。根据知识库回答用户问题。

知识库:
{context}

用户问题: {question}

要求:
1. 只基于知识库内容回答
2. 语气友好
3. 如果知识库没有相关信息，说明并建议联系人工客服
4. 给出具体的操作步骤

回答:"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 5. 工单创建

```python
@dataclass
class TicketCreator:
    """工单创建器"""

    async def create(self, user_id: str, issue: str, context: dict) -> dict:
        """自动创建工单"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        # 生成工单标题和描述
        response = await llm.ainvoke(f"""生成工单摘要。

用户问题: {issue}
对话历史: {json.dumps(context.get('history', []), ensure_ascii=False)[:1000]}

输出 JSON:
{{
    "title": "工单标题(20字内)",
    "description": "问题描述",
    "category": "退款/物流/产品/账户/其他",
    "priority": "P1/P2/P3",
    "suggested_department": "建议处理部门"
}}""")

        ticket = json.loads(response.content)
        ticket["ticket_id"] = f"TKT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        ticket["user_id"] = user_id
        ticket["status"] = "open"
        ticket["created_at"] = datetime.utcnow().isoformat()

        return ticket
```

---

## 6. 人工转接

```python
@dataclass
class HumanHandoff:
    """人工转接"""

    async def handoff(self, context: dict, reason: str) -> dict:
        """转接人工"""
        # 生成转接摘要
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(f"""生成转接摘要。

对话历史: {json.dumps(context.get('history', []), ensure_ascii=False)[:2000]}
转接原因: {reason}

输出 JSON:
{{
    "summary": "对话摘要(100字内)",
    "customer_issue": "客户问题",
    "attempted_solutions": ["已尝试的解决方案"],
    "customer_emotion": "客户情绪",
    "priority": "urgent/normal"
}}""")

        handoff_info = json.loads(response.content)
        handoff_info["reason"] = reason
        handoff_info["timestamp"] = datetime.utcnow().isoformat()

        return handoff_info
```

---

## 7. 满意度追踪

```python
@dataclass
class SatisfactionTracker:
    """满意度追踪"""

    async def survey(self, conversation_id: str) -> str:
        """满意度调查"""
        return "感谢使用！请评价本次服务（1-5星）：👍 1 2 3 4 5 ⭐"

    async def record(self, conversation_id: str, rating: int, feedback: str = ""):
        """记录满意度"""
        await db.satisfaction.insert({
            "conversation_id": conversation_id,
            "rating": rating,
            "feedback": feedback,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def report(self, days: int = 30) -> dict:
        """满意度报告"""
        records = await db.satisfaction.find({}).to_list(100)
        avg = sum(r["rating"] for r in records) / max(len(records), 1)
        return {
            "avg_rating": f"{avg:.1f}/5",
            "total_surveys": len(records),
            "satisfaction_rate": f"{sum(1 for r in records if r['rating'] >= 4) / max(len(records), 1) * 100:.0f}%",
        }
```

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了意图识别 | ☐ |
| 实现了情绪检测 | ☐ |
| 实现了 FAQ 自动回答 | ☐ |
| 实现了工单自动创建 | ☐ |
| 实现了人工转接（带摘要） | ☐ |
| 实现了满意度追踪 | ☐ |
| 有转人工触发规则 | ☐ |
| 有满意度报告 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 01 | 智能客服机器人 | 客服 |
| 13 | 客服系统进阶实战 | 进阶 |
| 32 | 对话系统设计模式 | 对话 |
| 136 | 多轮对话状态跟踪 | 状态 |
| 458 | 人机协作 HITL | 转人工 |
| 486 | Agent 踩坑实录 | 踩坑 |
| 496 | Agent 经验沉淀 | 经验 |
| 512 | 对话状态机与槽位填充 | 状态机 |
| 522 | 教育应用 | 教育 |
