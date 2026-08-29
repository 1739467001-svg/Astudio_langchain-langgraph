# LLM 应用容灾与高可用

> LLM API 可能宕机、限流、超时。本指南覆盖容灾设计和故障转移策略。

---

## 一、故障场景

```mermaid
graph TB
    subgraph 故障类型 {"LLM应用的常见故障"}
        F1["🔴 API服务不可用<br/>(OpenAI宕机)"]
        F2["🟡 API限流<br/>(超过QPS限制)"]
        F3["🟡 网络超时<br/>(跨区域延迟)"]
        F4["🟢 单次调用超时<br/>(大输入导致)"]
        F5["🔴 数据库故障<br/>(向量库/历史DB)"]
    end

    style F1 fill:'#FFCDD2'
    style F5 fill:'#FFCDD2'
    style F2 fill:'#FFE0B2'
    style F3 fill:'#FFE0B2'
```

## 二、容灾架构

```mermaid
graph TB
    subgraph 容灾架构 {"多层容灾架构"}
        U["请求"] --> HEALTH["健康检查<br/>检测主服务是否可用"]
        HEALTH -->|"健康"| PRIMARY["主模型<br/>GPT-4o-mini"]
        HEALTH -->|"不健康"| FAILOVER["故障转移"]

        FAILOVER --> BACKUP1["备用模型1<br/>通义千问"]
        BACKUP1 -->|"也不可用"| BACKUP2["备用模型2<br/>Ollama本地"]
        BACKUP2 -->|"也不可用"| CACHE_FALLBACK["缓存兜底<br/>返回缓存或预设回复"]

        PRIMARY --> RATE{"限流?"}
        RATE -->|"是"| QUEUE["排队等待<br/>指数退避"]
        RATE -->|"否"| PROC["正常处理"]
    end

    style PRIMARY fill:'#C8E6C9'
    style FAILOVER fill:'#FFE0B2'
    style CACHE_FALLBACK fill:'#FFCDD2'
```

## 三、故障转移实现

```python
import time
from langchain_openai import ChatOpenAI

class FailoverLLM:
    """带故障转移的LLM调用器"""
    def __init__(self):
        self.models = [
            ("OpenAI", ChatOpenAI(model="gpt-4o-mini", max_retries=2, timeout=15)),
            # ("通义千问", ChatTongyi(model="qwen-plus")),
            # ("Ollama", ChatOllama(model="qwen2")),  # 本地兜底
        ]
        self.health = {name: True for name, _ in self.models}
        self.fallback_responses = {
            "default": "抱歉，服务暂时不可用，请稍后重试。",
        }

    def invoke(self, messages):
        """按优先级尝试，自动故障转移"""
        for name, llm in self.models:
            if not self.health.get(name, True):
                continue  # 跳过不健康的模型
            try:
                result = llm.invoke(messages)
                self.health[name] = True  # 恢复健康
                return result
            except Exception as e:
                print(f"⚠️ {name}故障: {e}")
                self.health[name] = False
                continue

        # 所有模型都不可用
        return self._fallback_response(messages)

    def _fallback_response(self, messages):
        """兜底响应"""
        from langchain_core.messages import AIMessage
        last_msg = messages[-1].content if messages else ""
        return AIMessage(content=self.fallback_responses["default"])

    def health_check(self):
        """主动健康检查"""
        for name, llm in self.models:
            try:
                llm.invoke("ping")
                self.health[name] = True
            except:
                self.health[name] = False
        return self.health
```

## 四、降级策略

```mermaid
graph TD
    subgraph 降级层次 {"四级降级策略"}
        L1["Level 1: 换备用模型<br/>(GPT→通义千问→Ollama)"]
        L1 --> L2["Level 2: 简化处理<br/>(不用Agent/不用RAG<br/>直接LLM回复)"]
        L2 --> L3["Level 3: 缓存兜底<br/>(返回相似问题的缓存答案)"]
        L3 --> L4["Level 4: 预设回复<br/>('服务暂时不可用')"]
    end

    style L1 fill:'#C8E6C9'
    style L4 fill:'#FFCDD2'
```

```python
def graceful_degrade(question: str, primary_llm, fallback_llm, cache: dict):
    """优雅降级"""
    # Level 1: 主模型
    try:
        return primary_llm.invoke(question).content
    except Exception:
        pass

    # Level 2: 备用模型
    try:
        return fallback_llm.invoke(question).content
    except Exception:
        pass

    # Level 3: 缓存兜底
    for cached_q, cached_a in cache.items():
        if cached_q in question or question in cached_q:
            return f"(缓存回复) {cached_a}"

    # Level 4: 预设回复
    return "抱歉，AI服务暂时不可用。您的请求已记录，我们稍后回复。"
```

## 五、限流与排队

```python
import time
from collections import defaultdict

class RateLimiter:
    """令牌桶限流器"""
    def __init__(self, max_per_minute: int = 20):
        self.max = max_per_minute
        self.calls = defaultdict(list)

    def check(self, user_id: str) -> bool:
        now = time.time()
        # 清理1分钟前的记录
        self.calls[user_id] = [t for t in self.calls[user_id] if now - t < 60]
        if len(self.calls[user_id]) >= self.max:
            return False
        self.calls[user_id].append(now)
        return True

    def wait_if_needed(self, user_id: str, max_wait: float = 10):
        """如果限流则等待"""
        while not self.check(user_id):
            time.sleep(1)
            max_wait -= 1
            if max_wait <= 0:
                return False
        return True
```

## 六、容灾检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 多模型故障转移 | 主→备→兜底 | ☐ |
| 超时设置 | LLM调用30秒超时 | ☐ |
| 重试机制 | 指数退避3次 | ☐ |
| 限流保护 | 每用户/全局QPS限制 | ☐ |
| 降级策略 | 模型降级→缓存→预设 | ☐ |
| 健康检查 | 定期检测模型可用性 | ☐ |
| 监控告警 | 故障时通知 | ☐ |
| 熔断器 | 连续失败时暂停请求 | ☐ |
