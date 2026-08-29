# LLM 应用 SRE 运维与事故响应

> LLM 应用有独特的运维挑战：模型 API 可能突然限流、向量库可能沉默退化、Agent 可能进入死循环。传统 SRE 流程不够用。这份指南覆盖 LLM 应用的 SRE 实践：值班响应、事故分级、根因分析和事后复盘。

---

## 一、LLM SRE 的独特挑战

```mermaid
graph TB
    subgraph 传统SRE &#123;"传统SRE关注"&#125;
        T1["服务器CPU/内存"]
        T2["数据库性能"]
        T3["网络延迟"]
    end

    subgraph LLM SRE &#123;"LLM SRE额外关注"&#125;
        L1["模型API可用性<br/>OpenAI/Claude是否正常"]
        L2["Token消耗趋势<br/>是否突然飙升"]
        L3["幻觉率<br/>回答质量是否退化"]
        L4["Agent行为<br/>是否死循环/卡住"]
        L5["向量库健康<br/>检索质量是否下降"]
        L6["缓存命中率<br/>是否突然降低"]
    end

    style 传统SRE fill:#E3F2FD
    style LLM SRE fill:#FFCDD2
```

---

## 二、事故分级

```mermaid
graph TB
    subgraph 分级 &#123;"LLM应用事故四级"&#125;
        SEV1["SEV1: 系统宕机<br/>完全不可用<br/>5分钟内响应"]
        SEV2["SEV2: 严重退化<br/>核心功能受损<br/>30分钟内响应"]
        SEV3["SEV3: 局部问题<br/>非核心功能<br/>2小时内响应"]
        SEV4["SEV4: 小问题<br/>影响轻微<br/>下个工作日处理"]
    end

    style SEV1 fill:#FFCDD2,stroke:#C62828,stroke-width:3px
    style SEV2 fill:#FFE0B2
    style SEV3 fill:#FFF9C4
    style SEV4 fill:#C8E6C9
```

```python
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

class Severity(str, Enum):
    SEV1 = "sev1"
    SEV2 = "sev2"
    SEV3 = "sev3"
    SEV4 = "sev4"

@dataclass
class Incident:
    """事故记录。"""
    id: str
    severity: Severity
    title: str
    description: str
    status: str = "detected"  # detected→investigating→mitigating→resolved
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved_at: str | None = None
    root_cause: str = ""
    action_items: list[str] = field(default_factory=list)
    timeline: list[dict] = field(default_factory=list)

    def add_event(self, event: str, author: str = "system"):
        self.timeline.append(&#123;
            "timestamp": datetime.now().isoformat(),
            "event": event,
            "author": author,
        &#125;)

class IncidentClassifier:
    """事故分类器：自动判断严重程度。"""

    SEV1_CONDITIONS = [
        "模型API完全不可用",
        "错误率>50%",
        "核心功能完全失败",
        "数据丢失",
    ]

    SEV2_CONDITIONS = [
        "错误率10-50%",
        "P95延迟>10秒",
        "缓存命中率<10%",
        "Agent死循环率高",
        "部分用户无法使用",
    ]

    SEV3_CONDITIONS = [
        "错误率5-10%",
        "P95延迟>5秒",
        "个别工具调用失败",
        "非核心功能异常",
    ]

    @classmethod
    def classify(cls, metrics: dict) -> Severity:
        """根据监控指标自动分类。"""
        error_rate = metrics.get("error_rate", 0)
        p95_latency = metrics.get("p95_latency", 0)
        cache_hit = metrics.get("cache_hit_rate", 100)
        api_available = metrics.get("api_available", True)

        if not api_available or error_rate > 50:
            return Severity.SEV1
        if error_rate > 10 or p95_latency > 10000 or cache_hit < 10:
            return Severity.SEV2
        if error_rate > 5 or p95_latency > 5000:
            return Severity.SEV3
        return Severity.SEV4
```

---

## 三、事故响应流程

```mermaid
graph TB
    subgraph 响应 &#123;"事故响应5步"&#125;
        S1["1.检测<br/>告警/用户报告"] --> S2["2.分类<br/>确定SEV级别"]
        S2 --> S3["3.响应<br/>通知值班人"]
        S3 --> S4["4.缓解<br/>止血优先"]
        S4 --> S5["5.复盘<br/>根因+改进"]
    end

    style S1 fill:#FFCDD2
    style S4 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style S5 fill:#C8E6C9
```

