# LangGraph Platform 部署与生产化指南

> 在本地跑通 Agent 和在生产环境部署 Agent 是两回事。LangGraph Platform（含 LangGraph Cloud 和自托管方案）提供了开箱即用的生产级部署：API 服务、持久化、流式输出、Cron 调度、人机交互、Studio 可视化。本指南详解 LangGraph Platform 的架构、部署方式、API 设计，以及从开发到生产的完整路径。

---

## 1. LangGraph Platform 概览

### 三种部署方式

| 方式 | 描述 | 适用场景 |
|------|------|---------|
| LangGraph Cloud | LangChain 官方托管 | 快速上线、不想运维 |
| 自托管（Self-hosted） | Docker 部署到自己的服务器 | 数据隐私、私有云 |
| LangGraph Studio | 本地可视化调试 | 开发调试 |

### Platform 提供什么

```
你只需定义 Graph，Platform 提供：
  ✅ REST API（自动生成）
  ✅ 流式输出（SSE）
  ✅ 持久化（检查点/状态恢复）
  ✅ Cron 调度（定时任务）
  ✅ 人机交互（interrupt/wait）
  ✅ Webhook（事件通知）
  ✅ Studio 可视化（图结构+调试）
  ✅ 多线程管理
  ✅ 认证鉴权
```

### 与手动部署对比

| 维度 | 手动部署（FastAPI+LangGraph） | LangGraph Platform |
|------|---------------------------|-------------------|
| API 开发 | 自己写 | 自动生成 |
| 持久化 | 自己接 Checkpointer | 内置 |
| 流式输出 | 自己封装 SSE | 内置 |
| 定时任务 | 自己写 Cron | 内置 Cron |
| 人机交互 | 自己实现 | 内置 interrupt |
| 状态管理 | 自己管理 | 内置 thread + checkpoint |
| 可视化 | 没有 | Studio |
| 运维 | 自己做 | Cloud 免运维/自托管有工具 |

---

## 2. 项目结构

### 标准项目结构

```
my-agent-project/
├── langgraph.json          # 配置文件（核心）
├── requirements.txt        # Python 依赖
├── src/
│   ├── __init__.py
│   ├── graph.py            # Graph 定义（入口）
│   ├── state.py            # State 定义
│   ├── tools.py            # 工具定义
│   └── nodes.py            # 节点逻辑
└── tests/
    └── test_graph.py
```

### langgraph.json 配置

```json
{
  "dependencies": ["."],
  "graphs": {
    "assistant": "./src/graph.py:graph"
  },
  "env": ".env"
}
```

### Graph 定义

```python
# src/graph.py

from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

class AgentState(TypedDict):
    messages: list
    context: str
    result: str

@tool
def search(query: str) -> str:
    """搜索"""
    return f"结果: {query}"

llm = ChatOpenAI(model="gpt-4o-mini")

async def chat_node(state: AgentState):
    response = await llm.ainvoke(state["messages"])
    return {"messages": state["messages"] + [response]}

graph_builder = StateGraph(AgentState)
graph_builder.add_node("chat", chat_node)
graph_builder.add_edge(START, "chat")
graph_builder.add_edge("chat", END)

# 关键：导出编译后的 graph
graph = graph_builder.compile()
```

---

## 3. LangGraph Cloud 部署

### CLI 部署

```bash
# 安装 LangGraph CLI
pip install langgraph-cli

# 登录（需要 LangSmith 账号）
langgraph auth login

# 部署到 Cloud
langgraph deploy --name my-agent --tag production

# 查看部署状态
langgraph deployments list

# 获取 API 地址
# https://your-deployment.langgraph.app
```

### API 调用

```python
import requests

DEPLOYMENT_URL = "https://your-deployment.langgraph.app"

# === 创建线程（会话）===
response = requests.post(
    f"{DEPLOYMENT_URL}/threads",
    json={"metadata": {"user_id": "user123"}},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
thread = response.json()
thread_id = thread["thread_id"]

# === 发送消息（流式）===
response = requests.post(
    f"{DEPLOYMENT_URL}/threads/{thread_id}/runs/stream",
    json={
        "assistant_id": "assistant",
        "input": {
            "messages": [{"role": "user", "content": "你好"}]
        },
        "stream_mode": "messages",  # 消息流模式
    },
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    stream=True,  # 流式接收
)

# 处理 SSE 流
for line in response.iter_lines():
    if line:
        event = json.loads(line)
        print(event)
```

### 流式输出客户端

```python
from langgraph_sdk import get_client

# 使用 SDK 客户端
async def chat():
    client = get_client(url=DEPLOYMENT_URL, api_key="YOUR_API_KEY")

    # 创建线程
    thread = await client.threads.create()

    # 流式运行
    async for event in client.runs.stream(
        thread["thread_id"],
        "assistant",  # langgraph.json 中定义的 graph 名
        input={"messages": [{"role": "user", "content": "什么是 RAG？"}]},
        stream_mode="messages",
    ):
        if event.event == "messages/partial":
            # 部分消息（打字机效果）
            for msg in event.data:
                if msg["type"] == "AIMessageChunk":
                    print(msg["content"], end="", flush=True)
        elif event.event == "updates":
            # 状态更新
            print(f"\n[状态更新] {event.data}")

asyncio.run(chat())
```

