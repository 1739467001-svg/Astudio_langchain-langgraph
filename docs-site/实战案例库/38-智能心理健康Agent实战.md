# 实战案例 38：智能心理健康 Agent

> 心理健康需求增长——情绪识别、心理评估、放松指导、危机干预。Agent 能初步评估心理状态、提供放松建议（不替代专业心理咨询）。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"心理健康Agent"&#125;
        U["用户: '最近很焦虑'"] --> ASSESS["情绪评估<br/>情绪状态+严重程度"]
        ASSESS --> RISK&#123;"危机风险?"&#125;
        RISK -->|高风险| CRISIS["⚠️ 危机干预<br/>推荐专业帮助"]
        RISK -->|低风险| GUIDE["放松指导<br/>呼吸/冥想/运动"]
        GUIDE --> TRACK["跟踪建议<br/>持续关注"]
    end

    style ASSESS fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CRISIS fill:#FFCDD2,stroke:#C62828,stroke-width:3px
    style GUIDE fill:#C8E6C9
```

**核心技术：** 情绪评估 + 风险检测 + 放松指导 + 危机干预

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

@tool
async def assess_mood(user_input: str) -> dict:
    """评估用户情绪状态。

    Args:
        user_input: 用户描述
    """
    prompt = f"""评估以下描述中的情绪状态。

描述: &#123;user_input&#125;

评估:
1. 主要情绪（焦虑/抑郁/愤怒/平静/其他）
2. 情绪强度（1-10）
3. 可能的原因
4. 是否有自伤/自杀风险

输出JSON:
```json
&#123;&#123;
  "primary_emotion": "...",
  "intensity": 6,
  "possible_cause": "...",
  "risk_level": "low/medium/high",
  "needs_professional": true/false
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"primary_emotion": "未知", "risk_level": "low"&#125;

@tool
async def crisis_intervention(assessment: dict) -> str:
    """危机干预——高风险时提供专业资源。

    Args:
        assessment: 情绪评估
    """
    if assessment.get("risk_level") != "high":
        return "风险等级较低，无需危机干预。"

    return """⚠️ 你的感受很重要，请立即寻求专业帮助：

1. 全国24小时心理援助热线：400-161-9995
2. 北京心理危机研究与干预中心：010-82951332
3. 生命热线：400-821-1215

你不是一个人。有人愿意倾听和帮助。
请尽快联系专业心理咨询师或前往最近医院心理科。"""

@tool
async def relaxation_guide(assessment: dict) -> str:
    """提供放松和应对建议。

    Args:
        assessment: 情绪评估
    """
    emotion = assessment.get("primary_emotion", "焦虑")
    intensity = assessment.get("intensity", 5)

    prompt = f"""为用户提供放松建议。

情绪: &#123;emotion&#125;
强度: &#123;intensity&#125;/10

建议包含:
1. 即时放松技巧（呼吸法等）
2. 短期应对策略
3. 长期改善建议
4. 何时寻求专业帮助

注意: 语气温暖、非评判、鼓励性。
建议:"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content + "\n\n💚 以上建议仅供参考。如持续感到困扰，请咨询专业心理咨询师。"

@tool
async def follow_up_plan(assessment: dict, guidance: str) -> str:
    """生成跟踪建议。

    Args:
        assessment: 评估结果
        guidance: 放松建议
    """
    intensity = assessment.get("intensity", 5)

    plan = f"""## 跟踪建议

### 当前状态
- 情绪: &#123;assessment.get('primary_emotion', '未知')&#125;
- 强度: &#123;intensity&#125;/10
"""
    if intensity >= 7:
        plan += "- 建议: 1周后复评，如未改善请寻求专业帮助\n"
    elif intensity >= 4:
        plan += "- 建议: 2周后复评，尝试放松技巧\n"
    else:
        plan += "- 建议: 状态良好，保持自我关注\n"

    plan += "\n### 日常建议\n- 每日记录情绪\n- 保持规律作息\n- 适度运动\n- 社交连接\n"
    plan += "\n💚 心理健康和身体健康同样重要。"

    return plan
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能心理健康助手。你可以：

1. **assess_mood**: 评估情绪状态
2. **crisis_intervention**: 危机干预（高风险时）
3. **relaxation_guide**: 放松和应对建议
4. **follow_up_plan**: 跟踪建议

## 工作流程
1. 评估情绪状态和风险
2. 高风险→危机干预（提供热线）
3. 低风险→放松建议
4. 生成跟踪计划

## 原则
- 语气温暖、非评判、鼓励性
- 不诊断心理疾病
- 高风险必须推荐专业帮助
- 必须包含免责声明
- 不替代专业心理咨询"""

mental_health_agent = create_react_agent(
    llm,
    [assess_mood, crisis_intervention, relaxation_guide, follow_up_plan],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await mental_health_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "最近工作压力大，总是焦虑，睡不好"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、安全边界

| 边界 | 说明 | 优先级 |
|------|------|--------|
| 不诊断疾病 | 只评估情绪状态 | ★★★ |
| 高风险转专业 | 提供心理热线 | ★★★ |
| 必含免责声明 | 不替代咨询师 | ★★★ |
| 语气温暖 | 非评判鼓励性 | ★★★ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有情绪评估 | ☐ |
| 有危机干预 | ☐ |
| 有放松建议 | ☐ |
| 有免责声明 | ☐ |
