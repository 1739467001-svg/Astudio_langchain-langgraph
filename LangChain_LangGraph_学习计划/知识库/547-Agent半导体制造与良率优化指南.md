# Agent 半导体制造与良率优化指南

> 芯片制造是世界上最精密的工业——一片晶圆上千亿个晶体管，一个微小缺陷导致整片报废。Agent 能分析工艺数据、识别缺陷模式、优化参数、预测良率。本指南系统讲解半导体 Agent 架构、缺陷检测、良率分析、工艺优化。

---

## 1. 半导体 Agent 架构

### 工作流

```mermaid
graph TB
    WAFER["晶圆数据<br/>缺陷图/电测参数"] --> DEFECT["缺陷分析<br/>类型/位置/模式"]
    DEFECT --> YIELD["良率分析<br/>根因定位"]
    YIELD --> OPTIMIZE["工艺优化<br/>参数调整建议"]
    OPTIMIZE --> SIMULATE["仿真验证<br/>效果预测"]
    SIMULATE --> IMPLEMENT["实施调整<br/>产线反馈"]

    style WAFER fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DEFECT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OPTIMIZE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 缺陷分析

```python
@dataclass
class DefectAnalyzer:
    """缺陷分析器"""

    async def analyze(self, defect_map: dict, process_data: dict) -> dict:
        """分析缺陷模式"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""分析半导体缺陷。

缺陷图数据: {json.dumps(defect_map, ensure_ascii=False)[:2000]}
工艺参数: {json.dumps(process_data, ensure_ascii=False)[:1000]}

输出 JSON:
{{
    "defect_patterns": [
        {{"pattern": "边缘集中/随机/线条", "count": 0, "likely_cause": "...", "severity": "high/medium/low"}}
    ],
    "root_cause_candidates": [
        {{"cause": "...", "confidence": 0.8, "evidence": "...", "affected_steps": ["光刻", "刻蚀"]}}
    ],
    "recommended_investigations": ["建议检查的工序"],
    "estimated_yield_impact": "影响良率百分比"
}}""")

        return json.loads(response.content)

    async def classify_defect(self, defect_image: str) -> dict:
        """VLM 分类缺陷"""
        import base64
        with open(defect_image, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        from langchain_core.messages import HumanMessage

        response = await llm.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": """分类半导体缺陷。输出 JSON:
{
    "defect_type": "颗粒/划痕/桥接/断路/短路/光刻偏移",
    "size_um": 0,
    "severity": "critical/major/minor",
    "affected_layer": "层名",
    "likely_process_step": "光刻/刻蚀/沉积/CMP"
}"""},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
            ])
        ])

        return json.loads(response.content)
```

---

## 3. 良率分析

```python
@dataclass
class YieldAnalyzer:
    """良率分析器"""

    async def analyze(self, wafer_data: dict, historical: list) -> dict:
        """分析良率"""
        current_yield = wafer_data.get("yield_rate", 0.85)
        target_yield = wafer_data.get("target", 0.95)
        historical_avg = sum(h.get("yield_rate", 0) for h in historical[-10:]) / max(len(historical[-10:]), 1)

        trend = "上升" if current_yield > historical_avg else "下降" if current_yield < historical_avg else "稳定"

        gap = target_yield - current_yield

        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""分析良率状况。

当前良率: {current_yield:.1%}
目标良率: {target_yield:.1%}
历史平均: {historical_avg:.1%}
趋势: {trend}
差距: {gap:.1%}
缺陷数据: {json.dumps(wafer_data.get("defects", {}), ensure_ascii=False)[:1000]}

输出 JSON:
{{
    "status": "达标/接近/不达标",
    "trend": "{trend}",
    "gap_to_target": "{gap:.1%}",
    "key_loss_sources": [{{"source": "...", "impact": "...", "improvable": true}}],
    "optimization_priorities": ["优化方向"],
    "estimated_improvement_potential": "可提升良率百分比"
}}""")

        return json.loads(response.content)
```

---

## 4. 工艺优化

```python
@dataclass
class ProcessOptimizer:
    """工艺优化器"""

    async def optimize(self, process_params: dict, yield_data: dict,
                       constraints: dict) -> dict:
        """优化工艺参数"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""优化半导体工艺参数。

当前参数: {json.dumps(process_params, ensure_ascii=False)[:1500]}
良率数据: {json.dumps(yield_data, ensure_ascii=False)[:500]}
约束条件: {json.dumps(constraints, ensure_ascii=False)}

输出 JSON:
{{
    "recommendations": [
        {{
            "parameter": "光刻曝光能量",
            "current": 30,
            "recommended": 28,
            "reason": "降低能量减少过曝光",
            "expected_yield_improvement": "0.5%",
            "risk": "low"
        }}
    ],
    "estimated_total_improvement": "1.5%",
    "implementation_order": ["先调整低风险参数"],
    "validation_method": "建议验证方法"
}}""")

        return json.loads(response.content)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了缺陷分析（模式识别） | ☐ |
| 实现了 VLM 缺陷分类 | ☐ |
| 实现了良率分析 | ☐ |
| 实现了工艺优化建议 | ☐ |
| 有良率趋势追踪 | ☐ |
| 有根因定位 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 40 | 智能制造 Agent | 制造 |
| 527 | Agent 智能制造 | 工业 |
| 540 | Agent 智能建筑 | 建筑 |
| 443 | 多模态文档智能 | VLM |
| 471 | 数字孪生 | 仿真 |
