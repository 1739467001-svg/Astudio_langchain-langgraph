# Agent 日志管理与审计追溯指南

> Agent 出问题时第一个问的是"日志在哪？"——但日志可能分散在多台机器、包含敏感信息、格式不统一、量太大无法搜索。本指南系统讲解结构化日志、日志脱敏、分布式日志聚合、审计链式哈希，以及日志智能分析。

---

## 1. 结构化日志

### 日志规范

```python
import structlog
from dataclasses import dataclass
from datetime import datetime

@dataclass
class AgentLogSchema:
    """Agent 日志 Schema"""

    # 必填字段
    timestamp: str          # ISO8601 时间戳
    level: str              # DEBUG/INFO/WARN/ERROR
    service: str            # 服务名
    component: str          # 组件（llm/tool/retriever/graph）
    message: str            # 消息

    # Agent 专有字段
    request_id: str = ""    # 请求 ID（跨服务追踪）
    session_id: str = ""    # 会话 ID
    user_id: str = ""       # 用户 ID（脱敏）
    agent_step: int = 0     # Agent 步骤号
    model_used: str = ""    # 使用的模型
    tokens_consumed: int = 0 # Token 消耗
    latency_ms: float = 0   # 延迟
    cost: float = 0         # 成本

    # 错误字段
    error_type: str = ""
    error_message: str = ""
    stack_trace: str = ""

    # 自定义
    metadata: dict = None

# 配置 structlog
def setup_logging():
    """设置结构化日志"""
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

# 使用
log = structlog.get_logger()

async def logged_node(state):
    """带结构化日志的节点"""
    log.info("node.start",
        component="llm",
        request_id=state.get("request_id"),
        session_id=state.get("session_id"),
        step=state.get("step", 0),
        model="gpt-4o-mini",
    )

    start = time.time()
    try:
        response = await llm.ainvoke(state["messages"])

        log.info("node.complete",
            component="llm",
            request_id=state.get("request_id"),
            tokens=response.usage_metadata.get("total_tokens", 0),
            latency_ms=(time.time() - start) * 1000,
            cost=calculate_cost(response),
        )
        return {"messages": [response]}

    except Exception as e:
        log.error("node.error",
            component="llm",
            request_id=state.get("request_id"),
            error_type=type(e).__name__,
            error_message=str(e),
            latency_ms=(time.time() - start) * 1000,
        )
        raise
```

---

## 2. 日志脱敏

```python
import re

@dataclass
class LogMasker:
    """日志脱敏器"""

    patterns = {
        "api_key": (r'sk-[a-zA-Z0-9]{20,}', 'sk-***'),
        "phone": (r'1[3-9]\d{9}', '1**-****-***'),
        "email": (r'[\w.-]+@[\w.-]+', '***@***.***'),
        "id_card": (r'\d{17}[\dXx]', '******************'),
        "bank_card": (r'\d{16,19}', '****-****-****-****'),
        "password": (r'password["\']?\s*[:=]\s*["\']?[^\s"\']+', 'password=***'),
        "token": (r'Bearer\s+[a-zA-Z0-9._-]+', 'Bearer ***'),
    }

    def mask(self, log_entry: dict) -> dict:
        """脱敏日志条目"""
        masked = log_entry.copy()

        for key, value in masked.items():
            if isinstance(value, str):
                masked[key] = self._mask_string(value)
            elif isinstance(value, dict):
                masked[key] = self.mask(value)

        return masked

    def _mask_string(self, text: str) -> str:
        for name, (pattern, replacement) in self.patterns.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        return text

    def mask_before_send(self, log_line: str) -> str:
        """发送前脱敏"""
        return self._mask_string(log_line)
```

---

## 3. 分布式日志聚合

### 日志收集架构

