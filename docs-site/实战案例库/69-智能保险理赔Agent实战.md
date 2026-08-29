# 智能保险理赔 Agent 实战

> 一个完整的保险理赔 Agent，集成多模态输入（事故照片+文字描述）、多 Agent 协作（查勘+定损+审核三 Agent 通信）、数据飞轮（用户反馈持续优化）、AB 测试（不同理赔模型对比）和工具缓存（事故记录缓存复用）。覆盖从报案到赔付的全流程。

---

## 1. 项目概述

### 业务场景

```
用户："我的车被追尾了，这是现场照片"
  ↓
Agent 接收图文 → 照查勘Agent分析事故 → 查定损Agent评估损失 → 
查审核Agent审核金额 → 生成理赔方案 → 用户确认
```

### 技术要点

| 组件 | 技术 | 对应知识库 |
|------|------|-----------|
| 事故照片分析 | 多模态 Agent（图像理解） | 412 |
| 三 Agent 协作 | Agent 通信协议 | 413 |
| 反馈优化 | 数据飞轮持续学习 | 414 |
| 模型对比 | AB 测试实验平台 | 415 |
| 事故记录复用 | Tool 缓存 | 416 |

---

## 2. 架构设计

```mermaid
graph TB
    USER["用户报案<br/>文字+照片"] --> MM["多模态输入处理<br/>模态识别+内容提取"]
    MM --> BUS["Agent 通信总线"]
    
    BUS --> SURVEY["查勘 Agent<br/>事故分析+责任判定"]
    SURVEY --> DAMAGE["定损 Agent<br/>损失评估+金额计算"]
    DAMAGE --> AUDIT["审核 Agent<br/>合规检查+金额审核"]
    
    AUDIT --> PLAN["理赔方案生成"]
    PLAN --> CONFIRM&#123;"用户确认?"&#125;
    CONFIRM -->|是| PAY["执行赔付+审计日志"]
    CONFIRM -->|否| ADJUST["调整方案"]
    ADJUST --> PLAN
    
    PAY --> FB["反馈收集<br/>满意度+修正"]
    FB --> FLYWHEEL["数据飞轮<br/>分析→改进→部署"]
    
    CACHE["工具缓存<br/>事故记录复用"] -.-> SURVEY
    CACHE -.-> DAMAGE
    AB["AB 测试<br/>模型对比"] -.-> DAMAGE

    style MM fill:#E3F2FD,stroke:#1565C0
    style BUS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style FB fill:#E8F5E9,stroke:#2E7D32
    style CACHE fill:#F3E5F5,stroke:#7B1FA2
    style AB fill:#FFCDD2,stroke:#C62828
```

---

## 3. 完整实现

### 3.1 多模态报案输入

```python
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
import base64
import json

class ClaimInputProcessor:
    """理赔报案输入处理器（多模态）"""

    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0)

    def process(
        self,
        text: str,
        images: list[str] | None = None,
    ) -> dict:
        """处理多模态报案输入

        Args:
            text: 用户文字描述
            images: 事故照片 Base64 编码列表
        """
        content_parts = [
            &#123;"type": "text", "text": f"""你是保险理赔专员。用户描述了事故情况，请分析并提取以下信息：

1. 事故类型（追尾/碰撞/刮擦/自然灾害/其他）
2. 事故地点
3. 事故时间
4. 车辆受损部位（如果有照片）
5. 是否有人员受伤
6. 初步责任判定建议

用户描述：&#123;text&#125;"""&#125;,
        ]

        # 添加照片
        if images:
            for i, img_b64 in enumerate(images[:5]):  # 最多 5 张
                content_parts.append(&#123;
                    "type": "image_url",
                    "image_url": &#123;
                        "url": f"data:image/jpeg;base64,&#123;img_b64&#125;",
                        "detail": "high",
                    &#125;,
                &#125;)
            content_parts.append(&#123;
                "type": "text",
                "text": "请仔细分析以上事故照片中的车辆受损情况。",
            &#125;)

        response = self.llm.invoke([
            SystemMessage(content="你是专业保险理赔分析师，擅长从照片和文字中提取事故信息。"),
            HumanMessage(content=content_parts),
        ])

        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return &#123;"raw_analysis": response.content&#125;
```