---

## 4. 自托管部署（Docker）

### Docker Compose 部署

```yaml
# docker-compose.yml
version: "3.9"

services:
  langgraph-api:
    image: langchain/langgraph-api:latest
    environment:
      - LANGSMITH_API_KEY=ls_xxx
      - OPENAI_API_KEY=sk-xxx
      - DATABASE_URL=postgresql://user:pass@postgres:5432/langgraph
      - REDIS_URL=redis://redis:6379
    ports:
      - "8000:8000"
    volumes:
      - ./src:/app/src
      - ./langgraph.json:/app/langgraph.json
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=langgraph
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  # LangGraph Studio（可选，可视化调试）
  studio:
    image: langchain/langgraph-studio:latest
    environment:
      - LANGGRAPH_API_URL=http://langgraph-api:8000
    ports:
      - "3000:3000"
    depends_on:
      - langgraph-api

volumes:
  pgdata:
```

### 启动与管理

```bash
# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f langgraph-api

# 更新代码后重启
docker-compose restart langgraph-api

# API 地址
# http://localhost:8000
# Studio 地址
# http://localhost:3000
```

### 健康检查

```python
import httpx

async def health_check():
    """检查 LangGraph API 健康状态"""
    async with httpx.AsyncClient() as client:
        # 健康检查端点
        response = await client.get("http://localhost:8000/ok")
        if response.status_code == 200:
            return {"status": "healthy"}

        # 检查已部署的 Graph
        response = await client.get("http://localhost:8000/assistants")
        if response.status_code == 200:
            assistants = response.json()
            return {"status": "healthy", "assistants": len(assistants)}

        return {"status": "unhealthy"}
```

---

## 5. 持久化与状态恢复

### Checkpoint 机制

```python
# LangGraph Platform 自动处理持久化
# 每次运行都会自动保存检查点

# === 恢复中断的运行 ===
async def resume_interrupted_run():
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 获取线程状态
    state = await client.threads.get_state(thread_id)

    if state and state.get("next"):
        # 有未完成的节点
        print(f"待执行节点: {state['next']}")

        # 恢复执行
        async for event in client.runs.stream(
            thread_id,
            "assistant",
            input=None,  # None = 从检查点继续
        ):
            print(event)

# === 获取历史检查点 ===
async def list_checkpoints(thread_id: str):
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 列出所有检查点
    checkpoints = await client.threads.get_history(
        thread_id,
        limit=10,  # 最近 10 个
    )

    for cp in checkpoints:
        print(f"检查点 ID: {cp['checkpoint_id']}")
        print(f"  步骤: {cp.get('step', 0)}")
        print(f"  下一节点: {cp.get('next', [])}")

# === 时间旅行：从历史状态分叉 ===
async def time_travel(thread_id: str, checkpoint_id: str):
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 从指定检查点重新运行（修改输入）
    async for event in client.runs.stream(
        thread_id,
        "assistant",
        input={"messages": [{"role": "user", "content": "换个角度回答"}]},
        checkpoint_id=checkpoint_id,  # 从这个历史点分叉
    ):
        print(event)
```

---

## 6. Cron 定时任务

```python
# LangGraph Platform 内置 Cron 调度
# 可以定时运行 Agent

async def setup_cron_job():
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 创建定时任务
    cron = await client.crons.create(
        thread_id=None,  # 新线程
        assistant_id="assistant",
        schedule="0 9 * * *",  # 每天早上 9 点
        input={
            "messages": [{"role": "user", "content": "生成今日早报"}]
        },
        metadata={"type": "daily_report"},
    )

    print(f"Cron 创建成功: {cron['cron_id']}")

    # 列出所有定时任务
    crons = await client.crons.list()
    for c in crons:
        print(f"ID: {c['cron_id']}, Schedule: {c['schedule']}")

    # 删除定时任务
    await client.crons.delete(cron_id=cron["cron_id"])
```

---

## 7. 人机交互（Human-in-the-Loop）

```python
# === 后端：定义 interrupt ===
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command

class ReviewState(TypedDict):
    document: str
    review_result: str
    approved: bool

async def generate_draft(state: ReviewState):
    draft = f"草稿: {state['document']} 的分析报告..."
    return {"document": draft}

async def human_review(state: ReviewState):
    """暂停等待人工审批"""
    # interrupt 会暂停执行，等待人工输入
    review = interrupt({
        "type": "approval",
        "document": state["document"],
        "message": "请审批以下文档是否可以发布"
    })

    # review 是人工输入的结果
    return {
        "approved": review.get("approved", False),
        "review_result": review.get("comment", ""),
    }

async def publish(state: ReviewState):
    if state["approved"]:
        return {"document": state["document"] + " [已发布]"}
    return {"document": state["document"] + " [被拒绝]"}

graph_builder = StateGraph(ReviewState)
graph_builder.add_node("draft", generate_draft)
graph_builder.add_node("review", human_review)
graph_builder.add_node("publish", publish)
graph_builder.add_edge(START, "draft")
graph_builder.add_edge("draft", "review")
graph_builder.add_edge("review", "publish")
graph_builder.add_edge("publish", END)

graph = graph_builder.compile()
```

