# 实战案例 46：智能图书馆 Agent

> 图书馆服务涉及图书检索、推荐、借阅管理、逾期提醒。Agent 能自动处理读者查询和图书管理。

---

## 一、案例概述

```mermaid
graph TB
    subgraph 系统 &#123;"图书馆Agent"&#125;
        U["读者: '推荐AI书籍'"] --> SEARCH["图书检索<br/>按主题/作者"]
        SEARCH --> RECOMMEND["智能推荐<br/>基于阅读历史"]
        RECOMMEND --> BORROW&#123;"要借阅?"&#125;
        BORROW -->|是| CHECKOUT["借阅登记<br/>可用性检查"]
        BORROW -->|否| INFO["图书信息"]
        CHECKOUT & INFO --> NOTIFY["通知+到期提醒"]
    end

    style SEARCH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style NOTIFY fill:#C8E6C9
```

**核心技术：** 图书检索 + 智能推荐 + 借阅管理 + 到期提醒

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
async def search_books(query: str, search_type: str = "title") -> dict:
    """检索图书。

    Args:
        query: 搜索关键词
        search_type: 搜索类型(title/author/subject)
    """
    return &#123;
        "query": query,
        "results": [
            &#123;"id": "B001", "title": "AI简史", "author": "张三", "available": True, "location": "A区3排"&#125;,
            &#123;"id": "B002", "title": "深度学习入门", "author": "李四", "available": False, "location": "B区1排"&#125;,
        ],
        "total_found": 2,
    &#125;

@tool
async def recommend_books(reader_id: str, interest: str = "") -> dict:
    """基于阅读历史推荐图书。

    Args:
        reader_id: 读者ID
        interest: 兴趣主题
    """
    return &#123;
        "reader_id": reader_id,
        "recommendations": [
            &#123;"title": "机器学习实战", "reason": "基于您的AI类阅读历史"&#125;,
            &#123;"title": "Python编程", "reason": "热门技术书籍"&#125;,
        ],
    &#125;

@tool
async def checkout_book(reader_id: str, book_id: str) -> dict:
    """借阅图书。

    Args:
        reader_id: 读者ID
        book_id: 图书ID
    """
    due_date = datetime.now() + timedelta(days=30)
    return &#123;
        "reader_id": reader_id,
        "book_id": book_id,
        "checkout_date": datetime.now().strftime("%Y-%m-%d"),
        "due_date": due_date.strftime("%Y-%m-%d"),
        "status": "借阅成功",
        "renewal_count": 0,
        "max_renewals": 1,
    &#125;

@tool
async def check_overdue(reader_id: str) -> dict:
    """检查逾期情况。

    Args:
        reader_id: 读者ID
    """
    return &#123;
        "reader_id": reader_id,
        "overdue_books": [
            &#123;"book_id": "B003", "title": "数据结构", "due_date": "2025-01-15", "days_overdue": 3, "fine": 1.5&#125;,
        ],
        "total_fine": 1.5,
    &#125;
```

### Agent 组装

```python
from langgraph.prebuilt import create_react_agent

SYSTEM_PROMPT = """你是智能图书馆助手。你可以：

1. **search_books**: 检索图书
2. **recommend_books**: 推荐图书
3. **checkout_book**: 借阅图书
4. **check_overdue**: 检查逾期

## 工作流程
1. 根据读者需求检索图书
2. 可推荐相关图书
3. 支持借阅登记
4. 检查逾期并提醒

## 原则
- 不可借阅的图书要说明
- 逾期要提醒并告知罚款
- 推荐要有理由"""

library_agent = create_react_agent(
    llm,
    [search_books, recommend_books, checkout_book, check_overdue],
    prompt=SYSTEM_PROMPT,
)
```

---

## 三、使用示例

```python
import asyncio

async def main():
    result = await library_agent.ainvoke(&#123;
        "messages": [&#123;"role": "user", "content": "帮我找AI相关的书，推荐几本，借一本可用的"&#125;]
    &#125;)
    print(result["messages"][-1].content[:1500])

asyncio.run(main())
```

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有图书检索 | ☐ |
| 有智能推荐 | ☐ |
| 有借阅管理 | ☐ |
| 有逾期提醒 | ☐ |