### 3.2 多 Agent 通信协作

```python
from dataclasses import dataclass, field
from enum import Enum
import uuid
import time
from typing import Any

class MsgType(Enum):
    TASK_REQUEST = "task_request"
    TASK_RESULT = "task_result"
    NOTIFICATION = "notification"

@dataclass
class AgentMsg:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    from_agent: str = ""
    to_agent: str = ""
    type: MsgType = MsgType.TASK_REQUEST
    content: dict = field(default_factory=dict)
    reply_to: str | None = None
    timestamp: float = field(default_factory=time.time)
    status: str = "pending"

class ClaimCommBus:
    """理赔 Agent 通信总线"""

    def __init__(self):
        self.agents: dict[str, dict] = &#123;&#125;
        self.queues: dict[str, list[AgentMsg]] = &#123;&#125;
        self.conversations: dict[str, list[AgentMsg]] = &#123;&#125;
        self.logs: list[dict] = []

    def register(self, agent_id: str, capabilities: list[str]):
        self.agents[agent_id] = &#123;"capabilities": capabilities, "online": True&#125;
        self.queues[agent_id] = []

    def send(self, msg: AgentMsg) -> bool:
        if msg.to_agent not in self.agents or not self.agents[msg.to_agent]["online"]:
            return False
        self.queues[msg.to_agent].append(msg)
        self.logs.append(&#123;
            "from": msg.from_agent, "to": msg.to_agent,
            "type": msg.type.value, "timestamp": msg.timestamp,
        &#125;)
        return True

    def receive(self, agent_id: str) -> list[AgentMsg]:
        msgs = self.queues.get(agent_id, [])
        self.queues[agent_id] = []
        return msgs

    def request_response(
        self, from_id: str, to_id: str, task: dict, timeout: float = 10
    ) -> dict | None:
        """请求-响应模式"""
        req = AgentMsg(from_agent=from_id, to_agent=to_id, content=task)
        self.send(req)

        start = time.time()
        while time.time() - start < timeout:
            responses = self.receive(from_id)
            for resp in responses:
                if resp.reply_to == req.id and resp.type == MsgType.TASK_RESULT:
                    return resp.content
            time.sleep(0.1)
        return None


# 注册三个 Agent
bus = ClaimCommBus()
bus.register("survey_agent", ["事故分析", "责任判定"])
bus.register("damage_agent", ["损失评估", "金额计算"])
bus.register("audit_agent", ["合规审核", "赔付决策"])

# 查勘 Agent
def survey_agent_process(
    bus: ClaimCommBus,
    claim_data: dict,
) -> dict:
    """查勘 Agent：分析事故、判定责任"""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    # 调用 LLM 分析事故
    from langchain_core.prompts import ChatPromptTemplate
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是保险查勘员。分析事故信息并判定责任。输出 JSON。"),
        ("human", "事故信息：&#123;claim_data&#125;"),
    ])
    chain = prompt | llm
    result = chain.invoke(&#123;"claim_data": json.dumps(claim_data, ensure_ascii=False)&#125;)

    try:
        analysis = json.loads(result.content)
    except json.JSONDecodeError:
        analysis = &#123;"raw": result.content&#125;

    # 向定损 Agent 发送评估请求
    damage_result = bus.request_response(
        from_id="survey_agent",
        to_id="damage_agent",
        task=&#123;
            "action": "assess_damage",
            "accident_type": analysis.get("accident_type"),
            "damaged_parts": analysis.get("damaged_parts", []),
            "vehicle_info": claim_data.get("vehicle_info", &#123;&#125;),
        &#125;,
        timeout=15,
    )

    # 向审核 Agent 发送审核请求
    audit_result = bus.request_response(
        from_id="survey_agent",
        to_id="audit_agent",
        task=&#123;
            "action": "audit_claim",
            "survey_analysis": analysis,
            "damage_assessment": damage_result,
            "policy_info": claim_data.get("policy_info", &#123;&#125;),
        &#125;,
        timeout=15,
    )

    return &#123;
        "survey_analysis": analysis,
        "damage_assessment": damage_result,
        "audit_decision": audit_result,
    &#125;


# 定损 Agent
def damage_agent_handler(bus: ClaimCommBus):
    """定损 Agent 消息处理"""
    messages = bus.receive("damage_agent")
    results = []

    for msg in messages:
        if msg.content.get("action") == "assess_damage":
            # 模拟定损计算
            damaged_parts = msg.content.get("damaged_parts", [])
            damage_items = []
            total = 0

            # 损失参考表
            part_costs = &#123;
                "前保险杠": 2000, "后保险杠": 1800, "前大灯": 3500,
                "引擎盖": 3000, "车门": 4500, "挡风玻璃": 2800,
                "翼子板": 1500, "后备箱盖": 3200,
            &#125;

            for part in damaged_parts:
                cost = part_costs.get(part, 1000)
                damage_items.append(&#123;"part": part, "cost": cost&#125;)
                total += cost

            # 工时费
            labor = total * 0.3
            total += labor

            result = &#123;
                "damage_items": damage_items,
                "parts_cost": sum(d["cost"] for d in damage_items),
                "labor_cost": labor,
                "total_estimate": total,
                "currency": "CNY",
            &#125;

            # 回复
            reply = AgentMsg(
                from_agent="damage_agent",
                to_agent=msg.from_agent,
                type=MsgType.TASK_RESULT,
                content=result,
                reply_to=msg.id,
                status="success",
            )
            bus.send(reply)
            results.append(result)

    return results


# 审核 Agent
def audit_agent_handler(bus: ClaimCommBus):
    """审核 Agent 消息处理"""
    messages = bus.receive("audit_agent")
    results = []

    for msg in messages:
        if msg.content.get("action") == "audit_claim":
            damage = msg.content.get("damage_assessment", &#123;&#125;)
            survey = msg.content.get("survey_analysis", &#123;&#125;)
            policy = msg.content.get("policy_info", &#123;&#125;)

            total_estimate = damage.get("total_estimate", 0)
            coverage_limit = policy.get("coverage_limit", 100000)
            deductible = policy.get("deductible", 500)

            # 审核逻辑
            approved = total_estimate <= coverage_limit
            payout = max(0, total_estimate - deductible) if approved else 0

            result = &#123;
                "approved": approved,
                "payout_amount": payout,
                "deductible": deductible,
                "coverage_limit": coverage_limit,
                "reason": "符合理赔条件" if approved else "超出保额上限",
                "audit_notes": f"定损金额 &#123;total_estimate:,.0f&#125; 元，免赔额 &#123;deductible:,.0f&#125; 元",
            &#125;

            reply = AgentMsg(
                from_agent="audit_agent",
                to_agent=msg.from_agent,
                type=MsgType.TASK_RESULT,
                content=result,
                reply_to=msg.id,
                status="success",
            )
            bus.send(reply)
            results.append(result)

    return results
```