```python
class IncidentResponder:
    """事故响应器。"""

    @staticmethod
    def get_mitigation_actions(severity: Severity, issue_type: str) -> list[str]:
        """根据事故类型获取缓解措施。"""
        actions = &#123;
            "api_down": [
                "切换到备用模型提供者",
                "启用降级模式（无RAG的简单回答）",
                "通知用户'服务暂时降级'",
            ],
            "high_error_rate": [
                "检查最近的部署变更",
                "检查模型API状态",
                "临时增加重试次数",
                "降低QPS限流",
            ],
            "high_latency": [
                "检查向量库查询延迟",
                "检查缓存命中率",
                "临时关闭重排序",
                "增加缓存TTL",
            ],
            "agent_loop": [
                "检查Agent max_iterations设置",
                "检查工具是否有超时",
                "临时降低Agent复杂度",
            ],
            "vector_db_slow": [
                "检查向量库内存使用",
                "重建HNSW索引",
                "检查是否有大批量写入",
            ],
        &#125;
        return actions.get(issue_type, ["具体分析问题原因"])
```

---

## 四、值班系统

```python
class OnCallRotation:
    """值班轮换系统。"""

    def __init__(self):
        self.schedule: list[dict] = []
        self.current_oncall: str | None = None

    def set_rotation(self, people: list[str], rotation_days: int = 7):
        """设置轮换。"""
        from datetime import datetime, timedelta
        start = datetime.now()
        for i in range(len(people)):
            self.schedule.append(&#123;
                "person": people[i],
                "start": (start + timedelta(days=i * rotation_days)).isoformat(),
                "end": (start + timedelta(days=(i + 1) * rotation_days)).isoformat(),
            &#125;)

    def get_current_oncall(self) -> str:
        """获取当前值班人。"""
        now = datetime.now().isoformat()
        for slot in self.schedule:
            if slot["start"] <= now < slot["end"]:
                return slot["person"]
        return self.schedule[0]["person"] if self.schedule else "unknown"

    def escalate(self, incident: Incident) -> list[str]:
        """事故升级通知链。"""
        chain = []
        if incident.severity == Severity.SEV1:
            chain = [
                "立即电话通知值班人",
                "5分钟未响应→通知团队负责人",
                "15分钟未响应→通知CTO",
            ]
        elif incident.severity == Severity.SEV2:
            chain = [
                "Slack/钉钉通知值班人",
                "30分钟未响应→电话通知",
            ]
        return chain
```

---

## 五、根因分析

```python
class RootCauseAnalyzer:
    """根因分析器。"""

    @staticmethod
    async def analyze(llm, incident: Incident, metrics: dict) -> str:
        """用LLM辅助根因分析。"""
        from langchain_core.messages import HumanMessage

        prompt = f"""你是LLM应用SRE专家。请分析以下事故的根因。

事故信息:
- 标题: &#123;incident.title&#125;
- 严重度: &#123;incident.severity.value&#125;
- 描述: &#123;incident.description&#125;
- 时间线: &#123;incident.timeline&#125;

当时监控指标:
&#123;metrics&#125;

请分析：
1. 直接原因（什么直接导致了事故）
2. 根本原因（为什么会出现这个问题）
3. 检测延迟（从发生到检测用了多久）
4. 缓解措施（做了什么止血）
5. 预防措施（如何防止再次发生）

输出格式:
```json
&#123;&#123;
  "direct_cause": "...",
  "root_cause": "...",
  "detection_delay": "...",
  "mitigation": "...",
  "prevention": ["措施1", "措施2"]
&#125;&#125;
```"""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        return response.content
```

---

## 六、事后复盘

```mermaid
graph TB
    subgraph 复盘 &#123;"事后复盘5要素"&#125;
        R1["时间线<br/>从检测到恢复<br/>每个节点记录"]
        R2["根因<br/>5Why分析<br/>不只看直接原因"]
        R3["影响<br/>用户数/持续时间<br/>业务损失"]
        R4["改进项<br/>可执行的Action Items<br/>指定负责人和截止日期"]
        R5["经验<br/>文档化<br/>加入运维手册"]
    end

    style 复盘 fill:#E3F2FD
```

