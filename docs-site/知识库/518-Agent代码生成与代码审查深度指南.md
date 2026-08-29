# Agent 代码生成与代码审查深度指南

> Agent 不只是回答问题——它能写代码、审查代码、修 Bug、跑测试。本指南深度讲解代码生成 Agent 的完整架构：从需求理解到代码生成、从代码审查到自动修复、从测试生成到 CI 集成。

---

## 1. 代码生成 Agent 架构

### 工作流

```mermaid
graph TB
    REQ["需求描述"] --> UNDERSTAND["需求理解<br/>拆分功能点"]
    UNDERSTAND --> GEN["代码生成<br/>逐文件生成"]
    GEN --> REVIEW["代码审查<br/>质量/安全/性能"]
    REVIEW --> FIX["修复问题<br/>根据审查意见"]
    FIX --> TEST["生成测试<br/>单元+集成"]
    TEST --> RUN["运行测试<br/>沙箱执行"]
    RUN --> PASS&#123;"通过?"&#125;
    PASS -->|"是"| OUTPUT["输出代码"]
    PASS -->|"否"| DEBUG["调试修复"]
    DEBUG --> GEN

    style UNDERSTAND fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style REVIEW fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style OUTPUT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 代码生成

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from dataclasses import dataclass

@dataclass
class CodeGenerator:
    """代码生成器"""

    async def generate_from_requirement(self, requirement: str,
                                        language: str = "python") -> dict:
        """从需求生成代码"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)

        prompt = f"""你是资深&#123;language&#125;工程师。根据需求生成完整代码。

需求: &#123;requirement&#125;

要求：
1. 代码完整可运行
2. 包含类型注解
3. 包含错误处理
4. 包含文档字符串
5. 包含示例用法

只输出代码，不要解释。"""

        response = await llm.ainvoke(prompt)
        code = self._extract_code(response.content)

        return &#123;
            "code": code,
            "language": language,
            "requirement": requirement,
        &#125;

    async def generate_project(self, project_desc: str) -> dict:
        """生成完整项目结构"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)

        # 1. 生成项目结构
        structure_prompt = f"""根据项目描述生成文件结构。

项目: &#123;project_desc&#125;

输出 JSON: &#123;&#123;"files": [&#123;&#123;"path": "...", "description": "..."&#125;&#125;]&#125;&#125;"""

        response = await llm.ainvoke(structure_prompt)
        try:
            files = json.loads(response.content)["files"]
        except:
            files = [&#123;"path": "main.py", "description": "主入口"&#125;]

        # 2. 逐文件生成代码
        generated = &#123;&#125;
        for file_info in files:
            code = await self.generate_from_requirement(
                f"文件 &#123;file_info['path']&#125;: &#123;file_info['description']&#125;"
            )
            generated[file_info["path"]] = code["code"]

        return &#123;"project_structure": files, "code": generated&#125;

    def _extract_code(self, text: str) -> str:
        """提取代码块"""
        import re
        match = re.search(r'```(?:python)?\n(.*?)```', text, re.DOTALL)
        return match.group(1) if match else text
```

---

## 3. 代码审查

```python
@dataclass
class CodeReviewer:
    """代码审查器"""

    async def review(self, code: str, language: str = "python") -> dict:
        """审查代码"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""审查以下&#123;language&#125;代码，从这些维度评估（1-5分）：

1. 代码质量：可读性、命名、结构
2. 错误处理：异常处理是否完善
3. 安全性：注入风险、敏感信息
4. 性能：算法效率、资源使用
5. 可维护性：模块化、可扩展
6. 测试覆盖：是否有测试

代码:
```
&#123;code&#125;
```

输出 JSON:
&#123;&#123;
    "scores": &#123;&#123;"quality": 0, "security": 0, "performance": 0, "maintainability": 0, "testing": 0&#125;&#125;,
    "issues": [&#123;&#123;"severity": "high/medium/low", "line": 0, "issue": "...", "suggestion": "..."&#125;&#125;],
    "summary": "总体评价",
    "approved": true/false
&#125;&#125;"""

        response = await llm.ainvoke(prompt)
        try:
            return json.loads(response.content)
        except:
            return &#123;"summary": response.content, "approved": False&#125;

    async def review_diff(self, diff: str) -> dict:
        """审查 Git Diff"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        prompt = f"""审查以下代码变更（Git Diff），指出：
1. 潜在 Bug
2. 安全问题
3. 性能问题
4. 改进建议
5. 是否可以合并

Diff:
&#123;diff&#125;"""

        response = await llm.ainvoke(prompt)
        return &#123;"review": response.content&#125;
```

