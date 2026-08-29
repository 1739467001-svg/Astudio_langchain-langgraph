# Agent 身份认证与授权体系指南

> 当 Agent 代表用户执行操作——查数据库、发消息、调用 API——谁来确认"这个 Agent 确实有权做这件事"？Agent 不能匿名操作，也不能拥有无限权限。本指南系统讲解 Agent 身份管理、认证机制、RBAC/ABAC 授权模型，以及在 LangChain/LangGraph 中的实现方案。

---

## 1. 为什么 Agent 需要身份认证

### 没有认证的风险

```
场景：Agent 帮用户查询订单
  无认证：Agent 可以查任何人的订单 → 隐私泄露
  有认证：Agent 只能查当前登录用户的订单 → 安全

场景：Agent 可以调用删除工具
  无授权：Agent 误删数据 → 灾难
  有授权：删除操作需要管理员审批 → 安全

场景：多租户系统
  无隔离：租户 A 的 Agent 访问租户 B 的数据 → 越权
  有隔离：Agent 上下文绑定租户 ID → 隔离
```

### 认证 vs 授权 vs 审计

```
认证（Authentication）：你是谁？
  → 验证用户/Agent 身份
  → JWT / API Key / OAuth 2.0

授权（Authorization）：你能做什么？
  → 检查权限和角色
  → RBAC / ABAC / Policy

审计（Audit）：你做了什么？
  → 记录所有操作
  → 日志 / 追踪 / 合规
```

---

## 2. 身份认证机制

### JWT Token 认证

```python
from datetime import datetime, timedelta
import jwt
from dataclasses import dataclass

@dataclass
class JWTManager:
    """JWT Token 管理器"""
    secret_key: str = "your-secret-key"
    algorithm: str = "HS256"
    expire_minutes: int = 60

    def create_token(self, user_id: str, roles: list, tenant_id: str = "") -> str:
        """创建 JWT Token"""
        payload = &#123;
            "user_id": user_id,
            "roles": roles,          # ["user", "admin"]
            "tenant_id": tenant_id,  # 多租户
            "exp": datetime.utcnow() + timedelta(minutes=self.expire_minutes),
            "iat": datetime.utcnow(),
        &#125;
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> dict:
        """验证 JWT Token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token 已过期")
        except jwt.InvalidTokenError:
            raise ValueError("无效 Token")

# 使用
jwt_mgr = JWTManager(secret_key="my-secret")
token = jwt_mgr.create_token(
    user_id="user_001",
    roles=["user"],
    tenant_id="tenant_A",
)
# token = "eyJhbG..."

payload = jwt_mgr.verify_token(token)
# &#123;"user_id": "user_001", "roles": ["user"], "tenant_id": "tenant_A", ...&#125;
```

### API Key 认证

```python
import hashlib
import secrets

@dataclass
class APIKeyManager:
    """API Key 管理（适合 Agent 间认证）"""
    keys: dict = None  # &#123;key_hash: &#123;agent_id, scopes, created_at&#125;&#125;

    def __post_init__(self):
        self.keys = &#123;&#125;

    def create_key(self, agent_id: str, scopes: list) -> str:
        """为 Agent 创建 API Key"""
        raw_key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        self.keys[key_hash] = &#123;
            "agent_id": agent_id,
            "scopes": scopes,  # ["read:orders", "write:messages"]
            "created_at": datetime.utcnow(),
        &#125;
        return raw_key  # 只返回一次

    def verify_key(self, raw_key: str) -> dict:
        """验证 API Key"""
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        if key_hash not in self.keys:
            raise ValueError("无效 API Key")
        return self.keys[key_hash]

# 使用
key_mgr = APIKeyManager()
agent_key = key_mgr.create_key("agent_001", ["read:orders", "write:messages"])
# 返回原始 key，只出现一次
```

### OAuth 2.0 集成（第三方服务）

