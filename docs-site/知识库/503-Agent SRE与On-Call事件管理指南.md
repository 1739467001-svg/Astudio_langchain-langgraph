# Agent SRE 与 On-Call 事件管理指南

> 凌晨 3 点 Agent 服务告警——谁处理？怎么处理？处理完怎么记录？SRE 和 On-Call 就是回答这些问题的体系。本指南系统讲解 SRE 实践（SLI/SLO/错误预算）、On-Call 值班制度、事件管理流程（IMAC）、Runbook 自动化。

---

## 1. SRE 基础

### SLI/SLO/SLA

```
SLI（Service Level Indicator）指标：
  具体测量值，如：请求成功率 99.2%

SLO（Service Level Objective）目标：
  内部目标，如：成功率 >= 99.5%

SLA（Service Level Agreement）协议：
  对外承诺，如：成功率 >= 99.0%（违约赔偿）

错误预算（Error Budget）：
  100% - SLO = 0.5% 错误预算
  允许 0.5% 的请求失败
  用完 → 冻结新功能发布，专注稳定性
```

### Agent SLI 定义

```python
@dataclass
class AgentSLI:
    """Agent 服务水平指标"""

    # 可用性
    availability: float = 0.0  # 成功请求数/总请求数

    # 延迟
    latency_p50_ms: float = 0  # 50% 请求的延迟
    latency_p95_ms: float = 0  # 95% 请求的延迟
    latency_p99_ms: float = 0  # 99% 请求的延迟

    # 质量
    answer_quality: float = 0  # 回答质量评分(0-1)
    hallucination_rate: float = 0  # 幻觉率

    # 成本
    cost_per_request: float = 0  # 单次请求成本

    def calculate_slo(self) -> dict:
        """计算 SLO 达成情况"""
        slos = &#123;
            "availability >= 99.5%": self.availability >= 0.995,
            "p95 latency < 15s": self.latency_p95_ms < 15000,
            "p99 latency < 30s": self.latency_p99_ms < 30000,
            "quality > 0.8": self.answer_quality > 0.8,
            "hallucination < 5%": self.hallucination_rate < 0.05,
            "cost < $0.02/req": self.cost_per_request < 0.02,
        &#125;

        passed = sum(slos.values())
        total = len(slos)

        return &#123;
            "slos": slos,
            "passed": passed,
            "total": total,
            "pass_rate": passed / total,
            "error_budget_remaining": 1.0 - self.availability if self.availability > 0.995 else 0,
        &#125;
```

---

## 2. On-Call 值班制度

### 值班轮转

```python
@dataclass
class OncallSchedule:
    """On-Call 排班"""

    # 排班规则
    rotation = &#123;
        "primary": &#123;"duration_days": 7, "backup": True&#125;,  # 主值班 7 天
        "secondary": &#123;"duration_days": 7, "backup": True&#125;,  # 备份值班 7 天
    &#125;

    # 值班人员
    team = [
        &#123;"name": "Alice", "phone": "138xxxx", "timezone": "Asia/Shanghai"&#125;,
        &#123;"name": "Bob", "phone": "139xxxx", "timezone": "Asia/Shanghai"&#125;,
        &#123;"name": "Charlie", "phone": "137xxxx", "timezone": "Asia/Shanghai"&#125;,
    ]

    async def get_current_oncall(self) -> dict:
        """获取当前值班人"""
        # 根据周数计算
        week_num = datetime.utcnow().isocalendar()[1]
        primary = self.team[week_num % len(self.team)]
        secondary = self.team[(week_num + 1) % len(self.team)]

        return &#123;
            "primary": primary,
            "secondary": secondary,
            "week": week_num,
        &#125;

    async def escalate(self, alert: dict) -> dict:
        """告警升级"""
        current = await self.get_current_oncall()

        # Level 1: 通知主值班
        await self._notify(current["primary"], alert)
        # 等待 5 分钟
        await asyncio.sleep(300)

        # Level 2: 未确认→通知备份
        if not await self._is_acknowledged(alert["id"]):
            await self._notify(current["secondary"], alert)
            await asyncio.sleep(300)

        # Level 3: 仍未确认→通知全员
        if not await self._is_acknowledged(alert["id"]):
            for member in self.team:
                await self._notify(member, alert)
            # 电话呼叫
            await self._call(current["primary"]["phone"])

        return &#123;"escalated": True, "level": 3&#125;

    async def _notify(self, person: dict, alert: dict):
        """通知值班人"""
        message = f"""🚨 告警: &#123;alert['title']&#125;
严重级别: &#123;alert['severity']&#125;
值班人: &#123;person['name']&#125;
详情: &#123;alert.get('description', '')&#125;

请尽快处理。"""
        # 发送 Slack/钉钉/短信
        print(f"通知 &#123;person['name']&#125;: &#123;message[:100]&#125;")

    async def _is_acknowledged(self, alert_id: str) -> bool:
        return False  # 实际中查询确认状态

    async def _call(self, phone: str):
        print(f"📞 电话呼叫: &#123;phone&#125;")
```

---

## 3. 事件管理流程

### 事件生命周期

