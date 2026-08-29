# Agent 自动扩缩容与弹性指南

> 流量高峰时 Agent 响应变慢，低谷时 GPU 闲置浪费。自动扩缩容让 Agent 服务根据负载自动增减实例——高峰扩容保性能，低谷缩容省成本。本指南系统讲解扩缩容策略、K8s HPA/KEDA 集成、GPU 资源调度，以及预热与优雅排空。

---

## 1. 扩缩容策略

### 策略对比

| 策略 | 响应速度 | 成本 | 复杂度 | 适用 |
|------|---------|------|--------|------|
| 定时扩缩 | 快 | 中 | 低 | 可预测流量 |
| 指标驱动 | 中 | 低 | 中 | 通用 |
| 预测性 | 快 | 最低 | 高 | 有历史数据 |
| 事件驱动 | 极快 | 中 | 中 | 突发流量 |
| 混合 | 快 | 低 | 高 | 生产推荐 |

### 扩缩容决策

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class ScalingDecision:
    """扩缩容决策"""
    current_replicas: int
    target_replicas: int
    action: str           # scale_up / scale_down / no_change
    reason: str
    metrics: dict
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class AutoScaler:
    """自动扩缩容器"""

    min_replicas: int = 2
    max_replicas: int = 20
    scale_up_threshold: float = 0.7     # CPU 利用率 > 70% 扩容
    scale_down_threshold: float = 0.3   # CPU 利用率 < 30% 缩容
    cooldown_seconds: int = 300          # 冷却期 5 分钟

    last_scale_time: datetime = None

    async def evaluate(self, metrics: dict) -> ScalingDecision:
        """评估是否需要扩缩容"""
        current = metrics.get("replicas", 2)
        cpu_util = metrics.get("cpu_utilization", 0)
        gpu_util = metrics.get("gpu_utilization", 0)
        queue_depth = metrics.get("queue_depth", 0)
        avg_latency = metrics.get("avg_latency_ms", 0)

        # 综合利用率
        combined_util = max(cpu_util, gpu_util)

        # 检查冷却期
        if self.last_scale_time:
            elapsed = (datetime.utcnow() - self.last_scale_time).total_seconds()
            if elapsed < self.cooldown_seconds:
                return ScalingDecision(
                    current_replicas=current,
                    target_replicas=current,
                    action="no_change",
                    reason=f"冷却期中（{self.cooldown_seconds - elapsed:.0f}s 剩余）",
                    metrics=metrics,
                )

        # 扩容条件
        if combined_util > self.scale_up_threshold or queue_depth > 50 or avg_latency > 30000:
            target = min(current + 2, self.max_replicas)
            if target > current:
                self.last_scale_time = datetime.utcnow()
                return ScalingDecision(
                    current_replicas=current,
                    target_replicas=target,
                    action="scale_up",
                    reason=f"利用率 {combined_util:.0%}，队列 {queue_depth}，延迟 {avg_latency}ms",
                    metrics=metrics,
                )

        # 缩容条件
        if combined_util < self.scale_down_threshold and queue_depth < 5:
            target = max(current - 1, self.min_replicas)
            if target < current:
                self.last_scale_time = datetime.utcnow()
                return ScalingDecision(
                    current_replicas=current,
                    target_replicas=target,
                    action="scale_down",
                    reason=f"利用率 {combined_util:.0%}，队列 {queue_depth}",
                    metrics=metrics,
                )

        return ScalingDecision(
            current_replicas=current,
            target_replicas=current,
            action="no_change",
            reason="指标正常",
            metrics=metrics,
        )
```

---

## 2. K8s HPA 集成

### HPA 配置

```yaml
# k8s/hpa-agent.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # CPU 利用率
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    # 内存利用率
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    # 自定义指标：队列深度
    - type: Pods
      pods:
        metric:
          name: agent_queue_depth
        target:
          type: AverageValue
          averageValue: "50"
    # 自定义指标：P95 延迟
    - type: Pods
      pods:
        metric:
          name: agent_latency_p95_ms
        target:
          type: AverageValue
          averageValue: "30000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60    # 扩容稳定窗口
      policies:
        - type: Percent
          value: 100                     # 每次最多翻倍
          periodSeconds: 60
        - type: Pods
          value: 4                       # 每次最多加 4 个
          periodSeconds: 60
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300   # 缩容稳定窗口 5 分钟
      policies:
        - type: Percent
          value: 10                      # 每次最多缩 10%
          periodSeconds: 60
      selectPolicy: Min
