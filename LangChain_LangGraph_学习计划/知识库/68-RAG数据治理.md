# RAG 数据治理

> 知识库不是"建好就不管了"。数据治理确保知识库持续准确、新鲜、可追溯。

---

## 一、数据治理全景

```mermaid
graph TB
    subgraph 数据治理 {"RAG 数据治理五维度"}
        D1["📐 质量<br/>准确/完整/无冗余"]
        D2["🔄 时效<br/>定期更新/过期清理"]
        D3["🏷️ 目录<br/>分类/标签/可检索"]
        D4["👤 权限<br/>谁可以看什么"]
        D5["📋 审计<br/>谁改了什么/何时改的"]
    end

    style 数据治理 fill:'#E3F2FD'
```

## 二、数据生命周期

```mermaid
graph LR
    subgraph 生命周期 {"知识库数据生命周期"}
        C["收集<br/>文档来源"] --> V["审核<br/>质量检查"]
        V --> I["入库<br/>向量化"]
        I --> U["使用<br/>检索问答"]
        U --> M["监控<br/>效果追踪"]
        M --> R["更新/归档<br/>定期维护"]
        R --> C
    end

    style C fill:'#C8E6C9'
    style R fill:'#FFE0B2'
```

## 三、数据目录管理

```python
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class DocumentRecord(BaseModel):
    """文档元数据记录（数据目录）"""
    doc_id: str                      # 文档ID
    title: str                        # 标题
    source: str                       # 来源(文件名/URL)
    category: str                     # 分类
    tags: list[str] = []              # 标签
    created_at: str = ""              # 创建时间
    updated_at: str = ""              # 更新时间
    chunk_count: int = 0              # 分块数
    status: str = "active"            # 状态: active/archived/pending
    owner: str = ""                   # 负责人
    version: str = "1.0"              # 版本

class DataCatalog:
    """数据目录管理器"""
    def __init__(self):
        self.records = {}  # 实际用数据库

    def register(self, record: DocumentRecord):
        """注册新文档"""
        record.created_at = datetime.now().isoformat()
        record.updated_at = record.created_at
        self.records[record.doc_id] = record

    def update_status(self, doc_id: str, status: str):
        """更新状态"""
        if doc_id in self.records:
            self.records[doc_id].status = status
            self.records[doc_id].updated_at = datetime.now().isoformat()

    def list_by_category(self, category: str) -> list:
        """按分类列出"""
        return [r for r in self.records.values() if r.category == category and r.status == "active"]

    def find_stale(self, days: int = 90) -> list:
        """查找过时文档"""
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)
        return [
            r for r in self.records.values()
            if r.status == "active"
            and datetime.fromisoformat(r.updated_at) < cutoff
        ]

    def archive(self, doc_id: str):
        """归档文档"""
        self.update_status(doc_id, "archived")
```

## 四、数据质量监控

```python
class DataQualityMonitor:
    """数据质量监控器"""
    def __init__(self, catalog: DataCatalog):
        self.catalog = catalog

    def check_completeness(self) -> dict:
        """检查完整性：是否有缺失元数据"""
        records = list(self.catalog.records.values())
        issues = []
        for r in records:
            if not r.title:
                issues.append(f"{r.doc_id}: 缺少标题")
            if not r.category:
                issues.append(f"{r.doc_id}: 缺少分类")
            if r.chunk_count == 0:
                issues.append(f"{r.doc_id}: 无文档块")
        return {"total": len(records), "issues": issues}

    def check_freshness(self, max_days: int = 90) -> dict:
        """检查时效性：是否有过时文档"""
        stale = self.catalog.find_stale(max_days)
        return {
            "total_active": len([r for r in self.catalog.records.values() if r.status == "active"]),
            "stale_count": len(stale),
            "stale_docs": [r.doc_id for r in stale],
        }

    def check_duplicates(self, vectorstore) -> dict:
        """检查重复内容"""
        # 简化：检查相似度高的文档对
        # 实际中需要对比所有文档对
        return {"duplicates": "需要手动检查"}

    def report(self) -> str:
        """生成质量报告"""
        completeness = self.check_completeness()
        freshness = self.check_freshness()

        report = f"""=== 数据质量报告 ===
总文档数: {completeness['total']}
活跃文档: {freshness['total_active']}
过时文档: {freshness['stale_count']}
质量问题: {len(completeness['issues'])}

问题详情:"""
        for issue in completeness['issues'][:10]:
            report += f"\n  ⚠️ {issue}"

        return report
```

## 五、数据治理检查表

| 维度 | 检查项 | 频率 |
|------|--------|------|
| 质量 | 文档内容是否准确 | 入库时 |
| 质量 | 是否有重复文档 | 每月 |
| 时效 | 是否有过时文档 | 每月 |
| 时效 | 文档是否及时更新 | 每周 |
| 目录 | 每个文档有分类和标签 | 入库时 |
| 目录 | 分类体系是否合理 | 每季度 |
| 权限 | 敏感文档是否受限 | 入库时 |
| 审计 | 变更是否有记录 | 每次变更 |
| 监控 | 检索质量是否下降 | 每周 |

## 六、治理流程

```mermaid
graph TB
    subgraph 治理流程 {"数据治理周循环"}
        W1["周一: 质量报告<br/>检查完整性和时效性"]
        W1 --> W2["周二: 清理过时<br/>归档/更新"]
        W2 --> W3["周三-四: 更新文档<br/>新文档入库"]
        W3 --> W4["周五: 效果评估<br/>用测试集检查检索质量"]
        W4 --> W1
    end

    style W1 fill:'#E3F2FD'
    style W4 fill:'#C8E6C9'
```
