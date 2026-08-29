# Agent 工具链设计

> 工具不是随意堆砌。好的工具链设计让 Agent 既强大又可靠。

---

## 一、工具链设计原则

```mermaid
graph TB
    subgraph 设计原则 &#123;"工具链设计五原则"&#125;
        P1["1. 职责单一<br/>每个工具只做一件事"]
        P2["2. 描述精确<br/>LLM完全靠描述决策"]
        P3["3. 参数简洁<br/>尽量≤3个参数"]
        P4["4. 错误友好<br/>返回有用的错误信息"]
        P5["5. 数量适中<br/>3-7个最佳"]
    end

    style P1 fill:'#C8E6C9'
    style P2 fill:'#FFF9C4'
```

## 二、工具分层架构

```mermaid
graph TB
    subgraph 工具分层 &#123;"工具链分层设计"&#125;
        L1["Layer 1: 基础工具<br/>搜索/计算/日期<br/>(通用，所有Agent可用)"]
        L2["Layer 2: 领域工具<br/>订单查询/产品搜索<br/>(按业务领域分组)"]
        L3["Layer 3: 组合工具<br/>搜索+摘要+翻译<br/>(封装多步操作)"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L2 fill:'#E3F2FD'
    style L3 fill:'#F3E5F5'
```

## 三、工具分组管理

```python
# 不同Agent分配不同工具组
class ToolRegistry:
    """工具注册与分组管理"""
    def __init__(self):
        self.groups = &#123;
            "common": [search_web, calculator, get_date],
            "customer_service": [query_order, refund_tool, submit_complaint],
            "product": [search_product, get_inventory, get_price],
            "analytics": [query_database, generate_chart, export_data],
        &#125;

    def get_tools(self, group: str) -> list:
        """获取指定组的工具"""
        return self.groups.get(group, [])

    def get_common_plus(self, group: str) -> list:
        """获取基础工具+领域工具"""
        return self.groups["common"] + self.groups.get(group, [])

registry = ToolRegistry()

# 客服Agent: 基础工具 + 客服工具
cs_tools = registry.get_common_plus("customer_service")

# 产品Agent: 基础工具 + 产品工具
product_tools = registry.get_common_plus("product")
```

## 四、组合工具设计

```python
@tool
def search_and_summarize(query: str) -> str:
    """搜索互联网并自动总结结果。当需要快速获取搜索结果摘要时使用。

    Args:
        query: 搜索关键词
    """
    # 组合：搜索 → LLM摘要
    from langchain_community.tools import DuckDuckGoSearchRun
    search = DuckDuckGoSearchRun()
    raw = search.invoke(query)

    summary_prompt = ChatPromptTemplate.from_template("总结：&#123;text&#125;")
    summary = (summary_prompt | llm | StrOutputParser()).invoke(&#123;"text": raw[:1000]&#125;)
    return summary
```

## 五、工具描述模板

```python
@tool
def query_order(order_id: str, include_details: bool = False) -> str:
    """查询订单状态和物流信息。

    适用场景：
    - 用户询问订单进度、物流状态
    - 用户问"我的包裹到哪了"
    - 用户问"订单什么时候发货"

    不适用场景：
    - 用户问产品信息（用search_product）
    - 用户问退换货政策（用get_refund_policy）

    Args:
        order_id: 订单号，格式ORD后跟数字（如ORD001）
        include_details: 是否包含详细信息（商品列表、金额），默认False

    Returns:
        订单状态摘要或详细信息
    """
    pass
```

## 六、工具链设计检查表

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 职责单一 | 每个工具只做一件事 | ☐ |
| 描述精确 | 说明做什么、何时用、何时不 | ☐ |
| 参数≤3 | 参数简洁，有类型标注 | ☐ |
| 错误友好 | 失败时返回有用信息 | ☐ |
| 数量3-7 | 不超过7个工具 | ☐ |
| 分组管理 | 按领域分组 | ☐ |
| 无重叠 | 工具间职责不重叠 | ☐ |