```python
class PostmortemGenerator:
    """事后复盘报告生成器。"""

    @staticmethod
    def generate(incident: Incident, rca: dict) -> str:
        """生成复盘报告。"""
        duration = ""
        if incident.resolved_at and incident.created_at:
            from datetime import datetime
            start = datetime.fromisoformat(incident.created_at)
            end = datetime.fromisoformat(incident.resolved_at)
            duration = f"&#123;(end - start).total_seconds() / 60:.1f&#125;分钟"

        report = f"""# 事故复盘报告

## 事故概要
- ID: &#123;incident.id&#125;
- 标题: &#123;incident.title&#125;
- 严重度: &#123;incident.severity.value.upper()&#125;
- 状态: &#123;incident.status&#125;
- 持续时间: &#123;duration&#125;
- 创建: &#123;incident.created_at&#125;
- 恢复: &#123;incident.resolved_at or '未恢复'&#125;

## 根因分析
- 直接原因: &#123;rca.get('direct_cause', '待分析')&#125;
- 根本原因: &#123;rca.get('root_cause', '待分析')&#125;
- 检测延迟: &#123;rca.get('detection_delay', '待分析')&#125;

## 时间线
"""
        for event in incident.timeline:
            report += f"- [&#123;event['timestamp']&#125;] &#123;event['event']&#125; (&#123;event['author']&#125;)\n"

        report += f"""
## 缓解措施
&#123;rca.get('mitigation', '待记录')&#125;

## 改进项
"""
        for i, action in enumerate(rca.get("prevention", [])):
            report += f"&#123;i+1&#125;. &#123;action&#125;\n"

        report += "\n## 经验教训\n"
        report += "(待填写)\n"

        return report
```

---

## 七、运维手册

```python
class RunbookRegistry:
    """运维手册注册表：常见问题的标准操作流程。"""

    RUNBOOKS = &#123;
        "model_api_down": &#123;
            "name": "模型API不可用",
            "steps": [
                "1. 确认API状态页（status.openai.com）",
                "2. 切换到备用模型（配置LLM网关降级链）",
                "3. 启用降级模式（简单回答，无RAG）",
                "4. 通知用户服务降级",
                "5. 持续监控API恢复",
                "6. 恢复后切回主模型",
            ],
        &#125;,
        "vector_db_down": &#123;
            "name": "向量库不可用",
            "steps": [
                "1. 检查向量库进程状态",
                "2. 检查磁盘空间和内存",
                "3. 如需重启，先保存检查点",
                "4. 重启向量库",
                "5. 验证索引完整性",
                "6. 如索引损坏，从备份恢复",
            ],
        &#125;,
        "cost_spike": &#123;
            "name": "Token成本突增",
            "steps": [
                "1. 检查是否有异常高QPS",
                "2. 检查是否有死循环Agent",
                "3. 检查缓存是否失效",
                "4. 临时降低QPS限制",
                "5. 检查模型路由是否正常",
            ],
        &#125;,
    &#125;

    @classmethod
    def get_runbook(cls, issue_type: str) -> dict | None:
        return cls.RUNBOOKS.get(issue_type)
```

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| SEV1必须5分钟响应 | 系统宕机必须立即处理 | ★★★ |
| 缓解优先于根因 | 先止血再分析 | ★★★ |
| 每次事故必复盘 | 不复盘就是白浪费 | ★★★ |
| 运维手册标准化 | 常见问题有标准流程 | ★★★ |
| 值班轮换7天一轮 | 避免疲劳 | ★★☆ |
| 监控告警自动分级 | 减少人工判断 | ★★☆ |
| LLM辅助根因分析 | 加速复盘 | ★☆☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 有事故分级标准 | ☐ |
| 有值班轮换制度 | ☐ |
| 有事故响应流程 | ☐ |
| 有根因分析方法 | ☐ |
| 有事后复盘模板 | ☐ |
| 有运维手册 | ☐ |
| 有告警自动分级 | ☐ |
