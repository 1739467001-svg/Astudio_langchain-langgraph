# Agent 调度与定时任务 Cron 指南

> Agent 不只是被动等待用户提问——它还需要"主动做事"：每天早上 9 点生成日报、每周一发送周报、检测到异常自动分析、知识库定时更新。本指南系统讲解 Agent 定时调度、Cron 表达式、任务队列、LangGraph Cron 集成，以及实际调度场景。

---

## 1. 定时任务场景

### 常见场景

| 场景 | 频率 | Agent 任务 |
|------|------|-----------|
| 每日早报 | 每天 9:00 | 采集新闻→分析→生成摘要→发送 |
| 每周周报 | 每周一 9:00 | 汇总数据→分析→生成报告 |
| 知识库更新 | 每天 2:00 | 增量采集→清洗→索引 |
| 健康检查 | 每 5 分钟 | 检查各组件状态→告警 |
| 日终结算 | 每天 23:59 | 汇总当日数据→成本分析 |
| 月度报告 | 每月 1 日 | 聚合月数据→生成月报 |
| 异常检测 | 每 1 分钟 | 检测异常→自动诊断→自愈 |
| 数据清理 | 每周日凌晨 | 清理过期数据→优化索引 |

---

## 2. Cron 表达式

### 语法

```
Cron 格式：分 时 日 月 周

* * * * *  含义
│ │ │ │ │
│ │ │ │ └─ 星期 (0-7, 0和7=周日)
│ │ │ └─── 月份 (1-12)
│ │ └───── 日期 (1-31)
│ └────── 小时 (0-23)
└──────── 分钟 (0-59)

特殊字符：
  *  任意值
  /  步进值（*/5 = 每5分钟）
  ,  列表（1,3,5）
  -  范围（9-17）
  ?  不指定（用于日或周互斥）

示例：
  0 9 * * *        → 每天 9:00
  0 9 * * 1        → 每周一 9:00
  0 9 1 * *        → 每月 1 日 9:00
  */5 * * * *      → 每 5 分钟
  0 */2 * * *      → 每 2 小时
  0 9 * * 1-5      → 工作日 9:00
  30 23 * * *      → 每天 23:30
```

---

## 3. 调度器实现

### APScheduler 集成

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class AgentScheduler:
    """Agent 定时调度器"""

    scheduler: AsyncIOScheduler = field(default_factory=AsyncIOScheduler)
    jobs: dict = field(default_factory=dict)

    async def add_daily_report(self, job_id: str, agent_func: callable,
                               hour: int = 9, minute: int = 0):
        """添加每日定时任务"""
        self.scheduler.add_job(
            agent_func,
            CronTrigger(hour=hour, minute=minute),
            id=job_id,
            replace_existing=True,
        )
        self.jobs[job_id] = {"schedule": f"每天 {hour}:{minute:02d}", "type": "daily_report"}

    async def add_weekly_report(self, job_id: str, agent_func: callable,
                                day_of_week: str = "mon", hour: int = 9):
        """添加每周任务"""
        self.scheduler.add_job(
            agent_func,
            CronTrigger(day_of_week=day_of_week, hour=hour, minute=0),
            id=job_id,
            replace_existing=True,
        )
        self.jobs[job_id] = {"schedule": f"每周{day_of_week} {hour}:00", "type": "weekly_report"}

    async def add_interval(self, job_id: str, agent_func: callable,
                           minutes: int = 5):
        """添加间隔任务"""
        from apscheduler.triggers.interval import IntervalTrigger
        self.scheduler.add_job(
            agent_func,
            IntervalTrigger(minutes=minutes),
            id=job_id,
            replace_existing=True,
        )
        self.jobs[job_id] = {"schedule": f"每 {minutes} 分钟", "type": "interval"}

    async def add_custom_cron(self, job_id: str, agent_func: callable,
                               cron_expression: str):
        """添加自定义 Cron 表达式"""
        # 解析 Cron 表达式
        parts = cron_expression.split()
        trigger = CronTrigger(
            minute=parts[0],
            hour=parts[1],
            day=parts[2],
            month=parts[3],
            day_of_week=parts[4],
        )
        self.scheduler.add_job(
            agent_func,
            trigger,
            id=job_id,
            replace_existing=True,
        )
        self.jobs[job_id] = {"schedule": cron_expression, "type": "custom"}

    def start(self):
        """启动调度器"""
        self.scheduler.start()
        print(f"Agent 调度器已启动，{len(self.jobs)} 个任务")

    def stop(self):
        """停止调度器"""
        self.scheduler.shutdown(wait=True)

    def list_jobs(self) -> list:
        """列出所有任务"""
        jobs = self.scheduler.get_jobs()
        return [{
            "job_id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "schedule": self.jobs.get(job.id, {}).get("schedule", ""),
        } for job in jobs]

    async def pause_job(self, job_id: str):
        """暂停任务"""
        self.scheduler.pause_job(job_id)

    async def resume_job(self, job_id: str):
        """恢复任务"""
        self.scheduler.resume_job(job_id)

    async def remove_job(self, job_id: str):
        """删除任务"""
        self.scheduler.remove_job(job_id)
        self.jobs.pop(job_id, None)

    async def run_job_now(self, job_id: str):
        """立即执行一次"""
        job = self.scheduler.get_job(job_id)
        if job:
            await job.func()