```mermaid
graph LR
    DETECT["检测<br/>告警/用户报告"] --> ACK["确认<br/>On-Call响应"]
    ACK --> TRIAGE["分诊<br/>分级+分类"]
    TRIAGE --> INVEST["调查<br/>根因分析"]
    INVEST --> MITIGATE["缓解<br/>恢复服务"]
    MITIGATE --> RESOLVE["解决<br/>彻底修复"]
    RESOLVE --> REVIEW["复盘<br/>事后分析"]

    style DETECT fill:#FFCCBC,stroke:#D84315
    style MITIGATE fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style REVIEW fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 事件管理器

```python
@dataclass
class IncidentManager:
    """事件管理器"""

    async def create_incident(self, alert: dict) -> dict:
        """创建事件"""
        incident = &#123;
            "incident_id": f"INC-&#123;datetime.utcnow().strftime('%Y%m%d')&#125;-&#123;hash(alert) % 1000:03d&#125;",
            "title": alert["title"],
            "severity": self._classify(alert),  # P0/P1/P2/P3
            "status": "detected",
            "created_at": datetime.utcnow().isoformat(),
            "oncall": await OncallSchedule().get_current_oncall(),
            "timeline": [&#123;"time": datetime.utcnow().isoformat(), "event": "created", "detail": alert["title"]&#125;],
        &#125;

        # 通知 On-Call
        await self._notify_oncall(incident)

        return incident

    async def acknowledge(self, incident_id: str, responder: str) -> dict:
        """确认事件"""
        await self._add_timeline(incident_id, f"确认 by &#123;responder&#125;")
        await self._update_status(incident_id, "acknowledged")
        return &#123;"incident_id": incident_id, "status": "acknowledged", "responder": responder&#125;

    async def resolve(self, incident_id: str, resolution: str) -> dict:
        """解决事件"""
        await self._add_timeline(incident_id, f"解决: &#123;resolution&#125;")
        await self._update_status(incident_id, "resolved")

        # 创建复盘任务
        await self._schedule_postmortem(incident_id)

        return &#123;"incident_id": incident_id, "status": "resolved"&#125;

    async def postmortem(self, incident_id: str) -> str:
        """事后复盘报告"""
        incident = await self._get_incident(incident_id)

        report = f"""# 事件复盘报告

## 事件信息
- 事件ID: &#123;incident['incident_id']&#125;
- 标题: &#123;incident['title']&#125;
- 严重级别: &#123;incident['severity']&#125;
- 持续时间: &#123;incident.get('duration', '未知')&#125;

## 时间线
&#123;self._format_timeline(incident.get('timeline', []))&#125;

## 根因分析
（待填写）

## 影响
（待填写）

## 缓解措施
（待填写）

## 根本修复
（待填写）

## 改进措施
1. （待填写）
2. （待填写）

## 经验教训
（待填写）"""

        return report

    def _classify(self, alert: dict) -> str:
        """分级"""
        if alert.get("severity") == "critical":
            return "P0"
        elif "error_rate" in alert.get("title", "").lower():
            return "P1"
        return "P2"

    def _format_timeline(self, timeline: list) -> str:
        return "\n".join([f"- [&#123;t['time']&#125;] &#123;t['event']&#125;" for t in timeline])
```

---

## 4. Runbook 自动化

```python
@dataclass
class RunbookExecutor:
    """Runbook 自动化执行"""

    runbooks = &#123;
        "high_error_rate": &#123;
            "name": "错误率过高",
            "steps": [
                &#123;"action": "检查 API 状态", "command": "curl -s https://api.openai.com/v1/models | jq ."&#125;,
                &#123;"action": "切换备用模型", "command": "update_config model=gpt-4o-mini"&#125;,
                &#123;"action": "检查限流", "command": "check_rate_limit"&#125;,
                &#123;"action": "如果持续→降级模式", "command": "enable_degraded_mode"&#125;,
            ],
        &#125;,
        "high_latency": &#123;
            "name": "延迟过高",
            "steps": [
                &#123;"action": "检查 GPU 利用率", "command": "nvidia-smi"&#125;,
                &#123;"action": "检查并发数", "command": "check_concurrent_requests"&#125;,
                &#123;"action": "扩容", "command": "kubectl scale deployment agent --replicas=5"&#125;,
                &#123;"action": "启用缓存", "command": "enable_cache"&#125;,
            ],
        &#125;,
    &#125;

    async def execute(self, runbook_id: str) -> dict:
        """执行 Runbook"""
        runbook = self.runbooks.get(runbook_id)
        if not runbook:
            return &#123;"error": "Runbook 不存在"&#125;

        results = []
        for step in runbook["steps"]:
            print(f"📋 执行: &#123;step['action']&#125;")
            # 实际执行命令
            result = await self._run_command(step["command"])
            results.append(&#123;"step": step["action"], "result": result[:200]&#125;)

            # 检查是否已恢复
            if await self._is_recovered():
                print("✅ 服务已恢复")
                break

        return &#123;"runbook": runbook_id, "results": results&#125;

    async def _run_command(self, command: str) -> str:
        return f"执行: &#123;command&#125;"

    async def _is_recovered(self) -> bool:
        return False
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 定义了 SLI/SLO | ☐ |
| 实现了错误预算 | ☐ |
| 配置了 On-Call 排班 | ☐ |
| 实现了告警升级 | ☐ |
| 实现了事件管理流程 | ☐ |
| 有事件复盘模板 | ☐ |
| 实现了 Runbook 自动化 | ☐ |
| 有值班通知系统 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 89 | SLO 与告警 | SLO |
| 122 | SRE 运维与事故响应 | SRE |
| 146 | SLO 速查图解 | SLO |
| 154 | SRE 运维 | SRE |
| 178 | SLA 管理与错误预算 | SLA |
| 249 | SLO 告警 | 告警 |
| 321 | SLO 速查 | 速查 |
| 351 | LLM 应用 SLO | SLO |
| 460 | 事件响应与根因分析 | 事件响应 |
| 473 | Agent 可靠性与韧性 | 韧性 |
| 478 | AIOps 与智能运维 | AIOps |
| 502 | Agent 可观测性三支柱 | 可观测性 |
