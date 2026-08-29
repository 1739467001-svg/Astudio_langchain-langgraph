# Agent 工具链设计深度指南

> Agent 的能力边界由工具决定——给 3 个工具和给 30 个工具效果完全不同。工具太少能力受限，太多决策混乱。这份指南系统讲解工具选型、命名规范、参数设计和依赖管理。

---

## 一、工具链设计的核心问题

```mermaid
graph TB
    subgraph 问题 {"工具链设计的3个核心问题"}
        Q1["选哪些工具？<br/>覆盖能力但不冗余"]
        Q2["怎么描述工具？<br/>让Agent选对不选错"]
        Q3["怎么管理依赖？<br/>工具间数据流转"]
    end

    style 问题 fill:#FFF3E0,stroke:#E65100,stroke-width:3px
```

---

## 二、工具选型原则

```mermaid
graph TB
    subgraph 原则 {"工具选型5原则"}
        P1["1.最小够用<br/>5-10个工具最佳"]
        P2["2.正交不重叠<br/>每个工具有明确职责"]
        P3["3.描述要精确<br/>Agent靠描述决策"]
        P4["4.参数要简单<br/>减少Agent出错"]
        P5["5.错误要友好<br/>返回可理解的错误"]
    end

    style 原则 fill:#E3F2FD
```

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class ToolCategory(str, Enum):
    SEARCH = "search"          # 搜索类
    ANALYZE = "analyze"        # 分析类
    EXECUTE = "execute"        # 执行类
    COMMUNICATE = "communicate"  # 通信类

class ToolDesignPrinciples:
    """工具设计原则检查器。"""

    @staticmethod
    def check_tool(
        name: str,
        description: str,
        params: dict,
        category: ToolCategory,
    ) -> dict:
        """检查工具设计是否合理。"""
        issues = []

        # 1. 名称检查：动词+名词
        if not any(verb in name for verb in ["search", "get", "create", "send", "analyze", "calculate", "execute"]):
            issues.append("工具名应含动词（search/get/create等）")

        # 2. 描述检查：说清楚做什么+何时用
        if len(description) < 20:
            issues.append("描述太短，Agent无法判断何时使用")
        if "何时" not in description and "when" not in description.lower():
            if "用于" not in description and "use" not in description.lower():
                issues.append("描述应说明何时使用此工具")

        # 3. 参数检查
        for param_name, param_info in params.items():
            if not param_info.get("description"):
                issues.append(f"参数'{param_name}'缺少描述")
            if param_info.get("required") and not param_info.get("default"):
                pass  # 必填参数是合理的

        return {
            "tool": name,
            "category": category.value,
            "issues": issues,
            "is_well_designed": len(issues) == 0,
        }
```

---

## 三、工具命名与描述规范

```python
# ✅ 好的工具设计
@tool
def search_web(query: str, max_results: int = 5) -> str:
    """搜索网络获取最新信息。

    何时使用：用户询问最新事件、实时数据、或知识库中没有的信息时。
    何时不使用：通用知识问题（直接回答即可）。

    Args:
        query: 搜索关键词
        max_results: 返回结果数量（默认5）
    """
    pass

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """发送邮件通知。

    何时使用：需要通知用户或团队成员时。
    注意：发送前需要人工审批。

    Args:
        to: 收件人邮箱
        subject: 邮件主题
        body: 邮件正文
    """
    pass

# ❌ 坏的工具设计
@tool
def tool1(x: str) -> str:
    """处理数据"""
    pass  # 名字无意义、描述太短、参数名含糊
```

---

## 四、工具依赖管理

```mermaid
graph TB
    subgraph 依赖 {"工具间数据依赖"}
        SEARCH["search_web"] --> ANALYZE["analyze_data<br/>(依赖搜索结果)"]
        ANALYZE --> REPORT["generate_report<br/>(依赖分析结果)"]
        REPORT --> SEND["send_email<br/>(依赖报告内容)"]
    end

    style 依赖 fill:#E3F2FD