```

### KEDA 事件驱动扩缩

```yaml
# k8s/keda-agent.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: agent-service-scaled
spec:
  scaleTargetRef:
    name: agent-service
  minReplicaCount: 2
  maxReplicaCount: 50
  pollingInterval: 15                    # 每 15 秒检查
  cooldownPeriod: 300                   # 冷却 5 分钟
  triggers:
    # Redis 队列深度触发
    - type: redis
      metadata:
        address: redis.default.svc:6379
        listName: agent_task_queue
        listLength: "10"                 # 每 10 个任务扩 1 个副本
    # Kafka 消息积压触发
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        consumerGroup: agent-group
        topic: agent-tasks
        lagThreshold: "100"
    # Prometheus 指标触发
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: agent_request_rate
        threshold: "100"
```

---

## 3. GPU 资源调度

```python
@dataclass
class GPUScheduler:
    """GPU 资源调度器"""

    async def schedule_gpu(self, request: dict) -> dict:
        """调度 GPU 资源"""
        # 根据模型大小选择 GPU
        model_size = request.get("model_size_gb", 14)
        gpu_memory = request.get("gpu_memory_gb", 80)

        if model_size > gpu_memory * 0.8:
            # 需要多 GPU
            gpu_count = int(model_size / (gpu_memory * 0.8)) + 1
            return {"strategy": "tensor_parallel", "gpus": gpu_count, "model": "multi-gpu"}
        else:
            # 单 GPU
            return {"strategy": "single_gpu", "gpus": 1}

    async def optimize_gpu_allocation(self, pending_requests: list) -> dict:
        """优化 GPU 分配"""
        # 按模型分组
        by_model = {}
        for req in pending_requests:
            model = req.get("model", "default")
            by_model.setdefault(model, []).append(req)

        allocation = {}
        for model, reqs in by_model.items():
            # 批处理：合并同模型请求
            batch_size = min(len(reqs), 32)  # 最大 32 批
            allocation[model] = {
                "gpus": 1,
                "batch_size": batch_size,
                "requests": len(reqs),
                "estimated_throughput": batch_size * 50,  # Token/s
            }

        return allocation
```

---

## 4. 预热与优雅排空

```python
@dataclass
class WarmupDrainer:
    """预热与优雅排空"""

    async def warmup_new_instance(self, instance_id: str):
        """预热新实例"""
        # 1. 加载模型到 GPU
        await self._load_model(instance_id)

        # 2. 发送预热请求（不返回给用户）
        await self._warmup_request(instance_id, "Hello")

        # 3. 标记为就绪
        await self._mark_ready(instance_id)

    async def drain_instance(self, instance_id: str):
        """优雅排空实例"""
        # 1. 标记为"不接受新请求"
        await self._mark_draining(instance_id)

        # 2. 等待现有请求完成
        while await self._has_pending_requests(instance_id):
            await asyncio.sleep(1)

        # 3. 保存状态
        await self._save_state(instance_id)

        # 4. 安全关闭
        await self._shutdown(instance_id)

    async def _load_model(self, instance_id):
        pass

    async def _warmup_request(self, instance_id, query):
        pass

    async def _mark_ready(self, instance_id):
        pass

    async def _mark_draining(self, instance_id):
        pass

    async def _has_pending_requests(self, instance_id):
        return False

    async def _save_state(self, instance_id):
        pass

    async def _shutdown(self, instance_id):
        pass
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解五种扩缩容策略 | ☐ |
| 实现了自动扩缩容决策器 | ☐ |
| 配置了 K8s HPA | ☐ |
| 配置了 KEDA 事件驱动 | ☐ |
| 实现了 GPU 资源调度 | ☐ |
| 实现了预热新实例 | ☐ |
| 实现了优雅排空 | ☐ |
| 配置了冷却期 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 76 | 蓝绿部署 | 部署 |
| 107 | 蓝绿部署与健康探针 | 探针 |
| 172 | 容量预估 | 容量 |
| 188 | 容灾高可用 | 容灾 |
| 237 | 容量规划 | 规划 |
| 306 | 容量预测 | 预测 |
| 351 | 优雅扩缩容 | 扩缩容 |
| 361 | 云原生部署 | 云原生 |
| 377 | 健康探针与存活检测 | 探针 |
| 391 | Agent 云原生部署 | 云原生 |
| 444 | 优雅关闭与重启 | 优雅关闭 |
| 469 | 分布式 Agent | 分布式 |
| 478 | AIOps 与智能运维 | 智能运维 |
