# Agent 数据迁移与零停机搬迁指南

> 向量库要从 Chroma 换成 Qdrant、数据库要从 MySQL 迁到 PostgreSQL、模型从 GPT-3.5 升到 GPT-4o——这些迁移不能停服。本指南系统讲解数据迁移策略、零停机搬迁技术、双向同步过渡、回滚保障。

---

## 1. 迁移场景与挑战

### 常见迁移场景

| 场景 | 来源 | 目标 | 挑战 |
|------|------|------|------|
| 向量库迁移 | Chroma | Qdrant/Pinecone | 重新 Embedding 或直接迁移 |
| 数据库迁移 | MySQL | PostgreSQL | SQL 方言差异 |
| 模型切换 | GPT-3.5 | GPT-4o | 上下文格式可能变化 |
| 检查点迁移 | SQLite | PostgreSQL | 状态格式转换 |
| 云厂商迁移 | AWS | 阿里云 | API 兼容性 |

### 零停机迁移核心原则

```
1. 双写过渡：新数据同时写入新旧两套系统
2. 渐进读切流：读取流量逐步从旧→新
3. 数据校验：对比新旧数据一致性
4. 回滚保障：发现问题立即切回旧系统
5. 最终清理：确认稳定后停止旧系统
```

---

## 2. 向量库迁移

### 双写迁移

```python
@dataclass
class VectorDBMigration:
    """向量库零停机迁移"""

    def __init__(self, old_store, new_store):
        self.old_store = old_store  # Chroma
        self.new_store = new_store  # Qdrant
        self.migration_mode = "dual_write"  # dual_write | read_new | completed

    async def add_documents(self, texts: list, metadatas: list):
        """双写：同时写入新旧库"""
        # 写旧库
        await self.old_store.add_texts(texts, metadatas)

        # 写新库
        await self.new_store.add_texts(texts, metadatas)

    async def search(self, query: str, k: int = 5):
        """搜索：根据迁移模式选择"""
        if self.migration_mode == "dual_write":
            # 从旧库读
            return await self.old_store.similarity_search(query, k=k)
        elif self.migration_mode == "read_new":
            # 从新库读
            return await self.new_store.similarity_search(query, k=k)
        elif self.migration_mode == "compare":
            # 对比模式：双读+对比
            old_results = await self.old_store.similarity_search(query, k=k)
            new_results = await self.new_store.similarity_search(query, k=k)
            await self._compare_results(old_results, new_results)
            return new_results  # 用新库结果

    async def backfill(self, batch_size: int = 1000):
        """回填：把旧库历史数据迁移到新库"""
        # 1. 获取旧库所有文档 ID
        all_ids = await self.old_store.get_all_ids()

        # 2. 分批迁移
        migrated = 0
        for i in range(0, len(all_ids), batch_size):
            batch_ids = all_ids[i:i + batch_size]
            docs = await self.old_store.get_by_ids(batch_ids)

            # 检查是否已在新库
            existing = await self.new_store.exists(batch_ids)
            new_docs = [d for d, e in zip(docs, existing) if not e]

            if new_docs:
                await self.new_store.add_texts(
                    texts=[d.page_content for d in new_docs],
                    metadatas=[d.metadata for d in new_docs],
                    ids=[d.metadata["id"] for d in new_docs],
                )
                migrated += len(new_docs)

            print(f"迁移进度: {i + len(batch_ids)}/{len(all_ids)} ({migrated} 新增)")

        return {"total": len(all_ids), "migrated": migrated}

    async def verify_consistency(self, sample_size: int = 100):
        """验证数据一致性"""
        import random
        all_ids = await self.old_store.get_all_ids()
        sample_ids = random.sample(all_ids, min(sample_size, len(all_ids)))

        mismatches = 0
        for doc_id in sample_ids:
            old_doc = await self.old_store.get_by_id(doc_id)
            new_doc = await self.new_store.get_by_id(doc_id)

            if not new_doc:
                mismatches += 1
                continue

            if old_doc.page_content != new_doc.page_content:
                mismatches += 1

        return {
            "sample_size": len(sample_ids),
            "mismatches": mismatches,
            "consistency_rate": 1 - mismatches / len(sample_ids) if sample_ids else 1,
        }

    async def cutover(self):
        """切换：完全使用新库"""
        # 1. 最后一次同步
        await self.backfill()

        # 2. 一致性检查
        consistency = await self.verify_consistency()
        if consistency["consistency_rate"] < 0.99:
            raise MigrationError(f"一致性不足: {consistency['consistency_rate']:.2%}")

        # 3. 切换读流量
        self.migration_mode = "read_new"

        # 4. 停止双写（观察期后）
        # self.migration_mode = "completed"
```

---

## 3. 数据库迁移