### 3.3 工具缓存：事故记录复用

```python
import hashlib
import json

class ClaimToolCache:
    """理赔工具缓存"""

    def __init__(self, default_ttl: float = 600):
        self.cache: dict[str, dict] = &#123;&#125;
        self.default_ttl = default_ttl
        self.stats = &#123;"hits": 0, "misses": 0&#125;

    def _key(self, tool: str, args: dict) -> str:
        normalized = json.dumps(args, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(f"&#123;tool&#125;:&#123;normalized&#125;".encode()).hexdigest()[:32]

    def get(self, tool: str, args: dict) -> tuple[Any, bool]:
        key = self._key(tool, args)
        entry = self.cache.get(key)
        if entry and time.time() - entry["created"] < entry["ttl"]:
            self.stats["hits"] += 1
            return entry["value"], True
        self.stats["misses"] += 1
        return None, False

    def set(self, tool: str, args: dict, value: Any, ttl: float | None = None):
        key = self._key(tool, args)
        self.cache[key] = &#123;
            "value": value, "created": time.time(),
            "ttl": ttl or self.default_ttl,
        &#125;

    def report(self) -> dict:
        total = self.stats["hits"] + self.stats["misses"]
        return &#123;
            **self.stats,
            "hit_rate": f"&#123;self.stats['hits'] / max(total, 1):.1%&#125;",
            "size": len(self.cache),
        &#125;

tool_cache = ClaimToolCache(default_ttl=600)

def get_accident_record(accident_id: str) -> dict:
    """查询事故记录（带缓存）"""
    cached, hit = tool_cache.get("accident_record", &#123;"accident_id": accident_id&#125;)
    if hit:
        return &#123;**cached, "_cached": True&#125;

    # 模拟数据库查询
    record = &#123;
        "accident_id": accident_id,
        "date": "2025-08-28",
        "location": "北京市朝阳区",
        "type": "追尾",
        "vehicles": ["京A12345", "京B67890"],
    &#125;
    tool_cache.set("accident_record", &#123;"accident_id": accident_id&#125;, record)
    return record
```