```mermaid
graph TB
    AGENT1["Agent 实例1"] --> LOG1["结构化日志"]
    AGENT2["Agent 实例2"] --> LOG2["结构化日志"]
    AGENT3["Agent 实例3"] --> LOG3["结构化日志"]

    LOG1 --> COLLECT["日志收集器<br/>Fluentd/Vector"]
    LOG2 --> COLLECT
    LOG3 --> COLLECT

    COLLECT --> BUFFER["消息队列<br/>Kafka/Redis"]
    BUFFER --> STORE["日志存储<br/>Elasticsearch/Loki"]
    STORE --> QUERY["查询分析<br/>Kibana/Grafana"]

    style COLLECT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style STORE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style QUERY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### request_id 透传

```python
@dataclass
class RequestIDPropagator:
    """request_id 透传（跨服务追踪）"""

    async def inject_context(self, state: dict):
        """注入 request_id 到上下文"""
        import contextvars
        request_id_var = contextvars.ContextVar("request_id", default="")

        request_id = state.get("request_id") or str(uuid.uuid4())
        request_id_var.set(request_id)
        state["request_id"] = request_id

    async def propagate_to_downstream(self, url: str, data: dict, request_id: str):
        """透传到下游服务"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=data,
                headers={
                    "X-Request-ID": request_id,
                    "X-Trace-ID": str(uuid.uuid4()),
                },
            )
        return response

    async def extract_from_headers(self, headers: dict) -> str:
        """从请求头提取"""
        return headers.get("x-request-id", str(uuid.uuid4()))
```

---

## 4. 审计链式哈希

```python
import hashlib

@dataclass
class AuditChain:
    """审计日志链式哈希（防篡改）"""

    async def append(self, event: dict):
        """追加审计事件"""
        # 获取上一条记录的哈希
        last = await db.audit_chain.find().sort("timestamp", -1).limit(1).to_list(1)
        prev_hash = last[0]["current_hash"] if last else "genesis"

        # 构建当前事件内容
        event_data = json.dumps({
            "timestamp": event["timestamp"],
            "user_id": event["user_id"],
            "action": event["action"],
            "resource": event["resource"],
            "result": event["result"],
        }, sort_keys=True)

        # 计算哈希
        current_hash = hashlib.sha256(
            (prev_hash + event_data).encode()
        ).hexdigest()

        # 存储
        audit_entry = {
            **event,
            "prev_hash": prev_hash,
            "current_hash": current_hash,
        }
        await db.audit_chain.insert(audit_entry)

    async def verify_chain(self) -> dict:
        """验证链完整性"""
        entries = await db.audit_chain.find().sort("timestamp", 1).to_list(None)

        for i in range(1, len(entries)):
            event_data = json.dumps({
                "timestamp": entries[i]["timestamp"],
                "user_id": entries[i]["user_id"],
                "action": entries[i]["action"],
                "resource": entries[i]["resource"],
                "result": entries[i]["result"],
            }, sort_keys=True)

            expected = hashlib.sha256(
                (entries[i-1]["current_hash"] + event_data).encode()
            ).hexdigest()

            if expected != entries[i]["current_hash"]:
                return {
                    "valid": False,
                    "broken_at": entries[i]["timestamp"],
                    "broken_entry": entries[i],
                }

        return {"valid": True, "total_entries": len(entries)}

    async def query_audit_trail(self, user_id: str = None,
                                action: str = None, start_time: str = None) -> list:
        """查询审计追溯"""
        query = {}
        if user_id:
            query["user_id"] = user_id
        if action:
            query["action"] = action
        if start_time:
            query["timestamp"] = {"$gte": start_time}

        return await db.audit_chain.find(query).sort("timestamp", 1).to_list(100)
```

---

## 5. 日志智能分析

```python
@dataclass
class LogAnalyzer:
    """日志智能分析"""

    async def analyze_error_logs(self, time_window: int = 3600) -> dict:
        """分析错误日志"""
        # 收集最近的错误日志
        cutoff = datetime.utcnow() - timedelta(seconds=time_window)
        error_logs = await db.logs.find({
            "level": "ERROR",
            "timestamp": {"$gte": cutoff.isoformat()},
        }).to_list(100)

        if not error_logs:
            return {"errors": 0, "analysis": "无错误"}

        # 用 LLM 分析
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        log_text = "\n".join([
            f"[{l['timestamp']}] {l.get('component', '')}: {l.get('message', '')[:200]}"
            for l in error_logs
        ])

        response = await llm.ainvoke(
            f"""分析以下错误日志，输出 JSON：

1. 错误分类（API故障/模型错误/工具失败/网络问题/资源不足）
2. 根因分析
3. 影响范围
4. 修复建议
5. 是否需要告警

错误日志：
{log_text}"""
        )

        try:
            return json.loads(response.content)
        except:
            return {"analysis": response.content, "errors": len(error_logs)}

    async def detect_patterns(self, logs: list) -> list:
        """检测日志模式"""
        # 按错误类型分组
        by_error = {}
        for log in logs:
            error_type = log.get("error_type", "unknown")
            by_error.setdefault(error_type, []).append(log)

        patterns = []
        for error_type, entries in by_error.items():
            if len(entries) >= 3:
                patterns.append({
                    "pattern": error_type,
                    "count": len(entries),
                    "first_seen": entries[0]["timestamp"],
                    "last_seen": entries[-1]["timestamp"],
                    "frequency": "high" if len(entries) > 10 else "medium",
                })

        return sorted(patterns, key=lambda x: -x["count"])
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了结构化日志 Schema | ☐ |
| 实现了日志脱敏 | ☐ |
| 配置了分布式日志聚合 | ☐ |
| 实现了 request_id 透传 | ☐ |
| 实现了审计链式哈希 | ☐ |
| 能验证审计链完整性 | ☐ |
| 实现了日志智能分析 | ☐ |
| 能检测日志模式 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 10 | 安全与合规指南 | 合规 |
| 78 | LLM 应用日志规范 | 日志规范 |
| 183 | 合规审计与日志追踪 | 审计 |
| 190 | 日志规范 | 规范 |
| 200 | 日志分析与智能诊断 | 日志分析 |
| 222 | 日志规范深度 | 规范 |
| 241 | 日志规范 | 规范 |
| 365 | 审计日志与合规追溯 | 审计 |
| 395 | 审计日志与合规追溯 | 审计 |
| 445 | Agent 调试与可观测工具链 | 调试 |
| 460 | 事件响应与根因分析 | 事件响应 |
| 477 | Agent 数据安全与加密 | 数据安全 |
| 478 | AIOps 与智能运维 | 智能运维 |
