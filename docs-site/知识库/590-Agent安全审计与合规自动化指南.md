# Agent 安全审计与合规自动化指南

> Agent 上线后需要持续审计——谁调了什么、做了什么、合规吗？本指南深度讲解自动化审计、合规检查、链式哈希防篡改、合规报告生成。

---

## 1. 自动化审计架构

```mermaid
graph TB
    AGENT["Agent 操作"] --> LOG["自动日志<br/>每次操作记录"]
    LOG --> HASH["链式哈希<br/>防篡改"]
    HASH --> CHECK["合规检查<br/>自动规则"]
    CHECK --> REPORT["合规报告<br/>定期生成"]
    REPORT --> ALERT["异常告警<br/>违规即告警"]

    style LOG fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style HASH fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CHECK fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 链式哈希审计

```python
import hashlib

@dataclass
class AuditChain:
    """链式哈希审计日志"""

    async def log(self, event: dict) -> dict:
        """记录审计事件（链式哈希防篡改）"""
        prev_hash = await self._get_last_hash()

        event_data = json.dumps(&#123;
            "timestamp": datetime.utcnow().isoformat(),
            "agent_id": event.get("agent_id", ""),
            "action": event.get("action", ""),
            "resource": event.get("resource", ""),
            "user_id": event.get("user_id", ""),
            "result": event.get("result", ""),
            "ip": event.get("ip", ""),
        &#125;, sort_keys=True)

        current_hash = hashlib.sha256(
            (prev_hash + event_data).encode()
        ).hexdigest()

        entry = &#123;
            **json.loads(event_data),
            "prev_hash": prev_hash,
            "current_hash": current_hash,
        &#125;

        await db.audit_chain.insert(entry)
        return entry

    async def verify_chain(self) -> dict:
        """验证审计链完整性"""
        entries = await db.audit_chain.find().sort("timestamp", 1).to_list(None)

        for i in range(1, len(entries)):
            event_data = json.dumps(&#123;
                k: entries[i][k] for k in ["timestamp", "agent_id", "action", "resource", "user_id", "result", "ip"]
            &#125;, sort_keys=True)

            expected = hashlib.sha256(
                (entries[i-1]["current_hash"] + event_data).encode()
            ).hexdigest()

            if expected != entries[i]["current_hash"]:
                return &#123;"valid": False, "broken_at": entries[i]["timestamp"]&#125;

        return &#123;"valid": True, "entries": len(entries)&#125;
```

---

## 3. 合规自动化

```python
@dataclass
class ComplianceAutomation:
    """合规自动化检查"""

    async def auto_check(self, action: dict) -> dict:
        """自动合规检查"""
        rules = &#123;
            "data_access": "是否访问了授权范围外的数据",
            "tool_usage": "是否使用了未授权工具",
            "cost_limit": "是否超出预算",
            "rate_limit": "是否超频率限制",
            "pii_handling": "是否正确处理 PII",
        &#125;

        violations = []

        # 数据访问检查
        if action.get("resource") and not await self._check_access(action["user_id"], action["resource"]):
            violations.append(&#123;"rule": "data_access", "severity": "high", "detail": "越权访问"&#125;)

        # PII 检查
        if action.get("result"):
            import re
            if re.search(r'\d&#123;11&#125;', str(action["result"])):
                violations.append(&#123;"rule": "pii_handling", "severity": "high", "detail": "结果含手机号"&#125;)

        return &#123;
            "compliant": len(violations) == 0,
            "violations": violations,
            "action": "告警" if violations else "通过",
        &#125;

    async def generate_report(self, period_days: int = 30) -> dict:
        """生成合规报告"""
        return &#123;
            "period": f"最近&#123;period_days&#125;天",
            "total_operations": 15000,
            "compliant": 14850,
            "violations": 150,
            "compliance_rate": "99.0%",
            "top_violations": [
                &#123;"type": "rate_limit", "count": 80&#125;,
                &#123;"type": "data_access", "count": 50&#125;,
                &#123;"type": "pii_handling", "count": 20&#125;,
            ],
            "recommendations": ["加强频率限制", "优化权限配置"],
        &#125;
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了链式哈希审计 | ☐ |
| 实现了链验证 | ☐ |
| 实现了合规自动检查 | ☐ |
| 实现了合规报告生成 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 480 | 日志管理与审计 | 日志 |
| 395 | 审计日志与合规追溯 | 审计 |
| 477 | 数据安全与加密 | 安全 |
| 501 | 数据保护与隐私 | 隐私 |
| 576 | 伦理治理与负责任AI | 伦理 |
