# Agent 边缘计算与端侧部署深度指南

> Agent 不只运行在云端——手机、IoT 设备、汽车、机器人都能跑 Agent。边缘部署的核心挑战：模型压缩、电量限制、网络不稳定、隐私保护。本指南深度讲解边缘 Agent 架构、端侧推理、云边协同、离线模式。

---

## 1. 边缘 Agent 架构

### 云边协同模型

```mermaid
graph TB
    subgraph "云端"
        CLOUD_LLM["大模型<br/>GPT-4o/Qwen-72B"]
        CLOUD_KB["知识库<br/>向量库"]
    end

    subgraph "边缘设备"
        EDGE_AGENT["边缘Agent<br/>Qwen-0.5B 量化"]
        EDGE_CACHE["本地缓存"]
        EDGE_SENSOR["传感器"]
    end

    EDGE_AGENT -->|"简单任务<br/>本地处理"| EDGE_CACHE
    EDGE_AGENT -->|"复杂任务<br/>上传云端"| CLOUD_LLM
    CLOUD_LLM -->|"结果返回"| EDGE_AGENT
    CLOUD_KB -->|"知识同步"| EDGE_CACHE

    style EDGE_AGENT fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style CLOUD_LLM fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

### 任务分级路由

| 任务复杂度 | 处理位置 | 延迟 | 示例 |
|-----------|---------|------|------|
| 简单 | 端侧 | <100ms | 闲聊/简单问答 |
| 中等 | 边缘服务器 | <1s | 摘要/分类 |
| 复杂 | 云端 | 1-5s | 深度推理/RAG |
| 离线 | 端侧 | 即时 | 语音命令/翻译 |

---

## 2. 端侧推理优化

```python
@dataclass
class EdgeInference:
    """端侧推理优化器"""

    async def optimize_for_device(self, model: str, device: str = "mobile") -> dict:
        """按设备类型优化"""
        configs = &#123;
            "mobile": &#123;
                "model": "qwen-0.5b-instruct-q4",
                "quantization": "int4",
                "max_tokens": 512,
                "context_window": 2048,
                "threads": 4,
                "memory_limit_mb": 500,
            &#125;,
            "raspberry_pi": &#123;
                "model": "qwen-0.5b-instruct-q4",
                "quantization": "int4",
                "max_tokens": 256,
                "context_window": 1024,
                "threads": 2,
                "memory_limit_mb": 200,
            &#125;,
            "car": &#123;
                "model": "qwen-1.8b-instruct-q4",
                "quantization": "int4",
                "max_tokens": 1024,
                "context_window": 4096,
                "threads": 4,
                "memory_limit_mb": 2000,
            &#125;,
        &#125;
        return configs.get(device, configs["mobile"])

    async def smart_route(self, query: str, confidence_threshold: float = 0.7) -> dict:
        """智能路由：端侧优先，不够再上云"""
        # 1. 端侧模型先答
        edge_result = await self._edge_inference(query)
        confidence = self._estimate_confidence(edge_result)

        if confidence >= confidence_threshold:
            return &#123;"source": "edge", "answer": edge_result, "latency_ms": 80&#125;

        # 2. 置信度低 → 上云
        cloud_result = await self._cloud_inference(query)
        return &#123;"source": "cloud", "answer": cloud_result, "latency_ms": 2000&#125;

    async def _edge_inference(self, query: str) -> str:
        # llama.cpp / Ollama 本地推理
        pass

    async def _cloud_inference(self, query: str) -> str:
        llm = ChatOpenAI(model="gpt-4o-mini")
        response = await llm.ainvoke(query)
        return response.content

    def _estimate_confidence(self, result: str) -> float:
        if not result or len(result) < 10:
            return 0.3
        if "不确定" in result or "无法" in result:
            return 0.4
        return 0.85
```

---

## 3. 离线模式

```python
@dataclass
class OfflineAgent:
    """离线模式 Agent"""

    async def run_offline(self, query: str, local_kb: object = None) -> dict:
        """完全离线运行"""
        # 1. 本地知识库检索
        if local_kb:
            docs = await local_kb.similarity_search(query, k=3)
            context = "\n".join([d.page_content[:200] for d in docs])
        else:
            context = "无"

        # 2. 本地模型推理（llama.cpp/Ollama）
        result = await self._local_llm(query, context)

        # 3. 如果有网络，尝试同步知识库
        if await self._check_network():
            await self._sync_kb(local_kb)

        return &#123;"answer": result, "offline": True, "kb_synced": await self._check_network()&#125;

    async def _local_llm(self, query: str, context: str) -> str:
        # Ollama 本地推理
        import subprocess
        result = subprocess.run(
            ["ollama", "run", "qwen2.5:0.5b", f"参考: &#123;context&#125;\n问题: &#123;query&#125;"],
            capture_output=True, text=True, timeout=30
        )
        return result.stdout.strip()

    async def _check_network(self) -> bool:
        import socket
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except:
            return False

    async def _sync_kb(self, local_kb):
        # 增量同步云端知识到本地
        pass
```

---

## 4. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解云边协同架构 | ☐ |
| 实现了智能路由（端侧优先） | ☐ |
| 实现了离线模式 | ☐ |
| 知道设备适配（mobile/PI/car） | ☐ |
| 理解端侧量化 | ☐ |

---

## 5. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 469 | 分布式 Agent 与边缘部署 | 边缘 |
| 434 | 自托管 LLM | 自托管 |
| 454 | LLM 推理引擎优化 | 推理 |
| 558 | 知识蒸馏与压缩 | 蒸馏 |
| 543 | 智能汽车 | 汽车 |
