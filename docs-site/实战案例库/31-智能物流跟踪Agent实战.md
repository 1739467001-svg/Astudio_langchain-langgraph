# 实战案例 31：智能物流跟踪 Agent

> 用户问"我的快递到哪了"——Agent 需要查询物流系统、理解状态、预估到达时间、处理异常。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"物流跟踪Agent"&#125;
        U["用户: '查我的快递'"] --> QUERY["查询物流<br/>运单号识别"]
        QUERY --> STATUS["状态分析<br/>当前位置+状态"]
        STATUS --> ETA["预估到达<br/>ETA计算"]
        ETA --> EXCEPTION&#123;"有异常?"&#125;
        EXCEPTION -->|是| ALERT["异常处理<br/>延迟/丢失/破损"]
        EXCEPTION -->|否| REPORT["跟踪报告"]
        ALERT --> REPORT
    end

    style QUERY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 运单查询 + 状态分析 + ETA 预估 + 异常处理

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re
from datetime import datetime, timedelta

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def query_logistics(tracking_number: str) -> dict:
    """查询运单物流状态。

    Args:
        tracking_number: 运单号
    """
    # 实际接入物流API
    return &#123;
        "tracking_number": tracking_number,
        "status": "运输中",
        "current_location": "北京转运中心",
        "destination": "上海",
        "history": [
            &#123;"time": "2025-01-01 10:00", "location": "深圳", "action": "已揽收"&#125;,
            &#123;"time": "2025-01-01 20:00", "location": "深圳转运中心", "action": "已到达"&#125;,
            &#123;"time": "2025-01-02 08:00", "location": "北京转运中心", "action": "已到达"&#125;,
        ],
        "estimated_delivery": "2025-01-03 18:00",
    &#125;

@tool
async def analyze_status(logistics_data: dict) -> dict:
    """分析物流状态和预估到达时间。

    Args:
        logistics_data: 物流查询结果
    """
    status = logistics_data.get("status", "未知")
    eta = logistics_data.get("estimated_delivery", "未知")
    history = logistics_data.get("history", [])
    last_update = history[-1] if history else &#123;&#125;

    prompt = f"""分析物流状态。

物流数据: &#123;json.dumps(logistics_data, ensure_ascii=False)[:1000]&#125;

分析:
1. 当前状态解读
2. 预估到达时间是否合理
3. 是否有延迟风险
4. 异常标记

输出JSON:
```json
&#123;&#123;
  "status_summary": "当前状态简述",
  "eta_assessment": "合理/可能延迟/无法预估",
  "delay_risk": "low/medium/high",
  "is_abnormal": true/false,
  "abnormal_type": "延迟/丢失/破损/无异常",
  "recommendation": "建议"
&#125;&#125;
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\&#123;.*\&#125;', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return &#123;"status_summary": status, "is_abnormal": False&#125;

@tool
async def handle_exception(tracking_number: str, analysis: dict) -> str:
    """处理物流异常。

    Args:
        tracking_number: 运单号
        analysis: 状态分析
    """
    abnormal_type = analysis.get("abnormal_type", "无异常")

    if "延迟" in abnormal_type:
        return f"运单&#123;tracking_number&#125;出现延迟，建议联系物流公司客服查询具体原因。"
    elif "丢失" in abnormal_type:
        return f"运单&#123;tracking_number&#125;可能丢失，建议立即联系发货方申请理赔。"
    elif "破损" in abnormal_type:
        return f"运单&#123;tracking_number&#125;可能破损，建议收货时当场验货并拍照留证。"
    return "无异常"

@tool
async def generate_tracking_report(
    tracking_number: str,
    logistics: dict,
    analysis: dict,
    exception: str = "",
) -> str:
    """生成物流跟踪报告。

    Args:
        tracking_number: 运单号
        logistics: 物流数据
        analysis: 分析结果
        exception: 异常处理（如有）
    """
    report = f"""# 物流跟踪报告

## 运单信息
- 运单号: &#123;tracking_number&#125;
- 当前状态: &#123;logistics.get('status', '未知')&#125;
- 当前位置: &#123;logistics.get('current_location', '未知')&#125;
- 目的地: &#123;logistics.get('destination', '未知')&#125;
- 预计送达: &#123;logistics.get('estimated_delivery', '未知')&#125;

## 状态分析
- 概述: &#123;analysis.get('status_summary', '未知')&#125;
- 延迟风险: &#123;analysis.get('delay_risk', '未知')&#125;
- 预估评估: &#123;analysis.get('eta_assessment', '未知')&#125;
"""
    if analysis.get("is_abnormal") and exception:
        report += f"\n## ⚠️ 异常处理\n&#123;exception&#125;\n"

    report += "\n## 物流轨迹\n"
    for record in logistics.get("history", []):
        report += f"- &#123;record.get('time', '')&#125; | &#123;record.get('location', '')&#125; | &#123;record.get('action', '')&#125;\n"

    return report
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能物流跟踪助手。你可以：

1. **query_logistics**: 查询运单物流
2. **analyze_status**: 分析状态+预估到达
3. **handle_exception**: 处理异常
4. **generate_tracking_report**: 生成跟踪报告

## 工作流程
1. 识别运单号
2. 查询物流状态
3. 分析状态和ETA
4. 如有异常→处理
5. 生成跟踪报告"""

logistics_agent = create_react_agent(
    llm,
    [query_logistics, analyze_status, handle_exception, generate_tracking_report],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await logistics_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "帮我查一下运单SF1234567890到哪了"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有物流查询 | ☐ |
| 有状态分析 | ☐ |
| 有异常处理 | ☐ |
| 有报告生成 | ☐ |