```

---

## 4. 定时 Agent 任务实现

### 每日早报

```python
async def daily_briefing_job():
    """每日早报任务"""
    print(f"[{datetime.now()}] 开始生成早报...")

    # 1. 采集新闻
    news = await collect_news(topics=["AI", "科技", "行业"])

    # 2. Agent 分析
    llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
    analysis = await llm.ainvoke(
        f"分析以下新闻，生成今日早报：\n{json.dumps(news, ensure_ascii=False)}"
    )

    # 3. 发送给所有订阅用户
    subscribers = await get_subscribers("daily_briefing")
    for user in subscribers:
        await send_notification(user["channel"], user["target"], analysis.content)

    print(f"[{datetime.now()}] 早报已发送给 {len(subscribers)} 位用户")

# 注册任务
scheduler = AgentScheduler()
await scheduler.add_daily_report("daily_briefing", daily_briefing_job, hour=9, minute=0)
scheduler.start()
```

### 知识库定时更新

```python
async def kb_update_job():
    """知识库定时更新"""
    # 1. 检测新文档
    new_docs = await detect_new_documents()

    # 2. 增量索引
    for doc in new_docs:
        chunks = await chunk_document(doc)
        await vectorstore.add_texts(chunks, metadatas=[{"source": doc["path"]}])

    # 3. 检测过期文档
    stale = await detect_stale_documents(days=90)
    for doc in stale:
        await vectorstore.delete(filter={"doc_id": doc["id"]})

    print(f"知识库更新: +{len(new_docs)} 新, -{len(stale)} 过期")

await scheduler.add_custom_cron("kb_update", kb_update_job, "0 2 * * *")  # 每天 2:00
```

### 异常检测任务

```python
async def anomaly_detection_job():
    """每分钟异常检测"""
    # 1. 收集当前指标
    metrics = await collect_current_metrics()

    # 2. 异常检测
    detector = AnomalyDetector()
    anomalies = await detector.detect_all(metrics)

    # 3. 有异常时触发诊断
    if anomalies:
        for anomaly in anomalies:
            # AIOps 诊断
            diagnosis = await IntelligentDiagnosis().diagnose_from_logs(
                error_logs=await get_recent_error_logs(),
                metrics=metrics,
            )

            # 发送告警
            await send_alert(anomaly, diagnosis)

    return {"anomalies": len(anomalies)}

await scheduler.add_interval("anomaly_check", anomaly_detection_job, minutes=1)
```

---

## 5. LangGraph Cron 集成

```python
# LangGraph Platform 内置 Cron 调度

from langgraph_sdk import get_client

async def setup_langgraph_cron():
    """在 LangGraph Platform 上设置 Cron"""
    client = get_client(url=DEPLOYMENT_URL, api_key="...")

    # 创建定时任务
    cron = await client.crons.create(
        thread_id=None,
        assistant_id="assistant",
        schedule="0 9 * * *",  # 每天 9:00
        input={
            "messages": [{"role": "user", "content": "生成今日早报"}]
        },
        metadata={"type": "daily_briefing", "name": "每日早报"},
    )

    print(f"Cron 创建: {cron['cron_id']}")

    # 列出所有定时任务
    crons = await client.crons.list()
    for c in crons:
        print(f"ID: {c['cron_id']}, Schedule: {c['schedule']}")

    # 删除
    # await client.crons.delete(cron_id=cron["cron_id"])
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Cron 表达式语法 | ☐ |
| 实现了 Agent 调度器 | ☐ |
| 实现了每日/每周/间隔任务 | ☐ |
| 实现了自定义 Cron | ☐ |
| 实现了每日早报任务 | ☐ |
| 实现了知识库定时更新 | ☐ |
| 实现了异常检测任务 | ☐ |
| 集成了 LangGraph Cron | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 36 | LLM 应用全生命周期 | 生命周期 |
| 50 | LLM 应用全生命周期管理 | 全生命周期 |
| 84 | 优雅关闭与重启 | 优雅关闭 |
| 153 | 实时数据管道 | 实时 |
| 185 | 实时数据管道 | 实时数据 |
| 227 | 事件驱动架构 | 事件驱动 |
| 244 | 优雅关闭 | 关闭 |
| 259 | 事件驱动 Agent 架构 | 事件驱动 |
| 330 | 消息总线 | 消息 |
| 455 | Agent 数据管道 | 数据管道 |
| 461 | 企业 Agent 集成 | 集成 |
| 486 | Agent Webhook | 事件通知 |
