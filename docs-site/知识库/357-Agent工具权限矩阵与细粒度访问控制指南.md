# Agent 工具权限矩阵与细粒度访问控制指南

> Agent 能调多个工具，但不是每个用户都该看到每个工具。这篇指南讲透基于角色的工具权限矩阵（RBAC）、运行时权限检查和动态工具集裁剪，让 Agent 安全地"按需用工具"。

---

## 一、为什么需要工具权限控制

```mermaid
graph TB
    USER["用户请求"] --> AUTH["身份认证<br/>提取角色"]
    AUTH --> MATRIX&#123;"权限矩阵<br/>角色×工具"&#125;
    MATRIX -->|允许| GRANT["动态注入工具集"]
    MATRIX -->|拒绝| DENY["剔除该工具<br/>Agent不感知"]

    GRANT --> AGENT["Agent 执行"]
    AGENT --> CALL&#123;"调用工具?"&#125;
    CALL --> CHECK&#123;"运行时二次校验"&#125;
    CHECK -->|通过| EXEC["执行工具"]
    CHECK -->|拒绝| BLOCK["阻止+记录"]

    style MATRIX fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style GRANT fill:#C8E6C9
    style BLOCK fill:#FFCDD2,stroke:#C62828
```

默认把所有工具都给 Agent 是危险的——普通用户不该触发数据库删除、文件写入或外部 API 调用。权限矩阵的核心是**在 Agent 组装时就剔除不该看到的工具**，在工具调用时再做二次校验。

---

## 二、权限矩阵实现

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Any
from langchain_core.tools import tool, BaseTool

