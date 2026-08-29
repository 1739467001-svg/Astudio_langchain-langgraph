# Agent 医疗辅助与诊断支持指南

> Agent 在医疗领域不是替代医生——而是辅助：症状采集、鉴别诊断提示、检验结果解读、用药安全检查。本指南系统讲解医疗 Agent 的架构、严格监管要求、诊断辅助流程、以及必须的 Human-in-the-Loop。

---

## 1. 医疗 Agent 架构

### 核心原则

```
医疗 Agent 三原则：
1. 辅助不替代：所有诊断建议需医生确认
2. 安全优先：宁可保守不做冒险建议
3. 可溯源：每条建议必须有医学文献支撑

合规要求：
- FDA SaMD（Software as Medical Device）分类
- 中国医疗器械软件分类
- HIPAA/个人信息保护法
- 数据必须本地化或加密
```

### 工作流

```mermaid
graph TB
    SYMPTOM["症状采集"] --> TRIAGE["分诊<br/>紧急程度判断"]
    TRIAGE -->|"紧急"| EMERGENCY["⚠️ 立即就医"]
    TRIAGE -->|"非紧急"| DIAGNOSIS["鉴别诊断<br/>可能疾病列表"]
    DIAGNOSIS --> CHECK["检验建议<br/>需要做哪些检查"]
    CHECK --> INTERPRET["结果解读<br/>辅助医生"]
    INTERPRET --> ADVICE["建议<br/>需医生确认"]
    ADVICE --> REVIEW["👨‍⚕️ 医生审核"]
    REVIEW --> OUTPUT["最终建议"]

    style TRIAGE fill:#FFCCBC,stroke:#D84315,stroke-width=2px
    style DIAGNOSIS fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style REVIEW fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 症状采集

```python
@dataclass
class SymptomCollector:
    """症状采集器"""

    async def collect(self, patient: dict) -> dict:
        """多轮对话采集症状"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""你是医疗问诊助手。请通过对话采集症状。

患者信息: {json.dumps(patient, ensure_ascii=False)}

采集要点：
1. 主诉（什么不舒服）
2. 持续时间
3. 严重程度(1-10)
4. 伴随症状
5. 既往病史
6. 过敏史
7. 用药史

注意：如果出现胸痛/呼吸困难/意识模糊等紧急症状，立即建议就医。

请开始问诊。"""

        response = await llm.ainvoke(prompt)
        return {"dialog": response.content, "patient": patient}

    async def triage(self, symptoms: dict) -> dict:
        """分诊：判断紧急程度"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""基于以下症状进行分诊。

症状: {json.dumps(symptoms, ensure_ascii=False)}

判断紧急程度:
- EMERGENCY: 需立即就医（胸痛/呼吸困难/严重出血/意识模糊）
- URGENT: 24小时内就医（高烧/剧烈疼痛）
- ROUTINE: 常规就诊
- SELF_CARE: 可自行处理

只回答级别和原因。""")

        return {"triage": response.content, "symptoms": symptoms}
```

---

## 3. 鉴别诊断辅助

```python
@dataclass
class DifferentialDiagnosis:
    """鉴别诊断辅助"""

    async def suggest(self, symptoms: dict, patient: dict) -> dict:
        """提供鉴别诊断建议"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""作为诊断辅助工具，基于症状提供鉴别诊断。

患者: {json.dumps(patient, ensure_ascii=False)}
症状: {json.dumps(symptoms, ensure_ascii=False)}

输出 JSON:
{{
    "differentials": [
        {{
            "disease": "疾病名",
            "probability": "高/中/低",
            "supporting_evidence": "支持的症状",
            "missing_evidence": "需要补充的检查",
            "recommended_tests": ["建议的检验项目"],
            "urgency": "routine/urgent"
        }}
    ],
    "red_flags": ["需要警惕的危险信号"],
    "disclaimer": "此建议仅供参考，最终诊断需医生确认"
}}

注意：按可能性排序，最多列出5个。"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 4. 检验结果解读

```python
@dataclass
class LabResultInterpreter:
    """检验结果解读器"""

    async def interpret(self, lab_results: dict, reference_ranges: dict) -> dict:
        """解读检验结果"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # 标记异常值
        abnormalities = self._check_abnormal(lab_results, reference_ranges)

        prompt = f"""解读以下检验结果。

检验结果: {json.dumps(lab_results, ensure_ascii=False)}
异常项: {json.dumps(abnormalities, ensure_ascii=False)}

输出 JSON:
{{
    "summary": "总体评估",
    "abnormal_items": [
        {{
            "item": "检验项目",
            "value": "结果",
            "reference": "参考范围",
            "interpretation": "可能含义",
            "severity": "normal/mild/moderate/severe"
        }}
    ],
    "possible_conditions": ["可能的疾病关联"],
    "recommended_follow_up": ["建议的进一步检查"],
    "disclaimer": "仅供参考，需医生确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)

    def _check_abnormal(self, results: dict, references: dict) -> list:
        """检查异常值"""
        abnormal = []
        for item, value in results.items():
            if item in references:
                ref = references[item]
                if value < ref.get("min", 0) or value > ref.get("max", float("inf")):
                    abnormal.append({"item": item, "value": value, "reference": ref})
        return abnormal
```

---

## 5. 用药安全检查

```python
@dataclass
class MedicationSafetyChecker:
    """用药安全检查器"""

    async def check_interactions(self, medications: list, patient: dict) -> dict:
        """检查药物相互作用"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""检查以下药物的安全性。

患者药物: {json.dumps(medications, ensure_ascii=False)}
患者信息: {json.dumps(patient, ensure_ascii=False)}

检查项：
1. 药物间相互作用
2. 过敏禁忌
3. 年龄/肾功能调整
4. 妊娠/哺乳禁忌

输出 JSON:
{{
    "safe": true/false,
    "interactions": [{{"drug1": "...", "drug2": "...", "severity": "...", "description": "..."}}],
    "contraindications": ["禁忌事项"],
    "dosage_adjustments": ["剂量调整建议"],
    "monitoring": ["需要监测的指标"],
    "disclaimer": "需医生/药师确认"
}}"""

        response = await llm.ainvoke(prompt)
        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解医疗 Agent 三原则 | ☐ |
| 实现了症状采集 | ☐ |
| 实现了分诊（紧急判断） | ☐ |
| 实现了鉴别诊断辅助 | ☐ |
| 实现了检验结果解读 | ☐ |
| 实现了用药安全检查 | ☐ |
| 所有建议有免责声明 | ☐ |
| 配置了 Human-in-the-Loop | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 58 | 智能医疗诊断辅助 Agent | 医疗 |
| 134 | Agent 代码执行沙箱 | 沙箱 |
| 451 | LLM 应用合规 | 合规 |
| 458 | 人机协作 HITL | HITL |
| 461 | 企业 Agent 集成 | HIS 集成 |
| 477 | Agent 数据安全 | 数据安全 |
| 501 | Agent 数据保护与隐私 | 隐私 |
