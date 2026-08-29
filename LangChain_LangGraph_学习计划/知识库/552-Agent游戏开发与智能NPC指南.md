# Agent 游戏开发与智能 NPC 指南

> 游戏 NPC 传统上按脚本行动——玩家很快发现规律。Agent 驱动的 NPC 能理解玩家行为、自主对话、动态调整难度、生成剧情。本指南系统讲解游戏 Agent 架构、智能 NPC 设计、动态剧情生成、玩家画像、反作弊。

---

## 1. 游戏 Agent 架构

### 工作流

```mermaid
graph TB
    PLAYER["玩家行为"] --> OBSERVE["行为观察<br/>操作/偏好/情绪"]
    OBSERVE --> ADAPT["动态调整<br/>难度/剧情/NPC"]
    NPC["NPC Agent"] --> DIALOGUE["自然对话<br/>非脚本对白"]
    NPC --> BEHAVIOR["自主行为<br/>目标驱动"]
    WORLD["游戏世界"] --> QUEST["动态任务<br/>生成"]
    OBSERVE --> CHEAT["反作弊<br/>异常检测"]

    style OBSERVE fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style NPC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style ADAPT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 智能 NPC

```python
@dataclass
class IntelligentNPC:
    """智能 NPC Agent"""

    async def interact(self, npc_profile: dict, player_action: str,
                       game_context: dict) -> dict:
        """NPC 与玩家交互"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

        response = await llm.ainvoke(f"""你是游戏中的NPC。

NPC身份: {json.dumps(npc_profile, ensure_ascii=False)}
玩家行为: {player_action}
游戏上下文: {json.dumps(game_context, ensure_ascii=False)[:500]}

要求:
1. 符合NPC性格和背景
2. 自然对话，不脚本化
3. 记住之前的交互
4. 可能提供任务/信息/交易
5. 情绪会变化

输出 JSON:
{{
    "dialogue": "NPC说的话",
    "emotion": "友好/中立/敌对",
    "action": "NPC的动作",
    "quest_offered": null,
    "relationship_change": 0,
    "items": ["可能给予/交易物品"]
}}""")

        return json.loads(response.content)

    async def autonomous_behavior(self, npc_profile: dict, world_state: dict) -> dict:
        """NPC 自主行为（玩家不在附近时）"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        response = await llm.ainvoke(f"""NPC自主行为决策。

NPC: {json.dumps(npc_profile, ensure_ascii=False)}
世界状态: {json.dumps(world_state, ensure_ascii=False)[:500]}

NPC根据自身目标和性格决定行为。

输出 JSON:
{{
    "action": "移动/对话/工作/休息/探索",
    "destination": "目的地",
    "duration": "持续时长",
    "mood": "情绪状态"
}}""")

        return json.loads(response.content)
```

---

## 3. 动态剧情

```python
@dataclass
class DynamicQuestGenerator:
    """动态任务生成器"""

    async def generate_quest(self, player_level: int, player_history: list,
                            world_events: list) -> dict:
        """生成动态任务"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

        response = await llm.ainvoke(f"""生成游戏任务。

玩家等级: {player_level}
玩家历史: {json.dumps(player_history[-5:], ensure_ascii=False)}
世界事件: {json.dumps(world_events[:5], ensure_ascii=False)}

输出 JSON:
{{
    "quest_id": "...",
    "title": "任务标题",
    "description": "任务描述",
    "objectives": ["任务目标"],
    "difficulty": "easy/medium/hard",
    "rewards": {{"xp": 100, "gold": 50, "items": []}},
    "npc_involved": "任务NPC",
    "estimated_time_minutes": 15,
    "branching": {{"choice_a": "...", "choice_b": "..."}}
}}""")

        return json.loads(response.content)
```

---

## 4. 反作弊

```python
@dataclass
class AntiCheatDetector:
    """反作弊检测器"""

    async def check(self, player_id: str, action_data: dict,
                    statistics: dict) -> dict:
        """检测作弊"""
        risk_score = 0
        reasons = []

        # 反应时间异常
        reaction_time = action_data.get("reaction_time_ms", 200)
        if reaction_time < 50:
            risk_score += 40
            reasons.append("反应时间异常快")

        # 点击精度异常
        accuracy = action_data.get("accuracy", 0.5)
        if accuracy > 0.98:
            risk_score += 30
            reasons.append("精度异常高")

        # 资源获取异常
        gold_rate = statistics.get("gold_per_hour", 0)
        if gold_rate > 10000:
            risk_score += 35
            reasons.append("金币获取异常")

        return {
            "player_id": player_id,
            "risk_score": risk_score,
            "risk_level": "high" if risk_score > 60 else "medium" if risk_score > 30 else "low",
            "reasons": reasons,
            "action": "封号" if risk_score > 60 else "观察" if risk_score > 30 else "正常",
        }
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了智能 NPC 对话 | ☐ |
| 实现了 NPC 自主行为 | ☐ |
| 实现了动态任务生成 | ☐ |
| 实现了反作弊检测 | ☐ |
| 有玩家行为观察 | ☐ |
| 有难度动态调整 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 多模态应用开发 | 多模态 |
| 467 | 多 Agent 仿真 | 群体智能 |
| 462 | Agent 设计模式 | 设计模式 |
| 521 | Agent 内容创作 | 创作 |
| 548 | Agent 影视制作 | 内容 |
