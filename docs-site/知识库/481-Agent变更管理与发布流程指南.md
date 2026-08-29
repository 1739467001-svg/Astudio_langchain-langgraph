# Agent 变更管理与发布流程指南

> Agent 系统不是一成不变的——Prompt 在改、模型在换、工具在更新、配置在调。每次变更都可能引入问题。变更管理就是确保每次变更可控、可追踪、可回滚。本指南系统讲解变更分类、发布流程、灰度策略、回滚机制，以及变更审批与审计。

---

## 1. 变更分类

### 变更类型与风险

| 类型 | 风险 | 示例 | 需要审批 |
|------|------|------|---------|
| Prompt 变更 | 中 | 改系统提示词 | 是 |
| 模型切换 | 高 | GPT-4o → Claude | 是 |
| 工具更新 | 中 | 修改工具参数 Schema | 是 |
| 配置变更 | 低 | 调整超时时间 | 否 |
| 代码变更 | 高 | 修改 Agent 逻辑 | 是 |
| 数据更新 | 低 | 更新知识库 | 否 |
| 依赖升级 | 中 | 升级 LangChain 版本 | 是 |
| 基础设施 | 高 | 切换 GPU 型号 | 是 |

### 变更管理流程

```mermaid
graph LR
    PROPOSE["提出变更"] --> REVIEW["评审"]
    REVIEW --> APPROVE&#123;"审批"&#125;
    APPROVE -->|"通过"| TEST["测试"]
    APPROVE -->|"拒绝"| REJECT["拒绝"]
    TEST --> STAGE["灰度发布"]
    STAGE --> MONITOR&#123;"监控"&#125;
    MONITOR -->|"正常"| FULL["全量发布"]
    MONITOR -->|"异常"| ROLLBACK["回滚"]
    FULL --> DOC["文档归档"]

    style APPROVE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style FULL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style ROLLBACK fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

---

## 2. 变更注册中心

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

class ChangeStatus(Enum):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"
    ROLLED_BACK = "rolled_back"
    REJECTED = "rejected"

class ChangeType(Enum):
    PROMPT = "prompt"
    MODEL = "model"
    TOOL = "tool"
    CONFIG = "config"
    CODE = "code"
    DATA = "data"
    DEPENDENCY = "dependency"
    INFRA = "infrastructure"

@dataclass
class ChangeRequest:
    """变更请求"""
    change_id: str
    title: str
    type: ChangeType
    description: str
    risk_level: str          # low / medium / high / critical
    proposed_by: str
    approved_by: str = ""
    status: ChangeStatus = ChangeStatus.DRAFT

    # 变更内容
    before_state: dict = field(default_factory=dict)
    after_state: dict = field(default_factory=dict)
    diff: str = ""

    # 发布计划
    rollout_strategy: str = "canary"  # canary / blue_green / rolling
    rollback_plan: str = ""

    # 时间
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    approved_at: str = ""
    deployed_at: str = ""

    # 监控
    success_metrics: dict = field(default_factory=dict)
    monitoring_period_hours: int = 24

@dataclass
class ChangeRegistry:
    """变更注册中心"""

    changes: dict = field(default_factory=dict)

    async def create_change(self, title: str, change_type: ChangeType,
                            description: str, risk: str, proposed_by: str,
                            before: dict, after: dict) -> ChangeRequest:
        """创建变更请求"""
        change_id = f"CHG-&#123;len(self.changes) + 1:04d&#125;"

        change = ChangeRequest(
            change_id=change_id,
            title=title,
            type=change_type,
            description=description,
            risk_level=risk,
            proposed_by=proposed_by,
            before_state=before,
            after_state=after,
            diff=self._generate_diff(before, after),
            rollback_plan=self._generate_rollback_plan(change_type, before),
        )

        self.changes[change_id] = change
        return change

    async def approve(self, change_id: str, approver: str) -> ChangeRequest:
        """审批变更"""
        change = self.changes.get(change_id)
        if not change:
            raise ValueError("变更不存在")

        change.approved_by = approver
        change.approved_at = datetime.utcnow().isoformat()
        change.status = ChangeStatus.APPROVED
        return change

    async def deploy(self, change_id: str) -> dict:
        """部署变更"""
        change = self.changes.get(change_id)
        if not change or change.status != ChangeStatus.APPROVED:
            raise ValueError("变更未审批")

        change.status = ChangeStatus.STAGING
        change.deployed_at = datetime.utcnow().isoformat()

        # 执行发布策略
        if change.rollout_strategy == "canary":
            result = await self._canary_deploy(change)
        elif change.rollout_strategy == "blue_green":
            result = await self._blue_green_deploy(change)
        else:
            result = await self._rolling_deploy(change)

        return result

    async def rollback(self, change_id: str) -> dict:
        """回滚变更"""
        change = self.changes.get(change_id)
        if not change:
            raise ValueError("变更不存在")

        # 恢复到 before_state
        await self._apply_state(change.before_state)
        change.status = ChangeStatus.ROLLED_BACK

        return &#123;"change_id": change_id, "status": "rolled_back", "restored_to": change.before_state&#125;

    def _generate_diff(self, before: dict, after: dict) -> str:
        """生成差异"""
        diff_lines = []
        all_keys = set(before.keys()) | set(after.keys())
        for key in sorted(all_keys):
            old_val = before.get(key, "[不存在]")
            new_val = after.get(key, "[不存在]")
            if old_val != new_val:
                diff_lines.append(f"- &#123;key&#125;: &#123;old_val&#125;")
                diff_lines.append(f"+ &#123;key&#125;: &#123;new_val&#125;")
        return "\n".join(diff_lines)

    def _generate_rollback_plan(self, change_type: ChangeType, before: dict) -> str:
        """生成回滚计划"""
        plans = &#123;
            ChangeType.PROMPT: f"恢复 Prompt 到旧版本: &#123;before.get('prompt', '')[:100]&#125;",
            ChangeType.MODEL: f"切换回旧模型: &#123;before.get('model', '')&#125;",
            ChangeType.TOOL: f"恢复工具配置: &#123;before&#125;",
            ChangeType.CONFIG: f"恢复配置: &#123;before&#125;",
        &#125;
        return plans.get(change_type, f"恢复到之前状态: &#123;before&#125;")

    async def _canary_deploy(self, change: ChangeRequest) -> dict:
        """金丝雀发布"""
        return &#123;"strategy": "canary", "traffic": "5%", "change_id": change.change_id&#125;

    async def _blue_green_deploy(self, change: ChangeRequest) -> dict:
        """蓝绿发布"""
        return &#123;"strategy": "blue_green", "change_id": change.change_id&#125;

    async def _rolling_deploy(self, change: ChangeRequest) -> dict:
        """滚动发布"""
        return &#123;"strategy": "rolling", "change_id": change.change_id&#125;

    async def _apply_state(self, state: dict):
        """应用状态"""
        pass
```

