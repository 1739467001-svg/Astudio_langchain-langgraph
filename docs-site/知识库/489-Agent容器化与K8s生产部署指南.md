# Agent 容器化与 K8s 生产部署指南

> 从"在我的机器上能跑"到"在生产环境稳定运行"——Docker 容器化+K8s 编排是标准路径。本指南系统讲解 Agent 的 Docker 镜像构建、K8s 部署清单、健康探针、HPA 弹性、ConfigMap/Secret 管理，以及生产级 Helm Chart。

---

## 1. Docker 镜像

### Dockerfile

```dockerfile
# Dockerfile — Agent 服务
FROM python:3.11-slim AS builder

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# === 运行阶段（多阶段构建减小镜像） ===
FROM python:3.11-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从 builder 复制已安装的包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制应用代码
WORKDIR /app
COPY src/ ./src/
COPY config/ ./config/
COPY langgraph.json .

# 非 root 用户运行
RUN useradd -m -u 1000 agent
USER agent

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### .dockerignore

```
__pycache__
*.pyc
.git
.env
*.md
tests/
docs/
node_modules/
.venv/
```

---

## 2. K8s 部署

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
  labels:
    app: agent-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: agent-service
    spec:
      containers:
        - name: agent
          image: registry.example.com/agent-service:1.0.0
          ports:
            - containerPort: 8000
          env:
            - name: ENVIRONMENT
              valueFrom:
                configMapKeyRef:
                  name: agent-config
                  key: environment
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: agent-secrets
                  key: openai-api-key
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: agent-secrets
                  key: database-url
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2000m"
              memory: "4Gi"
          # 健康探针
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 30
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          # 优雅关闭
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "10"]  # 等待负载均衡器摘除
      terminationGracePeriodSeconds: 60
```

### Service

```yaml
# k8s/service.yaml
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
  type: ClusterIP
```

### ConfigMap & Secret

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
data:
  environment: "production"
  llm_model: "gpt-4o"
  llm_temperature: "0"
  max_iterations: "25"
  log_level: "WARN"
  rag_top_k: "5"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
type: Opaque
stringData:
  openai-api-key: "sk-xxx"
  database-url: "postgresql://user:pass@db:5432/agent"
  redis-url: "redis://redis:6379"
```

### HPA 自动扩缩

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
```

---

## 3. 健康探针实现

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def liveness():
    """存活探针：进程活着"""
    return &#123;"status": "alive"&#125;

@app.get("/ready")
async def readiness():
    """就绪探针：能处理请求"""
    checks = &#123;
        "llm_api": await check_llm_api(),
        "database": await check_database(),
        "vectorstore": await check_vectorstore(),
    &#125;
    all_ready = all(checks.values())
    return &#123;
        "status": "ready" if all_ready else "not_ready",
        "checks": checks,
    &#125;
```

---

## 4. Helm Chart

### Chart 结构

```
agent-chart/
├── Chart.yaml          # Chart 元数据
├── values.yaml         # 默认值
├── values-prod.yaml    # 生产覆盖
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── secret.yaml
    ├── hpa.yaml
    └── ingress.yaml
```

### values.yaml

```yaml
# values.yaml
replicaCount: 3

image:
  repository: registry.example.com/agent-service
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "2000m"
    memory: "4Gi"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilization: 70

config:
  environment: production
  llmModel: gpt-4o
  maxIterations: 25

secrets:
  openaiApiKey: ""
  databaseUrl: ""

ingress:
  enabled: true
  host: agent.example.com
```

### 部署命令

```bash
# 安装
helm install agent-service ./agent-chart -f values-prod.yaml

# 升级
helm upgrade agent-service ./agent-chart -f values-prod.yaml

# 回滚
helm rollback agent-service 1

# 卸载
helm uninstall agent-service
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 构建了优化的 Docker 镜像 | ☐ |
| 配置了 K8s Deployment | ☐ |
| 配置了存活+就绪探针 | ☐ |
| 配置了 ConfigMap+Secret | ☐ |
| 配置了 HPA 自动扩缩 | ☐ |
| 实现了优雅关闭 | ☐ |
| 创建了 Helm Chart | ☐ |
| 配置了 Ingress | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 生产架构设计 | 架构 |
| 22 | CI/CD 流水线 | CI/CD |
| 76 | 蓝绿部署 | 部署 |
| 120 | LangGraph 部署 | 部署 |
| 188 | 配置即代码 | IaC |
| 302 | 多区域部署 | 多区域 |
| 361 | 云原生部署 | 云原生 |
| 391 | Agent 云原生部署 | 云原生 |
| 441 | LangGraph Platform 部署 | Platform |
| 479 | Agent 自动扩缩容 | 扩缩容 |
| 488 | Agent 环境管理 | 环境配置 |
