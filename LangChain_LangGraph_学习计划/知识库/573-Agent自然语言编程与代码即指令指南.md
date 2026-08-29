# Agent 自然语言编程与代码即指令指南

> 用户说"帮我创建一个 REST API"——Agent 直接生成并执行代码。代码即指令（Code as Instruction）让 Agent 用代码而非自然语言表达操作。本指南深度讲解 NL→代码生成→执行→验证的完整链路。

---

## 1. 自然语言编程架构

```mermaid
graph LR
    NL["自然语言<br/>'创建REST API'"] --> GEN["代码生成<br/>LLM生成Python"]
    GEN --> EXEC["沙箱执行<br/>Docker/容器"]
    EXEC --> TEST["自动测试<br/>验证结果"]
    TEST --> OK{"通过?"}
    OK -->|"是"| DEPLOY["部署"]
    OK -->|"否"| DEBUG["调试修复"]
    DEBUG --> GEN

    style GEN fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style EXEC fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DEPLOY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 代码生成执行

```python
@dataclass
class NaturalLanguageProgrammer:
    """自然语言编程器"""

    async def program(self, instruction: str, context: dict = None) -> dict:
        """自然语言→代码→执行"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)

        # 1. 生成代码
        response = await llm.ainvoke(f"""根据指令生成可执行的 Python 代码。

指令: {instruction}
上下文: {json.dumps(context or {}, ensure_ascii=False)[:500]}

要求:
1. 完整可运行
2. 包含错误处理
3. 包含类型注解
4. 最后有 `result = ...` 变量存储结果

只输出代码。""")

        code = self._extract_code(response.content)

        # 2. 沙箱执行
        result = await self._execute_in_sandbox(code)

        # 3. 验证
        if not result.get("success"):
            fixed = await self._auto_fix(code, result.get("error", ""))
            result = await self._execute_in_sandbox(fixed)

        return {
            "instruction": instruction,
            "code": code,
            "result": result,
            "success": result.get("success", False),
        }

    async def _execute_in_sandbox(self, code: str) -> dict:
        """沙箱执行"""
        import subprocess
        with open("/tmp/agent_code.py", "w") as f:
            f.write(code)
        try:
            result = subprocess.run(
                ["python", "/tmp/agent_code.py"],
                capture_output=True, text=True, timeout=30
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout[:3000],
                "stderr": result.stderr[:1000],
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "执行超时"}

    async def _auto_fix(self, code: str, error: str) -> str:
        """自动修复"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)
        response = await llm.ainvoke(f"修复代码错误。只输出修复后的完整代码。\n\n代码:\n{code}\n\n错误:\n{error}")
        return self._extract_code(response.content)

    def _extract_code(self, text: str) -> str:
        import re
        match = re.search(r'```(?:python)?\n(.*?)```', text, re.DOTALL)
        return match.group(1) if match else text
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 NL→代码→执行链路 | ☐ |
| 实现了代码生成 | ☐ |
| 实现了沙箱执行 | ☐ |
| 实现了自动修复 | ☐ |
| 有安全限制 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 436 | AI 编程 Agent | 编程 |
| 518 | 代码生成与审查 | 代码 |
| 134 | 代码执行沙箱 | 沙箱 |
| 186 | 安全沙箱 | 安全 |
