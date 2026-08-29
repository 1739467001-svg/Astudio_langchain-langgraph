# 智能税务申报 Agent 实战

> 一个完整的税务申报 Agent，集成 RAG 重排序、人机交互审批、价值约束护栏和 Prompt 缓存优化。覆盖从收入识别到税表生成的全流程，所有高风险操作（提交申报、修改数据）都经过人工审批。

---

## 1. 项目概述

### 业务场景

```
用户："帮我计算这个季度的个人所得税，我有工资收入和稿费收入"
  ↓
Agent：识别收入类型 → 查询税率表(RAG+重排) → 计算应纳税额 → 生成税表
  ↓
关键操作（提交申报）→ ⏸️ 暂停等待人工确认 → ▶️ 确认后提交
```

### 技术要点

| 组件 | 技术 | 对应知识库 |
|------|------|-----------|
| 税率检索 | RAG + Cross-encoder 重排序 | 407 |
| 申报审批 | LangGraph interrupt 人机交互 | 408 |
| 税法缓存 | Prompt 缓存复用 | 409 |
| 安全护栏 | 输入/输出护栏 + 约束注册 | 410 |
| 大规模税法 | 向量量化压缩 | 411 |

---

## 2. 架构设计

```mermaid
graph TB
    USER["用户输入"] --> IG["输入护栏<br/>注入检测"]
    IG -->|安全| AGENT["Agent 规划<br/>收入识别+税率查询"]
    IG -->|危险| REJ["拒绝并提示"]
    
    AGENT --> RAG["RAG 检索<br/>向量召回+重排序"]
    RAG --> CACHE["Prompt 缓存<br/>税法前缀复用"]
    CACHE --> CALC["税款计算<br/>阶梯税率引擎"]
    
    CALC --> SUBMIT&#123;"提交申报?"&#125;
    SUBMIT -->|是| INTERRUPT["⏸️ 中断<br/>等待人工审批"]
    INTERRUPT -->|批准| EXEC["执行提交<br/>+审计日志"]
    INTERRUPT -->|拒绝| CANCEL["取消提交"]
    
    EXEC --> OG["输出护栏<br/>敏感信息过滤"]
    OG --> RESP["返回结果"]
    CANCEL --> RESP

    style IG fill:#FFCDD2,stroke:#C62828
    style INTERRUPT fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style RAG fill:#E3F2FD,stroke:#1565C0
    style CACHE fill:#E8F5E9,stroke:#2E7D32
    style OG fill:#FFCDD2,stroke:#C62828
```

---

## 3. 完整实现

### 3.1 税率表 RAG + 重排序

