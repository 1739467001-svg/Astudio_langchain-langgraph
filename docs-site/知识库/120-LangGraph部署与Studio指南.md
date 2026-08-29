# LangGraph 部署与 Studio 指南

> 在本地跑通 LangGraph 只是第一步。如何部署到生产、如何可视化调试图结构、如何管理 API？这份指南覆盖 LangGraph Studio 可视化、LangGraph Cloud/Server 部署和自托管方案。

---

## 一、部署方式全景

```mermaid
graph TB
    ROOT["LangGraph部署方式"] --> D1["LangGraph Studio<br/>本地开发可视化"]
    ROOT --> D2["LangGraph Cloud<br/>官方托管部署"]
    ROOT --> D3["自托管<br/>Docker/自建服务器"]
    ROOT --> D4["langgraph-cli<br/>命令行部署工具"]

    D1 --> D1D["可视化图结构<br/>实时调试<br/>交互式测试"]
    D2 --> D2D["零运维<br/>自动扩缩容<br/>内置持久化"]
    D3 --> D3D["完全控制<br/>数据不出内网<br/>自定义基础设施"]
    D4 --> D4D["CLI工具<br/>本地模拟Cloud环境<br/>打包部署"]

    style ROOT fill:#1565C0,color:#fff
    style D1 fill:#E3F2FD
    style D2 fill:#FFF3E0
    style D3 fill:#C8E6C9
    style D4 fill:#F3E5F5
```

---

## 二、LangGraph Studio

### 2.1 什么是 Studio

```mermaid
graph TB
    subgraph Studio &#123;"LangGraph Studio功能"&#125;
        F1["图结构可视化<br/>看到节点和边的拓扑"]
        F2["交互式运行<br/>输入→运行→看结果"]
        F3["状态检查<br/>查看每步State快照"]
        F4["时间旅行<br/>回到任意步骤修改"]
        F5["断点调试<br/>在节点前后暂停"]
        F6["对话测试<br/>多轮对话测试记忆"]
    end

    style Studio fill:#E3F2FD
```

### 2.2 配置项目

```yaml
# langgraph.json — Studio和CLI的配置文件
&#123;
  "dependencies": ["."],          # Python包依赖（当前目录）
  "graphs": &#123;
    "my_agent": "./src/agent.py:graph"   # 图名称: 文件路径:变量名
  &#125;,
  "env": ".env"                    # 环境变量文件
&#125;
```

```python
# src/agent.py — 你的图定义
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """搜索信息"""
    return f"结果: &#123;query&#125;"

# 创建图
model = ChatOpenAI(model="gpt-4o")
graph = create_react_agent(model, [search], checkpointer=MemorySaver())
```

### 2.3 启动 Studio

```bash
# 安装LangGraph CLI
pip install langgraph-cli

# 启动开发服务器（含Studio UI）
langgraph dev

# Studio自动在浏览器打开
# 默认地址: http://localhost:2024
```

```mermaid
graph LR
    subgraph 开发流程 &#123;"使用Studio的开发流程"&#125;
        DEV["编写图代码"] --> CONFIG["写langgraph.json"]
        CONFIG --> CLI["langgraph dev"]
        CLI --> STUDIO["Studio UI<br/>可视化+调试"]
        STUDIO -->|发现问题| DEV
        STUDIO -->|调试通过| DEPLOY["部署"]
    end

    style STUDIO fill:#FFF9C4
    style DEPLOY fill:#C8E6C9
```

---

## 三、LangGraph Cloud 部署

### 3.1 部署流程

```mermaid
graph TB
    subgraph 部署 &#123;"LangGraph Cloud部署流程"&#125;
        S1["编写langgraph.json"] --> S2["定义图和依赖"]
        S2 --> S3["langgraph deploy"]
        S3 --> S4["自动打包<br/>上传到LangGraph Cloud"]
        S4 --> S5["获取API地址<br/>https://xxx.langgraph.app"]
        S5 --> S6["通过API调用<br/>或SDK调用"]
    end

    style S3 fill:#E3F2FD
    style S5 fill:#C8E6C9
    style S6 fill:#FFF3E0
```

### 3.2 部署配置

```json
&#123;
  "dependencies": ["."],
  "graphs": &#123;
    "research_agent": "./src/agents/research.py:graph",
    "code_agent": "./src/agents/code.py:graph"
  &#125;,
  "env": ".env",
  "python_version": "3.11"
&#125;
```