```

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class ToolDependency:
    """工具依赖关系。"""
    tool_name: str
    depends_on: list[str] = field(default_factory=list)  # 依赖的前置工具
    produces: str = ""  # 产出数据类型
    consumes: list[str] = field(default_factory=list)  # 消费的数据类型

class ToolChainManager:
    """工具链管理器。"""

    def __init__(self):
        self.tools: dict[str, ToolDependency] = {}

    def register(self, dep: ToolDependency):
        self.tools[dep.tool_name] = dep

    def get_execution_order(self, target_tool: str) -> list[str]:
        """获取执行顺序（拓扑排序）。"""
        order = []
        visited = set()

        def visit(tool_name: str):
            if tool_name in visited:
                return
            visited.add(tool_name)
            dep = self.tools.get(tool_name)
            if dep:
                for prerequisite in dep.depends_on:
                    visit(prerequisite)
            order.append(tool_name)

        visit(target_tool)
        return order

    def validate_chain(self) -> dict:
        """验证工具链完整性。"""
        issues = []
        for name, dep in self.tools.items():
            for prereq in dep.depends_on:
                if prereq not in self.tools:
                    issues.append(f"{name}依赖{prereq}，但{prereq}未注册")

        return {"valid": len(issues) == 0, "issues": issues}
```

---

## 五、工具组合模式

```mermaid
graph TB
    subgraph 模式 {"3种工具组合模式"}
        M1["串行链<br/>A→B→C<br/>数据逐步处理"]
        M2["并行扇出<br/>A→{B,C,D}<br/>多路同时执行"]
        M3["条件选择<br/>A→if→B/C<br/>根据结果选工具"]
    end

    style 模式 fill:#C8E6C9
```

---

## 六、工具数量与效果关系

```mermaid
graph TB
    subgraph 数量 {"工具数量与Agent效果"}
        N1["1-3个<br/>能力受限<br/>但决策准确"]
        N2["5-10个<br/>最佳平衡<br/>推荐"]
        N3["15+个<br/>决策困难<br/>选错率↑"]
        N4["30+个<br/>严重混乱<br/>必须分组"]
    end

    style N2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
    style N4 fill:#FFCDD2
```

```python
class ToolGroupManager:
    """工具分组管理器——超过10个工具时分组。"""

    def __init__(self):
        self.groups: dict[str, list] = {}

    def add_group(self, group_name: str, tools: list):
        self.groups[group_name] = tools

    def get_tools_for_task(self, task_type: str) -> list:
        """根据任务类型返回相关工具组。"""
        groups = {
            "research": ["search_web", "search_kb", "summarize"],
            "analysis": ["analyze_data", "calculate", "visualize"],
            "communication": ["send_email", "send_message", "create_calendar"],
        }
        return groups.get(task_type, [])
```

---

## 七、工具错误处理

```python
class ToolErrorHandler:
    """工具错误处理——返回Agent可理解的错误信息。"""

    @staticmethod
    def handle_error(tool_name: str, error: Exception) -> str:
        """将技术错误转为Agent可理解的信息。"""
        error_str = str(error).lower()

        if "timeout" in error_str:
            return f"工具{tool_name}执行超时，请减少参数范围后重试"
        elif "permission" in error_str or "403" in error_str:
            return f"工具{tool_name}权限不足，可能需要额外授权"
        elif "not found" in error_str or "404" in error_str:
            return f"工具{tool_name}未找到目标资源，请检查参数"
        elif "rate limit" in error_str or "429" in error_str:
            return f"工具{tool_name}被限流，请稍后重试"
        else:
            return f"工具{tool_name}执行失败: {str(error)[:100]}"
```

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 工具5-10个最佳 | 太少能力受限，太多决策混乱 | ★★★ |
| 描述说清"何时用" | Agent靠描述决策 | ★★★ |
| 参数用Pydantic | 类型约束减少错误 | ★★★ |
| 超过10个分组 | 按任务类型分组 | ★★☆ |
| 错误返回友好信息 | Agent可据此调整 | ★★☆ |
| 工具间不重叠 | 正交设计 | ★★☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 有工具设计检查器 | ☐ |
| 工具5-10个 | ☐ |
| 描述含"何时使用" | ☐ |
| 有依赖管理 | ☐ |
| 有错误处理 | ☐ |
| 超过10个有分组 | ☐ |
