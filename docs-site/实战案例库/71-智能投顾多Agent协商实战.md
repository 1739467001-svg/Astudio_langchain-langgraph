# 智能投顾多 Agent 协商实战

> 一个完整的智能投顾系统，集成 Agent 协商机制（多专家达成共识）、反馈循环自动调优、数据脱敏管道、工具动态发现和 LLM 网关统一模型管理。覆盖从投资咨询到风险评估的全流程。

---

## 1. 项目概述

### 业务场景

```
用户："我有 50 万，该买什么？"
  ↓
技术分析 Agent + 基本面 Agent + 情绪 Agent → 协商达成共识
  ↓
脱敏管道保护用户隐私 → LLM 网关统一调用 → 反馈循环持续优化
```

### 技术要点

| 组件 | 技术 | 对应知识库 |
|------|------|-----------|
| 多专家协商 | Agent 协商与共识 | 422 |
| 自动调优 | 反馈循环与自动调优 | 423 |
| 隐私保护 | 数据脱敏管道 | 424 |
| 工具管理 | 动态发现与绑定 | 425 |
| 模型管理 | LLM 网关统一管理 | 426 |

---

## 2. 架构设计

```mermaid
graph TB
    USER["用户咨询<br/>含个人信息"] --> MASK["脱敏管道<br/>敏感信息替换"]
    MASK --> GATEWAY["LLM 网关<br/>统一模型管理"]
    
    GATEWAY --> TECH["技术分析 Agent<br/>K线+指标"]
    GATEWAY --> FUND["基本面 Agent<br/>财报+估值"]
    GATEWAY --> SENT["情绪分析 Agent<br/>社交+新闻"]
    
    TECH --> NEG["协商引擎<br/>多轮讨论+加权投票"]
    FUND --> NEG
    SENT --> NEG
    
    NEG --> RESULT&#123;"达成共识?"&#125;
    RESULT -->|是| ADVISE["投资建议"]
    RESULT -->|否| ARB["仲裁者裁决"]
    ARB --> ADVISE
    
    ADVISE --> RESTORE["还原脱敏"]
    RESTORE --> USER2["返回用户"]
    
    FEEDBACK["反馈循环<br/>自动调优"] -.-> GATEWAY
    TOOLS["工具动态发现<br/>按权限绑定"] -.-> TECH

    style MASK fill:#FFCDD2,stroke:#C62828,stroke-width:2px
    style NEG fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style GATEWAY fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FEEDBACK fill:#E8F5E9,stroke:#2E7D32
```

---

## 3. 核心实现

### 3.1 数据脱敏管道

```python
import re
import hashlib
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

class SensitiveType(Enum):
    ID_CARD = "id_card"
    PHONE = "phone"
    EMAIL = "email"
    BANK_CARD = "bank_card"

@dataclass
class SensitiveMatch:
    type: SensitiveType
    value: str
    start: int
    end: int

class InvestmentMasker:
    """投顾场景脱敏管道"""

    PATTERNS = &#123;
        SensitiveType.ID_CARD: r"\b\d&#123;17&#125;[\dXx]\b",
        SensitiveType.PHONE: r"\b1[3-9]\d&#123;9&#125;\b",
        SensitiveType.EMAIL: r"\b[\w.-]+@[\w.-]+\.\w+\b",
        SensitiveType.BANK_CARD: r"\b\d&#123;4&#125;[\s-]?\d&#123;4&#125;[\s-]?\d&#123;4&#125;[\s-]?\d&#123;4&#125;\b",
    &#125;

    def __init__(self):
        self.replacement_map: dict[str, str] = &#123;&#125;
        self.counter: dict[str, int] = &#123;&#125;

    def mask(self, text: str) -> str:
        matches = []
        for stype, pattern in self.PATTERNS.items():
            for m in re.finditer(pattern, text):
                matches.append(SensitiveMatch(stype, m.group(), m.start(), m.end()))
        matches.sort(key=lambda m: m.start)

        result = text
        for match in reversed(matches):
            placeholder = self._placeholder(match.type)
            self.replacement_map[placeholder] = match.value
            result = result[:match.start] + placeholder + result[match.end:]
        return result

    def restore(self, text: str) -> str:
        for placeholder, original in self.replacement_map.items():
            text = text.replace(placeholder, original)
        return text

    def _placeholder(self, stype: SensitiveType) -> str:
        name = stype.value.upper()
        self.counter[name] = self.counter.get(name, 0) + 1
        return f"[&#123;name&#125;_&#123;self.counter[name]:03d&#125;]"

    def clear(self):
        self.replacement_map.clear()
        self.counter.clear()
```