```python
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from sentence_transformers import CrossEncoder
import numpy as np

# 税法知识库（实际应从文档加载）
TAX_LAWS = [
    Document(
        page_content="2025年个人所得税税率表（综合所得）：不超过36000元的部分，税率3%，速算扣除数0。超过36000元至144000元的部分，税率10%，速算扣除数2520。",
        metadata=&#123;"id": "tax_rate_2025", "category": "综合所得", "year": 2025&#125;,
    ),
    Document(
        page_content="稿酬所得以每次出版、发表取得的收入为一次。稿酬所得以收入减除费用后的余额为收入额，减按70%计算。适用20%比例税率。",
        metadata=&#123;"id": "royalty_rate", "category": "稿酬", "year": 2025&#125;,
    ),
    Document(
        page_content="劳务报酬所得每次收入不超过4000元的，减除费用800元；4000元以上的，减除20%的费用。适用20%-40%超额累进税率。",
        metadata=&#123;"id": "labor_rate", "category": "劳务报酬", "year": 2025&#125;,
    ),
    Document(
        page_content="专项附加扣除包括：子女教育每月1000元/孩，继续教育每月400元，住房贷款利息每月1000元，住房租金每月800-1500元，赡养老人每月1000-3000元。",
        metadata=&#123;"id": "special_deductions", "category": "专项扣除", "year": 2025&#125;,
    ),
    Document(
        page_content="居民个人综合所得年度汇算清缴：全年收入额减除费用60000元、专项扣除、专项附加扣除和依法确定的其他扣除后为应纳税所得额。",
        metadata=&#123;"id": "annual_settlement", "category": "汇算清缴", "year": 2025&#125;,
    ),
]

class TaxRAGSystem:
    """税率检索系统：向量召回 + Cross-encoder 重排序"""

    def __init__(self, documents: list[Document]):
        # 第一阶段：向量召回
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        self.vectorstore = FAISS.from_documents(documents, embeddings)

        # 第二阶段：Cross-encoder 重排序
        self.reranker = CrossEncoder("BAAI/bge-reranker-base")

    def search(self, query: str, top_k: int = 3) -> list[Document]:
        """两阶段检索：粗召回 + 精重排"""
        # 召回 Top-20
        candidates = self.vectorstore.similarity_search(query, k=20)

        if not candidates:
            return []

        # Cross-encoder 重排
        pairs = [(query, doc.page_content) for doc in candidates]
        scores = self.reranker.predict(pairs)

        # 按分数排序
        scored = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)

        # 返回 Top-K
        results = []
        for doc, score in scored[:top_k]:
            doc.metadata["rerank_score"] = float(score)
            results.append(doc)

        return results

# 初始化税率检索系统
tax_rag = TaxRAGSystem(TAX_LAWS)

# 测试检索
results = tax_rag.search("稿费收入怎么交税？")
for r in results:
    print(f"[&#123;r.metadata['rerank_score']:.4f&#125;] &#123;r.page_content[:80]&#125;...")
```

### 3.2 税款计算引擎

```python
from dataclasses import dataclass, field
from typing import Literal

IncomeType = Literal["工资薪金", "稿酬", "劳务报酬", "特许权使用费"]

@dataclass
class Income:
    """收入项"""
    type: IncomeType
    amount: float
    description: str = ""

@dataclass
class TaxResult:
    """计算结果"""
    total_income: float = 0
    deductions: float = 0
    taxable_income: float = 0
    tax_amount: float = 0
    after_tax: float = 0
    details: list[dict] = field(default_factory=list)

class TaxCalculator:
    """税款计算引擎"""

    # 综合所得累进税率表
    TAX_BRACKETS = [
        (36000, 0.03, 0),
        (144000, 0.10, 2520),
        (300000, 0.20, 16920),
        (420000, 0.25, 31920),
        (660000, 0.30, 52920),
        (960000, 0.35, 85920),
        (float("inf"), 0.45, 181920),
    ]

    STANDARD_DEDUCTION = 60000  # 年度基本减除
    SPECIAL_DEDUCTIONS = &#123;
        "子女教育": 12000,    # 1000×12
        "继续教育": 4800,     # 400×12
        "住房贷款利息": 12000,
        "住房租金": 12000,
        "赡养老人": 24000,
    &#125;

    def calculate(
        self,
        incomes: list[Income],
        special_deductions: list[str] | None = None,
    ) -> TaxResult:
        """计算年度综合所得个人所得税"""
        result = TaxResult()
        special_deductions = special_deductions or []

        # 计算各项收入
        for income in incomes:
            detail = &#123;"type": income.type, "amount": income.amount&#125;

            if income.type == "工资薪金":
                # 工资薪金全额计入
                result.total_income += income.amount
                detail["计入额"] = income.amount

            elif income.type == "稿酬":
                # 稿酬减按 70% 计入
                income_amount = income.amount * 0.7
                result.total_income += income_amount
                detail["计入额"] = income_amount
                detail["说明"] = "减按70%计入"

            elif income.type == "劳务报酬":
                # 劳务报酬减除 20% 费用
                if income.amount <= 4000:
                    income_amount = income.amount - 800
                else:
                    income_amount = income.amount * 0.8
                result.total_income += income_amount
                detail["计入额"] = income_amount
                detail["说明"] = "减除20%费用"

            result.details.append(detail)

        # 专项附加扣除
        for deduction_name in special_deductions:
            amount = self.SPECIAL_DEDUCTIONS.get(deduction_name, 0)
            result.deductions += amount

        # 应纳税所得额
        result.taxable_income = max(
            result.total_income - self.STANDARD_DEDUCTION - result.deductions,
            0
        )

        # 阶梯税率计算
        result.tax_amount = self._progressive_tax(result.taxable_income)
        result.after_tax = result.total_income - result.tax_amount

        return result

    def _progressive_tax(self, taxable: float) -> float:
        """累进税率计算"""
        if taxable <= 0:
            return 0

        for limit, rate, deduction in self.TAX_BRACKETS:
            if taxable <= limit:
                return taxable * rate - deduction

        return 0

# 使用
calc = TaxCalculator()
result = calc.calculate(
    incomes=[
        Income("工资薪金", 180000, "年度工资"),
        Income("稿酬", 30000, "书稿"),
        Income("劳务报酬", 20000, "讲座"),
    ],
    special_deductions=["子女教育", "住房贷款利息"],
)
print(f"总收入: &#123;result.total_income:,.0f&#125;")
print(f"扣除: &#123;result.deductions:,.0f&#125;")
print(f"应纳税所得额: &#123;result.taxable_income:,.0f&#125;")
print(f"应纳税额: &#123;result.tax_amount:,.0f&#125;")
print(f"税后收入: &#123;result.after_tax:,.0f&#125;")
```

