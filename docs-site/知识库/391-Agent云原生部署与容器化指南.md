# Agent 云原生部署与容器化指南

> 从本地脚本到生产部署——Docker容器化、K8s编排、配置外部化、健康探针集成。这篇指南讲透 Agent 的云原生部署全流程。

---

## 一、云原生部署架构

```mermaid
graph TB
    subgraph K8s &#123;"Kubernetes集群"&#125;
        INGRESS["Ingress<br/>流量入口"] --> SVC["Service<br/>负载均衡"]
        SVC --> P1["Pod1<br/>Agent实例"]
        SVC --> P2["Pod2<br/>Agent实例"]
        SVC --> P3["Pod3<br/>Agent实例"]

        P1 & P2 & P3 --> CONFIG["ConfigMap<br/>非敏感配置"]
        P1 & P2 & P3 --> SECRET["Secret<br/>API Key"]
        P1 & P2 & P3 --> PVC["PVC<br/>持久化存储"]
    end

    subgraph 外部 &#123;"外部服务"&#125;
        LLM_API["LLM API<br/>OpenAI/星火"]
        VEC_DB["向量库<br/>Milvus/PGVector"]
        REDIS["Redis<br/>缓存+Checkpointer"]
        MONITOR["Prometheus<br/>+ Grafana"]
    end

    P1 & P2 & P3 --> LLM_API & VEC_DB & REDIS
    P1 & P2 & P3 --> MONITOR

    style SVC fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CONFIG fill:#E3F2FD
    style MONITOR fill:#C8E6C9
```

---

## 二、Docker 容器化

```dockerfile
# Dockerfile
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

```python
# requirements.txt
langchain==0.3.*
langgraph==0.2.*
langchain-openai==0.2.*
fastapi==0.115.*
uvicorn==0.32.*
redis==5.*
psutil==5.*
```

### 应用入口

```python
# app.py
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
import os
import asyncio
import json

# ===== 配置（从环境变量读取） =====
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0"))
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "5"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# ===== 工具定义 =====
@tool
async def search(query: str) -> dict:
    """搜索信息。"""
    return &#123;"results": f"搜索: &#123;query&#125;"&#125;

@tool
async def calculate(expression: str) -> dict:
    """计算表达式。"""
    try:
        result = eval(expression)  # 生产环境应用安全的eval
        return &#123;"result": result&#125;
    except Exception:
        return &#123;"error": "无效表达式"&#125;

# ===== Agent 构建 =====
llm = ChatOpenAI(model=MODEL_NAME, temperature=TEMPERATURE)
checkpointer = MemorySaver()
agent = create_react_agent(
    llm,
    [search, calculate],
    prompt="你是智能助手。",
    checkpointer=checkpointer,
)

# ===== FastAPI 应用 =====
app = FastAPI(title="Agent API", version="1.0.0")

@app.get("/health/live")
async def liveness():
    return &#123;"status": "alive"&#125;

@app.get("/health/ready")
async def readiness():
    return &#123;"status": "ready", "model": MODEL_NAME&#125;

@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    query = body.get("query", "")
    thread_id = body.get("thread_id", "default")

    result = await agent.ainvoke(
        &#123;"messages": [&#123;"role": "user", "content": query&#125;]&#125;,
        config=&#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;,
    )
    return &#123;"response": result["messages"][-1].content&#125;

@app.post("/chat/stream")
async def chat_stream(request: Request):
    """流式响应。"""
    body = await request.json()
    query = body.get("query", "")
    thread_id = body.get("thread_id", "default")

    async def generate():
        async for event in agent.astream_events(
            &#123;"messages": [&#123;"role": "user", "content": query&#125;]&#125;,
            config=&#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;,
            version="v2",
        ):
            if event.get("event") == "on_chat_model_stream":
                chunk = event.get("data", &#123;&#125;).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield f"data: &#123;json.dumps(&#123;'token': chunk.content&#125;, ensure_ascii=False)&#125;\n\n"
        yield f"data: &#123;json.dumps(&#123;'done': True&#125;)&#125;\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Kubernetes 部署

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-deployment
  labels:
    app: agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      containers:
      - name: agent
        image: my-registry/agent-app:latest
        ports:
        - containerPort: 8000
        env:
        - name: MODEL_NAME
          valueFrom:
            configMapKeyRef:
              name: agent-config
              key: model_name
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: openai_api_key
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: agent-config
              key: redis_url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: agent-service
spec:
  selector:
    app: agent
  ports:
  - port: 80
    targetPort: 8000
  type: LoadBalancer

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
data:
  model_name: "gpt-4o-mini"
  redis_url: "redis://redis-service:6379"

---
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
type: Opaque
stringData:
  openai_api_key: "sk-xxxxx"
```

### 自动扩缩容

```yaml
# k8s-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 三、部署检查清单

| 检查项 | Docker | K8s | 说明 |
|----------|--------|-----|------|
| 健康探针 | HEALTHCHECK | livenessProbe | 存活检测 |
| 就绪探针 | - | readinessProbe | 就绪检测 |
| 配置外部化 | ENV | ConfigMap | 不硬编码 |
| 密钥管理 | ENV | Secret | 不暴露 |
| 资源限制 | - | resources | 防资源耗尽 |
| 自动扩缩 | - | HPA | 弹性伸缩 |
| 日志输出 | stdout | stdout | 日志聚合 |
| 优雅关闭 | signal | terminationGracePeriod | 排空连接 |

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 配置外部化 | 环境变量/ConfigMap | ★★★ |
| 密钥不进镜像 | Secret/Volume | ★★★ |
| 健康探针集成 | Liveness+Readiness | ★★★ |
| 资源限制 | CPU+Memory limits | ★★★ |
| 最小权限 | ServiceAccount限制 | ★★☆ |
| 优雅关闭 | 捕获SIGTERM | ★★☆ |
| 镜像最小化 | slim基础镜像 | ★★☆ |
| HPA自动扩缩 | CPU>70%扩容 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有Dockerfile | ☐ |
| 有FastAPI入口 | ☐ |
| 有健康探针 | ☐ |
| 有K8s部署文件 | ☐ |
| 有ConfigMap/Secret | ☐ |
| 有HPA自动扩缩 | ☐ |
| 有流式接口 | ☐ |
