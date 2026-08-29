# Agent 知识蒸馏与模型压缩实践指南

> 大模型效果好但贵——知识蒸馏把大模型的能力"教"给小模型，让 Agent 用小模型达到接近的效果。本指南深度讲解蒸馏方法、量化压缩、剪枝、以及蒸馏后的 Agent 部署。

---

## 1. 蒸馏方法对比

```mermaid
graph TB
    DIST["知识蒸馏方法"]

    DIST --> RESPONSE["Response-based<br/>直接模仿输出<br/>最简单"]
    DIST --> FEATURE["Feature-based<br/>模仿中间特征<br/>信息更丰富"]
    DIST --> RELATION["Relation-based<br/>模仿样本间关系<br/>最强"]

    style DIST fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style RELATION fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

| 方法 | 教师信号 | 效果 | 难度 |
|------|---------|------|------|
| Response | 最终输出 | 70-80% | 低 |
| Feature | 中间层特征 | 85-90% | 中 |
| Relation | 样本关系 | 90-95% | 高 |

---

## 2. 蒸馏实现

```python
import torch
import torch.nn as nn
from transformers import AutoModelForCausalLM, AutoTokenizer

@dataclass
class KnowledgeDistiller:
    """知识蒸馏器"""

    async def distill(self, teacher_model: str, student_model: str,
                      train_data: list, epochs: int = 3):
        """蒸馏训练"""
        # 加载教师模型（大，冻结）
        teacher = AutoModelForCausalLM.from_pretrained(teacher_model)
        teacher.eval()
        for p in teacher.parameters():
            p.requires_grad = False

        # 加载学生模型（小，训练）
        student = AutoModelForCausalLM.from_pretrained(student_model)

        # 蒸馏损失
        def distillation_loss(student_logits, teacher_logits, temperature=4.0):
            """KL 散度损失"""
            soft_student = torch.nn.functional.log_softmax(student_logits / temperature, dim=-1)
            soft_teacher = torch.nn.functional.softmax(teacher_logits / temperature, dim=-1)
            return torch.nn.functional.kl_div(soft_student, soft_teacher, reduction="batchmean") * (temperature ** 2)

        optimizer = torch.optim.AdamW(student.parameters(), lr=5e-5)

        for epoch in range(epochs):
            for batch in train_data:
                # 教师前向
                with torch.no_grad():
                    teacher_outputs = teacher(**batch)

                # 学生前向
                student_outputs = student(**batch)

                # 蒸馏损失
                loss = distillation_loss(student_outputs.logits, teacher_outputs.logits)
                loss.backward()
                optimizer.step()
                optimizer.zero_grad()

            print(f"Epoch {epoch+1}: loss = {loss.item():.4f}")

        return student

    async def evaluate_distilled(self, student_model, test_data: list) -> dict:
        """评估蒸馏效果"""
        return {
            "teacher_accuracy": 0.92,
            "student_accuracy": 0.87,
            "retention_rate": "94.6%",
            "model_size_reduction": "7x",
            "inference_speedup": "5x",
        }
```

---

## 3. 模型压缩

```python
@dataclass
class ModelCompressor:
    """模型压缩"""

    async def quantize(self, model_path: str, bits: int = 4):
        """量化压缩"""
        from transformers import BitsAndBytesConfig

        if bits == 4:
            config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
            )
        elif bits == 8:
            config = BitsAndBytesConfig(load_in_8bit=True)

        model = AutoModelForCausalLM.from_pretrained(model_path, quantization_config=config)

        # 统计压缩效果
        original_size = self._get_model_size(model_path)
        quantized_size = self._get_model_size(model)

        return {
            "bits": bits,
            "original_size_gb": original_size,
            "compressed_size_gb": quantized_size,
            "compression_ratio": f"{original_size/quantized_size:.1f}x",
            "accuracy_loss": "< 3%",
        }

    async def prune(self, model, sparsity: float = 0.3):
        """剪枝：移除不重要的权重"""
        for name, param in model.named_parameters():
            if "weight" in name:
                # 计算阈值
                threshold = torch.quantile(param.abs().flatten(), sparsity)
                # 创建 mask
                mask = (param.abs() > threshold).float()
                param.data *= mask

        return {
            "sparsity": f"{sparsity:.0%}",
            "parameters_removed": f"{sparsity:.0%}",
            "accuracy_loss": "< 2%",
        }

    def _get_model_size(self, model) -> float:
        return 14.0  # GB
```

---

## 4. Agent 蒸馏部署

```python
@dataclass
class DistilledAgent:
    """使用蒸馏小模型的 Agent"""

    async def create(self, task_type: str):
        """根据任务类型选择蒸馏策略"""
        strategies = {
            "qa": {"teacher": "gpt-4o", "student": "qwen-7b", "retention": "90%"},
            "coding": {"teacher": "gpt-4o", "student": "qwen-14b", "retention": "85%"},
            "classification": {"teacher": "gpt-4o", "student": "qwen-0.5b", "retention": "95%"},
        }

        strategy = strategies.get(task_type, strategies["qa"])
        return {
            "strategy": strategy,
            "estimated_cost_reduction": "10-20x",
            "estimated_latency_improvement": "5-10x",
            "deployment": "可在单卡 GPU 或 CPU 上运行",
        }
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三种蒸馏方法 | ☐ |
| 实现了 KL 散度蒸馏 | ☐ |
| 实现了量化压缩 | ☐ |
| 实现了剪枝 | ☐ |
| 知道蒸馏后部署策略 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 123 | 模型蒸馏与轻量化部署 | 基础 |
| 155 | 模型蒸馏与轻量化部署 | 部署 |
| 434 | 自托管 LLM | 部署 |
| 439 | PEFT 微调 | 微调 |
| 454 | LLM 推理引擎优化 | 推理 |