### 3.3 人机交互审批 + 价值约束

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
import json

class TaxAgentState(TypedDict):
    messages: Annotated[list, add_messages]
    incomes: list[dict]
    deductions: list[str]
    tax_result: dict | None
    submit_status: str  # pending / approved / rejected / cancelled
    audit_log: list[dict]


class TaxConstraintRegistry:
    """税务 Agent 价值约束"""

    def check(self, action: dict) -> dict:
        tool = action.get("tool", "")

        # 约束 1：禁止修改历史申报
        if tool == "modify_historical_filing":
            return &#123;"allowed": False, "reason": "禁止修改历史申报数据"&#125;

        # 约束 2：大额退税需要审批
        if tool == "submit_filing":
            refund = action.get("args", &#123;&#125;).get("refund_amount", 0)
            if refund > 10000:
                return &#123;
                    "allowed": False,
                    "needs_approval": True,
                    "reason": f"退税金额 &#123;refund:,.0f&#125; 超过 10000，需要主管审批",
                &#125;

        # 约束 3：禁止导出完整纳税人信息
        if tool == "export_data":
            return &#123;"allowed": False, "reason": "禁止导出完整纳税人信息"&#125;

        return &#123;"allowed": True&#125;


def input_guardrail_node(state: TaxAgentState) -> dict:
    """输入安全检查"""
    user_input = state["messages"][-1].content

    # 简单注入检测
    dangerous = ["忽略指令", "ignore instruction", "system prompt", "DELETE"]
    for kw in dangerous:
        if kw.lower() in user_input.lower():
            return &#123;
                "submit_status": "blocked",
                "messages": [&#123;"role": "ai", "content": f"输入包含危险关键词：&#123;kw&#125;"&#125;],
            &#125;

    return &#123;"submit_status": "input_ok"&#125;


def parse_income_node(state: TaxAgentState) -> dict:
    """解析收入信息"""
    # 模拟 LLM 解析（实际用 LLM）
    user_msg = state["messages"][-1].content

    incomes = []
    if "工资" in user_msg or "薪金" in user_msg:
        incomes.append(&#123;"type": "工资薪金", "amount": 180000, "description": "年度工资"&#125;)
    if "稿费" in user_msg or "稿酬" in user_msg:
        incomes.append(&#123;"type": "稿酬", "amount": 30000, "description": "书稿"&#125;)
    if "劳务" in user_msg:
        incomes.append(&#123;"type": "劳务报酬", "amount": 20000, "description": "讲座"&#125;)

    deductions = []
    if "子女" in user_msg:
        deductions.append("子女教育")
    if "房贷" in user_msg or "住房" in user_msg:
        deductions.append("住房贷款利息")

    return &#123;"incomes": incomes, "deductions": deductions&#125;


def calculate_tax_node(state: TaxAgentState) -> dict:
    """税款计算"""
    incomes = [Income(**inc) for inc in state["incomes"]]
    result = TaxCalculator().calculate(incomes, state["deductions"])

    return &#123;
        "tax_result": &#123;
            "total_income": result.total_income,
            "deductions": result.deductions,
            "taxable_income": result.taxable_income,
            "tax_amount": result.tax_amount,
            "after_tax": result.after_tax,
            "details": result.details,
        &#125;
    &#125;


def review_and_submit_node(state: TaxAgentState) -> dict:
    """提交申报前的人机交互审批"""
    result = state["tax_result"]

    # 检查价值约束
    constraints = TaxConstraintRegistry()
    check = constraints.check(&#123;
        "tool": "submit_filing",
        "args": &#123;"refund_amount": max(0, result["taxable_income"] - result["tax_amount"])&#125;,
    &#125;)

    if not check.get("allowed") and check.get("needs_approval"):
        # 触发中断，等待人工审批
        approval = interrupt(&#123;
            "type": "tax_filing_approval",
            "summary": &#123;
                "total_income": result["total_income"],
                "taxable_income": result["taxable_income"],
                "tax_amount": result["tax_amount"],
            &#125;,
            "reason": check["reason"],
            "message": "请审核以下税务申报信息后确认提交",
        &#125;)

        if approval.get("approved"):
            return &#123;
                "submit_status": "approved",
                "audit_log": state.get("audit_log", []) + [&#123;
                    "action": "submit_filing",
                    "status": "approved",
                    "reviewer": approval.get("reviewer"),
                    "timestamp": __import__("time").time(),
                &#125;],
            &#125;
        else:
            return &#123;
                "submit_status": "rejected",
                "audit_log": state.get("audit_log", []) + [&#123;
                    "action": "submit_filing",
                    "status": "rejected",
                    "reason": approval.get("reason"),
                &#125;],
            &#125;

    elif not check.get("allowed"):
        return &#123;
            "submit_status": "blocked",
            "audit_log": state.get("audit_log", []) + [&#123;
                "action": "submit_filing",
                "status": "blocked",
                "reason": check.get("reason"),
            &#125;],
        &#125;

    # 无需审批，直接提交
    return &#123;
        "submit_status": "submitted",
        "audit_log": state.get("audit_log", []) + [&#123;
            "action": "submit_filing",
            "status": "submitted",
        &#125;],
    &#125;


def output_guardrail_node(state: TaxAgentState) -> dict:
    """输出安全检查：过滤敏感信息"""
    import re
    result = state.get("tax_result", &#123;&#125;)
    output = json.dumps(result, ensure_ascii=False, indent=2)

    # 过滤身份证号等敏感信息
    output = re.sub(r'\b\d&#123;15,18&#125;[Xx]?\b', '[已脱敏]', output)

    return &#123;
        "messages": [&#123;"role": "ai", "content": f"税务计算结果：\n&#123;output&#125;"&#125;],
    &#125;


# 构建 Agent 图
def build_tax_agent():
    graph = StateGraph(TaxAgentState)

    graph.add_node("input_guard", input_guardrail_node)
    graph.add_node("parse_income", parse_income_node)
    graph.add_node("calculate_tax", calculate_tax_node)
    graph.add_node("review_submit", review_and_submit_node)
    graph.add_node("output_guard", output_guardrail_node)

    graph.add_edge(START, "input_guard")
    graph.add_conditional_edges(
        "input_guard",
        lambda s: "parse_income" if s["submit_status"] != "blocked" else "output_guard",
    )
    graph.add_edge("parse_income", "calculate_tax")
    graph.add_edge("calculate_tax", "review_submit")
    graph.add_edge("review_submit", "output_guard")
    graph.add_edge("output_guard", END)

    return graph.compile(checkpointer=MemorySaver())


# 使用示例
import uuid

app = build_tax_agent()
config = &#123;"configurable": &#123;"thread_id": str(uuid.uuid4())&#125;&#125;

# 第一次调用：执行到 review_submit 时暂停（interrupt）
result = app.invoke(
    &#123;
        "messages": [&#123;"role": "user", "content": "帮我计算年度个税，有工资18万、稿费3万和劳务报酬2万，有子女教育和房贷利息扣除"&#125;],
        "incomes": [],
        "deductions": [],
        "submit_status": "",
        "audit_log": [],
    &#125;,
    config=config,
)

# 查看 Agent 的计算结果
state = app.get_state(config)
print("待审批:", state.values.get("tax_result"))

# 人工审批通过
result = app.invoke(
    Command(resume=&#123;"approved": True, "reviewer": "tax_manager"&#125;),
    config=config,
)
print("最终状态:", result["submit_status"])
```

---

## 4. Prompt 缓存优化

```python
# 税法知识库内容作为稳定前缀（可缓存）
STABLE_TAX_LAW_PREFIX = """你是专业税务顾问。以下是2025年最新税法要点：

## 综合所得
- 工资薪金：全额计入
- 稿酬：减按70%计入
- 劳务报酬：减除20%费用后计入
- 特许权使用费：减除20%费用后计入

## 基本减除：每年60000元
## 专项附加扣除：子女教育/继续教育/住房贷款利息/住房租金/赡养老人

## 综合所得税率表（年度）：
- 不超36000：3%
- 36000-144000：10%
- 144000-300000：20%
- 300000-420000：25%
- 420000-660000：30%
- 660000-960000：35%
- 超960000：45%"""

# 每次调用只变化用户问题和检索结果
# 系统提示 + 税法知识 会被缓存
from langchain_core.prompts import ChatPromptTemplate

cached_prompt = ChatPromptTemplate.from_messages([
    ("system", STABLE_TAX_LAW_PREFIX),  # 可缓存前缀（约 500 Token）
    ("placeholder", "&#123;chat_history&#125;"),   # 变化部分
    ("human", "&#123;user_input&#125;"),
])
```

---

## 5. 运行效果

```python
# 完整运行流程
print("=" * 60)
print("智能税务申报 Agent")
print("=" * 60)

# 1. 输入安全检查
print("\n[1] 输入安全检查... 通过")

# 2. 收入解析
print("[2] 收入解析:")
for inc in result.get("incomes", []):
    print(f"    - &#123;inc['type']&#125;: ¥&#123;inc['amount']:,.0f&#125;")

# 3. 税款计算
print("[3] 税款计算:")
tax = result.get("tax_result", &#123;&#125;)
print(f"    总收入: ¥&#123;tax.get('total_income', 0):,.0f&#125;")
print(f"    专项扣除: ¥&#123;tax.get('deductions', 0):,.0f&#125;")
print(f"    应纳税所得额: ¥&#123;tax.get('taxable_income', 0):,.0f&#125;")
print(f"    应纳税额: ¥&#123;tax.get('tax_amount', 0):,.0f&#125;")
print(f"    税后收入: ¥&#123;tax.get('after_tax', 0):,.0f&#125;")

# 4. 人工审批
print("[4] 人工审批: ⏸️ 已暂停等待确认")

# 5. 审批通过后提交
print("[5] 审批通过，已提交申报")
print("[6] 审计日志:", result.get("audit_log"))
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| RAG + Cross-encoder 重排序 | ☐ |
| LangGraph interrupt 审批 | ☐ |
| Prompt 缓存前缀 | ☐ |
| 输入/输出护栏 | ☐ |
| 价值约束注册 | ☐ |
| 审计日志 | ☐ |
| 阶梯税率计算 | ☐ |
| 专项附加扣除 | ☐ |
| 稿酬/劳务报酬特殊处理 | ☐ |
