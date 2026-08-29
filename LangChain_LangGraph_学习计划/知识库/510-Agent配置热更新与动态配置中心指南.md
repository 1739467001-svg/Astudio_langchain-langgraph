# Agent 配置热更新与动态配置中心指南

> Agent 上线后需要调整 Prompt、切换模型、修改工具参数——不能每次都重启服务。配置热更新让配置变更不中断服务、动态配置中心统一管理所有配置、变更即时生效。本指南系统讲解配置热更新、动态配置中心、Feature Flag、配置版本管理。

---

## 1. 配置热更新架构

### 配置层级

```mermaid
graph TB
    CC["配置中心<br/>统一管理"]

    CC --> STATIC["静态配置<br/>环境变量/ConfigMap<br/>启动时加载"]
    CC --> DYNAMIC["动态配置<br/>运行时可改<br/>热更新"]
    CC --> FEATURE["Feature Flag<br/>功能开关<br/>即时切换"]

    DYNAMIC --> PROMPT["Prompt 配置<br/>系统提示词"]
    DYNAMIC --> MODEL["模型路由<br/>模型选择"]
    DYNAMIC --> LIMIT["限流参数<br/>RPM/TPM"]
    DYNAMIC --> TOOL["工具配置<br/>开关/参数"]

    style CC fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style DYNAMIC fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
```

### 配置类型

| 类型 | 变更频率 | 热更新 | 示例 |
|------|---------|--------|------|
| 静态 | 极低 | 否 | API Key/数据库地址 |
| 动态 | 中 | 是 | Prompt/温度/Top-K |
| Feature Flag | 高 | 是 | 新功能开关 |
| 紧急 | 极高 | 是 | 熔断开关/降级模式 |

---

## 2. 动态配置中心

### 实现

```python
from dataclasses import dataclass, field
from datetime import datetime
import asyncio

@dataclass
class DynamicConfigCenter:
    """动态配置中心"""

    config: dict = field(default_factory=lambda: {
        "system_prompt": "你是一个专业助手。",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "max_tokens": 4096,
        "rag_top_k": 5,
        "tools_enabled": ["search", "calculator"],
        "tools_disabled": [],
        "rate_limit_rpm": 100,
        "degraded_mode": False,
        "feature_flags": {
            "streaming": True,
            "caching": True,
            "multi_agent": False,
        },
    })

    version: int = 1
    listeners: list = field(default_factory=list)
    last_updated: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    async def get(self, key: str, default=None):
        """获取配置"""
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k, default)
            else:
                return default
        return value

    async def set(self, key: str, value):
        """设置配置（触发热更新）"""
        keys = key.split(".")
        config = self.config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value

        self.version += 1
        self.last_updated = datetime.utcnow().isoformat()

        # 通知所有监听者
        for listener in self.listeners:
            await listener(key, value)

        print(f"配置更新: {key} = {value} (v{self.version})")

    async def register_listener(self, callback):
        """注册配置变更监听器"""
        self.listeners.append(callback)

    async def snapshot(self) -> dict:
        """配置快照"""
        return {
            "config": self.config.copy(),
            "version": self.version,
            "last_updated": self.last_updated,
        }

# 全局配置中心
config_center = DynamicConfigCenter()
```

### 热更新监听

```python
# Prompt 热更新
async def on_prompt_change(key: str, value: str):
    """Prompt 变更时触发"""
    print(f"🔄 Prompt 热更新: {value[:50]}...")
    # Agent 下次调用时自动使用新 Prompt

# 模型路由热更新
async def on_model_change(key: str, value: str):
    """模型切换"""
    print(f"🔄 模型切换: {value}")
    # 下次 LLM 调用自动使用新模型

# Feature Flag 热更新
async def on_feature_flag_change(key: str, value: bool):
    """功能开关切换"""
    flag_name = key.split(".")[-1]
    print(f"🔄 Feature Flag {flag_name}: {'ON' if value else 'OFF'}")

# 注册监听
await config_center.register_listener(on_prompt_change)
await config_center.register_listener(on_model_change)
await config_center.register_listener(on_feature_flag_change)
```

