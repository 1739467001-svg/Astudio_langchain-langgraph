# Agent 决策回放与调试

> 当 Agent 出错时，你需要"回放"它的决策过程来定位问题。这份指南覆盖决策记录、回放和调试。

---

## 一、决策回放的价值

```mermaid
graph TB
    subgraph 无回放 &#123;"❌ 无决策回放"&#125;
        E1["Agent出错"] --> E2["不知道哪步出的问题"]
        E2 --> E3["只能猜测和重试"]
    end

    subgraph 有回放 &#123;"✅ 有决策回放"&#125;
        R1["Agent出错"] --> R2["回放完整决策链"]
        R2 --> R3["定位具体出错的步骤"]
        R3 --> R4["针对性修复"]
    end

    style 无回放 fill:'#FFCDD2'
    style 有回放 fill:'#C8E6C9'
```

## 二、决策记录存储

```python
import json
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Any

class DecisionStep(BaseModel):
    """单步决策记录"""
    step: int
    timestamp: str = ""
    node_name: str = ""              # 执行的节点
    input_data: Any = None           # 输入数据
    output_data: Any = None          # 输出数据
    tool_name: str = ""              # 使用的工具
    tool_input: str = ""             # 工具参数
    tool_output: str = ""            # 工具结果
    thought: str = ""               # LLM思考过程
    error: str = ""                  # 错误信息
    duration_ms: int = 0            # 耗时

class DecisionRecording(BaseModel):
    """完整决策记录"""
    request_id: str
    question: str
    steps: list[DecisionStep] = []
    final_answer: str = ""
    total_duration_ms: int = 0
    total_tokens: int = 0
    success: bool = True
    created_at: str = ""

class DecisionStore:
    """决策记录存储"""
    def __init__(self, path: str = "data/decisions"):
        import os
        self.path = path
        os.makedirs(path, exist_ok=True)

    def save(self, recording: DecisionRecording):
        """保存决策记录"""
        filepath = f"&#123;self.path&#125;/&#123;recording.request_id&#125;.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(recording.model_dump(), f, indent=2, ensure_ascii=False)

    def load(self, request_id: str) -> Optional[DecisionRecording]:
        """加载决策记录"""
        filepath = f"&#123;self.path&#125;/&#123;request_id&#125;.json"
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            return DecisionRecording(**data)
        except FileNotFoundError:
            return None

    def list_recent(self, limit: int = 10) -> list[str]:
        """列出最近的记录"""
        import os
        files = sorted(os.listdir(self.path), reverse=True)
        return [f.replace(".json", "") for f in files[:limit] if f.endswith(".json")]
```

## 三、决策回放

```python
class DecisionReplayer:
    """决策回放器"""
    def __init__(self, store: DecisionStore):
        self.store = store

    def replay_text(self, request_id: str) -> str:
        """文本格式回放"""
        recording = self.store.load(request_id)
        if not recording:
            return "未找到记录"

        report = f"=== 决策回放: &#123;request_id&#125; ===\n"
        report += f"问题: &#123;recording.question&#125;\n"
        report += f"成功: &#123;'✅' if recording.success else '❌'&#125;\n"
        report += f"总耗时: &#123;recording.total_duration_ms&#125;ms\n"
        report += f"总Token: &#123;recording.total_tokens&#125;\n\n"

        for step in recording.steps:
            report += f"--- Step &#123;step.step&#125;: &#123;step.node_name&#125; ---\n"
            if step.thought:
                report += f"🧠 思考: &#123;step.thought[:150]&#125;\n"
            if step.tool_name:
                report += f"🔧 工具: &#123;step.tool_name&#125;\n"
                report += f"📥 输入: &#123;step.tool_input[:100]&#125;\n"
                report += f"👀 结果: &#123;step.tool_output[:100]&#125;\n"
            if step.error:
                report += f"❌ 错误: &#123;step.error&#125;\n"
            report += f"⏱️ 耗时: &#123;step.duration_ms&#125;ms\n\n"

        report += f"最终回答: &#123;recording.final_answer[:200]&#125;\n"
        return report

    def replay_step_by_step(self, request_id: str):
        """逐步回放（生成器，可用于交互式调试）"""
        recording = self.store.load(request_id)
        if not recording:
            yield "未找到记录"
            return

        yield f"📋 问题: &#123;recording.question&#125;"
        yield f"&#123;'✅' if recording.success else '❌'&#125; 结果: &#123;'成功' if recording.success else '失败'&#125;"

        for step in recording.steps:
            yield f"\n--- Step &#123;step.step&#125; ---"
            if step.thought:
                yield f"🧠 &#123;step.thought[:100]&#125;"
            if step.tool_name:
                yield f"🔧 &#123;step.tool_name&#125;(&#123;step.tool_input[:50]&#125;)"
                yield f"👀 &#123;step.tool_output[:80]&#125;"
            if step.error:
                yield f"❌ &#123;step.error&#125;"
            yield f"⏱️ &#123;step.duration_ms&#125;ms"

    def find_error_step(self, request_id: str) -> Optional[int]:
        """找到出错的步骤"""
        recording = self.store.load(request_id)
        if not recording:
            return None
        for step in recording.steps:
            if step.error:
                return step.step
        return None
```

## 四、在 Agent 中集成

```python
from langchain_core.callbacks import BaseCallbackHandler
import time

class RecordingCallback(BaseCallbackHandler):
    """记录决策的回调"""
    def __init__(self, request_id: str, store: DecisionStore):
        self.request_id = request_id
        self.store = store
        self.recording = DecisionRecording(
            request_id=request_id,
            question="",
            created_at=datetime.now().isoformat(),
        )
        self._current_step = None
        self._step_start = None

    def on_llm_start(self, serialized, prompts, **kwargs):
        self._step_start = time.time()
        step = DecisionStep(step=len(self.recording.steps) + 1, timestamp=datetime.now().isoformat())
        self.recording.steps.append(step)
        self._current_step = step

    def on_llm_end(self, response, **kwargs):
        if self._current_step:
            self._current_step.duration_ms = int((time.time() - self._step_start) * 1000)

    def on_tool_start(self, serialized, input_str, **kwargs):
        if self._current_step:
            self._current_step.tool_name = serialized.get("name", "")
            self._current_step.tool_input = input_str[:200]

    def on_tool_end(self, output, **kwargs):
        if self._current_step:
            self._current_step.tool_output = str(output)[:200]

    def on_tool_error(self, error, **kwargs):
        if self._current_step:
            self._current_step.error = str(error)
            self.recording.success = False

    def finalize(self, question: str, answer: str):
        self.recording.question = question
        self.recording.final_answer = answer
        self.store.save(self.recording)
```

## 五、调试场景

```python
# 场景：Agent回答错误，需要定位
store = DecisionStore()
replayer = DecisionReplayer(store)

# 1. 找到出错的步骤
error_step = replayer.find_error_step("req_001")
print(f"出错步骤: Step &#123;error_step&#125;")

# 2. 查看完整回放
print(replayer.replay_text("req_001"))

# 3. 逐步调试
for line in replayer.replay_step_by_step("req_001"):
    print(line)
    input("按回车继续...")  # 交互式逐步回放
```

## 六、检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 决策记录保存 | 每次请求保存完整决策链 | ☐ |
| 记录存储位置 | 文件/数据库 | ☐ |
| 回放功能 | 可按request_id回放 | ☐ |
| 错误定位 | 能找到出错的步骤 | ☐ |
| 逐步调试 | 支持逐步回放 | ☐ |
| 保留期限 | 定期清理旧记录 | ☐ |
