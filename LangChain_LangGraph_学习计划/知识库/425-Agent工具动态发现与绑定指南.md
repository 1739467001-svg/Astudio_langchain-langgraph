# Agent 工具动态发现与绑定指南

> 传统 Agent 在代码里硬编码工具列表——编译时决定了能用哪些工具。但生产环境中，工具会增减：新 API 上线、旧接口下线、用户权限变化。动态工具发现让 Agent 在运行时自动发现可用工具，按需绑定，无需重新部署。

---

## 1. 静态 vs 动态工具

### 静态工具的问题

```
# 传统方式：硬编码工具列表
tools = [search_tool, calculator_tool, weather_tool]
agent = create_react_agent(llm, tools)

问题：
  1. 新增工具 → 改代码 → 重新部署
  2. 用户A有权限用工具X，用户B没有 → 硬编码无法区分
  3. 工具API下线了 → Agent还在尝试调用 → 报错
  4. 工具版本更新了 → 参数变了 → Agent用旧参数调用 → 失败
```

### 动态工具发现

```
Agent 启动
  → 查询工具注册中心："当前有哪些工具可用？"
  → 注册中心返回工具列表（含描述、参数schema、权限要求）
  → Agent 根据用户权限过滤
  → 绑定可用工具到当前会话
  → 用户问题 → LLM 从绑定的工具中选择调用
```

---

## 2. 工具注册与发现

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable
import time
import uuid

class ToolStatus(Enum):
    ACTIVE = "active"           # 可用
    DEPRECATED = "deprecated"   # 已废弃
    DISABLED = "disabled"       # 已禁用
    BETA = "beta"               # 测试中


@dataclass
class ToolDefinition:
    """工具定义"""
    name: str
    description: str
    # 参数 schema
    parameters: dict = field(default_factory=dict)  # JSON Schema
    # 状态
    status: ToolStatus = ToolStatus.ACTIVE
    version: str = "1.0.0"
    # 权限
    required_permissions: list[str] = field(default_factory=list)
    # 元数据
    category: str = "general"   # search / calculation / data / communication
    tags: list[str] = field(default_factory=list)
    # 执行
    handler: Callable | None = None
    # 时序
    registered_at: float = field(default_factory=time.time)
    last_updated: float = field(default_factory=time.time)


class ToolRegistry:
    """工具注册中心"""

    def __init__(self):
        self.tools: dict[str, ToolDefinition] = {}
        self.category_index: dict[str, list[str]] = {}

    def register(self, tool: ToolDefinition) -> bool:
        """注册工具"""
        self.tools[tool.name] = tool

        cat = tool.category
        if cat not in self.category_index:
            self.category_index[cat] = []
        if tool.name not in self.category_index[cat]:
            self.category_index[cat].append(tool.name)

        return True

    def unregister(self, name: str):
        """注销工具"""
        tool = self.tools.pop(name, None)
        if tool:
            cat = tool.category
            if cat in self.category_index:
                self.category_index[cat] = [
                    t for t in self.category_index[cat] if t != name
                ]

    def discover(
        self,
        category: str | None = None,
        permissions: list[str] | None = None,
        include_beta: bool = False,
    ) -> list[ToolDefinition]:
        """发现可用工具

        Args:
            category: 按分类过滤
            permissions: 用户权限列表
            include_beta: 是否包含 beta 工具
        """
        results = []

        for tool in self.tools.values():
            # 状态过滤
            if tool.status == ToolStatus.DISABLED:
                continue
            if tool.status == ToolStatus.DEPRECATED:
                continue
            if tool.status == ToolStatus.BETA and not include_beta:
                continue

            # 分类过滤
            if category and tool.category != category:
                continue

            # 权限过滤
            if permissions is not None:
                if not all(p in permissions for p in tool.required_permissions):
                    continue

            results.append(tool)

        return results

    def get(self, name: str) -> ToolDefinition | None:
        """获取单个工具定义"""
        return self.tools.get(name)

    def update_status(self, name: str, status: ToolStatus):
        """更新工具状态"""
        if name in self.tools:
            self.tools[name].status = status
            self.tools[name].last_updated = time.time()

    def list_categories(self) -> list[str]:
        """列出所有分类"""
        return list(self.category_index.keys())
