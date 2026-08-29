# LLM 应用性能剖析

> 性能优化的第一步是找到瓶颈。本指南教你系统性地剖析 LLM 应用的各环节耗时。

---

## 一、性能瓶颈分布

```mermaid
graph TB
    subgraph 瓶颈分布 &#123;"LLM应用的性能瓶颈在哪"&#125;
        B1["LLM API调用<br/>占总延迟60-80%<br/>最常见的瓶颈"]
        B2["向量检索<br/>占10-20%<br/>数据量大时显著"]
        B3["网络传输<br/>占5-10%<br/>跨区域调用时"]
        B4["序列化/解析<br/>占2-5%<br/>大JSON时"]
        B5["排队等待<br/>高并发时<br/>限流导致"]
    end

    style B1 fill:'#FFCDD2'
    style B2 fill:'#FFE0B2'
    style B3 fill:'#FFF9C4'
```

## 二、分层剖析法

```mermaid
graph TB
    subgraph 分层剖析 &#123;"从外到内逐层剖析"&#125;
        L1["Layer 1: 端到端延迟<br/>总耗时"]
        L1 --> L2["Layer 2: Chain各步骤<br/>prompt→llm→parser各多长"]
        L2 --> L3["Layer 3: LLM调用<br/>API延迟+Token"]
        L3 --> L4["Layer 4: 检索<br/>向量库查询耗时"]
    end

    style L1 fill:'#FFCDD2'
    style L4 fill:'#C8E6C9'
```

### 2.1 用 Callback 剖析

```python
import time
from langchain_core.callbacks import BaseCallbackHandler

class ProfilingCallback(BaseCallbackHandler):
    """性能剖析回调：记录每步耗时"""
    def __init__(self):
        self.profiles = []
        self._stack = []

    def on_chain_start(self, serialized, inputs, **kwargs):
        self._stack.append(&#123;"name": serialized.get("name", "?"), "start": time.time()&#125;)

    def on_chain_end(self, outputs, **kwargs):
        if self._stack:
            entry = self._stack.pop()
            entry["end"] = time.time()
            entry["duration"] = round(entry["end"] - entry["start"], 3)
            self.profiles.append(entry)

    def on_llm_start(self, serialized, prompts, **kwargs):
        self._stack.append(&#123;"name": "LLM", "start": time.time()&#125;)

    def on_llm_end(self, response, **kwargs):
        if self._stack:
            entry = self._stack.pop()
            entry["end"] = time.time()
            entry["duration"] = round(entry["end"] - entry["start"], 3)
            usage = response.llm_output or &#123;&#125;
            entry["tokens"] = usage.get("token_usage", &#123;&#125;).get("total_tokens", 0)
            self.profiles.append(entry)

    def report(self):
        """生成剖析报告"""
        print("\n=== 性能剖析报告 ===")
        total = sum(p.get("duration", 0) for p in self.profiles)
        for p in self.profiles:
            pct = p.get("duration", 0) / total * 100 if total > 0 else 0
            tokens = p.get("tokens", "")
            token_str = f" | &#123;tokens&#125; tokens" if tokens else ""
            print(f"  &#123;p['name']&#125;: &#123;p.get('duration', 0):.3f&#125;s (&#123;pct:.0f&#125;%)&#123;token_str&#125;")
        print(f"  总计: &#123;total:.3f&#125;s")
        return &#123;"total": total, "details": self.profiles&#125;
```

### 2.2 剖析结果示例

```
=== 性能剖析报告 ===
  PromptTemplate: 0.001s (0%)
  LLM: 2.847s (93%) | 1850 tokens
  StrOutputParser: 0.000s (0%)
  总计: 2.848s
```

## 三、优化策略

### 3.1 瓶颈到优化的映射

```mermaid
graph TD
    Q&#123;"瓶颈在哪?"&#125;
    Q -->|"LLM调用慢"| O1["换小模型/流式/缓存/batch"]
    Q -->|"检索慢"| O2["减小k/优化索引/换向量库"]
    Q -->|"网络慢"| O3["换API区域/代理/CDN"]
    Q -->|"并发慢"| O4["异步/队列/限流"]
    Q -->|"序列化慢"| O5["减少数据量/简化格式"]

    style O1 fill:'#C8E6C9'
    style O2 fill:'#C8E6C9'
```

### 3.2 各优化策略的效果

| 优化策略 | 适用瓶颈 | 预期效果 | 实施难度 |
|---------|---------|---------|---------|
| 换小模型 | LLM慢 | 延迟降50-70% | ★☆☆ |
| 流式输出 | 首字延迟 | 首字降90% | ★☆☆ |
| 缓存 | 重复调用 | 命中时降100% | ★★☆ |
| batch | 多请求 | 并发降60% | ★★☆ |
| 异步 | 高并发 | QPS提升3-5x | ★★★ |
| 减k值 | 检索慢 | 延迟降30-50% | ★☆☆ |
| 索引优化 | 检索慢 | 延迟降50%+ | ★★★ |
| 截断历史 | LLM慢 | Token降40% | ★★☆ |

## 四、性能剖析检查清单

| 检查项 | 方法 | 目标 |
|--------|------|------|
| 端到端延迟 | 计时总耗时 | P95 < 5s |
| LLM占比 | ProfilingCallback | < 80% |
| 检索延迟 | 计时similarity_search | < 100ms |
| Token消耗 | usage_metadata | < 3000/次 |
| 首字延迟 | TTFT测量 | < 500ms |
| 并发QPS | 并发测试 | > 5 QPS |