---

## 3. 灰度发布策略

```python
@dataclass
class RolloutManager:
    """灰度发布管理器"""

    stages = [
        &#123;"name": "内部测试", "traffic": 0.0&#125;,
        &#123;"name": "1%灰度", "traffic": 0.01&#125;,
        &#123;"name": "5%灰度", "traffic": 0.05&#125;,
        &#123;"name": "25%灰度", "traffic": 0.25&#125;,
        &#123;"name": "50%灰度", "traffic": 0.50&#125;,
        &#123;"name": "全量", "traffic": 1.00&#125;,
    ]

    def __init__(self):
        self.current_stage = 0
        self.metrics = &#123;"error_rate": 0, "latency_p95": 0, "quality_score": 0&#125;
        self.thresholds = &#123;"error_rate": 0.05, "latency_p95": 30000, "quality_score": 0.8&#125;

    async def can_advance(self) -> tuple[bool, str]:
        """检查是否可以推进"""
        if self.current_stage >= len(self.stages) - 1:
            return False, "已全量"

        if self.metrics["error_rate"] > self.thresholds["error_rate"]:
            return False, f"错误率 &#123;self.metrics['error_rate']:.1%&#125; 过高"

        if self.metrics["latency_p95"] > self.thresholds["latency_p95"]:
            return False, f"P95 延迟 &#123;self.metrics['latency_p95']&#125;ms 过高"

        if self.metrics["quality_score"] < self.thresholds["quality_score"]:
            return False, f"质量分 &#123;self.metrics['quality_score']:.2f&#125; 过低"

        next_stage = self.stages[self.current_stage + 1]
        return True, f"可推进到 &#123;next_stage['name']&#125;"

    async def advance(self) -> dict:
        """推进到下一阶段"""
        can, reason = await self.can_advance()
        if not can:
            return &#123;"success": False, "reason": reason&#125;

        self.current_stage += 1
        stage = self.stages[self.current_stage]
        return &#123;"success": True, "stage": stage["name"], "traffic": stage["traffic"]&#125;

    async def auto_rollback(self) -> dict:
        """自动回滚"""
        self.current_stage = 0
        return &#123;"action": "rollback", "reason": "自动回滚", "restored_to": self.stages[0]["name"]&#125;

    def should_use_new_version(self, user_id: str) -> bool:
        """判断用户是否使用新版本"""
        traffic = self.stages[self.current_stage]["traffic"]
        if traffic >= 1.0:
            return True
        if traffic <= 0:
            return False
        import hashlib
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 10000
        return hash_val < traffic * 10000
```

