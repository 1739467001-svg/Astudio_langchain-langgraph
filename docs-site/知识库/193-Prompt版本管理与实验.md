# Prompt 版本管理与实验

> Prompt 是 LLM 应用中变更最频繁的部分——改一个词可能让效果天翻地覆。但 Prompt 变更需要版本管理、A/B 实验、效果对比和回滚能力。

---

## 一、Prompt 版本管理架构

```mermaid
graph TB
    subgraph 管理 &#123;"Prompt版本管理"&#125;
        DRAFT["草稿版本"] --> TEST["测试版本"]
        TEST --> ACTIVE["活跃版本"]
        ACTIVE --> ARCHIVE["归档版本"]
        ARCHIVE -->|"回滚"| ACTIVE
    end

    style ACTIVE fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、Prompt 注册表

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

class PromptStatus(str, Enum):
    DRAFT = "draft"
    TESTING = "testing"
    ACTIVE = "active"
    ARCHIVED = "archived"

@dataclass
class PromptVersion:
    """Prompt版本。"""
    version: str               # v1.0, v1.1, v2.0
    content: str                # Prompt文本
    description: str            # 变更说明
    status: PromptStatus = PromptStatus.DRAFT
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    created_by: str = ""
    metrics: dict = field(default_factory=dict)  # 评估指标
    parent_version: Optional[str] = None  # 基于哪个版本

class PromptRegistry:
    """Prompt版本注册表。"""

    def __init__(self):
        self.prompts: dict[str, list[PromptVersion]] = &#123;&#125;  # &#123;name: [versions]&#125;

    def register(self, name: str, version: PromptVersion):
        """注册新版本。"""
        if name not in self.prompts:
            self.prompts[name] = []
        self.prompts[name].append(version)

    def get_active(self, name: str) -> Optional[PromptVersion]:
        """获取活跃版本。"""
        for v in reversed(self.prompts.get(name, [])):
            if v.status == PromptStatus.ACTIVE:
                return v
        return None

    def get_version(self, name: str, version: str) -> Optional[PromptVersion]:
        """获取指定版本。"""
        for v in self.prompts.get(name, []):
            if v.version == version:
                return v
        return None

    def activate(self, name: str, version: str):
        """激活版本。"""
        for v in self.prompts.get(name, []):
            if v.version == version:
                v.status = PromptStatus.ACTIVE
            elif v.status == PromptStatus.ACTIVE:
                v.status = PromptStatus.ARCHIVED

    def rollback(self, name: str) -> Optional[PromptVersion]:
        """回滚到上一个版本。"""
        versions = self.prompts.get(name, [])
        active_idx = None
        for i, v in enumerate(versions):
            if v.status == PromptStatus.ACTIVE:
                active_idx = i
                break

        if active_idx is not None and active_idx > 0:
            versions[active_idx].status = PromptStatus.ARCHIVED
            versions[active_idx - 1].status = PromptStatus.ACTIVE
            return versions[active_idx - 1]
        return None

    def diff(self, name: str, v1: str, v2: str) -> dict:
        """对比两个版本的差异。"""
        pv1 = self.get_version(name, v1)
        pv2 = self.get_version(name, v2)
        if not pv1 or not pv2:
            return &#123;"error": "版本不存在"&#125;

        lines1 = pv1.content.split("\n")
        lines2 = pv2.content.split("\n")

        added = [l for l in lines2 if l not in lines1]
        removed = [l for l in lines1 if l not in lines2]

        return &#123;
            "v1": v1, "v2": v2,
            "added_lines": added,
            "removed_lines": removed,
            "v1_length": len(pv1.content),
            "v2_length": len(pv2.content),
        &#125;

    def history(self, name: str) -> list[dict]:
        """获取版本历史。"""
        return [
            &#123;
                "version": v.version,
                "status": v.status.value,
                "description": v.description,
                "created_at": v.created_at,
                "metrics": v.metrics,
            &#125;
            for v in self.prompts.get(name, [])
        &#125;
```

---

## 三、Prompt 实验

```python
class PromptExperiment:
    """Prompt A/B实验。"""

    def __init__(self, registry: PromptRegistry):
        self.registry = registry

    async def run_experiment(
        self,
        prompt_name: str,
        variant_a_version: str,
        variant_b_version: str,
        test_cases: list[str],
        evaluate_func: callable,
    ) -> dict:
        """运行Prompt版本对比实验。"""
        prompt_a = self.registry.get_version(prompt_name, variant_a_version)
        prompt_b = self.registry.get_version(prompt_name, variant_b_version)

        if not prompt_a or not prompt_b:
            return &#123;"error": "版本不存在"&#125;

        results_a = []
        results_b = []

        for query in test_cases:
            score_a = await evaluate_func(prompt_a.content, query)
            score_b = await evaluate_func(prompt_b.content, query)
            results_a.append(score_a)
            results_b.append(score_b)

        avg_a = sum(results_a) / len(results_a) if results_a else 0
        avg_b = sum(results_b) / len(results_b) if results_b else 0

        return &#123;
            "variant_a": &#123;
                "version": variant_a_version,
                "avg_score": round(avg_a, 4),
                "scores": results_a,
            &#125;,
            "variant_b": &#123;
                "version": variant_b_version,
                "avg_score": round(avg_b, 4),
                "scores": results_b,
            &#125;,
            "delta": round(avg_b - avg_a, 4),
            "winner": variant_b_version if avg_b > avg_a else variant_a_version,
            "recommendation": f"采用&#123;variant_b_version if avg_b > avg_a else variant_a_version&#125;",
        &#125;
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| Prompt有版本号 | v1.0/v1.1/v2.0 | ★★★ |
| 每次变更有说明 | 为什么改 | ★★★ |
| 变更前先测试 | 不直接激活 | ★★★ |
| 可回滚 | 秒级回退 | ★★★ |
| 记录评估指标 | 数据驱动 | ★★☆ |
| 大变更用A/B | 小变更直接激活 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有Prompt注册表 | ☐ |
| 有版本状态管理 | ☐ |
| 有回滚能力 | ☐ |
| 有版本对比 | ☐ |
| 有A/B实验 | ☐ |