```

---

## 3. 动态工具绑定

```python
class DynamicToolBinder:
    """动态工具绑定器"""

    def __init__(self, registry: ToolRegistry):
        self.registry = registry
        self.session_bindings: dict[str, list[str]] = {}  # session → tool_names

    def bind_tools(
        self,
        session_id: str,
        user_permissions: list[str] | None = None,
        categories: list[str] | None = None,
        custom_tools: list[str] | None = None,
    ) -> list[ToolDefinition]:
        """为会话绑定工具

        Args:
            session_id: 会话 ID
            user_permissions: 用户权限
            categories: 限制工具分类
            custom_tools: 自定义指定工具名
        """
        if custom_tools:
            # 指定工具名
            tools = []
            for name in custom_tools:
                tool = self.registry.get(name)
                if tool and tool.status == ToolStatus.ACTIVE:
                    if user_permissions is None or all(
                        p in user_permissions for p in tool.required_permissions
                    ):
                        tools.append(tool)
        else:
            # 按分类+权限发现
            if categories:
                tools = []
                for cat in categories:
                    tools.extend(self.registry.discover(
                        category=cat,
                        permissions=user_permissions,
                    ))
            else:
                tools = self.registry.discover(permissions=user_permissions)

        # 去重
        seen = set()
        unique_tools = []
        for t in tools:
            if t.name not in seen:
                seen.add(t.name)
                unique_tools.append(t)

        # 记录绑定
        self.session_bindings[session_id] = [t.name for t in unique_tools]

        return unique_tools

    def get_bound_tools(self, session_id: str) -> list[str]:
        """获取会话已绑定的工具"""
        return self.session_bindings.get(session_id, [])

    def unbind(self, session_id: str):
        """解绑会话工具"""
        self.session_bindings.pop(session_id, None)

    def refresh(self, session_id: str) -> list[ToolDefinition]:
        """刷新绑定（工具可能有更新）"""
        bound = self.get_bound_tools(session_id)
        if not bound:
            return []
        # 重新发现
        tools = []
        for name in bound:
            tool = self.registry.get(name)
            if tool and tool.status == ToolStatus.ACTIVE:
                tools.append(tool)
        self.session_bindings[session_id] = [t.name for t in tools]
        return tools
```

---

## 4. 动态工具 Agent

```python
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel
from typing import Any

class DynamicToolAgent:
    """动态工具 Agent"""

    def __init__(
        self,
        llm: ChatOpenAI,
        registry: ToolRegistry,
        binder: DynamicToolBinder,
    ):
        self.llm = llm
        self.registry = registry
        self.binder = binder

    async def chat(
        self,
        session_id: str,
        user_input: str,
        user_permissions: list[str] | None = None,
    ) -> str:
        """动态绑定工具后对话"""
        # 1. 绑定工具
        tools = self.binder.bind_tools(
            session_id=session_id,
            user_permissions=user_permissions,
        )

        if not tools:
            return "当前没有可用工具，请联系管理员。"

        # 2. 将 ToolDefinition 转为 LangChain Tool
        lc_tools = []
        for tool_def in tools:
            lc_tool = StructuredTool.from_function(
                func=tool_def.handler or (lambda **kwargs: f"工具 {tool_def.name} 未配置处理器"),
                name=tool_def.name,
                description=tool_def.description,
            )
            lc_tools.append(lc_tool)

        # 3. 创建 Agent（每次会话动态创建）
        agent = create_react_agent(self.llm, lc_tools)

        # 4. 调用
        result = agent.invoke({
            "messages": [HumanMessage(content=user_input)],
        })

        response = result["messages"][-1].content

        # 5. 解绑（节省内存）
        self.binder.unbind(session_id)

        return response


# 使用
# 创建工具注册中心
registry = ToolRegistry()
binder = DynamicToolBinder(registry)

# 注册工具
def search_web(query: str) -> str:
    return f"搜索结果：{query}"

def calculate(expression: str) -> str:
    try:
        return str(eval(expression))
    except Exception as e:
        return f"计算错误：{e}"

registry.register(ToolDefinition(
    name="web_search",
    description="搜索互联网信息",
    parameters={"query": {"type": "string", "description": "搜索关键词"}},
    category="search",
    required_permissions=["search:read"],
    handler=search_web,
))

registry.register(ToolDefinition(
    name="calculator",
    description="数学计算器",
    parameters={"expression": {"type": "string", "description": "数学表达式"}},
    category="calculation",
    required_permissions=[],
    handler=calculate,
))