```python
# === 前端 API：处理 interrupt ===
async def handle_human_in_loop():
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 创建线程并启动
    thread = await client.threads.create()
    thread_id = thread["thread_id"]

    # 运行（会触发 interrupt 暂停）
    async for event in client.runs.stream(
        thread_id,
        "assistant",
        input={"document": "Q3 季度报告"},
    ):
        if event.event == "interrupt":
            # Agent 暂停等待人工输入
            interrupt_info = event.data
            print(f"等待审批: {interrupt_info['value']['message']}")

            # 提交人工审批结果
            await client.runs.update_state(
                thread_id,
                run_id=event.data["run_id"],
                values={"approved": True, "comment": "批准发布"},
                as_node="review",
            )

            # 恢复执行
            async for event in client.runs.stream(
                thread_id,
                "assistant",
                input=None,  # 继续执行
            ):
                print(event)
```

---

## 8. LangGraph Studio 可视化

### Studio 功能

```
LangGraph Studio（http://localhost:3000）：

  📊 图结构可视化
    - 看到完整的节点和边
    - 当前执行位置高亮
    - 条件路由可视化

  🔧 交互式调试
    - 在任意节点暂停
    - 修改状态后继续
    - 查看每步的输入输出

  📋 线程管理
    - 查看所有线程
    - 检查点列表
    - 时间旅行

  🎯 测试运行
    - 直接输入测试
    - 查看流式输出
    - 检查工具调用
```

### 在 Studio 中调试

```python
# Studio 自动连接本地 API
# 可以直接在 UI 中：
# 1. 输入测试消息
# 2. 查看图执行流程（节点高亮）
# 3. 在 interrupt 处暂停
# 4. 修改状态变量
# 5. 单步执行
# 6. 查看检查点历史
# 7. 从历史状态重新运行

# 配置 interrupt_before 在特定节点暂停
graph = graph_builder.compile(
    interrupt_before=["review"],  # 在 review 节点前暂停
)
```

---

## 9. 生产化检查清单

### 部署前检查

| 检查项 | 说明 | 状态 |
|--------|------|------|
| langgraph.json 配置正确 | graphs 路径和依赖 | ☐ |
| 环境变量配置 | API Key/DB URL/Redis URL | ☐ |
| 持久化后端 | PostgreSQL + Redis | ☐ |
| 健康检查端点 | /ok 返回 200 | ☐ |
| API 认证 | 鉴权配置 | ☐ |
| 并发控制 | worker 数量配置 | ☐ |
| 日志收集 | 结构化日志 | ☐ |
| 监控告警 | Prometheus + 告警 | ☐ |
| Studio 访问控制 | 生产环境关闭或加密 | ☐ |
| 数据库备份 | 定期备份策略 | ☐ |

### 性能优化

```python
# === 并发配置 ===
# docker-compose.yml 或环境变量
"""
WORKERS=4                 # Worker 进程数
MAX_CONCURRENT_THREADS=100  # 最大并发线程
MAX_QUEUE_SIZE=1000        # 请求队列
TIMEOUT=300                # 请求超时（秒）
"""

# === 数据库优化 ===
"""
# PostgreSQL 连接池
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30

# 定期清理旧检查点
# 保留最近 7 天的检查点
"""

# === 缓存 ===
"""
# Redis 缓存
# 工具结果缓存
# 热门查询缓存
"""
```

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 13 | 生产架构设计 | 生产架构 |
| 120 | LangGraph 部署与 Studio 指南 | 部署基础 |
| 126 | LangGraph 持久化 | 持久化 |
| 146 | LangGraph 流式 API 深度 | 流式 API |
| 158 | LangGraph 持久化与状态恢复深度 | 状态恢复 |
| 200 | LangGraph API 参考 | API 参考 |
| 206 | LangGraph 架构详解 | 架构 |
| 232 | LangGraph API 参考 | API 速查 |
| 264 | 状态快照 | 快照 |
| 340 | 状态快照时间旅行 | 时间旅行 |
| 378 | LangGraph 中断与人机交互 | 人机交互 |
| 404 | LangGraph 持久化检查点与状态恢复 | 检查点恢复 |
| 429 | Agent 可恢复性与容错编排 | 容错编排 |
| 434 | 自托管 LLM 与本地推理部署 | 自托管模式 |
| 440 | Agent 前端与聊天 UI 构建 | 前端对接 |