---

## 4. 自动修复

```python
@dataclass
class AutoFixer:
    """自动修复代码问题"""

    async def fix_issue(self, code: str, issue: dict) -> str:
        """修复单个问题"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)

        prompt = f"""修复以下代码中的问题。只修改有问题的部分，不要重写整个文件。

代码:
```
&#123;code&#125;
```

问题:
- 严重度: &#123;issue.get('severity', 'medium')&#125;
- 位置: 第 &#123;issue.get('line', '?')&#125; 行
- 描述: &#123;issue.get('issue', '')&#125;
- 建议: &#123;issue.get('suggestion', '')&#125;

输出修复后的完整代码。"""

        response = await llm.ainvoke(prompt)
        return self._extract_code(response.content)

    async def fix_all(self, code: str, review_result: dict) -> dict:
        """修复所有问题"""
        issues = review_result.get("issues", [])
        if not issues:
            return &#123;"code": code, "fixes": 0, "message": "无需修复"&#125;

        # 按严重度排序
        issues.sort(key=lambda x: &#123;"high": 0, "medium": 1, "low": 2&#125;.get(x.get("severity", "low"), 3))

        fixed_code = code
        fixes = 0

        for issue in issues:
            if issue.get("severity") in ["high", "medium"]:
                new_code = await self.fix_issue(fixed_code, issue)
                if new_code != fixed_code:
                    fixed_code = new_code
                    fixes += 1

        return &#123;
            "original_code": code,
            "fixed_code": fixed_code,
            "fixes": fixes,
            "remaining_issues": len(issues) - fixes,
        &#125;
```

---

## 5. 测试生成

```python
@dataclass
class TestGenerator:
    """测试代码生成"""

    async def generate_tests(self, code: str, language: str = "python") -> str:
        """生成单元测试"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.2)

        prompt = f"""为以下&#123;language&#125;代码生成完整的单元测试。

要求：
1. 覆盖正常路径
2. 覆盖边界情况
3. 覆盖异常情况
4. 使用 pytest 框架
5. 包含 mock

代码:
```
&#123;code&#125;
```

只输出测试代码。"""

        response = await llm.ainvoke(prompt)
        return self._extract_code(response.content)

    async def run_tests(self, test_code: str, source_code: str) -> dict:
        """运行测试"""
        # 写入临时文件
        with open("/tmp/test_code.py", "w") as f:
            f.write(source_code)
        with open("/tmp/test_test.py", "w") as f:
            f.write(test_code)

        import subprocess
        result = subprocess.run(
            ["python", "-m", "pytest", "/tmp/test_test.py", "-v", "--tb=short"],
            capture_output=True, text=True, timeout=30,
        )

        return &#123;
            "exit_code": result.returncode,
            "passed": result.returncode == 0,
            "output": result.stdout[:3000],
            "errors": result.stderr[:1000] if result.returncode != 0 else "",
        &#125;
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了代码生成（需求→代码） | ☐ |
| 实现了项目结构生成 | ☐ |
| 实现了代码审查（6 维度） | ☐ |
| 实现了自动修复 | ☐ |
| 实现了测试生成 | ☐ |
| 实现了测试运行 | ☐ |
| 有代码沙箱执行 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 03 | 核心概念 Models-Prompts-Parsers | 基础 |
| 22 | SQL 数据库 Agent | SQL |
| 134 | Agent 代码执行沙箱安全 | 沙箱 |
| 195 | Agent 安全沙箱 | 沙箱 |
| 436 | AI 编程 Agent | 编程 |
| 462 | Agent 设计模式 | 设计模式 |
| 504 | Agent DevOps 与 CI/CD | CI/CD |
| 517 | Agent 数据分析 | 数据分析 |
