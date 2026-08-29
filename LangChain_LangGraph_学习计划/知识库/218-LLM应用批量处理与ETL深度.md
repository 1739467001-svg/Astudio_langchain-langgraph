# LLM 应用批量处理与 ETL 深度

> 有些场景不是一问一答——而是批量处理 1000 个文档：分类、摘要、提取。逐个调 LLM 太慢，需要批量优化。

---

## 一、批量处理架构

```mermaid
graph TB
    subgraph 批量 {"批量处理流程"}
        QUEUE["任务队列<br/>1000个文档"] --> BATCH["分批<br/>每批20个"]
        BATCH --> CONCURRENCY["并发执行<br/>5批同时"]
        CONCURRENCY --> COLLECT["收集结果"]
        COLLECT --> HANDLE["错误处理<br/>失败重试"]
        HANDLE --> OUTPUT["输出结果"]
    end

    style BATCH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style CONCURRENCY fill:#E3F2FD
    style OUTPUT fill:#C8E6C9
```

---

## 二、批量处理器

```python
import asyncio
from dataclasses import dataclass, field
from typing import Callable, Any
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class BatchTask:
    """批量任务。"""
    task_id: str
    input_data: Any
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: str = ""
    retry_count: int = 0

@dataclass
class BatchConfig:
    """批量配置。"""
    batch_size: int = 20          # 每批数量
    max_concurrency: int = 5      # 最大并发
    max_retries: int = 2          # 最大重试
    timeout_per_task: int = 30    # 单任务超时(秒)

class BatchProcessor:
    """批量处理器。"""

    def __init__(self, config: BatchConfig = BatchConfig()):
        self.config = config
        self.results: list[BatchTask] = []
        self.stats = {
            "total": 0, "completed": 0, "failed": 0,
            "start_time": None, "end_time": None,
        }

    async def process(
        self,
        tasks: list[Any],
        handler: Callable,
    ) -> list[BatchTask]:
        """批量处理任务。"""
        self.stats["total"] = len(tasks)
        self.stats["start_time"] = datetime.now().isoformat()

        batch_tasks = [
            BatchTask(task_id=f"task_{i}", input_data=data)
            for i, data in enumerate(tasks)
        ]

        # 分批并发执行
        semaphore = asyncio.Semaphore(self.config.max_concurrency)

        async def process_one(task: BatchTask):
            async with semaphore:
                for attempt in range(self.config.max_retries + 1):
                    try:
                        result = await asyncio.wait_for(
                            handler(task.input_data),
                            timeout=self.config.timeout_per_task,
                        )
                        task.result = result
                        task.status = TaskStatus.COMPLETED
                        self.stats["completed"] += 1
                        return
                    except asyncio.TimeoutError:
                        task.error = f"超时（{self.config.timeout_per_task}秒）"
                    except Exception as e:
                        task.error = str(e)[:200]

                    task.retry_count = attempt + 1

                task.status = TaskStatus.FAILED
                self.stats["failed"] += 1

        # 并发执行所有任务
        await asyncio.gather(*[process_one(t) for t in batch_tasks])

        self.results = batch_tasks
        self.stats["end_time"] = datetime.now().isoformat()

        return batch_tasks

    def report(self) -> dict:
        """生成报告。"""
        return {
            **self.stats,
            "success_rate": round(
                self.stats["completed"] / max(self.stats["total"], 1), 4
            ),
            "failures": [
                {"task_id": t.task_id, "error": t.error}
                for t in self.results if t.status == TaskStatus.FAILED
            ][:10],
        }


class ETLProcessor:
    """ETL处理器——提取→转换→加载。"""

    @staticmethod
    async def extract(file_paths: list[str]) -> list[dict]:
        """提取阶段。"""
        results = []
        for path in file_paths:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                results.append({"source": path, "content": content})
            except Exception as e:
                results.append({"source": path, "error": str(e)})
        return results

    @staticmethod
    async def transform(documents: list[dict], handler: Callable, batch_config: BatchConfig = None) -> list[dict]:
        """转换阶段——批量LLM处理。"""
        config = batch_config or BatchConfig()
        processor = BatchProcessor(config)

        tasks = [d.get("content", "") for d in documents if "content" in d]
        results = await processor.process(tasks, handler)

        # 合并结果
        for doc, result in zip(documents, results):
            if result.status == TaskStatus.COMPLETED:
                doc["transformed"] = result.result
            else:
                doc["error"] = result.error

        return documents

    @staticmethod
    def load(documents: list[dict], vectorstore) -> dict:
        """加载阶段——入向量库。"""
        from langchain_core.documents import Document
        valid = [d for d in documents if "transformed" in d]
        docs = [
            Document(page_content=d["transformed"], metadata={"source": d["source"]})
            for d in valid
        ]
        if docs:
            vectorstore.add_documents(docs)
        return {"loaded": len(docs), "failed": len(documents) - len(valid)}
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 分批处理 | 避免内存溢出 | ★★★ |
| 控制并发 | 不超API限制 | ★★★ |
| 有重试机制 | 单个失败不影响整体 | ★★★ |
| 超时设置 | 防止卡住 | ★★★ |
| 批量API更省钱 | 50%折扣 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有批量处理器 | ☐ |
| 有并发控制 | ☐ |
| 有重试机制 | ☐ |
| 有ETL管线 | ☐ |
