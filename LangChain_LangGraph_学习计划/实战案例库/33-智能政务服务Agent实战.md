# 实战案例 33：智能政务服务 Agent

> 政务服务涉及办事指南、政策咨询、材料预审、进度查询。Agent 能让"让数据多跑路，让群众少跑腿"。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 {"政务服务Agent"}
        U["市民: '如何办理居住证'"] --> CLASSIFY["事项分类<br/>办事/咨询/查询"]
        CLASSIFY --> GUIDE["办事指南<br/>材料+流程+地点"]
        GUIDE --> PRECHECK{"材料预审?"}
        PRECHECK -->|是| CHECK["预审材料"]
        PRECHECK -->|否| REPORT["办事指南"]
        CHECK --> REPORT
    end

    style CLASSIFY fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style REPORT fill:#C8E6C9
```

**核心技术：** 事项分类 + 政策检索 + 材料预审 + 办事指南

---

## 二、核心实现

```python
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
import json, re

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

@tool
async def classify_service(user_request: str) -> dict:
    """分类政务服务事项。

    Args:
        user_request: 用户请求
    """
    prompt = f"""分类以下政务请求。

请求: {user_request}

分类:
1. 办事指南（如何办理某事）
2. 政策咨询（某政策内容）
3. 进度查询（查办理进度）
4. 材料预审（检查材料是否齐全）

输出JSON:
```json
{{
  "category": "...",
  "service_name": "具体事项名",
  "urgency": "high/normal"
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"category": "办事指南"}

@tool
async def search_policy(query: str) -> str:
    """搜索相关政策法规。

    Args:
        query: 搜索查询
    """
    # 实际接入政务知识库
    return f"政策查询结果: {query}——居住证办理需提供身份证、租房合同、社保证明"

@tool
async def generate_guide(service_name: str, policy_info: str) -> str:
    """生成办事指南。

    Args:
        service_name: 事项名称
        policy_info: 政策信息
    """
    prompt = f"""生成办事指南。

事项: {service_name}
政策依据: {policy_info[:500]}

指南包含:
1. 办理条件
2. 所需材料
3. 办理流程
4. 办理地点
5. 办理时限
6. 费用

指南:"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    return response.content

@tool
async def precheck_materials(service_name: str, user_materials: list[str]) -> dict:
    """预审材料是否齐全。

    Args:
        service_name: 事项名称
        user_materials: 用户已有材料列表
    """
    prompt = f"""检查用户材料是否齐全。

事项: {service_name}
用户已有材料: {user_materials}
所需材料: [身份证, 租房合同, 社保证明, 照片]

输出JSON:
```json
{{
  "complete": true/false,
  "missing": ["缺失材料"],
  "extra": ["多余材料"],
  "notes": "注意事项"
}}
```"""
    response = await llm.ainvoke([HumanMessage(content=prompt)])
    match = re.search(r'\{.*\}', response.content, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"complete": False, "missing": ["未知"]}
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能政务服务助手。你可以：

1. **classify_service**: 分类政务事项
2. **search_policy**: 搜索政策法规
3. **generate_guide**: 生成办事指南
4. **precheck_materials**: 预审材料

## 工作流程
1. 分类用户请求
2. 搜索相关政策
3. 生成办事指南
4. 如需预审→检查材料

## 原则
- 信息准确，基于政策
- 指南要具体可操作
- 提供办理地点和时限"""

gov_agent = create_react_agent(
    llm,
    [classify_service, search_policy, generate_guide, precheck_materials],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await gov_agent.ainvoke({
        "messages": [{"role": "user", "content": "我想办理居住证，需要什么材料？"}]
    })
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有事项分类 | ☐ |
| 有政策检索 | ☐ |
| 有办事指南 | ☐ |
| 有材料预审 | ☐ |
