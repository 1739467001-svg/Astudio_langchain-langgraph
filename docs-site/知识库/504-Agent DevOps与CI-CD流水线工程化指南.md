# Agent DevOps 与 CI/CD 流水线工程化指南

> Agent 代码改了→测试→构建→部署，不能靠手动。CI/CD 流水线让整个过程自动化：提交代码触发测试、质量门禁通过自动部署、失败自动回滚。本指南系统讲解 Agent 的 CI/CD 流水线设计、测试金字塔、质量门禁、自动部署策略。

---

## 1. CI/CD 流水线全貌

### 流水线阶段

```mermaid
graph LR
    COMMIT["代码提交"] --> LINT["Lint 检查"] --> UNIT["单元测试"] --> BUILD["构建镜像"]
    BUILD --> INTEGRATION["集成测试"] --> SECURITY["安全扫描"] --> EVAL["LLM 评估"]
    EVAL --> STAGING["部署测试环境"] --> E2E["端到端测试"] --> CANARY["金丝雀发布"]
    CANARY --> PROD["生产部署"]

    style COMMIT fill:#E3F2FD,stroke:#1565C0
    style EVAL fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style CANARY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 测试金字塔

```
        /\
       /e2e\        端到端测试（少量，慢，最真实）
      /------\
     /integration\   集成测试（中等，验证组件交互）
    /------------\
   /   unit tests  \  单元测试（大量，快，隔离）
  /----------------\
 /   lint & type    \  静态检查（最多，最快）
/--------------------\
```

---

## 2. GitHub Actions 流水线

### 完整 CI/CD 配置

```yaml
# .github/workflows/agent-cicd.yml
name: Agent CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: $&#123;&#123; github.repository &#125;&#125;