class Permission(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    AUDIT = "audit"   # 允许但记录审计日志

@dataclass
class ToolPermission:
    """单个工具的权限规则。"""
    tool_name: str
    roles: set[str]               # 允许调用的角色
    params_filter: dict = field(default_factory=dict)  # 参数过滤规则
    max_calls_per_session: int = 0  # 0=不限
    require_approval: bool = False  # 是否需要人工审批

@dataclass
class UserContext:
    """用户上下文。"""
    user_id: str
    roles: list[str]
    session_id: str
    metadata: dict = field(default_factory=dict)

class PermissionMatrix:
    """工具权限矩阵。"""

    def __init__(self):
        self._rules: dict[str, ToolPermission] = &#123;&#125;
        self._call_counts: dict[str, dict[str, int]] = &#123;&#125;  # session_id -> tool_name -> count
        self._audit_log: list[dict] = []

    def register(self, permission: ToolPermission):
        self._rules[permission.tool_name] = permission

    def check(self, tool_name: str, user: UserContext, params: dict = None) -> dict:
        """检查权限。"""
        rule = self._rules.get(tool_name)

        # 无规则=默认拒绝
        if not rule:
            return &#123;"allowed": False, "reason": "未注册工具"&#125;

        # 角色检查
        user_roles = set(user.roles)
        if not user_roles.intersection(rule.roles):
            return &#123;"allowed": False, "reason": "角色无权限"&#125;

        # 调用次数检查
        if rule.max_calls_per_session > 0:
            count = self._call_counts.get(user.session_id, &#123;&#125;).get(tool_name, 0)
            if count >= rule.max_calls_per_session:
                return &#123;"allowed": False, "reason": "超出调用次数限制"&#125;

        # 参数过滤检查
        if rule.params_filter and params:
            for param, allowed_values in rule.params_filter.items():
                if param in params and params[param] not in allowed_values:
                    return &#123;"allowed": False, "reason": f"参数 &#123;param&#125; 值不允许"&#125;

        # 审计模式
        should_audit = Permission.AUDIT.value if False else Permission.ALLOW.value

        # 需要审批
        if rule.require_approval:
            return &#123;"allowed": False, "reason": "需要人工审批", "needs_approval": True&#125;

        return &#123;"allowed": True, "reason": "通过"&#125;

    def record_call(self, tool_name: str, user: UserContext, params: dict, result: Any):
        """记录调用。"""
        session = user.session_id
        if session not in self._call_counts:
            self._call_counts[session] = &#123;&#125;
        self._call_counts[session][tool_name] = self._call_counts[session].get(tool_name, 0) + 1

        self._audit_log.append(&#123;
            "tool": tool_name, "user_id": user.user_id, "session_id": session,
            "params": str(params)[:200], "result": str(result)[:200],
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        &#125;)

    def get_allowed_tools(self, user: UserContext, all_tools: list[BaseTool]) -> list[BaseTool]:
        """根据权限矩阵过滤工具集。"""
        allowed = []
        for t in all_tools:
            check = self.check(t.name, user)
            if check["allowed"]:
                allowed.append(t)
        return allowed

    def get_audit_log(self, user_id: str = None) -> list[dict]:
        if user_id:
            return [log for log in self._audit_log if log["user_id"] == user_id]
        return self._audit_log
```

### 权限中间件装饰器

```python
import functools

def with_permission(matrix: PermissionMatrix):
    """权限校验装饰器——运行时二次校验。"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 从kwargs中提取用户上下文（由Agent框架注入）
            user_ctx = kwargs.get("_user_context")
            if not user_ctx:
                return &#123;"error": "无用户上下文", "details": "权限校验失败"&#125;

            tool_name = func.__name__
            check = matrix.check(tool_name, user_ctx, &#123;k: v for k, v in kwargs.items() if k != "_user_context"&#125;)

            if not check["allowed"]:
                return &#123;"error": "权限拒绝", "reason": check["reason"]&#125;

            # 执行
            result = await func(*args, **kwargs)
            matrix.record_call(tool_name, user_ctx, kwargs, result)
            return result
        return wrapper
    return decorator
```

---

## 三、使用示例

```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 定义工具
@tool
async def search_records(query: str) -> dict:
    """搜索记录。"""
    return &#123;"results": [f"记录: &#123;query&#125;"], "count": 1&#125;

@tool
async def delete_record(record_id: str) -> dict:
    """删除记录。"""
    return &#123;"deleted": True, "record_id": record_id&#125;

@tool
async def export_data(format: str) -> dict:
    """导出数据。"""
    return &#123;"exported": True, "format": format, "rows": 1500&#125;

# 配置权限矩阵
matrix = PermissionMatrix()
matrix.register(ToolPermission("search_records", roles=&#123;"viewer", "editor", "admin"&#125;))
matrix.register(ToolPermission("delete_record", roles=&#123;"admin"&#125;, max_calls_per_session=5, require_approval=False))
matrix.register(ToolPermission("export_data", roles=&#123;"editor", "admin"&#125;, params_filter=&#123;"format": ["csv", "json"]&#125;))

# 用户上下文
viewer_user = UserContext(user_id="u001", roles=["viewer"], session_id="s001")
admin_user = UserContext(user_id="u002", roles=["admin"], session_id="s002")

# 动态构建Agent——不同角色看到不同工具集
all_tools = [search_records, delete_record, export_data]

viewer_tools = matrix.get_allowed_tools(viewer_user, all_tools)
admin_tools = matrix.get_allowed_tools(admin_user, all_tools)

print(f"Viewer可用工具: &#123;[t.name for t in viewer_tools]&#125;")
# ['search_records']
print(f"Admin可用工具: &#123;[t.name for t in admin_tools]&#125;")
# ['search_records', 'delete_record', 'export_data']

viewer_agent = create_react_agent(llm, viewer_tools, prompt="你是记录查询助手。")
admin_agent = create_react_agent(llm, admin_tools, prompt="你是记录管理助手。")
```

---

## 四、权限模型对比

| 模型 | 粒度 | 实现复杂度 | 适用场景 |
|------|------|-----------|----------|
| 角色级（RBAC） | 工具级 | 低 | 工具<10个 |
| 参数级 | 参数值级 | 中 | 需要限制参数范围 |
| 属性级（ABAC） | 上下文级 | 高 | 复杂业务规则 |
| 动态权限 | 运行时计算 | 高 | 需要实时风控 |

---

## 五、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 默认拒绝 | 未注册的工具一律不可用 | ★★★ |
| Agent组装时过滤 | 用户不感知被拒绝的工具 | ★★★ |
| 运行时二次校验 | 防止注入绕过 | ★★★ |
| 调用次数限制 | 防止刷接口 | ★★☆ |
| 审计日志 | 所有敏感操作可追溯 | ★★☆ |
| 需审批操作标记 | 高危操作人工确认 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有权限矩阵 | ☐ |
| 支持角色级控制 | ☐ |
| 支持参数级过滤 | ☐ |
| 动态工具集裁剪 | ☐ |
| 运行时二次校验 | ☐ |
| 有审计日志 | ☐ |
| 有调用次数限制 | ☐ |