### 3.4 数据飞轮：反馈收集与持续优化

```python
class ClaimFeedbackSystem:
    """理赔反馈系统"""

    def __init__(self):
        self.feedbacks: list[dict] = []

    def collect(
        self,
        claim_id: str,
        rating: int,             # 1-5
        comment: str = "",
        correction: str = "",    # 用户修正的理赔金额
    ):
        """收集用户反馈"""
        self.feedbacks.append(&#123;
            "claim_id": claim_id,
            "rating": rating,
            "comment": comment,
            "correction": correction,
            "timestamp": time.time(),
        &#125;)

    def analyze(self) -> dict:
        """分析反馈"""
        total = len(self.feedbacks)
        if total == 0:
            return &#123;"status": "no_data"&#125;

        avg_rating = sum(f["rating"] for f in self.feedbacks) / total
        corrections = [f for f in self.feedbacks if f["correction"]]
        negatives = [f for f in self.feedbacks if f["rating"] <= 2]

        return &#123;
            "total": total,
            "avg_rating": round(avg_rating, 2),
            "satisfaction_rate": f"&#123;sum(1 for f in self.feedbacks if f['rating'] >= 4) / total:.1%&#125;",
            "corrections": len(corrections),
            "negatives": len(negatives),
            "improvement_needed": avg_rating < 4.0,
        &#125;

    def get_training_data(self) -> list[dict]:
        """提取改进数据（用户修正）"""
        return [
            &#123;
                "claim_id": f["claim_id"],
                "user_correction": f["correction"],
                "original_rating": f["rating"],
            &#125;
            for f in self.feedbacks if f["correction"]
        ]

feedback_system = ClaimFeedbackSystem()
```

### 3.5 AB 测试：理赔模型对比

```python
class ClaimABTest:
    """理赔模型 AB 测试"""

    def __init__(self):
        self.assignments: dict[str, str] = &#123;&#125;  # user_id → variant
        self.results: dict[str, list[float]] = &#123;"control": [], "treatment": []&#125;

    def assign(self, user_id: str) -> str:
        """分配变体"""
        import hashlib
        h = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        variant = "treatment" if h < 50 else "control"
        self.assignments[user_id] = variant
        return variant

    def record(self, user_id: str, satisfaction: float):
        """记录满意度"""
        variant = self.assignments.get(user_id, "control")
        self.results[variant].append(satisfaction)

    def analyze(self) -> dict:
        """分析结果"""
        control = self.results["control"]
        treatment = self.results["treatment"]

        if len(control) < 10 or len(treatment) < 10:
            return &#123;"status": "insufficient_data", "control": len(control), "treatment": len(treatment)&#125;

        control_rate = sum(control) / len(control)
        treatment_rate = sum(treatment) / len(treatment)
        diff = treatment_rate - control_rate

        # 简单 t 检验
        import numpy as np
        from scipy import stats

        if len(control) >= 2 and len(treatment) >= 2:
            t_stat, p_value = stats.ttest_ind(treatment, control)
            significant = p_value < 0.05
        else:
            p_value = 1.0
            significant = False

        return &#123;
            "control_satisfaction": f"&#123;control_rate:.1%&#125;",
            "treatment_satisfaction": f"&#123;treatment_rate:.1%&#125;",
            "difference": f"&#123;diff:+.1%&#125;",
            "p_value": f"&#123;p_value:.4f&#125;",
            "significant": significant,
            "conclusion": (
                f"新模型满意度&#123;'显著' if significant else '不显著'&#125;"
                f"&#123;'提升' if diff > 0 else '下降'&#125; &#123;abs(diff):.1%&#125;"
            ),
        &#125;
```

