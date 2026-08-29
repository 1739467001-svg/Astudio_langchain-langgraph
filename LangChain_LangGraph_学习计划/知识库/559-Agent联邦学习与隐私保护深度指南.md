# Agent 联邦学习与隐私保护深度指南

> 多家医院想联合训练 AI 诊断模型但数据不能共享——联邦学习让数据不出本地完成联合训练。本指南深度讲解联邦学习架构、安全聚合、差分隐私、在 Agent 中的应用。

---

## 1. 联邦学习架构

### 横向联邦 vs 纵向联邦

```mermaid
graph TB
    FL["联邦学习类型"]

    FL --> HFL["横向联邦<br/>样本不同特征相同<br/>多家医院同类数据"]
    FL --> VFL["纵向联邦<br/>样本相同特征不同<br/>银行+电商同一用户"]
    FL --> FTL["联邦迁移<br/>样本和特征都不同<br/>跨领域迁移"]

    style FL fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style HFL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 横向联邦实现

```python
import torch
from dataclasses import dataclass

@dataclass
class FederatedClient:
    """联邦学习客户端"""
    client_id: str
    model: torch.nn.Module = None
    local_data: list = None

    async def local_train(self, global_weights: dict, epochs: int = 3) -> dict:
        """本地训练"""
        # 加载全局权重
        self.model.load_state_dict(global_weights)
        optimizer = torch.optim.SGD(self.model.parameters(), lr=0.01)

        for epoch in range(epochs):
            for batch in self.local_data:
                output = self.model(batch["input"])
                loss = torch.nn.functional.cross_entropy(output, batch["label"])
                loss.backward()
                optimizer.step()
                optimizer.zero_grad()

        # 返回本地权重更新（不发送原始数据）
        return {
            "client_id": self.client_id,
            "weights": self.model.state_dict(),
            "num_samples": len(self.local_data),
        }

@dataclass
class FederatedServer:
    """联邦学习服务器（协调者）"""

    async def aggregate(self, client_updates: list) -> dict:
        """安全聚合（FedAvg）"""
        total_samples = sum(c["num_samples"] for c in client_updates)

        # 加权平均
        global_weights = {}
        for key in client_updates[0]["weights"]:
            global_weights[key] = sum(
                c["weights"][key] * c["num_samples"] / total_samples
                for c in client_updates
            )

        return global_weights

    async def train_round(self, clients: list, current_weights: dict) -> dict:
        """一轮联邦训练"""
        # 1. 分发全局权重
        # 2. 各客户端本地训练
        tasks = [c.local_train(current_weights) for c in clients]
        updates = await asyncio.gather(*tasks)

        # 3. 安全聚合
        new_weights = await self.aggregate(updates)

        return new_weights
```

---

## 3. 差分隐私

```python
@dataclass
class DifferentialPrivacy:
    """差分隐私保护"""

    async def add_noise(self, gradients: list, epsilon: float = 1.0,
                        sensitivity: float = 1.0) -> list:
        """向梯度添加噪声"""
        import numpy as np
        noise_scale = sensitivity / epsilon

        noisy_gradients = []
        for grad in gradients:
            noise = np.random.laplace(0, noise_scale, grad.shape)
            noisy_gradients.append(grad + noise)

        return noisy_gradients

    async def privacy_budget(self, epsilon: float, delta: float,
                             rounds: int) -> dict:
        """隐私预算计算"""
        return {
            "epsilon_per_round": epsilon / rounds,
            "delta": delta,
            "privacy_guarantee": f"ε={epsilon:.1f}, δ={delta}",
            "interpretation": "任意单条记录对模型影响不超过 e^epsilon 倍",
        }
```

---

## 4. 安全聚合

```python
@dataclass
class SecureAggregation:
    """安全聚合：服务器看不到单个客户端的梯度"""

    async def aggregate_secure(self, clients: list) -> dict:
        """安全聚合协议"""
        # 1. 每对客户端协商密钥
        # 2. 每个客户端添加 pairwise mask
        # 3. 服务器求和时 mask 互相抵消
        # 4. 服务器只看到聚合结果

        return {
            "method": "Bonawitz et al. Secure Aggregation",
            "privacy": "服务器无法看到任何单个客户端的梯度",
            "overhead": "通信量增加 ~2x",
            "client_dropout": "支持客户端中途退出",
        }
```

---

## 5. Agent 联邦场景

| 场景 | 参与方 | 数据 | 任务 |
|------|--------|------|------|
| 医疗诊断 | 多家医院 | 病历 | 联合训练诊断模型 |
| 金融风控 | 多家银行 | 交易记录 | 联合风控模型 |
| 智能输入法 | 多设备 | 用户输入 | 联合训练语言模型 |
| 工业质检 | 多工厂 | 缺陷数据 | 联合缺陷检测 |

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解横向/纵向联邦 | ☐ |
| 实现了 FedAvg 聚合 | ☐ |
| 实现了差分隐私 | ☐ |
| 理解安全聚合 | ☐ |
| 知道 Agent 联邦场景 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 449 | 隐私计算与联邦学习 | 基础 |
| 501 | Agent 数据保护 | 隐私 |
| 439 | PEFT 微调 | 微调 |
| 522 | Agent 教育应用 | 教育 |
| 523 | Agent 医疗辅助 | 医疗 |
