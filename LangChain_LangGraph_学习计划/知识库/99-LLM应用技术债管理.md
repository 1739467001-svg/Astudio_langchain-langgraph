# LLM 应用技术债管理

> LLM 应用技术债比传统软件更多——Prompt 硬编码、未参数化的模型名、未测试的 Chain。这份指南帮你识别和管理技术债。

---

## 一、LLM 应用特有的技术债

```mermaid
graph TB
    subgraph 技术债分类 {"LLM应用特有技术债"}
        D1["📝 Prompt债<br/>硬编码在代码中<br/>无版本管理"]
        D2["🤖 模型债<br/>模型名写死<br/>无法快速切换"]
        D3["📦 组件债<br/>Chain/Graph未模块化<br/>难以复用"]
        D4["🧪 测试债<br/>无评估数据集<br/>效果无法量化"]
        D5["📊 监控债<br/>无追踪/无告警<br/>问题靠用户反馈"]
        D6["🔒 安全债<br/>无护栏/无脱敏<br/>API Key暴露风险"]
    end

    style D1 fill:'#FFE0B2'
    style D4 fill:'#FFCDD2'
    style D6 fill:'#FFCDD2'
```

## 二、技术债评估

```python
from dataclasses import dataclass

@dataclass
class TechDebtItem:
    """技术债项"""
    category: str           # 类别
    description: str         # 描述
    severity: str           # 高/中/低
    effort: str             # 修复工作量
    impact: str             # 不修复的影响

TECH_DEBT_CHECKLIST = [
    TechDebtItem("Prompt", "Prompt硬编码在Python代码中", "中", "低", "修改Prompt需改代码+重启"),
    TechDebtItem("Prompt", "Prompt无版本管理", "中", "低", "无法回滚到旧版本"),
    TechDebtItem("模型", "模型名硬编码(如gpt-4o-mini)", "低", "低", "切换模型需改代码"),
    TechDebtItem("模型", "无备用模型降级", "高", "中", "API故障时无法降级"),
    TechDebtItem("组件", "Chain逻辑在main.py中", "中", "中", "难以复用和测试"),
    TechDebtItem("组件", "工具描述写得太简单", "低", "低", "Agent选错工具概率高"),
    TechDebtItem("测试", "无评估数据集", "高", "中", "改Prompt后不知道变好还是变差"),
    TechDebtItem("测试", "无回归测试", "高", "中", "新改动可能引入回归"),
    TechDebtItem("监控", "无LangSmith追踪", "中", "低", "无法调试复杂调用链"),
    TechDebtItem("监控", "无Token/成本监控", "中", "低", "不知道花了多少钱"),
    TechDebtItem("安全", "无输入护栏", "高", "中", "Prompt注入风险"),
    TechDebtItem("安全", "PII未脱敏", "高", "中", "用户隐私泄露风险"),
    TechDebtItem("部署", "无Docker容器化", "低", "中", "部署环境不一致"),
    TechDebtItem("部署", "无优雅关闭", "中", "低", "重启时请求中断"),
]

def assess_debt(items: list[TechDebtItem]) -> dict:
    """评估技术债"""
    high = [i for i in items if i.severity == "高"]
    medium = [i for i in items if i.severity == "中"]
    low = [i for i in items if i.severity == "低"]

    return {
        "total": len(items),
        "high": len(high),
        "medium": len(medium),
        "low": len(low),
        "high_items": [f"{i.category}: {i.description}" for i in high],
        "recommendation": "优先修复高优先级项" if high else "技术债可控",
    }

# 评估
assessment = assess_debt(TECH_DEBT_CHECKLIST)
print(f"总技术债: {assessment['total']}项")
print(f"高: {assessment['high']} | 中: {assessment['medium']} | 低: {assessment['low']}")
for item in assessment["high_items"]:
    print(f"  🔴 {item}")
```

## 三、技术债偿还优先级

```mermaid
graph TD
    subgraph 偿还路径 {"技术债偿还优先级"}
        P1["Step1: 安全债<br/>护栏+脱敏+API Key<br/>(最紧急)"]
        P1 --> P2["Step2: 测试债<br/>评估数据集+回归测试<br/>(防止变差)"]
        P2 --> P3["Step3: 监控债<br/>LangSmith+成本监控<br/>(可观测性)"]
        P3 --> P4["Step4: Prompt债<br/>外部化+版本管理<br/>(可维护性)"]
        P4 --> P5["Step5: 组件债<br/>模块化+复用<br/>(可扩展性)"]
    end

    style P1 fill:'#FFCDD2'
    style P5 fill:'#C8E6C9'
```

## 四、偿还策略

### 4.1 Prompt 外部化（偿还Prompt债）

```python
# ❌ 技术债：Prompt硬编码
chain = ChatPromptTemplate.from_template("你是客服。回答：{input}") | llm

# ✅ 偿还：Prompt外部化+版本管理
# prompts/qa_system/v1.0.txt
# prompts/qa_system/current.txt → v1.0.txt
from prompts.registry import get_prompt
prompt_text = get_prompt("qa_system")  # 从文件加载
chain = ChatPromptTemplate.from_template(prompt_text) | llm
```

### 4.2 模型可配置化（偿还模型债）

```python
# ❌ 技术债：模型名硬编码
llm = ChatOpenAI(model="gpt-4o-mini")

# ✅ 偿还：从配置加载
from config import config
llm = ChatOpenAI(model=config.get("model", "gpt-4o-mini"))
```

### 4.3 组件模块化（偿还组件债）

```python
# ❌ 技术债：所有逻辑在main.py
prompt = ChatPromptTemplate.from_template("...")
chain = prompt | llm | parser
# ... 散落在各处

# ✅ 偿还：模块化到chains/
# chains/qa_chain.py
def get_qa_chain():
    """问答链（可复用）"""
    prompt = ChatPromptTemplate.from_template(get_prompt("qa_system"))
    return prompt | get_llm() | StrOutputParser()
```

## 五、技术债检查频率

| 频率 | 检查内容 |
|------|---------|
| 每周 | Prompt是否硬编码、API Key是否安全 |
| 每月 | 完整技术债评估、测试覆盖率 |
| 每季度 | 架构审查、组件复用性、监控完整性 |
| 每年 | 大规模重构评估、框架升级 |
