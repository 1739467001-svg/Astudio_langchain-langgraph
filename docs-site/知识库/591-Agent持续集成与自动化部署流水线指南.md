# Agent 持续集成与自动化部署流水线指南

> Agent 代码改了→自动测试→自动构建→自动部署→自动验证。本指南深度讲解 CI/CD 流水线设计、测试自动化、蓝绿/金丝雀发布、自动回滚。

---

## 1. CI/CD 流水线

```mermaid
graph LR
    PUSH["代码推送"] --> LINT["Lint"] --> TEST["测试"] --> BUILD["构建"] --> SCAN["安全扫描"]
    SCAN --> EVAL["LLM评估"] --> DEPLOY_STG["测试环境"] --> E2E["端到端"] --> CANARY["金丝雀"] --> PROD["生产"]

    style EVAL fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CANARY fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 自动化测试链

```python
@dataclass
class CICDPipeline:
    """CI/CD 流水线"""

    async def run_pipeline(self, commit_sha: str) -> dict:
        """执行完整流水线"""
        stages = []

        # Stage 1: Lint
        lint = await self._run_lint()
        stages.append(&#123;"stage": "lint", "passed": lint["success"]&#125;)
        if not lint["success"]:
            return self._fail("lint", stages)

        # Stage 2: 单元测试
        unit = await self._run_unit_tests()
        stages.append(&#123;"stage": "unit_test", "passed": unit["passed"], "coverage": unit["coverage"]&#125;)
        if not unit["passed"]:
            return self._fail("unit_test", stages)

        # Stage 3: 构建
        build = await self._build_image(commit_sha)
        stages.append(&#123;"stage": "build", "passed": True, "image": build["image"]&#125;)

        # Stage 4: 安全扫描
        security = await self._security_scan(build["image"])
        stages.append(&#123;"stage": "security", "passed": security["vulnerabilities"] == 0&#125;)

        # Stage 5: LLM 质量评估
        eval_result = await self._llm_evaluation()
        stages.append(&#123;"stage": "llm_eval", "passed": eval_result["pass_rate"] >= 0.8&#125;)

        # Stage 6: 金丝雀发布
        if all(s["passed"] for s in stages):
            canary = await self._canary_deploy(build["image"])
            stages.append(&#123;"stage": "canary", "passed": canary["healthy"]&#125;)

            if canary["healthy"]:
                await self._full_deploy(build["image"])
                stages.append(&#123;"stage": "production", "passed": True&#125;)
            else:
                await self._rollback()
                stages.append(&#123;"stage": "rollback", "reason": "金丝雀不健康"&#125;)

        return &#123;"commit": commit_sha, "stages": stages, "success": all(s.get("passed", False) for s in stages)&#125;

    async def _llm_evaluation(self) -> dict:
        """LLM 质量评估"""
        # 使用 DeepEval/Ragas 运行评估集
        return &#123;"pass_rate": 0.85, "total": 50, "passed": 42&#125;

    async def _canary_deploy(self, image: str) -> dict:
        """金丝雀发布"""
        # 部署 5% 流量到新版本
        await self._update_traffic(new_percent=5)
        await asyncio.sleep(300)  # 观察 5 分钟
        healthy = await self._check_health()
        if healthy:
            # 逐步放量
            for pct in [25, 50, 100]:
                await self._update_traffic(new_percent=pct)
                await asyncio.sleep(120)
                if not await self._check_health():
                    return &#123;"healthy": False&#125;
        return &#123;"healthy": True&#125;
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了完整 CI/CD 流水线 | ☐ |
| 集成了 LLM 质量评估 | ☐ |
| 实现了金丝雀发布 | ☐ |
| 实现了自动回滚 | ☐ |
| 有安全扫描 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 22 | CI/CD 流水线 | CI/CD |
| 504 | DevOps 与 CI/CD | DevOps |
| 568 | 自动化测试 | 测试 |
| 590 | 安全审计 | 安全 |
| 481 | 变更管理与发布 | 变更 |
