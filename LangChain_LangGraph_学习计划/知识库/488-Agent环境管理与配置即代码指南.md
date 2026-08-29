# Agent 环境管理与配置即代码指南

> Agent 在开发、测试、生产三个环境中运行——模型不同、API Key 不同、数据库不同、Prompt 版本不同。手动改配置容易出错，配置即代码（IaC）让一切可追踪、可复现、可回滚。本指南系统讲解多环境管理、配置即代码、密钥分离、环境隔离。

---

## 1. 多环境架构

### 环境分层

```mermaid
graph LR
    DEV["开发环境<br/>本地/小模型<br/>GPT-4o-mini"] --> STAGING["测试环境<br/>生产配置<br/>完整测试"]
    STAGING --> PROD["生产环境<br/>高可用<br/>GPT-4o"]

    style DEV fill:#C8E6C9,stroke:#2E7D32
    style STAGING fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style PROD fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

### 环境配置差异

| 维度 | 开发 | 测试 | 生产 |
|------|------|------|------|
| 模型 | GPT-4o-mini/本地 | GPT-4o-mini | GPT-4o |
| API Key | 测试 Key | 测试 Key | 生产 Key |
| 数据库 | SQLite/本地 | 测试 DB | 生产 DB |
| 向量库 | 本地 Chroma | 测试实例 | 生产集群 |
| Checkpointer | MemorySaver | SQLite | Postgres |
| 日志级别 | DEBUG | INFO | WARN |
| 限流 | 无 | 模拟 | 严格 |
| 监控 | 无 | 基础 | 完整 |

---

## 2. 配置即代码

### 配置文件体系

```python
# config/base.yaml — 基础配置（所有环境共享）
app:
  name: agent-service
  version: "1.0.0"

agent:
  max_iterations: 25
  timeout_seconds: 120
  recursion_limit: 25

llm:
  temperature: 0
  max_tokens: 4096

rag:
  top_k: 5
  chunk_size: 500
  chunk_overlap: 50

# config/development.yaml — 开发环境覆盖
llm:
  model: gpt-4o-mini
  temperature: 0.7  # 开发时可以多样

database:
  url: sqlite:///./dev.db

vectorstore:
  type: chroma
  path: ./chroma_dev

logging:
  level: DEBUG

cost_tracking:
  enabled: false  # 开发不追踪成本

# config/production.yaml — 生产环境覆盖
llm:
  model: gpt-4o
  temperature: 0  # 生产确定性

database:
  url: ${DATABASE_URL}  # 从环境变量读取

vectorstore:
  type: qdrant
  url: ${VECTOR_DB_URL}

logging:
  level: WARN

cost_tracking:
  enabled: true
  daily_budget: 50.0

rate_limit:
  rpm: 100
  tpm: 100000

monitoring:
  enabled: true
  prometheus: true
  langsmith: true
```

### 配置加载器

```python
import yaml
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class AgentConfig:
    """Agent 配置"""
    # 应用
    app_name: str = "agent-service"
    version: str = "1.0.0"
    environment: str = "development"

    # LLM
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0
    llm_max_tokens: int = 4096
    llm_api_key: str = ""  # 从环境变量

    # Agent
    max_iterations: int = 25
    timeout_seconds: int = 120
    recursion_limit: int = 25

    # RAG
    rag_top_k: int = 5
    chunk_size: int = 500
    chunk_overlap: int = 50

    # 数据库
    database_url: str = "sqlite:///./dev.db"

    # 向量库
    vectorstore_type: str = "chroma"
    vectorstore_path: str = "./chroma"
    vectorstore_url: str = ""

    # 成本
    cost_tracking_enabled: bool = False
    daily_budget: float = 50.0

    # 限流
    rate_limit_rpm: int = 0  # 0=不限
    rate_limit_tpm: int = 0

    # 监控
    monitoring_enabled: bool = False
    langsmith_enabled: bool = False

    # 日志
    log_level: str = "INFO"

    @classmethod
    def load(cls, environment: str = "development"):
        """从配置文件加载"""
        config_dir = Path("config")

        # 1. 加载基础配置
        base = cls._load_yaml(config_dir / "base.yaml")

        # 2. 加载环境覆盖
        env_config = cls._load_yaml(config_dir / f"{environment}.yaml")

        # 3. 合并（环境覆盖基础）
        merged = cls._deep_merge(base, env_config)
        merged["environment"] = environment

        # 4. 从环境变量读取敏感信息
        merged["llm_api_key"] = os.getenv("OPENAI_API_KEY", "")
        merged["database_url"] = merged.get("database_url", "").replace(
            "${DATABASE_URL}", os.getenv("DATABASE_URL", "")
        )

        return cls(**cls._flatten(merged))

    @staticmethod
    def _load_yaml(path: Path) -> dict:
        if path.exists():
            with open(path) as f:
                return yaml.safe_load(f) or {}
        return {}

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = AgentConfig._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    @staticmethod
    def _flatten(d: dict, prefix: str = "") -> dict:
        flat = {}
        for k, v in d.items():
            key = f"{prefix}_{k}" if prefix else k
            if isinstance(v, dict):
                flat.update(AgentConfig._flatten(v, key))
            else:
                flat[key] = v
        return flat

