# 实战案例 58：智能医疗诊断辅助 Agent

> 医疗诊断涉及症状采集、鉴别诊断、检验结果分析和治疗建议。Agent 能辅助医生完成初步分析，从症状到鉴别诊断给出结构化建议。注意：本案例为教学演示，不构成医疗建议。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"医疗诊断辅助Agent"&#125;
        U["医生: '患者发热咳嗽3天'"] --> INTAKE["症状采集<br/>主诉+伴随症状+病史"]
        INTAKE --> DIFF["鉴别诊断<br/>可能疾病列表"]
        DIFF --> LAB&#123;"有检验结果?"&#125;
        LAB -->|有| ANALYZE["检验分析<br/>异常值标记"]
        LAB -->|无| RECOMMEND["建议检查项目"]
        ANALYZE & RECOMMEND --> ADVICE["诊疗建议<br/>用药+随访"]
    end

    style INTAKE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style DIFF fill:#E3F2FD,stroke:#1565C0
    style ADVICE fill:#C8E6C9
```

**核心技术：** 症状采集 + 鉴别诊断 + 检验结果分析 + 诊疗建议生成

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json
from datetime import datetime

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def collect_symptoms(chief_complaint: str, duration: str = "", accompanying: str = "", history: str = "") -> dict:
    """采集患者症状信息。

    Args:
        chief_complaint: 主诉（主要症状）
        duration: 持续时间
        accompanying: 伴随症状
        history: 既往病史
    """
    return &#123;
        "chief_complaint": chief_complaint,
        "duration": duration or "未提供",
        "accompanying": accompanying or "未提供",
        "history": history or "未提供",
        "collected_at": datetime.now().isoformat(),
        "completeness": "完整" if all([duration, accompanying, history]) else "部分缺失",
    &#125;

@tool
async def differential_diagnosis(symptoms: dict) -> dict:
    """根据症状给出鉴别诊断列表。

    Args:
        symptoms: 症状采集结果
    """
    # 模拟基于规则的鉴别诊断（实际可用RAG+知识库）
    complaint = symptoms.get("chief_complaint", "").lower()
    accompanying = symptoms.get("accompanying", "").lower()

    diagnoses = []

    # 简单规则引擎模拟
    if "发热" in complaint or "发烧" in complaint:
        if "咳嗽" in accompanying or "咳嗽" in complaint:
            diagnoses.append(&#123;
                "disease": "上呼吸道感染",
                "probability": 0.65,
                "icd_code": "J00",
                "severity": "轻",
                "key_findings": "发热+咳嗽，符合上感表现",
            &#125;)
            diagnoses.append(&#123;
                "disease": "急性支气管炎",
                "probability": 0.25,
                "icd_code": "J20",
                "severity": "中",
                "key_findings": "咳嗽持续需排除支气管炎",
            &#125;)
            diagnoses.append(&#123;
                "disease": "肺炎",
                "probability": 0.10,
                "icd_code": "J18",
                "severity": "中重",
                "key_findings": "高热+咳嗽需影像学排除肺炎",
            &#125;)
        elif "腹痛" in accompanying:
            diagnoses.append(&#123;
                "disease": "急性胃肠炎",
                "probability": 0.55,
                "icd_code": "K52",
                "severity": "中",
                "key_findings": "发热+腹痛符合消化道感染",
            &#125;)
    elif "头痛" in complaint:
        diagnoses.append(&#123;
            "disease": "紧张性头痛",
            "probability": 0.50,
            "icd_code": "G44.2",
            "severity": "轻",
            "key_findings": "最常见头痛类型",
        &#125;)
        diagnoses.append(&#123;
            "disease": "偏头痛",
            "probability": 0.35,
            "icd_code": "G43",
            "severity": "中",
            "key_findings": "单侧搏动性疼痛需考虑偏头痛",
        &#125;)

    if not diagnoses:
        diagnoses.append(&#123;
            "disease": "需进一步评估",
            "probability": 0.0,
            "icd_code": "R69",
            "severity": "未知",
            "key_findings": "症状不典型，建议详细问诊",
        &#125;)

    return &#123;
        "total_candidates": len(diagnoses),
        "diagnoses": sorted(diagnoses, key=lambda d: d["probability"], reverse=True),
        "top_candidate": diagnoses[0]["disease"],
        "disclaimer": "AI辅助诊断，仅供医生参考，不作为最终诊断依据",
    &#125;

@tool
async def analyze_lab_results(lab_data: str, diagnoses: dict) -> dict:
    """分析检验结果，标记异常值。

    Args:
        lab_data: 检验结果文本
        diagnoses: 鉴别诊断结果
    """
    # 模拟检验结果分析
    abnormal_items = []
    normal_items = []

    # 模拟解析（实际应解析结构化检验报告）
    reference_ranges = &#123;
        "白细胞": &#123;"range": (4.0, 10.0), "unit": "×10^9/L"&#125;,
        "中性粒细胞": &#123;"range": (2.0, 7.0), "unit": "×10^9/L"&#125;,
        "C反应蛋白": &#123;"range": (0, 10.0), "unit": "mg/L"&#125;,
        "体温": &#123;"range": (36.0, 37.3), "unit": "℃"&#125;,
    &#125;

    # 模拟检验值
    mock_results = &#123;
        "白细胞": 12.5,
        "中性粒细胞": 8.2,
        "C反应蛋白": 25.0,
        "体温": 38.5,
    &#125;

    for item, value in mock_results.items():
        ref = reference_ranges.get(item)
        if ref:
            low, high = ref["range"]
            if value < low:
                abnormal_items.append(&#123;"item": item, "value": f"&#123;value&#125;&#123;ref['unit']&#125;", "status": "偏低", "reference": f"&#123;low&#125;-&#123;high&#125;&#123;ref['unit']&#125;"&#125;)
            elif value > high:
                abnormal_items.append(&#123;"item": item, "value": f"&#123;value&#125;&#123;ref['unit']&#125;", "status": "偏高", "reference": f"&#123;low&#125;-&#123;high&#125;&#123;ref['unit']&#125;"&#125;)
            else:
                normal_items.append(&#123;"item": item, "value": f"&#123;value&#125;&#123;ref['unit']&#125;", "status": "正常", "reference": f"&#123;low&#125;-&#123;high&#125;&#123;ref['unit']&#125;"&#125;)

    # 关联诊断
    top_diagnosis = diagnoses.get("top_candidate", "")
    correlation = ""
    if "感染" in top_diagnosis or "炎" in top_diagnosis:
        wbc_abnormal = any(a["item"] == "白细胞" and a["status"] == "偏高" for a in abnormal_items)
        crp_abnormal = any(a["item"] == "C反应蛋白" and a["status"] == "偏高" for a in abnormal_items)
        if wbc_abnormal and crp_abnormal:
            correlation = "白细胞和CRP均升高，支持感染/炎症诊断"

    return &#123;
        "total_items": len(mock_results),
        "abnormal_count": len(abnormal_items),
        "normal_count": len(normal_items),
        "abnormal_items": abnormal_items,
        "normal_items": normal_items,
        "correlation": correlation,
    &#125;

@tool
async def generate_advice(symptoms: dict, diagnoses: dict, lab_analysis: dict) -> dict:
    """生成诊疗建议。

    Args:
        symptoms: 症状采集结果
        diagnoses: 鉴别诊断结果
        lab_analysis: 检验分析结果
    """
    top_diagnosis = diagnoses.get("top_candidate", "未确定")
    severity = "轻"
    for d in diagnoses.get("diagnoses", []):
        if d["disease"] == top_diagnosis:
            severity = d.get("severity", "轻")
            break

    advice_items = &#123;
        "上呼吸道感染": &#123;
            "medication": "对症治疗：退热药（对乙酰氨基酚）、缓解症状",
            "follow_up": "3-5天未缓解需复诊",
            "lifestyle": "多休息、多饮水、注意保暖",
        &#125;,
        "急性支气管炎": &#123;
            "medication": "如细菌感染可考虑抗生素，止咳化痰对症",
            "follow_up": "咳嗽超过2周需胸片检查",
            "lifestyle": "戒烟、避免刺激性气体",
        &#125;,
        "肺炎": &#123;
            "medication": "需影像学确诊后，按病原学结果抗感染治疗",
            "follow_up": "建议住院或门诊密切随访",
            "lifestyle": "卧床休息、营养支持",
        &#125;,
    &#125;

    selected = advice_items.get(top_diagnosis, &#123;
        "medication": "建议进一步检查后确定方案",
        "follow_up": "建议专科就诊",
        "lifestyle": "注意休息，观察病情变化",
    &#125;)

    return &#123;
        "report_id": f"MR-&#123;datetime.now().strftime('%Y%m%d%H%M%S')&#125;",
        "generated_at": datetime.now().isoformat(),
        "chief_complaint": symptoms.get("chief_complaint", ""),
        "top_diagnosis": top_diagnosis,
        "severity": severity,
        "lab_summary": &#123;
            "abnormal_count": lab_analysis.get("abnormal_count", 0),
            "correlation": lab_analysis.get("correlation", "无"),
        &#125;,
        "medication_advice": selected["medication"],
        "follow_up_advice": selected["follow_up"],
        "lifestyle_advice": selected["lifestyle"],
        "disclaimer": "本建议为AI辅助生成，仅供参考，最终诊疗由主治医师决定",
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能医疗诊断辅助助手。你可以：

1. **collect_symptoms**: 采集患者症状信息
2. **differential_diagnosis**: 根据症状给出鉴别诊断
3. **analyze_lab_results**: 分析检验结果
4. **generate_advice**: 生成诊疗建议

## 工作流程
1. 采集主诉、持续时间、伴随症状和病史
2. 根据症状给出鉴别诊断列表（按概率排序）
3. 如有检验结果，分析异常值并与诊断关联
4. 生成结构化诊疗建议（用药+随访+生活建议）

## 原则
- 鉴别诊断要按概率排序
- 检验结果与诊断要有关联分析
- 严重疾病不能遗漏（如肺炎、急腹症）
- 所有建议必须标注"仅供参考，由医师决定"
- 不能给出最终诊断，只能辅助"""

medical_agent = create_react_agent(
    llm,
    [collect_symptoms, differential_diagnosis, analyze_lab_results, generate_advice],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await medical_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "患者男，35岁，发热3天伴咳嗽，既往体健，有检验结果：白细胞12.5，CRP 25。请辅助诊断。"&#125;]
    &#125;)
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
医疗诊断辅助报告

报告编号：MR-20260827160000
主诉：发热3天伴咳嗽

鉴别诊断（按概率排序）：
1. 上呼吸道感染（65%）— ICD: J00 — 严重度：轻
   关键发现：发热+咳嗽，符合上感表现
2. 急性支气管炎（25%）— ICD: J20 — 严重度：中
   关键发现：咳嗽持续需排除支气管炎
3. 肺炎（10%）— ICD: J18 — 严重度：中重
   关键发现：高热+咳嗽需影像学排除肺炎

检验结果分析：
- 白细胞：12.5×10^9/L（偏高，参考4.0-10.0）
- 中性粒细胞：8.2×10^9/L（偏高，参考2.0-7.0）
- C反应蛋白：25.0mg/L（偏高，参考0-10.0）
- 体温：38.5℃（偏高，参考36.0-37.3）
异常项数：4项
关联分析：白细胞和CRP均升高，支持感染/炎症诊断

诊疗建议：
- 用药：对症治疗：退热药（对乙酰氨基酚）、缓解症状
- 随访：3-5天未缓解需复诊
- 生活：多休息、多饮水、注意保暖

⚠ 本建议为AI辅助生成，仅供参考，最终诊疗由主治医师决定
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有症状采集工具 | ☐ |
| 有鉴别诊断工具 | ☐ |
| 有检验结果分析 | ☐ |
| 有诊疗建议生成 | ☐ |
| 诊断按概率排序 | ☐ |
| 有免责声明 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
