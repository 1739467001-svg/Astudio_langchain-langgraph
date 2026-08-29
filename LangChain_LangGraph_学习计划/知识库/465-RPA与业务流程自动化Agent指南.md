# RPA 与业务流程自动化 Agent 指南

> 传统 RPA（UiPath/Automation Anywhere）用脚本自动化重复操作——但脚本死板，页面改了就崩。LLM Agent 让 RPA 变"聪明"了：能理解非结构化数据、处理异常情况、自适应界面变化。本指南系统讲解 AI 驱动的 RPA 架构、流程编排、异常处理，以及与 LangGraph 的集成。

---

## 1. 传统 RPA vs AI RPA

### 对比

| 维度 | 传统 RPA | AI RPA（LLM 驱动） |
|------|---------|-------------------|
| 规则 | 硬编码 IF/ELSE | LLM 理解并决策 |
| 数据 | 结构化 | 结构化+非结构化 |
| 异常处理 | 预设分支 | LLM 自主处理 |
| 界面变化 | 脚本失效 | LLM 适应 |
| 实现 | 录制/脚本 | Prompt + 工具 |
| 成本 | 低（脚本） | 中（LLM 调用） |
| 可靠性 | 高（固定路径） | 中（LLM 不确定性） |

### 混合方案

```
AI RPA 最佳实践：
  确定性步骤 → 传统脚本（快、可靠）
  非确定性步骤 → LLM Agent（灵活、智能）

  例：发票处理流程
    Step1: 下载邮件附件 → 脚本（确定性）
    Step2: 识别发票类型 → LLM（非结构化判断）
    Step3: 提取金额 → LLM + OCR
    Step4: 录入 ERP → 脚本（确定性API调用）
    Step5: 异常处理 → LLM（自主决策）
```

---

## 2. 流程编排

### 业务流程定义

```python
from dataclasses import dataclass, field
from enum import Enum

class StepType(Enum):
    SCRIPT = "script"      # 传统脚本
    LLM = "llm"            # LLM 决策
    HUMAN = "human"        # 人工审批
    API = "api"            # API 调用
    CONDITION = "condition" # 条件分支

@dataclass
class ProcessStep:
    """流程步骤"""
    id: str
    name: str
    type: StepType
    config: dict = field(default_factory=dict)
    on_success: str = ""    # 下一步
    on_failure: str = ""   # 失败时
    retry_count: int = 3
    timeout: int = 60

@dataclass
class BusinessProcess:
    """业务流程"""
    name: str
    steps: dict            # {step_id: ProcessStep}
    entry: str             # 入口步骤

    # 发票处理流程示例
    @staticmethod
    def invoice_processing():
        return BusinessProcess(
            name="发票处理",
            entry="download",
            steps={
                "download": ProcessStep(
                    id="download", name="下载邮件附件", type=StepType.SCRIPT,
                    config={"mailbox": "invoices@company.com", "save_to": "/tmp/invoices"},
                    on_success="classify",
                ),
                "classify": ProcessStep(
                    id="classify", name="发票分类", type=StepType.LLM,
                    config={"prompt": "识别发票类型：增值税专用/普通/电子", "model": "gpt-4o-mini"},
                    on_success="extract",
                ),
                "extract": ProcessStep(
                    id="extract", name="提取信息", type=StepType.LLM,
                    config={"prompt": "提取发票号、日期、金额、税额", "output_format": "json"},
                    on_success="validate",
                ),
                "validate": ProcessStep(
                    id="validate", name="数据校验", type=StepType.CONDITION,
                    config={"rule": "金额 > 0 且 税额 > 0"},
                    on_success="enter_erp",
                    on_failure="manual_review",
                ),
                "enter_erp": ProcessStep(
                    id="enter_erp", name="录入ERP", type=StepType.API,
                    config={"endpoint": "https://erp.company.com/api/invoices", "method": "POST"},
                    on_success="notify",
                    on_failure="retry_erp",
                ),
                "manual_review": ProcessStep(
                    id="manual_review", name="人工审核", type=StepType.HUMAN,
                    config={"message": "发票数据异常，请人工审核"},
                    on_success="enter_erp",
                ),
                "notify": ProcessStep(
                    id="notify", name="通知完成", type=StepType.SCRIPT,
                    config={"channel": "dingtalk", "message": "发票处理完成"},
                ),
                "retry_erp": ProcessStep(
                    id="retry_erp", name="ERP重试", type=StepType.API,
                    config={"endpoint": "https://erp.company.com/api/invoices", "retry": 3},
                    on_success="notify",
                    on_failure="manual_review",
                ),
            },
        )
```