```python
# Agent 代表用户访问第三方服务（如 Slack、GitHub）
from authlib.integrations.httpx_client import AsyncOAuth2Client

async def get_oauth_token(user_id: str, service: str) -> str:
    """获取用户授权的 OAuth Token"""
    # 从数据库获取用户存储的 OAuth Token
    token = await db.get_oauth_token(user_id, service)
    if token and token["expires_at"] > datetime.utcnow():
        return token["access_token"]

    # Token 过期，用 refresh_token 刷新
    async with AsyncOAuth2Client(
        client_id="your_client_id",
        client_secret="your_client_secret",
    ) as client:
        new_token = await client.refresh_token(
            "https://api.slack.com/oauth/v2/refresh",
            refresh_token=token["refresh_token"],
        )
        await db.save_oauth_token(user_id, service, new_token)
        return new_token["access_token"]
```

---

## 3. RBAC 授权模型

### 角色定义

```python
from enum import Enum
from dataclasses import dataclass, field

class Role(Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    USER = "user"
    GUEST = "guest"

@dataclass
class Permission:
    """权限定义"""
    resource: str       # "orders", "messages", "tools"
    action: str         # "read", "write", "delete", "execute"
    conditions: dict = field(default_factory=dict)  # 额外条件

@dataclass
class RBACManager:
    """基于角色的访问控制"""
    role_permissions: dict = None

    def __post_init__(self):
        # 角色到权限的映射
        self.role_permissions = &#123;
            Role.ADMIN: [
                Permission("*", "*"),  # 管理员有所有权限
            ],
            Role.OPERATOR: [
                Permission("orders", "read"),
                Permission("orders", "write"),
                Permission("messages", "read"),
                Permission("messages", "write"),
                Permission("tools", "execute"),
            ],
            Role.USER: [
                Permission("orders", "read"),  # 只能读自己的
                Permission("messages", "write"),
            ],
            Role.GUEST: [
                Permission("orders", "read"),
            ],
        &#125;

    def check_permission(self, role: Role, resource: str, action: str) -> bool:
        """检查角色是否有权限"""
        permissions = self.role_permissions.get(role, [])
        for perm in permissions:
            if (perm.resource == "*" or perm.resource == resource) and \
               (perm.action == "*" or perm.action == action):
                return True
        return False
```

### ABAC 属性级授权

```python
@dataclass
class ABACManager:
    """基于属性的访问控制（更细粒度）"""

    policies: list = None

    def __post_init__(self):
        self.policies = [
            # 用户只能访问自己的订单
            &#123;
                "resource": "orders",
                "action": "read",
                "condition": lambda ctx: ctx["resource_owner_id"] == ctx["user_id"],
            &#125;,
            # 操作员可以修改订单但不能删除
            &#123;
                "resource": "orders",
                "action": "write",
                "condition": lambda ctx: ctx["role"] in ["operator", "admin"],
            &#125;,
            # 删除需要管理员
            &#123;
                "resource": "orders",
                "action": "delete",
                "condition": lambda ctx: ctx["role"] == "admin",
            &#125;,
            # 工具执行需要特定角色
            &#123;
                "resource": "tools",
                "action": "execute",
                "condition": lambda ctx: ctx["role"] in ["operator", "admin"] and
                             ctx["tool_name"] in ctx["allowed_tools"],
            &#125;,
            # 多租户隔离
            &#123;
                "resource": "*",
                "action": "*",
                "condition": lambda ctx: ctx["tenant_id"] == ctx["resource_tenant_id"],
            &#125;,
        ]

    def check(self, context: dict) -> bool:
        """检查是否满足策略"""
        resource = context.get("resource")
        action = context.get("action")

        for policy in self.policies:
            if (policy["resource"] == "*" or policy["resource"] == resource) and \
               (policy["action"] == "*" or policy["action"] == action):
                if policy["condition"](context):
                    return True
        return False

# 使用
abac = ABACManager()

# 用户读取自己的订单
ctx = &#123;
    "user_id": "user_001",
    "role": "user",
    "resource": "orders",
    "action": "read",
    "resource_owner_id": "user_001",
    "tenant_id": "tenant_A",
    "resource_tenant_id": "tenant_A",
&#125;
abac.check(ctx)  # True

# 用户读取别人的订单
ctx["resource_owner_id"] = "user_002"
abac.check(ctx)  # False
```

---