jobs:
  # 阶段1: 代码质量
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install ruff mypy
      - run: ruff check src/
      - run: mypy src/ --ignore-missing-imports

  # 阶段2: 单元测试
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r requirements.txt pytest pytest-cov
      - run: pytest tests/unit/ --cov=src --cov-report=xml
      - run: |
          # 覆盖率检查
          COVERAGE=$(python -c "import xml.etree.ElementTree as ET; tree=ET.parse('coverage.xml'); print(tree.getroot().attrib['line-rate'])")
          if (( $(echo "$COVERAGE < 0.7" | bc -l) )); then
            echo "❌ 覆盖率 $COVERAGE 低于 70%"
            exit 1
          fi

  # 阶段3: 构建 Docker 镜像
  build:
    needs: [lint, unit-test]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: $&#123;&#123; env.REGISTRY &#125;&#125;
          username: $&#123;&#123; github.actor &#125;&#125;
          password: $&#123;&#123; secrets.GITHUB_TOKEN &#125;&#125;
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            $&#123;&#123; env.REGISTRY &#125;&#125;/$&#123;&#123; env.IMAGE_NAME &#125;&#125;:$&#123;&#123; github.sha &#125;&#125;
            $&#123;&#123; env.REGISTRY &#125;&#125;/$&#123;&#123; env.IMAGE_NAME &#125;&#125;:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # 阶段4: LLM 评估测试
  llm-eval:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install deepeval ragas
      - run: |
          # 运行 LLM 质量评估
          pytest tests/eval/ --deepeval
        env:
          OPENAI_API_KEY: $&#123;&#123; secrets.OPENAI_API_KEY &#125;&#125;
      - name: 质量门禁
        run: |
          # 检查通过率
          python scripts/check_eval_results.py --min-pass-rate 0.8

  # 阶段5: 安全扫描
  security-scan:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 依赖漏洞扫描
        run: |
          pip install safety
          safety check --output json
      - name: Prompt 注入测试
        run: |
          python scripts/red_team_test.py
        env:
          OPENAI_API_KEY: $&#123;&#123; secrets.OPENAI_API_KEY &#125;&#125;

  # 阶段6: 部署到测试环境
  deploy-staging:
    needs: [llm-eval, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: |
          echo "部署到测试环境..."
          kubectl set image deployment/agent-staging \
            agent=$&#123;&#123; env.REGISTRY &#125;&#125;/$&#123;&#123; env.IMAGE_NAME &#125;&#125;:$&#123;&#123; github.sha &#125;&#125;

  # 阶段7: 金丝雀发布到生产
  deploy-canary:
    needs: deploy-staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production-canary
      url: https://agent.example.com
    steps:
      - name: Canary Release (10%)
        run: |
          echo "金丝雀发布 10%..."
          kubectl apply -f k8s/canary-10.yaml

      - name: 等待观察
        run: sleep 300  # 观察 5 分钟

      - name: 检查健康
        run: |
          HEALTH=$(curl -s https://agent.example.com/health | jq .status)
          if [ "$HEALTH" != "healthy" ]; then
            echo "❌ 健康检查失败，回滚"
            kubectl rollout undo deployment/agent-production
            exit 1
          fi

      - name: 全量发布
        run: |
          echo "全量发布..."
          kubectl apply -f k8s/production.yaml
```

---

## 3. Agent 测试策略

### 测试层级

```python
# tests/unit/test_prompt.py — 单元测试
import pytest

def test_system_prompt_contains_safety_rules():
    """测试 System Prompt 包含安全规则"""
    prompt = get_system_prompt()
    assert "不要泄露" in prompt
    assert "拒绝有害" in prompt

def test_tool_schema_valid():
    """测试工具 Schema 有效"""
    from pydantic import BaseModel
    for tool in all_tools:
        # 每个 Schema 必须是有效的 JSON Schema
        schema = tool.args_schema.model_json_schema()
        assert "properties" in schema
```

```python
# tests/integration/test_agent_flow.py — 集成测试
import pytest

@pytest.mark.asyncio
async def test_agent_with_tools():
    """测试 Agent + 工具集成"""
    agent = create_react_agent(model, [search_tool, calc_tool])
    result = await agent.ainvoke(&#123;"messages": [
        &#123;"role": "user", "content": "搜索 LangChain 并计算其 GitHub stars 的平方"&#125;
    ]&#125;)

    assert result["messages"][-1].content is not None
    # 验证调用了搜索工具
    tool_calls = [m for m in result["messages"] if hasattr(m, "tool_calls") and m.tool_calls]
    assert len(tool_calls) > 0
```

```python
# tests/eval/test_quality.py — LLM 评估测试
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

@pytest.mark.asyncio
async def test_rag_quality():
    """测试 RAG 回答质量"""
    response = await rag_agent.ainvoke("什么是 LCEL？")

    test_case = LLMTestCase(
        input="什么是 LCEL？",
        actual_output=response.content,
        expected_output="LangChain Expression Language",
        retrieval_context=["LCEL 是 LangChain 表达式语言..."],
    )

    metrics = [
        AnswerRelevancyMetric(threshold=0.7),
        FaithfulnessMetric(threshold=0.8),
    ]

    assert_test(test_case, metrics)
```

---

## 4. 质量门禁

```python
@dataclass
class QualityGate:
    """CI/CD 质量门禁"""

    gates = &#123;
        "lint": &#123;"required": True, "blocking": True&#125;,
        "unit_test_coverage": &#123;"threshold": 0.70, "blocking": True&#125;,
        "integration_test": &#123;"required": True, "blocking": True&#125;,
        "llm_eval_pass_rate": &#123;"threshold": 0.80, "blocking": True&#125;,
        "security_scan": &#123;"max_vulnerabilities": 0, "blocking": True&#125;,
        "prompt_injection_test": &#123;"max_failures": 0, "blocking": True&#125;,
        "performance_baseline": &#123;"max_regression_pct": 0.10, "blocking": False&#125;,
    &#125;

    def check(self, results: dict) -> dict:
        """检查所有门禁"""
        gate_results = &#123;&#125;
        all_passed = True

        for gate_name, config in self.gates.items():
            result = results.get(gate_name, &#123;&#125;)
            passed = self._check_gate(gate_name, config, result)
            gate_results[gate_name] = &#123;
                "passed": passed,
                "blocking": config.get("blocking", False),
                "result": result,
            &#125;
            if not passed and config.get("blocking"):
                all_passed = False

        return &#123;
            "all_passed": all_passed,
            "gates": gate_results,
            "action": "可部署" if all_passed else "阻止部署",
        &#125;
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 配置了完整 CI/CD 流水线 | ☐ |
| 实现了测试金字塔（单元/集成/端到端） | ☐ |
| 集成了 LLM 质量评估 | ☐ |
| 集成了安全扫描 | ☐ |
| 配置了质量门禁 | ☐ |
| 实现了金丝雀发布 | ☐ |
| 实现了自动回滚 | ☐ |
| 有覆盖率检查 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 22 | CI/CD 流水线 | CI/CD |
| 28 | CI/CD 与自动化测试 | 自动化 |
| 65 | CI/CD 流水线图解 | 图解 |
| 143 | Agent 测试自动化与 CI 集成 | 测试 |
| 160 | RAG 离线评估 | 评估 |
| 175 | 灰度发布 | 灰度 |
| 286 | CI/CD 流水线图解 | 图解 |
| 362 | 端到端测试框架 | E2E |
| 435 | LLM 评测工具链集成 | 评测 |
| 447 | 速度卡 | 速查 |
| 457 | LLMOps | 生命周期 |
| 481 | Agent 变更管理 | 变更 |
| 489 | Agent 容器化部署 | 部署 |
| 499 | Agent 性能压测 | 压测 |