---

## 3. 流程执行引擎

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
import asyncio

class ProcessState(TypedDict):
    process_name: str
    current_step: str
    step_results: dict
    data: dict           # 流程中传递的数据
    errors: list
    status: str           # running | completed | failed | paused

@dataclass
class ProcessEngine:
    """流程执行引擎"""

    async def execute_step(self, step: ProcessStep, state: ProcessState) -> dict:
        """执行单个步骤"""
        try:
            if step.type == StepType.SCRIPT:
                result = await self._run_script(step, state)
            elif step.type == StepType.LLM:
                result = await self._run_llm(step, state)
            elif step.type == StepType.API:
                result = await self._run_api(step, state)
            elif step.type == StepType.HUMAN:
                result = await self._run_human(step, state)
            elif step.type == StepType.CONDITION:
                result = await self._run_condition(step, state)
            else:
                result = {"status": "unknown_step_type"}

            return {"result": result, "success": True}

        except Exception as e:
            return {"result": str(e), "success": False, "error": str(e)}

    async def _run_script(self, step: ProcessStep, state: ProcessState) -> dict:
        """执行脚本步骤"""
        config = step.config
        if "mailbox" in config:
            # 模拟下载邮件附件
            files = await download_attachments(config["mailbox"], config["save_to"])
            return {"files": files, "count": len(files)}
        elif "channel" in config:
            await send_notification(config["channel"], config["message"])
            return {"sent": True}
        return {"status": "done"}

    async def _run_llm(self, step: ProcessStep, state: ProcessState) -> dict:
        """执行 LLM 步骤"""
        llm = ChatOpenAI(
            model=step.config.get("model", "gpt-4o-mini"),
            temperature=0,
        )
        prompt = step.config["prompt"]

        # 把前面步骤的数据加入上下文
        context_data = state.get("data", {})
        full_prompt = f"{prompt}\n\n上下文数据: {json.dumps(context_data, ensure_ascii=False)}"

        response = await llm.ainvoke(full_prompt)

        # 如果要求 JSON 输出
        if step.config.get("output_format") == "json":
            try:
                return json.loads(response.content)
            except json.JSONDecodeError:
                return {"raw_text": response.content}

        return {"output": response.content}

    async def _run_api(self, step: ProcessStep, state: ProcessState) -> dict:
        """执行 API 调用"""
        config = step.config
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=config.get("method", "POST"),
                url=config["endpoint"],
                json=state.get("data", {}),
                timeout=config.get("timeout", 30),
            )
        return {"status_code": response.status_code, "response": response.json()}

    async def _run_human(self, step: ProcessStep, state: ProcessState) -> dict:
        """人工审核步骤"""
        # 发送审批请求（实际中通过 interrupt 实现）
        await send_approval_request(step.config["message"], state.get("data", {}))
        # 等待人工输入
        result = interrupt({"type": "human_review", "message": step.config["message"]})
        return result

    async def _run_condition(self, step: ProcessStep, state: ProcessState) -> dict:
        """条件判断"""
        data = state.get("data", {})
        rule = step.config.get("rule", "")

        # 用 LLM 做条件判断
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"判断以下数据是否满足条件。只回答 YES 或 NO。\n数据: {json.dumps(data)}\n条件: {rule}"
        )
        passed = "YES" in response.content.upper()

        return {"passed": passed, "next": step.on_success if passed else step.on_failure}