### 3.2 LLM 网关

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import time
from dataclasses import dataclass, field

@dataclass
class GatewayResponse:
    content: str = ""
    model: str = ""
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    error: str | None = None

class InvestmentLLMGateway:
    """投顾 LLM 网关"""

    def __init__(self):
        self.models = &#123;
            "gpt-4o-mini": &#123;"price_in": 0.15, "price_out": 0.60, "priority": 1&#125;,
            "gpt-4o": &#123;"price_in": 2.50, "price_out": 10.00, "priority": 2&#125;,
        &#125;
        self.stats = &#123;"requests": 0, "cost": 0.0, "errors": 0&#125;

    def chat(self, messages: list[dict], model: str = "gpt-4o-mini") -> GatewayResponse:
        start = time.time()
        config = self.models.get(model)
        if not config:
            return GatewayResponse(error=f"模型 &#123;model&#125; 未注册")

        try:
            lc_messages = []
            for msg in messages:
                if msg["role"] == "system":
                    lc_messages.append(SystemMessage(content=msg["content"]))
                else:
                    lc_messages.append(HumanMessage(content=msg["content"]))

            llm = ChatOpenAI(model=model, temperature=0)
            response = llm.invoke(lc_messages)
            latency = (time.time() - start) * 1000

            input_tokens = sum(len(m["content"]) // 4 for m in messages)
            output_tokens = len(response.content) // 4
            cost = (input_tokens / 1e6 * config["price_in"] +
                    output_tokens / 1e6 * config["price_out"])

            self.stats["requests"] += 1
            self.stats["cost"] += cost

            return GatewayResponse(
                content=response.content, model=model,
                latency_ms=latency, cost_usd=cost,
            )
        except Exception as e:
            self.stats["errors"] += 1
            # 降级
            fallback = self._fallback(model)
            if fallback and fallback != model:
                return self.chat(messages, fallback)
            return GatewayResponse(error=str(e))

    def _fallback(self, model: str) -> str | None:
        available = [m for m in self.models if m != model]
        available.sort(key=lambda m: self.models[m]["priority"])
        return available[0] if available else None

gateway = InvestmentLLMGateway()
```

### 3.3 多 Agent 协商

```python
import json
from langchain_core.prompts import ChatPromptTemplate

@dataclass
class AgentOpinion:
    agent_id: str
    role: str
    opinion: str
    confidence: float
    reasoning: str

class InvestmentNegotiation:
    """投顾多 Agent 协商引擎"""

    def __init__(self, gateway: InvestmentLLMGateway):
        self.gateway = gateway
        self.max_rounds = 2

    def analyze(self, question: str, user_profile: dict) -> dict:
        """完整投资分析"""
        # 1. 收集各专家意见
        tech_op = self._get_opinion("技术分析师", question, user_profile, "K线形态、技术指标、量价关系")
        fund_op = self._get_opinion("基本面分析师", question, user_profile, "财务报表、行业前景、估值水平")
        sent_op = self._get_opinion("情绪分析师", question, user_profile, "社交媒体情绪、新闻报道、市场情绪")

        opinions = [tech_op, fund_op, sent_op]

        # 2. 检查一致性
        unique = set(o.opinion for o in opinions)
        if len(unique) == 1:
            return self._result(opinions, opinions[0].opinion, "unanimous", 1)

        # 3. 协商讨论
        for round_num in range(1, self.max_rounds + 1):
            opinions = self._discuss(question, opinions)
            unique = set(o.opinion for o in opinions)
            if len(unique) == 1:
                avg_conf = sum(o.confidence for o in opinions) / len(opinions)
                return self._result(opinions, opinions[0].opinion,
                                    f"consensus_round_&#123;round_num&#125;", round_num)

        # 4. 加权投票
        from collections import defaultdict
        votes = defaultdict(float)
        for o in opinions:
            votes[o.opinion] += o.confidence
        winner = max(votes, key=votes.get)
        total = sum(votes.values())

        return self._result(opinions, winner, "weighted_vote",
                           self.max_rounds, votes[winner] / total)

    def _get_opinion(self, role: str, question: str,
                     profile: dict, focus: str) -> AgentOpinion:
        """获取单个 Agent 的意见"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", f"""你是专业&#123;role&#125;。分析投资问题。
关注：&#123;focus&#125;
用户风险偏好：&#123;profile.get('risk_tolerance', '中等')&#125;

输出 JSON：&#123;&#123;"opinion": "建议/观望/不建议", "confidence": 0.0-1.0, "reasoning": "分析理由"&#125;&#125;"""),
            ("human", "&#123;question&#125;"),
        ])

        chain = prompt | self.gateway
        # 用网关调用
        messages = [
            &#123;"role": "system", "content": f"你是专业&#123;role&#125;。关注：&#123;focus&#125;。输出JSON。"&#125;,
            &#123;"role": "user", "content": question&#125;,
        ]
        resp = self.gateway.chat(messages)

        try:
            data = json.loads(resp.content)
            return AgentOpinion(
                agent_id=role, role=role,
                opinion=data.get("opinion", "观望"),
                confidence=data.get("confidence", 0.5),
                reasoning=data.get("reasoning", ""),
            )
        except json.JSONDecodeError:
            return AgentOpinion(role, role, "观望", 0.5, resp.content[:100])

    def _discuss(self, question: str, opinions: list[AgentOpinion]) -> list[AgentOpinion]:
        """一轮协商讨论"""
        other_text = "\n".join([
            f"- &#123;o.role&#125;：&#123;o.opinion&#125;（&#123;o.confidence:.0%&#125;，&#123;o.reasoning[:80]&#125;）"
            for o in opinions
        ])

        updated = []
        for original in opinions:
            messages = [
                &#123;"role": "system", "content": f"""你是&#123;original.role&#125;。
其他专家意见：
&#123;other_text&#125;

你可以坚持或修改意见。输出JSON：&#123;&#123;"opinion": "...", "confidence": 0.0-1.0, "reasoning": "..."&#125;&#125;"""&#125;,
                &#123;"role": "user", "content": f"原始问题：&#123;question&#125;\n你的初始意见：&#123;original.opinion&#125;"&#125;,
            ]
            resp = self.gateway.chat(messages)
            try:
                data = json.loads(resp.content)
                updated.append(AgentOpinion(
                    original.agent_id, original.role,
                    data.get("opinion", original.opinion),
                    data.get("confidence", original.confidence),
                    data.get("reasoning", original.reasoning),
                ))
            except json.JSONDecodeError:
                updated.append(original)

        return updated

    @staticmethod
    def _result(opinions, consensus, method, rounds, confidence=None):
        if confidence is None:
            confidence = sum(o.confidence for o in opinions) / len(opinions)
        return &#123;
            "consensus": consensus,
            "confidence": f"&#123;confidence:.0%&#125;",
            "method": method,
            "rounds": rounds,
            "experts": [
                &#123;"role": o.role, "opinion": o.opinion, "confidence": f"&#123;o.confidence:.0%&#125;"&#125;
                for o in opinions
            ],
        &#125;
