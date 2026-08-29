# LLM 应用批量处理与 ETL 最新

> 知识库 61 有 220 行、知识库 218 有深度。这篇整合为最新——批量处理配置、并发控制和 ETL 管线。

---

## 一、批量处理架构

```mermaid
graph TB
    subgraph 批量 {"批量处理流程"}
        QUEUE["任务队列"] --> BATCH["分批<br/>每批20个"]
        BATCH --> CONCURRENT["并发执行<br/>5批同时"]
        CONCURRENT --> COLLECT["收集结果"]
        COLLECT --> RETRY["失败重试"]
        RETRY --> OUTPUT["输出"]
    end

    style BATCH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style OUTPUT fill:#C8E6C9
```

---

## 二、实现

```python
import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Any

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class BatchConfig:
    """批量配置。"""
    batch_size: int = 20
    max_concurrency: int = 5
    max_retries: int = 2
    timeout_per_task: int = 30

@dataclass
class BatchTask:
    """批量任务。"""
    task_id: str
    input_data: Any
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: str = ""
    retry_count: int = 0

class BatchProcessor:
    """批量处理器。"""

    def __init__(self, config: BatchConfig = BatchConfig()):
        self.config = config
        self.results: list[BatchTask] = []

    async def process(self, tasks: list[Any], handler: Callable) -> dict:
        """批量处理。"""
        self.results = []
        batch_tasks = [BatchTask(task_id=f"t_{i}", input_data=data) for i, data in enumerate(tasks)]
        semaphore = asyncio.Semaphore(self.config.max_concurrency)

        async def run_one(task: BatchTask):
            async with semaphore:
                for attempt in range(self.config.max_retries + 1):
                    try:
                        result = await asyncio.wait_for(
                            handler(task.input_data),
                            timeout=self.config.timeout_per_task,
                        )
                        task.result = result
                        task.status = TaskStatus.COMPLETED
                        return
                    except asyncio.TimeoutError:
                        task.error = "超时"
                    except Exception as e:
                        task.error = str(e)[:200]
                    task.retry_count = attempt + 1
                task.status = TaskStatus.FAILED

        await asyncio.gather(*[run_one(t) for t in batch_tasks])
        self.results = batch_tasks

        completed = sum(1 for t in batch_tasks if t.status == TaskStatus.COMPLETED)
        failed = sum(1 for t in batch_tasks if t.status == TaskStatus.FAILED)

        return {
            "total": len(tasks),
            "completed": completed,
            "failed": failed,
            "success_rate": round(completed / max(len(tasks), 1), 4),
            "failures": [{"id": t.task_id, "error": t.error} for t in batch_tasks if t.status == TaskStatus.FAILED][:5],
        }


class ETLProcessor:
    """ETL处理器。"""

    @staticmethod
    async def extract(file_paths: list[str]) -> list[dict]:
        """提取。"""
        results = []
        for path in file_paths:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    results.append({"source": path, "content": f.read()})
            except Exception as e:
                results.append({"source": path, "error": str(e)})
        return results

    @staticmethod
    async def transform(documents: list[dict], handler: Callable, config: BatchConfig = None) -> list[dict]:
        """转换——批量LLM处理。"""
        config = config or BatchConfig()
        processor = BatchProcessor(config)
        contents = [d.get("content", "") for d in documents if "content" in d]
        await processor.process(contents, handler)

        for doc, result in zip(documents, processor.results):
            if result.status == TaskStatus.COMPLETED:
                doc["transformed"] = result.result
            else:
                doc["error"] = result.error
        return documents

    @staticmethod
    def load(documents: list[dict], vectorstore) -> dict:
        """加载——入向量库。"""
        from langchain_core.documents import Document
        valid = [d for d in documents if "transformed" in d]
        docs = [Document(page_content=d["transformed"], metadata={"source": d["source"]}) for d in valid]
        if docs:
            vectorstore.add_documents(docs)
        return {"loaded": len(docs), "failed": len(documents) - len(valid)}
```

---

## 三、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 分批处理 | 防内存溢出 | ★★★ |
| 控制并发 | 不超API限制 | ★★★ |
| 有重试机制 | 单个失败不影响整体 | ★★★ |
| 超时设置 | 防止卡住 | ★★★ |
| 批量API更省钱 | 50%折扣 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有批量处理器 | ☐ |
| 有ETL管线 | ☐ |
| 有并发控制 | ☐ |