---

## 4. 完整运行流程

```python
def run_claim_agent(user_text: str, user_id: str, images: list[str] | None = None):
    """运行完整的理赔 Agent 流程"""
    print("=" * 60)
    print("智能保险理赔 Agent")
    print("=" * 60)

    # 0. AB 测试分流
    ab_test = ClaimABTest()
    variant = ab_test.assign(user_id)
    model = "gpt-4o" if variant == "treatment" else "gpt-4o-mini"
    print(f"[0] 用户分配到 &#123;variant&#125; 组，使用模型 &#123;model&#125;")

    # 1. 多模态输入处理
    print("\n[1] 多模态报案输入处理...")
    processor = ClaimInputProcessor()
    claim_data = processor.process(user_text, images)
    print(f"    事故类型: &#123;claim_data.get('accident_type', '未知')&#125;")
    print(f"    受损部位: &#123;claim_data.get('damaged_parts', [])&#125;")

    # 2. 多 Agent 协作
    print("\n[2] 多 Agent 协作处理...")
    # 启动定损和审核 Agent 的消息处理
    # 实际中这些应该是独立线程/进程
    damage_agent_handler(bus)
    audit_agent_handler(bus)

    # 查勘 Agent 协调
    result = survey_agent_process(bus, &#123;**claim_data, "user_id": user_id&#125;)
    print(f"    定损金额: ¥&#123;result.get('damage_assessment', &#123;&#125;).get('total_estimate', 0):,.0f&#125;")
    print(f"    审核结果: &#123;result.get('audit_decision', &#123;&#125;).get('approved', False)&#125;")
    print(f"    赔付金额: ¥&#123;result.get('audit_decision', &#123;&#125;).get('payout_amount', 0):,.0f&#125;")

    # 3. 工具缓存统计
    print(f"\n[3] 工具缓存: &#123;tool_cache.report()&#125;")

    # 4. 收集反馈
    print("\n[4] 等待用户反馈...")
    # 模拟用户反馈
    rating = 4
    feedback_system.collect("claim_001", rating, comment="处理很快", correction="")
    ab_test.record(user_id, 1.0 if rating >= 4 else 0.0)

    # 5. 数据飞轮分析
    print(f"\n[5] 飞轮分析: &#123;feedback_system.analyze()&#125;")

    # 6. AB 测试结果
    print(f"\n[6] AB 测试: &#123;ab_test.analyze()&#125;")

    return result


# 运行
if __name__ == "__main__":
    result = run_claim_agent(
        user_text="今天下午在朝阳区被追尾了，后保险杠受损",
        user_id="user_001",
        images=None,  # 实际中传入事故照片 Base64
    )
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 多模态输入（文字+照片） | ☐ |
| 多 Agent 通信协作 | ☐ |
| 查勘→定损→审核三步流程 | ☐ |
| 工具缓存复用 | ☐ |
| 反馈收集 | ☐ |
| 数据飞轮分析 | ☐ |
| AB 测试模型对比 | ☐ |
| 审计日志 | ☐ |
| 赔付金额计算 | ☐ |
| 免赔额处理 | ☐ |