## 4. LangGraph 中的认证授权

### 认证中间件

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_core.tools import tool

# === 在 State 中携带认证信息 ===
from typing import TypedDict

class AuthState(TypedDict):
    messages: list
    user_id: str          # 认证后的用户 ID
    roles: list           # 用户角色
    tenant_id: str        # 租户 ID
    permissions: dict     # 权限缓存

# === 认证节点（图的第一个节点）===
async def auth_node(state: AuthState):
    """从消息中提取并验证身份"""
    token = extract_token_from_messages(state["messages"])

    if not token:
        return &#123;"messages": [&#123;"role": "assistant", "content": "请先登录"&#125;]&#125;

    try:
        payload = jwt_mgr.verify_token(token)
        return &#123;
            "user_id": payload["user_id"],
            "roles": payload["roles"],
            "tenant_id": payload.get("tenant_id", ""),
            "permissions": &#123;&#125;,
        &#125;
    except ValueError as e:
        return &#123;"messages": [&#123;"role": "assistant", "content": f"认证失败: &#123;e&#125;"&#125;]&#125;

# === 授权检查的工具 ===
@tool
def query_orders(user_id: str, tenant_id: str) -> str:
    """查询订单（只能查自己的）"""
    # 工具内部再检查一次
    if user_id != ctx_user_id:
        return "无权访问"
    return f"用户 &#123;user_id&#125; 的订单列表"

# === 带权限检查的节点 ===
async def tool_node(state: AuthState):
    """工具调用节点，带权限检查"""
    user_role = state.get("roles", ["guest"])

    # 检查是否有工具执行权限
    if not rbac.check_permission(Role(user_role[0]), "tools", "execute"):
        return &#123;"messages": [&#123;"role": "assistant", "content": "无权调用工具"&#125;]&#125;

    # 根据角色过滤可用工具
    available_tools = filter_tools_by_role(state["roles"], all_tools)

    llm = ChatOpenAI(model="gpt-4o-mini").bind_tools(available_tools)
    response = await llm.ainvoke(state["messages"])
    return &#123;"messages": [response]&#125;

# === 组装带认证的图 ===
graph = StateGraph(AuthState)
graph.add_node("auth", auth_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "auth")
graph.add_edge("auth", "tools")
graph.add_edge("tools", END)

secured_app = graph.compile()
```

### 动态工具过滤

```python
@dataclass
class ToolAccessControl:
    """工具访问控制"""

    tool_roles: dict = None

    def __post_init__(self):
        # 工具到角色的映射
        self.tool_roles = &#123;
            "query_orders": ["user", "operator", "admin"],
            "create_order": ["operator", "admin"],
            "delete_order": ["admin"],
            "send_message": ["user", "operator", "admin"],
            "execute_code": ["admin"],
            "web_search": ["user", "operator", "admin"],
            "database_query": ["operator", "admin"],
        &#125;

    def filter_tools(self, tools: list, user_roles: list) -> list:
        """根据用户角色过滤可用工具"""
        allowed = []
        for tool in tools:
            required_roles = self.tool_roles.get(tool.name, ["admin"])
            if any(role in required_roles for role in user_roles):
                allowed.append(tool)
        return allowed

    def check_tool_access(self, tool_name: str, user_roles: list) -> bool:
        """检查是否有权限使用特定工具"""
        required_roles = self.tool_roles.get(tool_name, ["admin"])
        return any(role in required_roles for role in user_roles)
```

---

## 5. 多租户隔离

```python
@dataclass
class TenantIsolation:
    """多租户数据隔离"""

    async def get_tenant_filter(self, tenant_id: str) -> dict:
        """获取租户过滤条件"""
        return &#123;"tenant_id": tenant_id&#125;

    async def check_resource_access(self, user_tenant: str, resource_tenant: str) -> bool:
        """检查资源是否属于用户租户"""
        if user_tenant != resource_tenant:
            raise PermissionError(f"跨租户访问被拒绝: &#123;user_tenant&#125; → &#123;resource_tenant&#125;")
        return True

