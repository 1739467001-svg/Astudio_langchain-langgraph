# 实战案例 54：智能专利分析 Agent

> 专利分析涉及专利检索、技术分析、侵权风险评估和布局建议。Agent 能自动检索专利、分析技术特征、给出战略建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"专利分析Agent"}
        U["查询: '分析AI专利'"] --> SEARCH["专利检索<br/>按关键词/分类"]
        SEARCH --> ANALYZE["技术分析<br/>权利要求+摘要"]
        ANALYZE --> RISK{"侵权风险?"}
        RISK -->|是| FLAG["风险标记<br/>+规避建议"]
        RISK -->|否| REPORT["分析报告<br/>+布局建议"]
        FLAG --> REPORT
    end

    style SEARCH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 专利检索 + 技术特征分析 + 风险评估 + 布局建议

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def search_patents(keyword: str, patent_type: str = "发明专利") -> dict:
    """检索专利。

    Args:
        keyword: 搜索关键词
        patent_type: 专利类型(发明专利/实用新型/外观设计)
    """
    return {
        "keyword": keyword,
        "patent_type": patent_type,
        "results": [
            {"id": "CN102024001", "title": f"基于{keyword}的智能系统", "applicant": "科技公司A", "date": "2024-01-15", "status": "已授权", "claims": 3},
            {"id": "CN102024002", "title": f"{keyword}处理方法及装置", "applicant": "研究院B", "date": "2024-03-20", "status": "审查中", "claims": 5},
        ],
        "total": 2,
    }

@tool
async def analyze_technology(patents: dict) -> dict:
    """分析专利技术特征。

    Args:
        patents: 检索结果
    """
    prompt = f"""分析以下专利的技术特征。

专利: {json.dumps(patents, ensure_ascii=False)[:500]}

分析:
1. 核心技术方向
2. 权利要求覆盖范围
3. 技术发展趋势
4. 主要竞争者

输出JSON:
```json
{{
  "tech_direction": "...",
  "coverage_scope": "...",
  "trend": "...",
  "key_players": ["竞争者A"],
  "tech_gaps": ["技术空白点"]
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"tech_direction": "AI领域", "key_players": []}

@tool
async def assess_risk(analysis: dict, own_products: str = "") -> dict:
    """评估侵权风险。

    Args:
        analysis: 技术分析
        own_products: 自有产品描述
    """
    return {
        "risk_level": "medium",
        "risk_patents": ["CN102024001"],
        "risk_factors": ["技术方向重叠", "权利要求覆盖自有产品"],
        "mitigation": ["设计规避", "申请交叉许可", "布局防御性专利"],
    }

@tool
async def generate_report(search: dict, analysis: dict, risk: dict) -> str:
    """生成专利分析报告。

    Args:
        search: 检索结果
        analysis: 技术分析
        risk: 风险评估
    """
    report = f"""# 专利分析报告

## 检索结果
- 关键词: {search.get('keyword', '')}
- 类型: {search.get('patent_type', '')}
- 数量: {search.get('total', 0)}件

## 技术分析
- 技术方向: {analysis.get('tech_direction', '')}
- 覆盖范围: {analysis.get('coverage_scope', '')}
- 发展趋势: {analysis.get('trend', '')}
- 竞争者: {', '.join(analysis.get('key_players', []))}
- 技术空白: {', '.join(analysis.get('tech_gaps', []))}

## 风险评估
- 风险等级: {risk.get('risk_level', '')}
- 风险专利: {', '.join(risk.get('risk_patents', []))}
- 风险因素: {', '.join(risk.get('risk_factors', []))}

## 建议
"""
    for m in risk.get("mitigation", []):
        report += f"- {m}\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能专利分析助手。你可以：

1. **search_patents**: 检索专利
2. **analyze_technology**: 分析技术特征
3. **assess_risk**: 评估侵权风险
4. **generate_report**: 生成分析报告

## 工作流程
1. 检索相关专利
2. 分析技术特征和趋势
3. 评估侵权风险
4. 生成报告+建议

## 原则
- 客观分析
- 有风险要标记
- 建议要可执行"""

patent_agent = create_react_agent(
    llm,
    [search_patents, analyze_technology, assess_risk, generate_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await patent_agent.ainvoke({
        "messages": [{"role": "user", "content": "分析AI Agent相关的专利，评估技术趋势和风险"}]
    })
    print(result["messages"][-1].content[:1000])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有专利检索 | ☐ |
| 有技术分析 | ☐ |
| 有风险评估 | ☐ |
| 有报告生成 | ☐ |
