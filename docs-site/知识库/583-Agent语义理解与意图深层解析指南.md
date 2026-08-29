# Agent 语义理解与意图深层解析指南

> 用户说"帮我看看这个"——看什么？这个是什么？Agent 需要深层理解用户意图。本指南讲解语义解析、意图分类、槽位推断、隐含意图发现。

---

## 1. 意图解析层次

```mermaid
graph TB
    INPUT["用户输入"] --> L1["表层理解<br/>字面意思"]
    L1 --> L2["意图识别<br/>用户想做什么"]
    L2 --> L3["深层理解<br/>为什么/隐含需求"]
    L3 --> L4["上下文推理<br/>结合历史"]
    L4 --> OUTPUT["精准响应"]

    style L2 fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style L3 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style L4 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 深层意图解析

```python
@dataclass
class DeepIntentParser:
    """深层意图解析器"""

    async def parse(self, query: str, context: dict = None) -> dict:
        """多层意图解析"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""深层意图解析。

用户输入: &#123;query&#125;
对话历史: &#123;json.dumps(context.get('history', [])[-3:], ensure_ascii=False) if context else '无'&#125;

解析层次:
1. 表层: 字面意思是什么?
2. 意图: 用户想做什么? (查询/操作/咨询/比较/投诉)
3. 隐含: 用户没说但可能需要的? (如问价格可能还需要对比)
4. 情绪: 用户情绪状态?
5. 紧急度: 需要多快响应?

输出 JSON:
&#123;&#123;
    "surface_meaning": "字面意思",
    "primary_intent": "主要意图",
    "secondary_intents": ["次要意图"],
    "implicit_needs": ["隐含需求"],
    "emotion": "neutral/frustrated/curious/urgent",
    "urgency": "low/medium/high",
    "confidence": 0.85,
    "recommended_response_strategy": "回答策略建议",
    "missing_info": ["需要追问的信息"]
&#125;&#125;""")

        return json.loads(response.content)

    async def detect_ambiguous(self, query: str) -> dict:
        """检测歧义"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(f"判断查询是否有歧义。只回答 JSON: &#123;&#123;\"ambiguous\": true/false, \"possible_meanings\": [], \"clarification_needed\": \"需要澄清的问题\"&#125;&#125;\n&#123;query&#125;")
        return json.loads(response.content)
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解意图解析四层 | ☐ |
| 实现了深层意图解析 | ☐ |
| 实现了歧义检测 | ☐ |
| 有隐含需求发现 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 131 | 查询理解流程 | 查询 |
| 163 | 查询理解与意图识别 | 意图 |
| 512 | 对话状态机 | 状态机 |
| 571 | 对话体验设计 | 体验 |
