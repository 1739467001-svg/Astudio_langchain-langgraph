# Agent 云原生与 Serverless 部署指南

> 不是所有 Agent 都需要 24/7 运行——有的只在被调用时才需要。Serverless 部署让 Agent 按需启动、用完释放、零成本空闲。本指南系统讲解云原生部署（K8s/容器/微服务）和 Serverless 部署（Lambda/Cloud Functions/Edge）两种模式及选型。

---

## 1. 部署模式对比

| 模式 | 特点 | 成本 | 延迟 | 适用 |
|------|------|------|------|------|
| K8s 常驻 | 始终运行 | 固定 | 最低 | 高频/实时 |
| Serverless | 按需启动 | 按量 | 冷启动 | 低频/突发 |
| 边缘 | 就近部署 | 中 | 极低 | 全球分布 |
| 混合 | 常驻+Serverless | 优化 | 混合 | 生产推荐 |

### 何时用 Serverless

```
适合 Serverless：
  - 低频调用（< 100 次/小时）
  - 突发流量（偶尔高峰）
  - 成本敏感（不想为空闲付费）
  - 简单部署（不想运维 K8s）

不适合 Serverless：
  - 需要常驻 GPU（本地模型推理）
  - 冷启动不可接受（< 1 秒响应）
  - 长连接/WebSocket
  - 大量状态管理
```

---

## 2. Serverless 部署

### AWS Lambda

```python
# lambda_handler.py
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
import json

# 全局初始化（Lambda 容器复用）
llm = None
agent = None

def get_agent():
    """懒加载 Agent（复用容器）"""
    global llm, agent
    if agent is None:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        from langgraph.prebuilt import create_react_agent
        agent = create_react_agent(llm, [search_tool, calc_tool])
    return agent

@tool
def search_tool(query: str) -> str:
    """搜索"""
    return f"结果: &#123;query&#125;"

@tool
def calc_tool(expression: str) -> str:
    """计算"""
    return str(eval(expression))

def lambda_handler(event, context):
    """AWS Lambda 入口"""
    # 解析请求
    body = json.loads(event.get("body", "&#123;&#125;"))
    query = body.get("message", "")

    # 获取 Agent（复用全局实例）
    agent = get_agent()

    # 执行
    result = agent.invoke(&#123;"messages": [&#123;"role": "user", "content": query&#125;]&#125;)

    return &#123;
        "statusCode": 200,
        "headers": &#123;"Content-Type": "application/json"&#125;,
        "body": json.dumps(&#123;
            "answer": result["messages"][-1].content,
            "request_id": context.aws_request_id,
        &#125;),
    &#125;
```

### 流式输出（Lambda + API Gateway）

```python
def lambda_stream_handler(event, context):
    """Lambda 流式响应（API Gateway 流式）"""
    import asyncio

    body = json.loads(event.get("body", "&#123;&#125;"))
    query = body.get("message", "")

    async def generate():
        agent = get_agent()
        async for event in agent.astream_events(
            &#123;"messages": [&#123;"role": "user", "content": query&#125;]&#125;,
            version="v2",
        ):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield chunk.content

    # Lambda 流式响应
    return &#123;
        "statusCode": 200,
        "headers": &#123;"Content-Type": "text/event-stream"&#125;,
        "body": asyncio.run(generate()),
    &#125;
```

### Cloudflare Workers（边缘部署）

```python
# Cloudflare Worker — 边缘 Agent
# 适合：轻量推理、路由、缓存

async def handle(request):
    """Cloudflare Worker 入口"""
    body = await request.json()
    query = body.get("message", "")

    # 边缘缓存检查
    cache_key = f"agent:&#123;hash(query)&#125;"
    cached = await env.CACHE.get(cache_key)
    if cached:
        return Response(cached, media_type="application/json")

    # 转发到主推理服务（Worker 不做重推理）
    response = await fetch("https://agent-service.example.com/chat", &#123;
        "method": "POST",
        "body": json.dumps(&#123;"message": query&#125;),
    &#125;)

    result = await response.json()

    # 边缘缓存
    await env.CACHE.put(cache_key, json.dumps(result), expirationTtl=3600)

    return Response(json.dumps(result), media_type="application/json")
```

---

## 3. K8s 云原生部署

### 生产级 K8s 配置

```yaml
# k8s/production.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: agent
          image: ghcr.io/org/agent:1.0.0
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2000m"
              memory: "4Gi"
          # 启动优化
          startupProbe:
            httpGet:
              path: /ready
              port: 8000
            failureThreshold: 30
            periodSeconds: 5
          # 健康检查
          livenessProbe:
            httpGet: &#123;path: /health, port: 8000&#125;
            periodSeconds: 30
          readinessProbe:
            httpGet: &#123;path: /ready, port: 8000&#125;
            periodSeconds: 10
          # 优雅关闭
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "10"]
      terminationGracePeriodSeconds: 60
---
# HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-hpa
spec:
  scaleTargetRef:
    kind: Deployment
    name: agent-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: &#123;type: Utilization, averageUtilization: 70&#125;
---
# Service
apiVersion: v1
kind: Service
metadata:
  name: agent-service
spec:
  selector:
    app: agent-service
  ports:
    - port: 80
      targetPort: 8000
---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agent-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
spec:
  rules:
    - host: agent.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: agent-service
                port: &#123;number: 80&#125;
```

---

## 4. 混合部署策略

```python
@dataclass
class HybridDeployment:
    """混合部署：K8s 常驻 + Serverless 弹性"""

    async def route(self, request: dict) -> dict:
        """根据请求特征路由"""
        priority = request.get("priority", "normal")
        expected_duration = request.get("estimated_duration", 5)

        if priority == "high" or expected_duration < 5:
            # 高优先级或短任务 → K8s 常驻（低延迟）
            return await self._call_k8s(request)
        else:
            # 低优先级或长任务 → Serverless（省成本）
            return await self._call_serverless(request)

    async def _call_k8s(self, request):
        """调用 K8s 服务"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://agent-service.default.svc:80/chat",
                json=request,
                timeout=30,
            )
        return response.json()

    async def _call_serverless(self, request):
        """调用 Serverless"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://agent-lambda.example.com/chat",
                json=request,
                timeout=120,  # Serverless 可能冷启动
            )
        return response.json()
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种部署模式 | ☐ |
| 能实现 Lambda 部署 | ☐ |
| 实现了 Serverless 流式 | ☐ |
| 配置了 K8s 生产部署 | ☐ |
| 实现了混合部署路由 | ☐ |
| 理解冷启动问题 | ☐ |
| 配置了 Ingress | ☐ |
| 理解边缘部署 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 生产架构设计 | 架构 |
| 361 | 云原生部署 | 云原生 |
| 391 | Agent 云原生部署与容器化 | 容器化 |
| 441 | LangGraph Platform 部署 | Platform |
| 469 | 分布式 Agent 与边缘部署 | 边缘 |
| 479 | Agent 自动扩缩容 | 扩缩容 |
| 489 | Agent 容器化与 K8s | K8s |
| 491 | Agent 冷启动优化 | 冷启动 |
| 504 | Agent DevOps 与 CI/CD | CI/CD |
