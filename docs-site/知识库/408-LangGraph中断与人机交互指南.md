# LangGraph 中断与人机交互指南

> Agent 全自动执行不一定靠谱——发邮件、删数据、提交订单这类高风险操作，应该暂停等人类确认再继续。LangGraph 的中断机制（interrupt）让你在任意节点暂停、人工审核、然后恢复执行，实现 human-in-the-loop 工作流。

---

## 1. 为什么需要中断

### 全自动 vs 人机协同

```
全自动 Agent：
  用户 → Agent规划 → 工具调用 → 工具调用 → 完成
  问题：高风险操作无人把关

人机协同 Agent：
  用户 → Agent规划 → 工具调用 → ⏸️暂停 → 人工确认 → ▶️继续 → 完成
  优势：高风险操作有人把关
```

### 需要人工介入的场景

| 场景 | 原因 | 中断方式 |
|------|------|----------|
| 发送邮件/消息 | 不可撤回 | 工具执行前 |
| 数据库写入 | 影响数据完整性 | 工具执行前 |
| 资金操作 | 金额大 | 工具执行前 |
| 代码提交 | 影响主分支 | 工具执行前 |
| 内容审核 | 合规要求 | 生成后 |
| 多方案选择 | 需要人类决策 | 路由前 |
| 上下文不足 | 需要补充信息 | 任意时刻 |

---

## 2. 中断机制详解

### interrupt_before 和 interrupt_after

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]
    pending_tool_call: dict | None
    human_feedback: str | None

def agent_node(state: State) -> dict:
    """Agent 决策节点"""
    # LLM 决定调用哪个工具
    return &#123;"pending_tool_call": &#123;"name": "send_email", "args": &#123;...&#125;&#125;&#125;

def execute_tool_node(state: State) -> dict:
    """工具执行节点"""
    tool_call = state["pending_tool_call"]
    # 执行工具...
    return &#123;"messages": [tool_result]&#125;

def human_review_node(state: State) -> dict:
    """人工审核节点"""
    # 这里只是占位，实际审核在外部完成
    pass

# 构建图
graph = StateGraph(State)
graph.add_node("agent", agent_node)
graph.add_node("execute_tool", execute_tool_node)
graph.add_node("human_review", human_review_node)

graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", lambda s: "human_review" if s.get("pending_tool_call") else END)
graph.add_edge("human_review", "execute_tool")
graph.add_edge("execute_tool", "agent")

# 编译时配置中断点
checkpointer = MemorySaver()
app = graph.compile(
    checkpointer=checkpointer,
    interrupt_before=["human_review"],  # 在 human_review 之前暂停
)
```

### 执行流程

```python
import uuid

# 第一次调用：执行到 human_review 前暂停
config = &#123;"configurable": &#123;"thread_id": str(uuid.uuid4())&#125;&#125;
result = app.invoke(
    &#123;"messages": [HumanMessage("帮我发邮件给老板说项目延期")]&#125;,
    config=config,
)
# 此时 Agent 已决定要调用 send_email，但还没执行
# state["pending_tool_call"] = &#123;"name": "send_email", "args": &#123;...&#125;&#125;

# 人工审核：检查 pending_tool_call
state = app.get_state(config)
print(f"待执行工具: &#123;state.values.get('pending_tool_call')&#125;")

# 人工决策：批准或修改
user_decision = input("批准？(yes/no): ")

if user_decision == "yes":
    # 恢复执行：从 human_review 继续到 execute_tool
    result = app.invoke(None, config=config)
elif user_decision == "no":
    # 拒绝：修改状态后继续
    app.update_state(
        config,
        &#123;
            "pending_tool_call": None,
            "messages": [AIMessage("用户拒绝了邮件发送操作")],
            "human_feedback": "拒绝发送，改为口头通知",
        &#125;,
    )
    result = app.invoke(None, config=config)
```

### interrupt() 函数：动态中断

```python
from langgraph.types import interrupt, Command
from langgraph.errors import GraphInterrupt