# 使用
config = AgentConfig.load("production")
llm = ChatOpenAI(
    model=config.llm_model,
    temperature=config.llm_temperature,
    api_key=config.llm_api_key,
)
```

---

## 3. 密钥管理

### 密钥分离原则

```python
import os
from dataclasses import dataclass

@dataclass
class SecretsManager:
    """密钥管理：绝不硬编码"""

    def get(self, key: str) -> str:
        """获取密钥（按优先级）"""
        # 1. 环境变量（开发）
        value = os.getenv(key)
        if value:
            return value

        # 2. .env 文件（本地开发）
        # from dotenv import load_dotenv
        # load_dotenv()

        # 3. 密钥管理服务（生产）
        # AWS: Secrets Manager
        # HashiCorp: Vault
        # Azure: Key Vault
        # GCP: Secret Manager
        value = self._from_kms(key)
        if value:
            return value

        raise ValueError(f"密钥 {key} 未找到")

    def _from_kms(self, key: str) -> str:
        """从 KMS 获取（生产）"""
        # 实际调用 Vault/AWS Secrets Manager
        return ""

# .env 文件（不提交到 Git）
"""
# .env
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379
LANGSMITH_API_KEY=ls_xxx
"""

# .gitignore
"""
.env
config/secrets/
"""
```

### 密钥轮换

```python
@dataclass
class KeyRotation:
    """密钥轮换"""

    async def rotate(self, key_name: str):
        """轮换密钥"""
        # 1. 生成新密钥
        new_key = generate_api_key()

        # 2. 在 KMS 中更新
        await self._update_kms(key_name, new_key)

        # 3. 通知所有服务重新加载
        await self._notify_reload(key_name)

        # 4. 旧密钥保留 24 小时（过渡期）
        await self._schedule_old_key_expiry(key_name, hours=24)
```

---

## 4. 环境隔离

```python
@dataclass
class EnvironmentIsolation:
    """环境隔离"""

    # 每个环境独立的数据
    isolation_rules = {
        "database": "每环境独立数据库",
        "vectorstore": "每环境独立向量库",
        "cache": "每环境独立缓存命名空间",
        "queue": "每环境独立消息队列",
        "storage": "每环境独立文件存储",
    }

    def get_namespace(self, env: str, resource: str) -> str:
        """获取环境命名空间"""
        return f"{env}_{resource}"  # 如 production_vectorstore

    def verify_isolation(self, env: str) -> dict:
        """验证环境隔离"""
        checks = {
            "database_isolated": self._check_db_isolation(env),
            "vectorstore_isolated": self._check_vector_isolation(env),
            "no_prod_keys_in_dev": self._check_key_separation(env),
        }
        return {
            "environment": env,
            "all_isolated": all(checks.values()),
            "checks": checks,
        }

    def _check_db_isolation(self, env: str) -> bool:
        return True

    def _check_vector_isolation(self, env: str) -> bool:
        return True

    def _check_key_separation(self, env: str) -> bool:
        if env == "development":
            # 确保开发环境不用生产 Key
            key = os.getenv("OPENAI_API_KEY", "")
            return not key.startswith("sk-prod-")
        return True
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了多环境配置文件 | ☐ |
| 配置加载器（base+环境覆盖） | ☐ |
| 密钥从环境变量/KMS读取 | ☐ |
| .env 不提交到 Git | ☐ |
| 配置了密钥轮换 | ☐ |
| 环境隔离验证 | ☐ |
| 配置可版本化 | ☐ |
| 敏感信息不硬编码 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 06 | 环境配置指南 | 配置 |
| 58 | 动态配置管理 | 动态配置 |
| 82 | 动态配置管理 | 配置 |
| 103 | 配置即代码 | IaC |
| 163 | 多环境管理 | 多环境 |
| 188 | 配置即代码深度 | 深度 |
| 195 | 多环境管理 | 环境 |
| 242 | 动态配置 | 配置 |
| 263 | 配置即代码 | IaC |
| 334 | 特征开关 | Feature Flag |
| 364 | 特征开关与动态配置 | Feature Flag |
| 477 | Agent 数据安全 | 密钥安全 |
| 481 | Agent 变更管理 | 变更 |