---

## 3. Feature Flag 系统

```python
@dataclass
class FeatureFlag:
    """功能开关"""

    flags: dict = field(default_factory=lambda: {
        "new_rag_pipeline": {"enabled": False, "percentage": 0},
        "multi_agent": {"enabled": False, "percentage": 0},
        "streaming_output": {"enabled": True, "percentage": 100},
        "semantic_cache": {"enabled": True, "percentage": 50},
        "reasoning_model": {"enabled": False, "percentage": 0},
    })

    async def is_enabled(self, flag_name: str, user_id: str = "") -> bool:
        """检查功能是否开启"""
        flag = self.flags.get(flag_name, {"enabled": False, "percentage": 0})

        if not flag["enabled"]:
            return False

        if flag["percentage"] >= 100:
            return True

        # 按用户百分比
        if user_id:
            hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
            return hash_val < flag["percentage"]

        return False

    async def enable(self, flag_name: str, percentage: int = 100):
        """开启功能"""
        if flag_name in self.flags:
            self.flags[flag_name]["enabled"] = True
            self.flags[flag_name]["percentage"] = percentage
            print(f"Feature Flag {flag_name}: ON ({percentage}%)")

    async def disable(self, flag_name: str):
        """关闭功能"""
        if flag_name in self.flags:
            self.flags[flag_name]["enabled"] = False
            print(f"Feature Flag {flag_name}: OFF")

# 使用
feature_flags = FeatureFlag()

# 在 Agent 中使用
async def agent_with_flags(query: str, user_id: str):
    if await feature_flags.is_enabled("new_rag_pipeline", user_id):
        return await new_rag_agent(query)
    else:
        return await old_rag_agent(query)
```

---

## 4. 紧急配置

```python
@dataclass
class EmergencyConfig:
    """紧急配置：一键操作"""

    async def enable_degraded_mode(self):
        """启用降级模式"""
        await config_center.set("degraded_mode", True)
        await config_center.set("model", "gpt-4o-mini")  # 切便宜模型
        await config_center.set("rate_limit_rpm", 10)     # 降限流
        print("🚨 已启用降级模式")

    async def disable_degraded_mode(self):
        """关闭降级模式"""
        await config_center.set("degraded_mode", False)
        await config_center.set("model", "gpt-4o")
        await config_center.set("rate_limit_rpm", 100)
        print("✅ 已关闭降级模式")

    async def enable_circuit_breaker(self):
        """启用熔断"""
        await config_center.set("circuit_breaker", True)
        print("🚨 已启用熔断")

    async def rollback_prompt(self, version: int):
        """回滚 Prompt"""
        prompt = await prompt_registry.get(version)
        await config_center.set("system_prompt", prompt)
        print(f"🔄 Prompt 已回滚到 v{version}")
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了动态配置中心 | ☐ |
| 实现了配置热更新监听 | ☐ |
| 实现了 Feature Flag 系统 | ☐ |
| 实现了按用户百分比灰度 | ☐ |
| 实现了紧急配置（降级/熔断） | ☐ |
| 实现了配置版本管理 | ☐ |
| 有配置快照功能 | ☐ |
| 不重启即可变更配置 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 58 | 动态配置管理 | 动态配置 |
| 82 | 动态配置管理 | 配置 |
| 103 | 配置即代码 | IaC |
| 163 | 多环境管理 | 环境 |
| 188 | 配置即代码深度 | 深度 |
| 242 | 动态配置 | 配置 |
| 263 | 配置即代码 | IaC |
| 334 | 特征开关 | Feature Flag |
| 364 | 特征开关与动态配置 | Flag |
| 488 | Agent 环境管理与配置 | 环境配置 |
| 481 | Agent 变更管理 | 变更 |
