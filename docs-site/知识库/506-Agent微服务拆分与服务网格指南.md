# Agent 微服务拆分与服务网格指南

> 单体 Agent 上线后用户增长——一个进程扛不住、一个团队维护不了。按业务域拆分成微服务：对话服务、检索服务、工具服务、分析服务各自独立。本指南系统讲解 Agent 微服务拆分策略、服务间通信、服务网格（Istio/Linkerd）治理。

---

## 1. 微服务拆分策略

### 按业务域拆分

```mermaid
graph TB
    subgraph "单体 Agent"
        MONOLITH["一个进程<br/>对话+检索+工具+分析"]
    end

    subgraph "微服务 Agent"
        CHAT["对话服务<br/>LLM 推理"]
        SEARCH["检索服务<br/>RAG"]
        TOOLS["工具服务<br/>工具执行"]
        ANALYZE["分析服务<br/>数据处理"]
        GATEWAY["API 网关<br/>路由+认证"]
    end

    GATEWAY --> CHAT
    CHAT --> SEARCH
    CHAT --> TOOLS
    TOOLS --> ANALYZE

    style MONOLITH fill:#FFCCBC,stroke:#D84315
    style GATEWAY fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style CHAT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 拆分原则

| 原则 | 说明 | 示例 |
|------|------|------|
| 单一职责 | 每个服务做一件事 | 检索只管检索 |
| 独立部署 | 服务可独立发布 | 检索更新不影响对话 |
| 数据隔离 | 每个服务有自己的存储 | 检索用向量库，对话用 PostgreSQL |
| 松耦合 | 服务间通过 API 通信 | 不共享内存状态 |
| 高内聚 | 相关功能在一起 | 检索+分块+Embedding 在一个服务 |

### 何时拆分

```
需要拆分的信号：
  1. 单体部署超过 2GB 内存
  2. 团队超过 5 人，代码冲突频繁
  3. 不同模块更新频率差异大（检索每天更新，对话偶尔）
  4. 不同模块资源需求不同（检索要 GPU、对话要 CPU）
  5. 需要独立扩缩容（检索 QPS 是对话的 10 倍）

不急于拆分：
  1. 团队 < 3 人
  2. QPS < 50
  3. 功能稳定不频繁迭代