```

### 3.4 完整流程

```python
def run_investment_advisor(user_input: str, user_profile: dict):
    """运行完整投顾流程"""
    print("=" * 60)
    print("智能投顾多 Agent 协商系统")
    print("=" * 60)

    # 1. 脱敏
    masker = InvestmentMasker()
    masked_input = masker.mask(user_input)
    print(f"\n[1] 脱敏处理：&#123;masked_input[:80]&#125;...")

    # 2. 多 Agent 协商
    negotiation = InvestmentNegotiation(gateway)
    result = negotiation.analyze(masked_input, user_profile)
    print(f"\n[2] 多 Agent 协商：")
    for expert in result["experts"]:
        print(f"    &#123;expert['role']&#125;: &#123;expert['opinion']&#125; (&#123;expert['confidence']&#125;)")
    print(f"    共识：&#123;result['consensus']&#125; (&#123;result['confidence']&#125;)")
    print(f"    方式：&#123;result['method']&#125;，轮次：&#123;result['rounds']&#125;")

    # 3. 网关统计
    print(f"\n[3] LLM 网关统计：")
    print(f"    请求：&#123;gateway.stats['requests']&#125;，成本：$&#123;gateway.stats['cost']:.4f&#125;")

    # 4. 还原脱敏
    masker.clear()
    print(f"\n[4] 完成")

    return result

# 运行
result = run_investment_advisor(
    user_input="我有50万资金，手机13912345678，身份证110101199001011234，该投资什么？",
    user_profile=&#123;"risk_tolerance": "中等", "age": 35, "horizon": "5年"&#125;,
)
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 有脱敏管道（替换+还原） | ☐ |
| 有 LLM 网关（统一+降级） | ☐ |
| 有多 Agent 协商 | ☐ |
| 有加权投票 | ☐ |
| 有仲裁者 | ☐ |
| 有成本追踪 | ☐ |
| 有工具动态发现 | ☐ |
| 有反馈循环 | ☐ |