# 创建 Agent
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
agent = DynamicToolAgent(llm, registry, binder)

# 用户 A 有搜索权限
response_a = agent.chat("session_a", "帮我搜索 LangChain 最新版本", ["search:read"])
# → 可以使用 web_search 工具

# 用户 B 没有搜索权限
response_b = agent.chat("session_b", "帮我搜索 LangChain 最新版本", [])
# → 只有 calculator 工具，无法搜索
```

---

## 5. 工具健康检查与自动禁用

```python
class ToolHealthChecker:
    """工具健康检查器"""

    def __init__(self, registry: ToolRegistry):
        self.registry = registry
        self.health_log: dict[str, list[dict]] = {}  # tool_name → health records
        self.failure_threshold = 3    # 连续失败 3 次自动禁用

    def check_tool(self, tool_name: str) -> dict:
        """检查单个工具健康"""
        tool = self.registry.get(tool_name)
        if not tool:
            return {"tool": tool_name, "status": "not_found"}

        # 调用健康检查端点（如果有）
        # 这里简化为检查 handler 是否可调用
        if tool.handler is None:
            return {"tool": tool_name, "status": "no_handler"}

        return {
            "tool": tool_name,
            "status": "healthy" if tool.status == ToolStatus.ACTIVE else "unhealthy",
            "version": tool.version,
        }

    def record_failure(self, tool_name: str, error: str):
        """记录工具调用失败"""
        if tool_name not in self.health_log:
            self.health_log[tool_name] = []

        self.health_log[tool_name].append({
            "error": error,
            "timestamp": time.time(),
        })

        # 检查连续失败次数
        recent = self.health_log[tool_name][-self.failure_threshold:]
        if len(recent) >= self.failure_threshold:
            # 自动禁用
            self.registry.update_status(tool_name, ToolStatus.DISABLED)
            return {"action": "auto_disabled", "tool": tool_name, "reason": f"连续失败 {len(recent)} 次"}

        return {"action": "logged", "failures": len(recent)}

    def record_success(self, tool_name: str):
        """记录成功调用，重置失败计数"""
        if tool_name in self.health_log:
            self.health_log[tool_name] = []

    def health_report(self) -> dict:
        """健康报告"""
        all_tools = self.registry.tools
        healthy = sum(1 for t in all_tools.values() if t.status == ToolStatus.ACTIVE)
        disabled = sum(1 for t in all_tools.values() if t.status == ToolStatus.DISABLED)

        return {
            "total_tools": len(all_tools),
            "healthy": healthy,
            "disabled": disabled,
            "failure_logs": {
                name: len(logs) for name, logs in self.health_log.items()
            },
        }
```

---

## 6. 工具版本管理

```python
class ToolVersionManager:
    """工具版本管理"""

    def __init__(self, registry: ToolRegistry):
        self.registry = registry
        self.versions: dict[str, list[ToolDefinition]] = {}  # name → versions

    def register_version(self, tool: ToolDefinition):
        """注册新版本"""
        if tool.name not in self.versions:
            self.versions[tool.name] = []
        self.versions[tool.name].append(tool)
        # 注册到 registry（覆盖旧版本）
        self.registry.register(tool)

    def get_versions(self, name: str) -> list[ToolDefinition]:
        """获取工具所有版本"""
        return self.versions.get(name, [])

    def rollback_version(self, name: str) -> bool:
        """回滚到上一版本"""
        versions = self.versions.get(name, [])
        if len(versions) < 2:
            return False
        # 激活倒数第二个版本
        self.registry.register(versions[-2])
        return True
```

---

## 7. 配置参考

| 配置 | 推荐值 | 说明 |
|------|--------|------|
| 工具数量上限 | 10-20 | 太多 LLM 会选错 |
| 健康检查频率 | 每 5 分钟 | 定时检查所有工具 |
| 失败阈值 | 3 次 | 连续失败后自动禁用 |
| 会话工具缓存 | 是 | 同会话不重复绑定 |
| Beta 工具 | 默认不包含 | 需显式请求 |
| 版本回滚 | 支持 | 新版本有问题时 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 有工具注册中心 | ☐ |
| 有动态绑定器 | ☐ |
| 有权限过滤 | ☐ |
| 有分类索引 | ☐ |
| 有健康检查 | ☐ |
| 有自动禁用 | ☐ |
| 有版本管理 | ☐ |
| 有版本回滚 | ☐ |