### 在线迁移流程

```python
@dataclass
class DatabaseMigration:
    """数据库零停机迁移"""

    async def migrate(self, old_db, new_db):
        """迁移流程"""
        # 阶段1: 结构迁移
        await self._migrate_schema(old_db, new_db)

        # 阶段2: 全量数据复制
        await self._bulk_copy(old_db, new_db)

        # 阶段3: 增量同步（CDC）
        sync_task = await self._start_cdc_sync(old_db, new_db)

        # 阶段4: 双写
        await self._enable_dual_write(old_db, new_db)

        # 阶段5: 读切流（10%→50%→100%）
        await self._gradual_read_cutover(new_db)

        # 阶段6: 停止旧库写入
        await self._stop_old_writes(old_db)

        # 阶段7: 停止 CDC
        sync_task.stop()

        # 阶段8: 验证+清理
        await self._verify(old_db, new_db)

    async def _migrate_schema(self, old_db, new_db):
        """结构迁移"""
        # MySQL → PostgreSQL 的 DDL 转换
        # 类型映射：INT → INTEGER, VARCHAR → TEXT, etc.

    async def _bulk_copy(self, old_db, new_db):
        """全量复制"""
        tables = await old_db.get_tables()
        for table in tables:
            count = await old_db.count(table)
            batch_size = 10000
            for offset in range(0, count, batch_size):
                rows = await old_db.select(table, offset=offset, limit=batch_size)
                await new_db.batch_insert(table, rows)
            print(f"  {table}: {count} 行已复制")

    async def _start_cdc_sync(self, old_db, new_db):
        """CDC 增量同步"""
        # 使用 Debezium/Canal 监听 binlog
        # 增量变更实时同步到新库

    async def _enable_dual_write(self, old_db, new_db):
        """启用双写"""
        # 新数据同时写入两个库
        pass

    async def _gradual_read_cutover(self, new_db):
        """渐进式读切流"""
        percentages = [0.1, 0.25, 0.5, 0.75, 1.0]
        for pct in percentages:
            await self._set_read_ratio(new_db, pct)
            print(f"  读切流: {pct:.0%}")
            await asyncio.sleep(300)  # 观察 5 分钟

    async def _verify(self, old_db, new_db):
        """验证"""
        # 对比行数
        # 对比关键记录
        pass
```

---

## 4. 模型切换迁移

```python
@dataclass
class ModelMigration:
    """模型切换迁移"""

    async def migrate_model(self, old_model: str, new_model: str):
        """模型切换"""
        # 1. 新旧模型并行运行
        old_llm = ChatOpenAI(model=old_model, temperature=0)
        new_llm = ChatOpenAI(model=new_model, temperature=0)

        # 2. 灰度切流
        traffic_split = 0.0
        while traffic_split < 1.0:
            # 按比例路由
            if self._should_use_new(traffic_split):
                result = await new_llm.ainvoke(query)
            else:
                result = await old_llm.ainvoke(query)

            # 3. 对比质量
            if traffic_split < 0.5:
                old_result = await old_llm.ainvoke(query)
                new_result = await new_llm.ainvoke(query)
                quality_diff = await self._compare_quality(old_result, new_result)
                if quality_diff < 0.8:
                    print(f"⚠️ 新模型质量下降: {quality_diff}")
                    traffic_split = 0  # 回退
                    break

            traffic_split += 0.1

        # 4. 完全切换
        return {"migrated_to": new_model, "traffic": "100%"}

    async def _compare_quality(self, old_result, new_result) -> float:
        """对比新旧模型输出质量"""
        judge = ChatOpenAI(model="gpt-4o", temperature=0)
        response = await judge.ainvoke(
            f"比较两个回答的质量。新回答是否不劣于旧回答？只回答 0-1 分数。\n\n旧: {old_result.content[:500]}\n新: {new_result.content[:500]}"
        )
        try:
            return float(response.content.strip())
        except:
            return 0.8
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解零停机迁移原则 | ☐ |
| 实现了向量库双写迁移 | ☐ |
| 实现了数据库全量+增量迁移 | ☐ |
| 实现了渐进式读切流 | ☐ |
| 实现了数据一致性校验 | ☐ |
| 实现了模型灰度切换 | ☐ |
| 有回滚保障 | ☐ |
| 有迁移验证 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 44 | 知识库增量更新 | 增量 |
| 218 | 增量更新 | 增量 |
| 250 | 知识库增量更新 | 增量 |
| 301 | 向量数据库图解 | 向量库 |
| 368 | 向量库选型决策树 | 选型 |
| 374 | 版本兼容与平滑迁移 | 迁移 |
| 490 | 版本兼容与平滑升级 | 升级 |
| 492 | 异地多活与灾难恢复 | 灾备 |
