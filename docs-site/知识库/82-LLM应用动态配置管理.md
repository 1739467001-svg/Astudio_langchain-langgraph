# LLM 应用动态配置管理

> 不重启应用就能切换模型、调Prompt、改参数。动态配置让运维更灵活。

---

## 一、静态配置 vs 动态配置

```mermaid
graph TB
    subgraph 静态 &#123;"静态配置（.env）"&#125;
        S1["改配置→重启服务"] --> S2["❌ 需要停机"]
    end

    subgraph 动态 &#123;"动态配置"&#125;
        D1["改配置→热加载"] --> D2["✅ 不停机"]
        D2 --> D3["✅ 灰度发布"]
    end

    style 静态 fill:'#FFCDD2'
    style 动态 fill:'#C8E6C9'
```

## 二、动态配置管理器

```python
import json
import os
from datetime import datetime
from typing import Any

class DynamicConfig:
    """动态配置管理器"""
    def __init__(self, config_path: str = "config/dynamic.json"):
        self.config_path = config_path
        self._config = &#123;&#125;
        self._last_modified = 0
        self._load()

    def _load(self):
        """加载配置文件"""
        if not os.path.exists(self.config_path):
            self._config = &#123;&#125;
            return

        mtime = os.path.getmtime(self.config_path)
        if mtime == self._last_modified:
            return  # 未修改

        with open(self.config_path, "r", encoding="utf-8") as f:
            self._config = json.load(f)
        self._last_modified = mtime
        print(f"✅ 配置已加载: &#123;datetime.fromtimestamp(mtime)&#125;")

    def get(self, key: str, default: Any = None) -> Any:
        """获取配置（自动检查更新）"""
        self._load()  # 每次读取时检查文件是否更新
        return self._config.get(key, default)

    def set(self, key: str, value: Any):
        """设置配置"""
        self._config[key] = value
        self._save()

    def _save(self):
        """保存配置"""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self._config, f, indent=2, ensure_ascii=False)

    def reload(self):
        """强制重新加载"""
        self._last_modified = 0
        self._load()

# 配置文件示例 config/dynamic.json
"""
&#123;
    "model": "gpt-4o-mini",
    "temperature": 0,
    "max_tokens": 500,
    "system_prompt": "你是友好的AI助手。",
    "rag_top_k": 3,
    "rag_chunk_size": 500,
    "cache_enabled": true,
    "max_iterations": 5,
    "rate_limit_per_minute": 20,
    "feature_flags": &#123;
        "streaming": true,
        "guardrails": true,
        "feedback_buttons": true
    &#125;
&#125;
"""

# 全局配置实例
config = DynamicConfig()
```

## 三、在应用中使用

```python
from langchain_openai import ChatOpenAI

def get_dynamic_llm() -> ChatOpenAI:
    """根据动态配置创建LLM"""
    return ChatOpenAI(
        model=config.get("model", "gpt-4o-mini"),
        temperature=config.get("temperature", 0),
        max_tokens=config.get("max_tokens", 500),
    )

def chat(user_input: str) -> str:
    """带动态配置的聊天"""
    llm = get_dynamic_llm()  # 每次调用都读取最新配置
    system_prompt = config.get("system_prompt", "你是AI助手。")

    from langchain_core.prompts import ChatPromptTemplate
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "&#123;input&#125;"),
    ])
    chain = prompt | llm
    return chain.invoke(&#123;"input": user_input&#125;).content
```

## 四、Feature Flags（功能开关）

```python
class FeatureFlags:
    """功能开关管理"""
    def __init__(self, config: DynamicConfig):
        self.config = config

    def is_enabled(self, feature: str) -> bool:
        """检查功能是否开启"""
        flags = self.config.get("feature_flags", &#123;&#125;)
        return flags.get(feature, False)

    def enable(self, feature: str):
        """开启功能"""
        flags = self.config.get("feature_flags", &#123;&#125;)
        flags[feature] = True
        self.config.set("feature_flags", flags)

    def disable(self, feature: str):
        """关闭功能"""
        flags = self.config.get("feature_flags", &#123;&#125;)
        flags[feature] = False
        self.config.set("feature_flags", flags)

# 使用
flags = FeatureFlags(config)

def chat_with_flags(user_input: str) -> str:
    """带功能开关的聊天"""
    if flags.is_enabled("streaming"):
        # 流式输出
        for chunk in llm.stream(user_input):
            yield chunk.content
    else:
        # 非流式
        return llm.invoke(user_input).content

    if flags.is_enabled("guardrails"):
        # 启用护栏
        user_input = input_guard(user_input)
```

## 五、动态配置架构

```mermaid
graph TB
    subgraph 架构 &#123;"动态配置架构"&#125;
        F["config/dynamic.json<br/>(配置文件)"] --> CONFIG["DynamicConfig<br/>(配置管理器)"]
        CONFIG --> APP["应用代码"]
        APP --> LLM["LLM调用<br/>(model/temp/max_tokens)"]
        APP --> RAG["RAG参数<br/>(k/chunk_size)"]
        APP --> FLAGS["Feature Flags<br/>(streaming/guardrails)"]

        ADMIN["运维/管理"] -.->|"修改文件"| F
        ADMIN -.->|"API修改"| CONFIG
    end

    style CONFIG fill:'#FFF9C4'
    style ADMIN fill:'#E3F2FD'
```

## 六、配置项清单

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| model | str | gpt-4o-mini | 使用的模型 |
| temperature | float | 0 | 随机性 |
| max_tokens | int | 500 | 最大输出 |
| system_prompt | str | "你是AI助手" | 系统提示词 |
| rag_top_k | int | 3 | 检索数量 |
| rag_chunk_size | int | 500 | 分块大小 |
| cache_enabled | bool | true | 是否启用缓存 |
| max_iterations | int | 5 | Agent最大循环 |
| rate_limit_per_minute | int | 20 | 速率限制 |
| feature_flags.streaming | bool | true | 流式输出 |
| feature_flags.guardrails | bool | true | 输入输出护栏 |
| feature_flags.feedback | bool | true | 反馈按钮 |