```

### LangGraph 流程引擎

```python
async def process_step_node(state: ProcessState):
    """流程执行节点"""
    process = BusinessProcess.invoice_processing()
    step = process.steps[state["current_step"]]

    engine = ProcessEngine()
    result = await engine.execute_step(step, state)

    # 更新状态
    step_results = state.get("step_results", {})
    step_results[state["current_step"]] = result

    # 合并数据
    data = state.get("data", {})
    if result.get("result"):
        data.update(result["result"] if isinstance(result["result"], dict) else {"output": result["result"]})

    # 确定下一步
    if result["success"]:
        if step.type == StepType.CONDITION:
            next_step = result["result"].get("next", step.on_success)
        else:
            next_step = step.on_success
    else:
        next_step = step.on_failure or "end"

    return {
        "current_step": next_step,
        "step_results": step_results,
        "data": data,
        "errors": state.get("errors", []) + ([result.get("error")] if result.get("error") else []),
        "status": "completed" if next_step == "" else "running",
    }

def route_process(state: ProcessState):
    if state.get("status") == "completed":
        return END
    if state.get("current_step", "") == "":
        return END
    return "step"

# 构建流程引擎
graph = StateGraph(ProcessState)
graph.add_node("step", process_step_node)
graph.add_edge(START, "step")
graph.add_conditional_edges("step", route_process, {"step": "step", END: END})
process_app = graph.compile()

# 运行发票处理流程
result = await process_app.ainvoke({
    "process_name": "发票处理",
    "current_step": "download",
    "step_results": {},
    "data": {},
    "errors": [],
    "status": "running",
})
```

---

## 4. 异常处理与重试

```python
@dataclass
class ExceptionHandler:
    """异常处理"""

    async def handle_with_retry(self, step: ProcessStep, state: ProcessState,
                                 engine: ProcessEngine):
        """带重试的执行"""
        last_error = None

        for attempt in range(step.retry_count):
            try:
                result = await engine.execute_step(step, state)
                if result["success"]:
                    return result
                last_error = result.get("error")
            except Exception as e:
                last_error = str(e)

            # 指数退避
            if attempt < step.retry_count - 1:
                wait_time = 2 ** attempt
                await asyncio.sleep(wait_time)

        # 重试耗尽，进入异常处理
        return await self._handle_failure(step, state, last_error)

    async def _handle_failure(self, step: ProcessStep, state: ProcessState, error: str):
        """失败处理"""
        # 用 LLM 分析错误并决定补救措施
        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        analysis = await llm.ainvoke(
            f"""流程步骤失败，分析原因并建议补救措施。

步骤: {step.name}
错误: {error}
已有数据: {json.dumps(state.get("data", {}), ensure_ascii=False)}

选项：
1. retry - 重试（换个参数）
2. skip - 跳过此步骤
3. manual - 转人工
4. abort - 终止流程

只回答选项名。"""
        )
        action = analysis.content.strip().lower()
        return {"action": action, "error": error}
```

---

## 5. 常见 RPA 场景

| 场景 | 流程 | 混合策略 |
|------|------|---------|
| 发票处理 | 下载→分类→提取→校验→录入 | 脚本+LLM+人工 |
| 简历筛选 | 收集→解析→评分→分类→通知 | 脚本+LLM |
| 合同审查 | 上传→OCR→条款提取→风险→报告 | OCR+LLM+人工 |
| 数据录入 | 导出→提取→映射→录入→校验 | 脚本+LLM |
| 报告生成 | 采集→分析→生成→审批→发送 | LLM+脚本+人工 |
| 客户跟进 | 查询→分类→生成话术→发送→记录 | API+LLM+脚本 |

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解传统 RPA vs AI RPA | ☐ |
| 能定义业务流程 | ☐ |
| 实现了流程执行引擎 | ☐ |
| 实现了 LLM 步骤 | ☐ |
| 实现了条件分支 | ☐ |
| 实现了人工审核步骤 | ☐ |
| 实现了异常处理与重试 | ☐ |
| 在 LangGraph 中集成了流程引擎 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 23 | 文档处理管线 | 文档处理 |
| 36 | LLM 应用全生命周期 | 生命周期 |
| 09 | 自动化工作流 Agent | 工作流 |
| 22 | CI/CD 流水线 | 流水线 |
| 129 | Agent 工作流模式全集 | 工作流模式 |
| 189 | Agent 工作流引擎设计 | 引擎设计 |
| 316 | 工作流编排 | 编排 |
| 432 | Computer Use | 浏览器自动化 |
| 443 | 多模态文档智能 | OCR |
| 458 | 人机协作 HITL | 人工审核 |
| 462 | Agent 设计模式 | Saga 模式 |