---

## 4. 变更审计

```python
@dataclass
class ChangeAuditor:
    """变更审计"""

    async def log_change(self, change: ChangeRequest):
        """记录变更日志"""
        audit = &#123;
            "change_id": change.change_id,
            "type": change.type.value,
            "title": change.title,
            "risk": change.risk_level,
            "proposed_by": change.proposed_by,
            "approved_by": change.approved_by,
            "status": change.status.value,
            "created_at": change.created_at,
            "deployed_at": change.deployed_at,
            "rollback_plan": change.rollback_plan,
        &#125;
        await db.change_audit.insert(audit)

    async def get_change_history(self, limit: int = 50) -> list:
        """获取变更历史"""
        return await db.change_audit.find().sort("created_at", -1).limit(limit).to_list(limit)

    async def get_failed_changes(self) -> list:
        """获取失败的变更"""
        return await db.change_audit.find(&#123;
            "status": &#123;"$in": ["rolled_back", "rejected"]&#125;
        &#125;).sort("created_at", -1).to_list(50)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解变更分类与风险 | ☐ |
| 实现了变更注册中心 | ☐ |
| 实现了变更审批流程 | ☐ |
| 实现了灰度发布管理 | ☐ |
| 实现了自动回滚 | ☐ |
| 实现了变更审计 | ☐ |
| 有回滚计划 | ☐ |
| 配置了变更历史查询 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 22 | CI-CD 流水线 | CI/CD |
| 51 | 灰度发布 | 灰度 |
| 76 | 蓝绿部署 | 蓝绿 |
| 141 | 版本管理与灰度发布 | 版本 |
| 173 | 版本管理与灰度发布 | 灰度 |
| 175 | 灰度发布 | 灰度 |
| 207 | 灰度发布深度 | 深度 |
| 318 | 灰度发布图解 | 灰度 |
| 371 | 金丝雀发布 | 金丝雀 |
| 374 | 版本兼容 | 兼容 |
| 385 | 模型 AB 测试 | AB 测试 |
| 419 | 提示词版本管理 | 版本 |
| 457 | LLMOps | 生命周期 |
| 480 | 日志管理与审计 | 审计 |
