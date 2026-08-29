# Agent 委托代理与权限委派指南

> Agent A 代表用户执行操作——能否把这个权限委托给 Agent B？委托代理链涉及权限传递、范围限制、责任追溯。本指南讲解委托模型、权限传递、最小权限原则、审计链。

---

## 1. 委托模型

```mermaid
graph LR
    USER["用户"] -->|"授权"| AGENT_A["Agent A<br/>主代理"]
    AGENT_A -->|"委托子任务"| AGENT_B["Agent B<br/>子代理"]
    AGENT_B -->|"执行"| ACTION["操作"]
    ACTION --> AUDIT["审计链<br/>用户→A→B→操作"]

    style AGENT_A fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style AGENT_B fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style AUDIT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 权限委派实现

```python
@dataclass
class DelegationManager:
    """权限委派管理器"""

    async def delegate(self, from_agent: str, to_agent: str,
                       permissions: list, scope: dict,
                       duration_hours: int = 24) -> dict:
        """委派权限"""
        # 最小权限原则：只能委派自己拥有的权限
        own_perms = await self._get_permissions(from_agent)
        delegatable = [p for p in permissions if p in own_perms]

        if not delegatable:
            return {"success": False, "reason": "无权委派请求的权限"}

        delegation = {
            "delegation_id": str(uuid.uuid4()),
            "from": from_agent,
            "to": to_agent,
            "permissions": delegatable,
            "scope": scope,  # {"resource": "...", "max_amount": 1000}
            "expires_at": (datetime.utcnow() + timedelta(hours=duration_hours)).isoformat(),
            "created_at": datetime.utcnow().isoformat(),
            "revocable": True,
            "audit_chain": [f"{from_agent} → {to_agent}: {delegatable}"],
        }

        await self._store_delegation(delegation)
        return {"success": True, "delegation": delegation}

    async def check_permission(self, agent_id: str, permission: str,
                               resource: str = "") -> dict:
        """检查权限（含委派链）"""
        # 直接权限
        direct = await self._get_permissions(agent_id)
        if permission in direct:
            return {"allowed": True, "source": "direct", "chain": [agent_id]}

        # 委派权限
        delegations = await self._get_active_delegations(agent_id)
        for d in delegations:
            if permission in d["permissions"]:
                if not d.get("expires_at") or datetime.fromisoformat(d["expires_at"]) > datetime.utcnow():
                    chain = d["audit_chain"] + [agent_id]
                    return {"allowed": True, "source": "delegated", "chain": chain}

        return {"allowed": False, "reason": "无权限"}

    async def revoke(self, delegation_id: str) -> dict:
        """撤销委派"""
        await self._revoke_delegation(delegation_id)
        return {"revoked": True, "delegation_id": delegation_id}
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解委托链模型 | ☐ |
| 实现了权限委派 | ☐ |
| 实现了权限检查（含委派链） | ☐ |
| 实现了撤销 | ☐ |
| 有审计链 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 442 | Agent 身份认证与授权 | 认证 |
| 458 | 人机协作 HITL | 委托 |
| 577 | Agent 信任与声誉 | 信任 |
| 574 | 博弈论与机制设计 | 机制 |