# 在 RAG 中应用租户隔离
async def tenant_aware_retrieval(query: str, tenant_id: str):
    """带租户隔离的检索"""
    # 向量库查询时自动加租户过滤
    results = await vectorstore.asimilarity_search(
        query,
        filter=&#123;"tenant_id": tenant_id&#125;,  # 只检索当前租户的文档
        k=5,
    )
    return results
```

---

## 6. 审计日志

```python
@dataclass
class AuditLogger:
    """操作审计日志"""

    async def log(self, user_id: str, action: str, resource: str,
                 details: dict, success: bool, tenant_id: str = ""):
        """记录审计日志"""
        log_entry = &#123;
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,           # "execute_tool", "query_data"
            "resource": resource,        # "orders", "web_search"
            "details": details,          # 工具参数等
            "success": success,
            "tenant_id": tenant_id,
            "ip_address": get_client_ip(),
        &#125;
        await db.audit_logs.insert(log_entry)

    async def query_logs(self, user_id: str = None, action: str = None,
                         start_time: datetime = None, limit: int = 100):
        """查询审计日志"""
        query = &#123;&#125;
        if user_id:
            query["user_id"] = user_id
        if action:
            query["action"] = action
        if start_time:
            query["timestamp"] = &#123;"$gte": start_time.isoformat()&#125;

        return await db.audit_logs.find(query).limit(limit).to_list()

# 在 Agent 执行中记录审计
audit = AuditLogger()

async def execute_with_audit(tool_name: str, args: dict, ctx: dict):
    """带审计的工具执行"""
    await audit.log(
        user_id=ctx["user_id"],
        action="execute_tool",
        resource=tool_name,
        details=args,
        success=False,
        tenant_id=ctx.get("tenant_id", ""),
    )
    try:
        result = await execute_tool(tool_name, args)
        await audit.log(
            user_id=ctx["user_id"],
            action="execute_tool",
            resource=tool_name,
            details=&#123;**args, "result": str(result)[:200]&#125;,
            success=True,
            tenant_id=ctx.get("tenant_id", ""),
        )
        return result
    except Exception as e:
        await audit.log(
            user_id=ctx["user_id"],
            action="execute_tool",
            resource=tool_name,
            details=&#123;"error": str(e)&#125;,
            success=False,
            tenant_id=ctx.get("tenant_id", ""),
        )
        raise
```

---

## 7. 认证方案对比

| 方案 | 适用场景 | 优势 | 劣势 |
|------|---------|------|------|
| JWT | 用户认证 | 无状态、跨服务 | Token 无法主动撤销 |
| API Key | Agent 间认证 | 简单 | 难以细粒度控制 |
| OAuth 2.0 | 第三方服务 | 标准化、可委托 | 实现复杂 |
| Session Cookie | Web 应用 | 可撤销 | 有状态、不跨域 |
| mTLS | 服务间认证 | 最高安全性 | 证书管理复杂 |

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解认证 vs 授权 vs 审计 | ☐ |
| 实现了 JWT 认证 | ☐ |
| 实现了 RBAC 角色权限 | ☐ |
| 实现了 ABAC 属性级授权 | ☐ |
| 在 LangGraph 中集成了认证节点 | ☐ |
| 实现了动态工具过滤 | ☐ |
| 配置了多租户隔离 | ☐ |
| 配置了审计日志 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 62 | 多租户 LLM 应用架构 | 多租户基础 |
| 102 | RAG 文档级权限控制 | 文档权限 |
| 144 | Agent 边界防护 | Agent 边界 |
| 155 | 文档级权限控制 | 权限控制 |
| 187 | RAG 文档级权限控制深度 | 权限深度 |
| 262 | 文档级权限图解 | 权限可视化 |
| 327 | 工具权限矩阵 | 工具权限 |
| 357 | Agent 工具权限矩阵 | 工具权限 |
| 375 | 多租户隔离与资源配额 | 多租户 |
| 395 | Agent 审计日志与合规追溯 | 审计日志 |
| 405 | 多租户隔离与资源配额 | 租户隔离 |
| 424 | 数据脱敏管道与隐私保护 | 数据安全 |
| 438 | NeMo Guardrails | 安全防护 |