def human_approval_node(state: State) -> dict:
    """动态中断：在节点内部触发暂停"""
    tool_call = state["pending_tool_call"]

    # interrupt() 会暂停图执行，返回值是恢复时传入的值
    approval = interrupt(&#123;
        "type": "tool_approval",
        "tool": tool_call["name"],
        "args": tool_call["args"],
        "message": f"Agent 要执行 &#123;tool_call['name']&#125;，请审核",
    &#125;)

    # 恢复后，approval 是人工传入的决策
    if approval.get("approved"):
        return &#123;"human_feedback": "approved"&#125;
    else:
        return &#123;
            "pending_tool_call": None,
            "human_feedback": approval.get("reason", "rejected"),
        &#125;
```

### 恢复执行

```python
from langgraph.types import Command

# 方式一：invoke(None, config) — 从中断点继续
result = app.invoke(None, config=config)

# 方式二：Command(resume=...) — 向 interrupt() 传值
result = app.invoke(
    Command(resume=&#123;"approved": True, "reason": "内容确认无误"&#125;),
    config=config,
)

# 方式三：update_state + invoke(None) — 先改状态再继续
app.update_state(config, &#123;"human_feedback": "approved"&#125;)
result = app.invoke(None, config=config)
```

---

## 3. 生产级 Human-in-the-Loop 系统

```python
from dataclasses import dataclass, field
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from typing import TypedDict, Annotated, Any
from langgraph.graph.message import add_messages
from enum import Enum
import time

class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"

@dataclass
class ApprovalRequest:
    """审批请求"""
    request_id: str
    tool_name: str
    tool_args: dict
    agent_reasoning: str
    risk_level: str  # low / medium / high / critical
    created_at: float = field(default_factory=time.time)
    status: ApprovalStatus = ApprovalStatus.PENDING
    reviewer: str | None = None
    review_comment: str | None = None
    modified_args: dict | None = None


class HITLState(TypedDict):
    messages: Annotated[list, add_messages]
    pending_action: dict | None
    approval_history: list[dict]
    current_step: str
    risk_assessment: dict | None


class RiskAssessor:
    """风险评估器：判断操作风险等级"""

    CRITICAL_TOOLS = &#123;"delete_database", "send_money", "deploy_to_prod", "format_disk"&#125;
    HIGH_TOOLS = &#123;"send_email", "create_vm", "modify_config", "git_push"&#125;
    MEDIUM_TOOLS = &#123;"search_web", "read_file", "list_directory"&#125;

    @classmethod
    def assess(cls, tool_name: str, tool_args: dict) -> dict:
        if tool_name in cls.CRITICAL_TOOLS:
            level = "critical"
            auto_approve = False
        elif tool_name in cls.HIGH_TOOLS:
            level = "high"
            auto_approve = False
        elif tool_name in cls.MEDIUM_TOOLS:
            level = "medium"
            auto_approve = True  # 低风险自动通过
        else:
            level = "low"
            auto_approve = True

        return &#123;
            "tool": tool_name,
            "level": level,
            "auto_approve": auto_approve,
            "reason": f"&#123;tool_name&#125; 风险等级: &#123;level&#125;",
        &#125;


def agent_planning_node(state: HITLState) -> dict:
    """Agent 规划节点：LLM 决定下一步操作"""
    # 模拟 LLM 决策
    action = &#123;
        "tool": "send_email",
        "args": &#123;"to": "boss@company.com", "subject": "项目延期通知", "body": "..."&#125;,
        "reasoning": "用户要求通知老板项目延期",
    &#125;

    risk = RiskAssessor.assess(action["tool"], action["args"])

    return &#123;
        "pending_action": action,
        "risk_assessment": risk,
        "current_step": "planning_done",
    &#125;


def risk_check_node(state: HITLState) -> dict:
    """风险检查节点：决定是否需要人工审批"""
    risk = state.get("risk_assessment", &#123;&#125;)
    action = state.get("pending_action", &#123;&#125;)

    if risk.get("auto_approve"):
        # 低风险，自动通过
        return &#123;"current_step": "auto_approved"&#125;
    else:
        # 高风险，触发人工审批
        approval = interrupt(&#123;
            "type": "approval_required",
            "tool": action.get("tool"),
            "args": action.get("args"),
            "risk_level": risk.get("level"),
            "reasoning": action.get("reasoning"),
            "message": f"⚠️ Agent 要执行 &#123;action['tool']&#125;（风险: &#123;risk['level']&#125;），请审批",
        &#125;)

        # 恢复后处理审批结果
        if approval.get("approved"):
            if approval.get("modified_args"):
                # 修改了参数
                state["pending_action"]["args"] = approval["modified_args"]
                return &#123;
                    "current_step": "approved_with_modifications",
                    "approval_history": [&#123;
                        "tool": action["tool"],
                        "status": "modified",
                        "reviewer": approval.get("reviewer"),
                        "comment": approval.get("comment"),
                    &#125;],
                &#125;
            return &#123;
                "current_step": "approved",
                "approval_history": [&#123;
                    "tool": action["tool"],
                    "status": "approved",
                    "reviewer": approval.get("reviewer"),
                &#125;],
            &#125;
        else:
            # 拒绝
            return &#123;
                "pending_action": None,
                "current_step": "rejected",
                "approval_history": [&#123;
                    "tool": action["tool"],
                    "status": "rejected",
                    "reviewer": approval.get("reviewer"),
                    "comment": approval.get("comment"),
                &#125;],
            &#125;


def execute_action_node(state: HITLState) -> dict:
    """执行节点"""
    action = state.get("pending_action")
    if not action:
        return &#123;"messages": [&#123;"role": "ai", "content": "操作已取消"&#125;]&#125;

    # 执行工具
    return &#123;
        "messages": [&#123;"role": "ai", "content": f"已执行 &#123;action['tool']&#125;"&#125;],
        "current_step": "executed",
    &#125;


# 构建生产级 HITL 图
def build_hitl_graph():
    graph = StateGraph(HITLState)

    graph.add_node("planning", agent_planning_node)
    graph.add_node("risk_check", risk_check_node)
    graph.add_node("execute", execute_action_node)

    graph.add_edge(START, "planning")
    graph.add_edge("planning", "risk_check")

    # 条件路由：根据审批结果决定下一步
    graph.add_conditional_edges(
        "risk_check",
        lambda s: "execute" if s.get("pending_action") else END,
    )
    graph.add_edge("execute", END)

    return graph.compile(checkpointer=MemorySaver())


# 使用示例
app = build_hitl_graph()

# 第一次调用：自动执行到 risk_check 时暂停（interrupt）
config = &#123;"configurable": &#123;"thread_id": "session-1"&#125;&#125;
result = app.invoke(
    &#123;"messages": [&#123;"role": "user", "content": "帮我发邮件通知老板项目延期"&#125;]&#125;,
    config=config,
)
# 图在 risk_check 节点暂停，等待人工审批

# 查看暂停状态
state = app.get_state(config)
print("当前状态:", state.values.get("current_step"))
print("待审批操作:", state.values.get("pending_action"))

# 人工审批通过
result = app.invoke(
    Command(resume=&#123;
        "approved": True,
        "reviewer": "admin",
        "comment": "邮件内容确认无误",
    &#125;),
    config=config,
)
```

---

## 4. 超时与自动降级

```python
import asyncio
from langgraph.types import Command

class TimeoutManager:
    """审批超时管理"""

    def __init__(self, timeout_seconds: int = 3600):
        self.timeout = timeout_seconds

    async def wait_for_approval(
        self,
        app,
        config: dict,
        timeout: int | None = None,
    ) -> dict:
        """等待人工审批，超时自动拒绝"""
        timeout = timeout or self.timeout

        try:
            # 轮询检查状态
            start = time.time()
            while time.time() - start < timeout:
                state = app.get_state(config)
                # 如果图已完成（不再是中断状态）
                if not state.next:
                    return state.values
                await asyncio.sleep(5)

            # 超时：自动拒绝
            print(f"审批超时(&#123;timeout&#125;s)，自动拒绝")
            result = app.invoke(
                Command(resume=&#123;
                    "approved": False,
                    "reviewer": "system",
                    "comment": f"审批超时(&#123;timeout&#125;秒)，自动拒绝",
                &#125;),
                config=config,
            )
            return result

        except Exception as e:
            print(f"审批流程异常: &#123;e&#125;")
            app.update_state(config, &#123;"current_step": "error"&#125;)
            return app.invoke(None, config=config)
```

---

## 5. 多人审批工作流

```python
def multi_approval_node(state: HITLState) -> dict:
    """需要多人审批的节点"""

    action = state["pending_action"]
    risk = state["risk_assessment"]

    # 根据风险等级决定需要几人审批
    required_approvals = &#123;
        "low": 0,
        "medium": 1,
        "high": 2,
        "critical": 3,
    &#125;.get(risk["level"], 1)

    if required_approvals == 0:
        return &#123;"current_step": "auto_approved"&#125;

    # 依次请求审批
    approvals = []
    for i in range(required_approvals):
        approval = interrupt(&#123;
            "type": "multi_approval",
            "round": i + 1,
            "total_rounds": required_approvals,
            "tool": action["tool"],
            "args": action["args"],
            "previous_approvals": approvals,
        &#125;)

        if not approval.get("approved"):
            return &#123;
                "pending_action": None,
                "current_step": f"rejected_at_round_&#123;i+1&#125;",
                "approval_history": approvals + [&#123;
                    "round": i + 1,
                    "status": "rejected",
                    "reviewer": approval.get("reviewer"),
                &#125;],
            &#125;

        approvals.append(&#123;
            "round": i + 1,
            "status": "approved",
            "reviewer": approval.get("reviewer"),
            "comment": approval.get("comment"),
        &#125;)

    return &#123;
        "current_step": "all_approved",
        "approval_history": approvals,
    &#125;
```

---

## 6. 中断状态管理

```python
class InterruptManager:
    """中断状态管理器"""

    def __init__(self, app):
        self.app = app

    def get_pending_interrupts(self, config: dict) -> list:
        """获取当前待处理的中断"""
        state = self.app.get_state(config)
        if not state.next:
            return []  # 没有中断

        # 获取中断信息
        tasks = state.tasks
        interrupts = []
        for task in tasks:
            if hasattr(task, "interrupts"):
                for intr in task.interrupts:
                    interrupts.append(&#123;
                        "node": task.name,
                        "value": intr.value,
                    &#125;)
        return interrupts

    def list_all_pending(self, thread_ids: list[str]) -> dict:
        """列出所有线程的待处理中断"""
        pending = &#123;&#125;
        for thread_id in thread_ids:
            config = &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;
            interrupts = self.get_pending_interrupts(config)
            if interrupts:
                pending[thread_id] = interrupts
        return pending

    def cancel_interrupt(self, config: dict, reason: str = "user_cancelled"):
        """取消中断"""
        self.app.update_state(config, &#123;
            "pending_action": None,
            "current_step": "cancelled",
        &#125;)
        # 继续执行（会走到结束分支）
        return self.app.invoke(None, config=config)
```

---

## 7. 配置参考

| 配置 | 推荐值 | 说明 |
|------|--------|------|
| 超时时间 | 3600s (1h) | 审批超时自动拒绝 |
| 自动通过风险 | low | 低风险操作不需要审批 |
| 多人审批 | high=2人, critical=3人 | 风险越高审批人越多 |
| 轮询间隔 | 5s | 检查审批状态频率 |
| Checkpointer | Postgres | 生产用持久化 |
| thread_id | UUID | 每次对话唯一 |

### 中断点选择

| 中断方式 | 时机 | 灵活性 | 适用 |
|----------|------|--------|------|
| interrupt_before | 节点执行前 | 固定 | 始终需要审批 |
| interrupt_after | 节点执行后 | 固定 | 执行后审核 |
| interrupt() | 节点内部动态 | 最高 | 条件性审批 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有风险分级 | ☐ |
| 有 interrupt 审批 | ☐ |
| 有超时自动拒绝 | ☐ |
| 有审批日志 | ☐ |
| 有参数修改能力 | ☐ |
| 有多人审批（高风险） | ☐ |
| 有 Checkpointer 持久化 | ☐ |
| 有待处理中断列表 | ☐ |
| 有取消中断能力 | ☐ |
