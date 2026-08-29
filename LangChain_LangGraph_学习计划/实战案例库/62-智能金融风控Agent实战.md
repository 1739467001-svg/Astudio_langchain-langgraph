# 实战案例 62：智能金融风控 Agent

> 金融风控涉及用户画像分析、交易行为评估、风险评分和决策建议。Agent 能自动分析用户信用、检测异常交易并给出风控建议，辅助风控团队决策。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"金融风控Agent"}
        U["风控员: '评估用户U001的贷款申请'"] --> PROFILE["用户画像<br/>信用+资产+负债"]
        PROFILE --> BEHAVIOR["行为分析<br/>交易模式+异常检测"]
        BEHAVIOR --> SCORE{"风险评分"}
        SCORE -->|低风险| APPROVE["建议批准<br/>设定额度"]
        SCORE -->|中风险| REVIEW["建议人工审核<br/>补充材料"]
        SCORE -->|高风险| REJECT["建议拒绝<br/>标记关注"]
        APPROVE & REVIEW & REJECT --> REPORT["风控报告"]
    end

    style PROFILE fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style SCORE fill:#E3F2FD,stroke:#1565C0
    style REPORT fill:#C8E6C9
```

**核心技术：** 用户画像分析 + 交易行为评估 + 风险评分 + 决策建议

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
async def analyze_profile(user_id: str) -> dict:
    """分析用户信用画像。

    Args:
        user_id: 用户ID
    """
    return {
        "user_id": user_id,
        "name": "张三",
        "age": 32,
        "credit_score": 720,
        "annual_income_cny": 250000,
        "total_assets_cny": 1800000,
        "total_debt_cny": 450000,
        "debt_to_income_ratio": 0.18,
        "credit_history_years": 8,
        "existing_loans": 1,
        "late_payments_2y": 1,
        "employment_years": 5,
        "employer": "某科技有限公司",
        "residence": "自有",
    }

@tool
async def analyze_behavior(user_id: str, profile: dict) -> dict:
    """分析交易行为模式。

    Args:
        user_id: 用户ID
        profile: 用户画像
    """
    return {
        "user_id": user_id,
        "avg_monthly_transactions": 85,
        "avg_transaction_amount": 320,
        "large_transactions_30d": 3,
        "night_transactions_pct": 5.0,
        "cross_border_transactions": 0,
        "merchant_diversity": 42,
        "transaction_trend": "稳定",
        "anomaly_score": 0.15,
        "flagged_transactions": [
            {"date": "2026-08-15", "amount": 15000, "reason": "金额异常", "severity": "中"},
        ],
        "behavioral_risk": "低" if 0.15 < 0.3 else "中",
    }

@tool
async def calculate_risk_score(profile: dict, behavior: dict) -> dict:
    """计算综合风险评分。

    Args:
        profile: 用户画像
        behavior: 行为分析
    """
    # 多维度评分
    credit_score = profile.get("credit_score", 600)
    dti = profile.get("debt_to_income_ratio", 0.5)
    late_payments = profile.get("late_payments_2y", 0)
    anomaly = behavior.get("anomaly_score", 0)
    income = profile.get("annual_income_cny", 0)

    # 各维度得分（0-100，越高越安全）
    credit_dim = min(credit_score / 850 * 100, 100)
    dti_dim = max(0, 100 - dti * 200)  # DTI越低越好
    history_dim = max(0, 100 - late_payments * 20)
    behavior_dim = max(0, 100 - anomaly * 200)
    income_dim = min(income / 300000 * 100, 100)

    # 加权综合
    weights = {"credit": 0.3, "dti": 0.2, "history": 0.15, "behavior": 0.2, "income": 0.15}
    total_score = (
        credit_dim * weights["credit"] +
        dti_dim * weights["dti"] +
        history_dim * weights["history"] +
        behavior_dim * weights["behavior"] +
        income_dim * weights["income"]
    )

    # 风险等级
    if total_score >= 75:
        risk_level = "低"
        action = "建议批准"
        max_amount = min(income * 5, 1000000)
    elif total_score >= 55:
        risk_level = "中"
        action = "建议人工审核"
        max_amount = min(income * 3, 500000)
    else:
        risk_level = "高"
        action = "建议拒绝"
        max_amount = 0

    return {
        "total_score": round(total_score, 1),
        "risk_level": risk_level,
        "recommended_action": action,
        "max_loan_amount_cny": max_amount,
        "score_breakdown": {
            "信用分": round(credit_dim, 1),
            "负债收入比": round(dti_dim, 1),
            "还款记录": round(history_dim, 1),
            "行为风险": round(behavior_dim, 1),
            "收入水平": round(income_dim, 1),
        },
        "weights": weights,
    }

@tool
async def generate_risk_report(profile: dict, behavior: dict, risk: dict) -> dict:
    """生成风控报告。

    Args:
        profile: 用户画像
        behavior: 行为分析
        risk: 风险评分
    """
    return {
        "report_id": f"RC-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "generated_at": datetime.now().isoformat(),
        "user_id": profile.get("user_id", ""),
        "name": profile.get("name", ""),
        "profile_summary": {
            "credit_score": profile.get("credit_score", 0),
            "annual_income": profile.get("annual_income_cny", 0),
            "dti_ratio": profile.get("debt_to_income_ratio", 0),
            "credit_years": profile.get("credit_history_years", 0),
        },
        "behavior_summary": {
            "avg_monthly_txn": behavior.get("avg_monthly_transactions", 0),
            "anomaly_score": behavior.get("anomaly_score", 0),
            "flagged_count": len(behavior.get("flagged_transactions", [])),
        },
        "risk_assessment": {
            "total_score": risk.get("total_score", 0),
            "risk_level": risk.get("risk_level", ""),
            "action": risk.get("recommended_action", ""),
            "max_loan": risk.get("max_loan_amount_cny", 0),
            "breakdown": risk.get("score_breakdown", {}),
        },
        "conditions": "需提供收入证明+银行流水" if risk.get("risk_level") == "中" else "",
        "disclaimer": "本报告由AI辅助生成，仅供参考，最终决策由风控委员会审批",
    }
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能金融风控助手。你可以：

1. **analyze_profile**: 分析用户信用画像
2. **analyze_behavior**: 分析交易行为模式
3. **calculate_risk_score**: 计算综合风险评分
4. **generate_risk_report**: 生成风控报告

## 工作流程
1. 获取用户信用画像（信用分、收入、负债、还款记录）
2. 分析交易行为（交易频率、异常检测、大额标记）
3. 多维度加权计算风险评分（信用/负债/历史/行为/收入）
4. 根据评分给出风险等级和决策建议
5. 生成完整风控报告

## 原则
- 多维度评估，不依赖单一指标
- 风险评分要有分解明细
- 高风险必须标记原因
- 中风险建议补充材料
- 所有建议标注仅供参考"""

risk_agent = create_react_agent(
    llm,
    [analyze_profile, analyze_behavior, calculate_risk_score, generate_risk_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await risk_agent.ainvoke({
        "messages": [{"role": "user", "content": "评估用户U001的贷款申请，给出风控建议"}]
    })
    print(result["messages"][-1].content[:2000])

asyncio.run(main())
```

预期输出示例：

```
金融风控报告

报告编号：RC-20260827200000
用户：U001（张三）

用户画像：
- 信用分：720
- 年收入：25万元
- 负债收入比：18%
- 信用历史：8年
- 逾期记录：1次（近2年）

行为分析：
- 月均交易：85笔
- 平均金额：320元
- 异常评分：0.15（低）
- 标记交易：1笔（大额15000元）

风险评分：79.5分
  信用分维度: 84.7
  负债收入比维度: 64.0
  还款记录维度: 80.0
  行为风险维度: 70.0
  收入水平维度: 83.3

风险等级：低
建议动作：建议批准
建议最高额度：1,000,000元

附加条件：无
⚠ 本报告由AI辅助生成，仅供参考，最终决策由风控委员会审批
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有用户画像分析 | ☐ |
| 有行为分析 | ☐ |
| 有风险评分 | ☐ |
| 有决策建议 | ☐ |
| 评分有维度分解 | ☐ |
| 有免责声明 | ☐ |
| 使用 create_react_agent | ☐ |
| 包含使用示例 | ☐ |
