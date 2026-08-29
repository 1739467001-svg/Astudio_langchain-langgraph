# 实战案例 50：智能城市规划 Agent

> 城市规划涉及人口分析、土地利用、交通规划、环境评估。Agent 能综合多源数据给出规划建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"城市规划Agent"&#125;
        U["查询: '某区域规划建议'"] --> POP["人口分析<br/>密度+趋势"]
        POP --> LAND["土地利用<br/>现状+潜力"]
        LAND --> TRANS["交通规划<br/>路网+公交"]
        TRANS --> ENV["环境评估"]
        ENV --> SUGGEST["规划建议<br/>综合报告"]
    end

    style POP fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SUGGEST fill:#C8E6C9
```

**核心技术：** 人口分析 + 土地评估 + 交通规划 + 综合建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def analyze_population(area: str) -> dict:
    """分析区域人口数据。

    Args:
        area: 区域名称
    """
    return &#123;
        "area": area,
        "population": 120000,
        "density": 8500,
        "growth_rate": 0.025,
        "age_distribution": &#123;"0-14": 0.15, "15-64": 0.70, "65+": 0.15&#125;,
        "trend": "持续增长",
    &#125;

@tool
async def analyze_land_use(area: str) -> dict:
    """分析土地利用现状。

    Args:
        area: 区域名称
    """
    return &#123;
        "area": area,
        "residential": 0.35,
        "commercial": 0.15,
        "industrial": 0.20,
        "green": 0.15,
        "vacant": 0.15,
        "road": 0.00,
        "potential": "有15%空地可开发",
    &#125;

@tool
async def generate_planning_advice(population: dict, land: dict) -> str:
    """生成规划建议。

    Args:
        population: 人口数据
        land: 土地数据
    """
    prompt = f"""基于数据生成城市规划建议。

人口: &#123;json.dumps(population, ensure_ascii=False)[:500]&#125;
土地: &#123;json.dumps(land, ensure_ascii=False)[:500]&#125;

建议包含:
1. 居住区规划
2. 商业区布局
3. 交通规划
4. 绿地保护
5. 公共设施

建议:"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能城市规划助手。你可以：

1. **analyze_population**: 分析人口数据
2. **analyze_land_use**: 分析土地利用
3. **generate_planning_advice**: 生成规划建议

## 工作流程
1. 分析人口和土地数据
2. 综合生成规划建议

## 原则
- 数据驱动
- 建议要具体可操作
- 综合考虑多维度"""

urban_agent = create_react_agent(
    llm,
    [analyze_population, analyze_land_use, generate_planning_advice],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await urban_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "分析城东新区的规划潜力"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有人口分析 | ☐ |
| 有土地评估 | ☐ |
| 有规划建议 | ☐ |