```

---

## 2. 服务间通信

### 同步通信（gRPC/HTTP）

```python
@dataclass
class ChatService:
    """对话微服务"""

    search_service_url: str = "http://search-service:8001"
    tool_service_url: str = "http://tool-service:8002"

    async def handle(self, query: str, session_id: str):
        """处理对话请求"""
        # 1. 调用检索服务
        search_results = await self._call_search(query)

        # 2. LLM 推理
        context = "\n".join([r["content"] for r in search_results])
        response = await llm.ainvoke(f"参考以下信息回答：\n&#123;context&#125;\n\n问题：&#123;query&#125;")

        # 3. 如果需要工具
        if hasattr(response, "tool_calls") and response.tool_calls:
            tool_results = await self._call_tools(response.tool_calls)
            # 二次推理
            response = await llm.ainvoke(f"工具结果：&#123;tool_results&#125;\n请综合回答：&#123;query&#125;")

        return response.content

    async def _call_search(self, query: str) -> list:
        """调用检索服务"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"&#123;self.search_service_url&#125;/search",
                json=&#123;"query": query, "top_k": 5&#125;,
                timeout=5,
            )
        return response.json().get("results", [])

    async def _call_tools(self, tool_calls: list) -> list:
        """调用工具服务"""
        results = []
        async with httpx.AsyncClient() as client:
            for tc in tool_calls:
                response = await client.post(
                    f"&#123;self.tool_service_url&#125;/execute",
                    json=&#123;"tool": tc["name"], "args": tc["args"]&#125;,
                    timeout=10,
                )
                results.append(response.json())
        return results
```

### 异步通信（消息队列）

```python
@dataclass
class AsyncCommunication:
    """异步通信：通过消息队列解耦"""

    async def publish_task(self, task: dict):
        """发布任务到队列"""
        await redis.lpush("task_queue", json.dumps(task))

    async def consume_tasks(self):
        """消费任务"""
        while True:
            _, data = await redis.brpop("task_queue", timeout=30)
            if data:
                task = json.loads(data)
                result = await self._process(task)
                # 发布结果
                await redis.lpush(f"result:&#123;task['task_id']&#125;", json.dumps(result))

    async def get_result(self, task_id: str, timeout: int = 60) -> dict:
        """获取结果"""
        _, data = await redis.brpop(f"result:&#123;task_id&#125;", timeout=timeout)
        if data:
            return json.loads(data)
        return &#123;"error": "timeout"&#125;
```

---

## 3. 服务网格

### Istio 配置

```yaml
# istio.yaml — 服务网格配置
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: chat-service
spec:
  http:
    # 路由规则
    - route:
        - destination:
            host: chat-service
            port: &#123;number: 8000&#125;
      # 超时
      timeout: 120s
      # 重试
      retries:
        attempts: 3
        perTryTimeout: 30s
        retryOn: "5xx,reset,connect-failure"
      # 熔断
      fault:
        abort:
          percentage:
            value: 0  # 不注入故障（生产）
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: chat-service
spec:
  host: chat-service
  trafficPolicy:
    # 熔断器
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 60s
      maxEjectionPercent: 50
    # 负载均衡
    loadBalancer:
      simple: LEAST_REQUEST
    # 连接池
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
```

### 服务网格能力

```python
@dataclass
class ServiceMeshCapabilities:
    """服务网格提供的能力（无需修改代码）"""

    capabilities = &#123;
        "流量管理": &#123;
            "路由": "按规则路由到不同版本",
            "负载均衡": "轮转/最少请求/随机",
            "熔断": "自动熔断不健康实例",
            "重试": "自动重试失败请求",
            "超时": "请求级超时控制",
        &#125;,
        "安全": &#123;
            "mTLS": "服务间双向 TLS 加密",
            "认证": "JWT 认证",
            "授权": "基于角色的访问控制",
        &#125;,
        "可观测性": &#123;
            "追踪": "自动分布式追踪",
            "指标": "请求量/延迟/错误率",
            "访问日志": "结构化访问日志",
        &#125;,
        "弹性": &#123;
            "金丝雀": "按比例流量切分",
            "蓝绿": "全量切换",
            "故障注入": "注入延迟/错误测试韧性",
        &#125;,
    &#125;
```

---

## 4. API 网关

```python
@dataclass
class APIGateway:
    """API 网关"""

    async def route(self, request: dict) -> dict:
        """路由请求"""
        path = request.get("path", "")
        method = request.get("method", "GET")

        # 路由表
        routes = &#123;
            "/chat": &#123;"service": "chat-service", "port": 8000&#125;,
            "/search": &#123;"service": "search-service", "port": 8001&#125;,
            "/tools/execute": &#123;"service": "tool-service", "port": 8002&#125;,
            "/analyze": &#123;"service": "analyze-service", "port": 8003&#125;,
        &#125;

        target = routes.get(path)
        if not target:
            return &#123;"status": 404, "error": "Not Found"&#125;

        # 认证
        token = request.get("headers", &#123;&#125;).get("Authorization")
        if not await self._authenticate(token):
            return &#123;"status": 401, "error": "Unauthorized"&#125;

        # 限流
        user_id = request.get("user_id", "")
        if not await self._check_rate_limit(user_id):
            return &#123;"status": 429, "error": "Too Many Requests"&#125;

        # 转发
        return await self._forward(target, request)
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解微服务拆分原则 | ☐ |
| 知道何时该拆分 | ☐ |
| 实现了服务间同步通信 | ☐ |
| 实现了异步消息队列 | ☐ |
| 配置了 Istio 服务网格 | ☐ |
| 理解服务网格能力 | ☐ |
| 配置了 API 网关 | ☐ |
| 理解 mTLS 安全 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 生产架构设计 | 架构 |
| 16 | 生产架构图解 | 架构 |
| 361 | 云原生部署 | 云原生 |
| 391 | Agent 云原生部署 | 云原生 |
| 441 | LangGraph Platform 部署 | Platform |
| 461 | 企业 Agent 集成 | 集成 |
| 469 | 分布式 Agent | 分布式 |
| 482 | Agent API 设计 | API |
| 489 | Agent 容器化部署 | 容器化 |
| 499 | Agent 性能压测 | 压测 |
| 505 | Agent 云原生部署 | 云原生 |