```bash
# 部署到LangGraph Cloud
langgraph deploy

# 查看部署状态
langgraph deployment status

# 查看日志
langgraph deployment logs

# 销毁部署
langgraph deployment destroy
```

### 3.3 调用部署的 API

```python
from langgraph_sdk import get_client

# 连接到部署的LangGraph
client = get_client(url="https://your-app.langgraph.app")

# 创建线程
thread = await client.threads.create()

# 发送消息运行Agent
async for event in client.runs.stream(
    thread_id=thread["thread_id"],
    app_id="research_agent",
    input=&#123;"messages": [&#123;"role": "user", "content": "研究AI Agent市场"&#125;]&#125;,
    stream_mode="messages",
):
    print(event)
```

---

## 四、自托管部署

### 4.1 Docker 部署

```mermaid
graph TB
    subgraph 架构 &#123;"自托管架构"&#125;
        LB["负载均衡<br/>Nginx/ALB"] --> API1["LangGraph API<br/>容器实例1"]
        LB --> API2["LangGraph API<br/>容器实例2"]
        LB --> API3["LangGraph API<br/>容器实例3"]
        API1 --> DB["PostgreSQL<br/>检查点存储"]
        API2 --> DB
        API3 --> DB
        API1 --> REDIS["Redis<br/>队列/缓存"]
        API2 --> REDIS
        API3 --> REDIS
    end

    style LB fill:#E3F2FD
    style DB fill:#FFF3E0
    style REDIS fill:#FFCDD2
```

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动LangGraph API服务器
CMD ["langgraph", "api", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  langgraph-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=$&#123;OPENAI_API_KEY&#125;
      - POSTGRES_URL=postgresql://user:pass@postgres:5432/langgraph
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: langgraph
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - langgraph-api

volumes:
  pgdata:
  redisdata:
```

### 4.2 生产级配置

```python
# config.py — 生产环境配置
import os
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore

# 生产级持久化：PostgreSQL
def get_checkpointer():
    """生产检查点存储"""
    postgres_url = os.getenv("POSTGRES_URL")
    return PostgresSaver.from_conn_string(postgres_url)

def get_store():
    """长期记忆存储"""
    postgres_url = os.getenv("POSTGRES_URL")
    return PostgresStore.from_conn_string(postgres_url)

# 生产级Agent
from langgraph.prebuilt import create_react_agent

def create_production_agent():
    """创建生产Agent"""
    model = ChatOpenAI(
        model="gpt-4o",
        timeout=30,           # LLM调用超时
        max_retries=2,        # 重试次数
    )

    agent = create_react_agent(
        model,
        tools=[search, calculate],
        checkpointer=get_checkpointer(),
        store=get_store(),
    )
    return agent

production_graph = create_production_agent()
```

---

## 五、API 设计

### 5.1 LangGraph API 端点

```mermaid
graph TB
    subgraph API &#123;"LangGraph API核心端点"&#125;
        E1["POST /threads<br/>创建对话线程"]
        E2["POST /threads/&#123;id&#125;/runs<br/>在线程中运行图"]
        E3["GET /threads/&#123;id&#125;/state<br/>获取线程状态"]
        E4["POST /threads/&#123;id&#125;/runs/stream<br/>流式运行"]
        E5["GET /assistants<br/>列出可用的图"]
        E6["POST /runs/cron<br/>定时运行"]
    end

    style API fill:#E3F2FD
```

### 5.2 FastAPI 集成

```python
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
import json

app = FastAPI(title="LangGraph Agent API")

# 创建Agent实例
agent = create_react_agent(
    ChatOpenAI(model="gpt-4o"),
    [search, calculate],
    checkpointer=MemorySaver(),
)

@app.post("/chat")
async def chat(request: Request):
    """同步对话接口"""
    data = await request.json()
    message = data["message"]
    thread_id = data.get("thread_id", "default")

    result = agent.invoke(
        &#123;"messages": [&#123;"role": "user", "content": message&#125;]&#125;,
        &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;,
    )

    # 提取最后一条AI消息
    last_msg = result["messages"][-1]

    return &#123;
        "response": last_msg.content,
        "thread_id": thread_id,
    &#125;

@app.post("/chat/stream")
async def chat_stream(request: Request):
    """流式对话接口（SSE）"""
    data = await request.json()
    message = data["message"]
    thread_id = data.get("thread_id", "default")

    async def event_stream():
        async for event in agent.astream_events(
            &#123;"messages": [&#123;"role": "user", "content": message&#125;]&#125;,
            &#123;"configurable": &#123;"thread_id": thread_id&#125;&#125;,
            version="v2",
        ):
            if event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if chunk.content:
                    yield f"data: &#123;json.dumps(&#123;'content': chunk.content&#125;)&#125;\n\n"

        yield f"data: &#123;json.dumps(&#123;'done': True&#125;)&#125;\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )
```

---

## 六、生产环境监控

```mermaid
graph TB
    subgraph 监控 &#123;"部署后监控维度"&#125;
        M1["健康检查<br/>GET /health<br/>返回图状态"]
        M2["运行指标<br/>延迟/吞吐/错误率<br/>通过Prometheus采集"]
        M3["日志<br/>结构化日志<br/>请求追踪ID"]
        M4["LangSmith追踪<br/>每次执行的完整轨迹<br/>自动采集"]
        M5["告警<br/>错误率>阈值<br/>延迟>SLO<br/>队列积压"]
    end

    style 监控 fill:#E3F2FD
```

```python
# health.py — 健康检查端点
@app.get("/health")
async def health_check():
    """健康检查"""
    checks = &#123;&#125;

    # 1. 检查LLM可用性
    try:
        model = ChatOpenAI(model="gpt-4o")
        await model.ainvoke("ping")
        checks["llm"] = "healthy"
    except Exception:
        checks["llm"] = "unhealthy"

    # 2. 检查向量库
    try:
        # 简单查询测试
        checks["vector_db"] = "healthy"
    except Exception:
        checks["vector_db"] = "unhealthy"

    # 3. 检查PostgreSQL
    try:
        checks["postgres"] = "healthy"
    except Exception:
        checks["postgres"] = "unhealthy"

    all_healthy = all(v == "healthy" for v in checks.values())

    return &#123;
        "status": "healthy" if all_healthy else "degraded",
        "checks": checks,
    &#125;
```

---

## 七、部署方式选型

```mermaid
graph TB
    Q1&#123;"开发阶段？"&#125; -->|原型开发| STUDIO["Studio (langgraph dev)"]
    Q1 -->|生产部署| Q2&#123;"数据敏感度？"&#125;
    Q2 -->|可上云| Q3&#123;"预算有限<br/>或无运维团队？"&#125;
    Q3 -->|是| CLOUD["LangGraph Cloud<br/>零运维"]
    Q3 -->|有运维能力| SELF["自托管<br/>完全控制"]
    Q2 -->|敏感数据不出内网| SELF

    style STUDIO fill:#E3F2FD
    style CLOUD fill:#C8E6C9
    style SELF fill:#FFF3E0
```

| 部署方式 | 适合场景 | 优点 | 缺点 |
|----------|----------|------|------|
| Studio | 开发调试 | 可视化、交互式 | 仅本地 |
| LangGraph Cloud | 快速上线生产 | 零运维、自动扩缩容 | 数据在云端、有费用 |
| 自托管 | 数据敏感的生产 | 完全控制、数据不出内网 | 需要运维能力 |
| langgraph-cli | CI/CD模拟 | 本地测试部署配置 | 不适合生产 |

---

## 八、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 开发时用Studio | 可视化调试效率高10倍 | ★★★ |
| 生产用PostgreSQL检查点 | 比MemorySaver持久可靠 | ★★★ |
| API无状态化 | 容器可水平扩缩容 | ★★★ |
| 健康检查必须覆盖依赖 | LLM/向量库/数据库都要检查 | ★★☆ |
| 配置LangSmith追踪 | 自动采集每次执行轨迹 | ★★☆ |
| 流式接口用SSE | 用户体验更好 | ★★☆ |
| 线程ID对应会话 | 实现对话记忆隔离 | ★★☆ |

---

## 九、检查清单

| 检查项 | 状态 |
|--------|------|
| 能配置langgraph.json项目 | ☐ |
| 能用Studio可视化调试图 | ☐ |
| 理解三种部署方式的区别 | ☐ |
| 能用Docker Compose部署 | ☐ |
| 配置了PostgreSQL持久化 | ☐ |
| 实现了健康检查端点 | ☐ |
| 有流式API接口 | ☐ |
| 配置了LangSmith追踪 | ☐ |
