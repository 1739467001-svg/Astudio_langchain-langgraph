# PEFT 微调与 DPO 对齐实践指南

> Prompt 工程解决不了所有问题——当你需要模型学会特定领域知识、固定输出格式、遵循企业风格规范时，微调是更彻底的方案。但全量微调太贵（需要多卡 A100），PEFT（参数高效微调）用 1% 的参数量达到接近的效果。本指南详解 LoRA/QLoRA 微调、DPO 偏好对齐，以及微调模型的 LangChain 集成。

---

## 1. 微调 vs Prompt 工程 vs RAG

### 三种增强方式对比

| 方式 | 改变什么 | 成本 | 效果 | 适用场景 |
|------|---------|------|------|---------|
| Prompt 工程 | 输入提示 | 极低 | 中 | 格式控制、角色设定 |
| RAG | 检索知识 | 低 | 高（知识） | 知识增强、事实准确 |
| PEFT 微调 | 模型权重 | 中 | 高（行为） | 风格/格式/领域适配 |
| 全量微调 | 全部权重 | 高 | 最高 | 深度领域适配 |
| DPO 对齐 | 偏好权重 | 中 | 高（偏好） | 人类偏好对齐 |

### 何时该微调

```
先试 Prompt 工程 → 不够 → 加 RAG → 还不够 → 微调

微调的理由（至少满足一个）：
  1. Prompt 已经很长但效果仍不够
  2. 需要固定的输出格式（JSON Schema）
  3. 需要特定的语言风格/语气
  4. 需要模型理解领域术语
  5. RAG 检索的文档模型看不懂
  6. 推理成本敏感（微调小模型替代大模型）

不该微调的理由：
  1. 知识会频繁更新 → 用 RAG
  2. 数据量少于 100 条 → Prompt 工程
  3. 只需要回答事实问题 → RAG
  4. 没有评估集 → 先建评估集
```

---

## 2. PEFT 核心概念

### LoRA 原理

```
全量微调：
  W' = W + ΔW
  W: 原始权重矩阵（如 4096×4096 = 1678万参数）
  ΔW: 微调更新（同样 1678万参数）
  → 每一层都要更新，显存巨大

LoRA（Low-Rank Adaptation）：
  W' = W + A × B
  W: 原始权重（冻结，不更新）
  A: 降维矩阵（4096×r，如 4096×8 = 3.3万参数）
  B: 升维矩阵（r×4096，如 8×4096 = 3.3万参数）
  r: 秩（通常 8-64）

  只训练 A 和 B → 参数量 6.6万 vs 1678万 = 0.4%
  显存需求降低 90%+
  效果接近全量微调的 95%+
```

### QLoRA：进一步省显存

```
QLoRA = Quantization + LoRA

步骤：
  1. 原始模型量化为 4-bit（显存减少 75%）
  2. 在量化模型上加 LoRA 适配器（训练 4-bit 模型上的 LoRA）
  3. 推理时合并

效果：
  - 7B 模型全量微调需要 56GB 显存（2×A100 80GB）
  - 7B 模型 QLoRA 只需 6GB 显存（单张 RTX 4090）
  - 72B 模型 QLoRA 只需 48GB 显存（单张 A100 80GB）
```

### 参数对比

| 方法 | 训练参数量 | 显存需求（7B模型） | 效果 | 硬件 |
|------|-----------|------------------|------|------|
| 全量微调 | 100% | 56GB+ | 100% | 多卡 A100 |
| LoRA | 0.1-1% | 16GB | 95%+ | 单卡 |
| QLoRA | 0.1-1% | 6GB | 93%+ | 消费级显卡 |
| Adapter | 1-5% | 20GB | 90%+ | 单卡 |

---

## 3. QLoRA 微调实战

### 准备数据

```python
# 微调数据格式（指令微调）
# data/train.jsonl
{"instruction": "把以下文本翻译成英文", "input": "你好世界", "output": "Hello World"}
{"instruction": "总结以下文档", "input": "LangChain 是一个...", "output": "LangChain 是 LLM 应用框架"}
{"instruction": "判断情感", "input": "今天天气真好", "output": "积极"}
{"instruction": "生成 SQL", "input": "查询用户表中年龄大于18的记录", "output": "SELECT * FROM users WHERE age > 18"}

# 数据准备脚本
import json
from datasets import Dataset

def load_training_data(filepath: str) -> Dataset:
    """加载微调数据"""
    data = []
    with open(filepath, "r") as f:
        for line in f:
            item = json.loads(line)
            # 转换为对话格式
            data.append({
                "messages": [
                    {"role": "system", "content": "你是一个专业的中文助手。"},
                    {"role": "user", "content": f"{item['instruction']}\n\n{item.get('input', '')}"},
                    {"role": "assistant", "content": item["output"]},
                ]
            })
    return Dataset.from_list(data)

train_data = load_training_data("data/train.jsonl")
print(f"训练样本数: {len(train_data)}")
# 建议：至少 500 条，推荐 1000-5000 条
```

### QLoRA 微调代码

```python
# pip install peft trl transformers bitsandbytes accelerate

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig

# === 1. 加载量化模型 ===
model_name = "Qwen/Qwen2.5-7B-Instruct"

# 4-bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",          # NF4 量化
    bnb_4bit_compute_dtype=torch.float16,  # 计算精度
    bnb_4bit_use_double_quant=True,       # 双重量化
)

# 加载模型
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
)
model = prepare_model_for_kbit_training(model)

# 加载分词器
tokenizer = AutoTokenizer.from_pretrained(model_name)
tokenizer.pad_token = tokenizer.eos_token

# === 2. 配置 LoRA ===
lora_config = LoraConfig(
    r=16,                          # 秩，8-64，越大效果越好但参数越多
    lora_alpha=32,                 # 缩放因子，通常为 r 的 2 倍
    lora_dropout=0.05,             # Dropout 防过拟合
    bias="none",                   # 不训练 bias
    task_type="CAUSAL_LM",         # 任务类型
    target_modules=[               # 需要加 LoRA 的模块
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
)

# 打印可训练参数量
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# 输出示例: trainable params: 19,982,208 || all params: 7,621,806,592 || trainable%: 0.26%

# === 3. 训练配置 ===
training_args = SFTConfig(
    output_dir="./output/qwen2.5-7b-lora",
    num_train_epochs=3,              # 训练轮数
    per_device_train_batch_size=2,   # 批大小（根据显存调）
    gradient_accumulation_steps=4,   # 梯度累积（等效 batch=8）
    warmup_ratio=0.1,               # 预热比例
    learning_rate=2e-4,             # 学习率
    lr_scheduler_type="cosine",      # 学习率调度
    logging_steps=10,                # 日志频率
    save_strategy="epoch",           # 每轮保存
    save_total_limit=3,              # 最多保存3个检查点
    fp16=True,                       # 混合精度
    optim="paged_adamw_8bit",        # 8位优化器（省显存）
    max_seq_length=1024,             # 最大序列长度
    dataset_text_field="messages",   # 对话格式数据
)

# === 4. 开始训练 ===
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_data,
    processing_class=tokenizer,
)

trainer.train()

# 保存 LoRA 适配器（只有几十MB）
trainer.save_model("./output/qwen2.5-7b-lora-final")
```

### 训练监控

```python
# 训练参数调优建议

# 数据量与效果：
#   100 条：格式学习
#   500 条：基础领域适应
#   1000-5000 条：推荐范围
#   10000+ 条：深度领域适配

# LoRA 参数选择：
#   r=8: 简单任务（格式、风格）
#   r=16: 中等任务（领域知识）← 推荐默认
#   r=32-64: 复杂任务（多任务学习）

# 学习率：
#   1e-4 ~ 3e-4: LoRA 推荐范围
#   太大：loss 不收敛
#   太小：训练太慢

# Epoch：
#   1-2: 数据量大（>5000条）
#   2-3: 数据量中（500-5000条）← 推荐默认
#   3-5: 数据量小（<500条）

# 过拟合信号：
#   - 训练 loss 持续下降但评估 loss 上升
#   - 模型开始"背"训练数据
#   - 解决：减少 epoch、增加 dropout、增加数据
```

---

## 4. DPO 偏好对齐

### 为什么需要 DPO

```
SFT（监督微调）：
  教模型"应该说什么"
  数据格式：instruction → output（标准答案）

DPO（Direct Preference Optimization）：
  教模型"什么更好"
  数据格式：instruction → chosen（更好的回答）, rejected（较差的回答）

场景：
  SFT 后模型能回答了，但回答风格可能不够好
  DPO 让模型学会人类偏好的回答方式

  示例：
    问题: "如何学 Python？"
    chosen: "建议从基础语法开始，配合项目练习..."
    rejected: "看教程就行。"

  DPO 后模型倾向于给出更详细、更有帮助的回答
```

### RLHF vs DPO

| 维度 | RLHF | DPO |
|------|------|-----|
| 需要奖励模型 | 是 | 否 |
| 需要强化学习 | 是（PPO） | 否 |
| 实现复杂度 | 高 | 低 |
| 训练稳定性 | 较差 | 较好 |
| 效果 | 好 | 接近 RLHF |
| 显存需求 | 高 | 中 |

### DPO 训练

```python
# pip install trl peft transformers

from trl import DPOTrainer, DPOConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import Dataset
import torch

# === 1. 准备偏好数据 ===
# data/preference.jsonl
preference_data = [
    {
        "prompt": "如何提高编程能力？",
        "chosen": "建议从以下几个方面入手：1. 多练习项目 2. 阅读优秀代码 3. 参与开源",
        "rejected": "多写代码就行了。"
    },
    {
        "prompt": "什么是 RAG？",
        "chosen": "RAG 是检索增强生成，通过检索外部文档来增强 LLM 的回答质量和准确性。",
        "rejected": "RAG 就是搜索加生成。"
    },
]

# 加载数据
dataset = Dataset.from_list(preference_data)

# === 2. 加载 SFT 后的模型 ===
model_name = "Qwen/Qwen2.5-7B-Instruct"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# DPO 需要一个参考模型（冻结的原始模型）
ref_model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
)

# === 3. DPO 配置 ===
dpo_config = DPOConfig(
    output_dir="./output/qwen2.5-7b-dpo",
    num_train_epochs=1,              # DPO 通常 1-2 轮
    per_device_train_batch_size=1,
    gradient_accumulation_steps=8,
    learning_rate=5e-6,              # DPO 学习率要比 SFT 小
    warmup_ratio=0.1,
    logging_steps=10,
    save_strategy="epoch",
    beta=0.1,                        # DPO 温度参数
    max_length=1024,
    max_prompt_length=512,
)

# === 4. 训练 ===
trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=dpo_config,
    train_dataset=dataset,
    processing_class=tokenizer,
)

trainer.train()
trainer.save_model("./output/qwen2.5-7b-dpo-final")
```

---

## 5. 微调模型部署

### 合并 LoRA 适配器

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# === 方式1：合并后部署到 vLLM ===

# 加载基础模型
base_model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto",
)

# 加载 LoRA 适配器
model = PeftModel.from_pretrained(base_model, "./output/qwen2.5-7b-lora-final")

# 合并权重
merged_model = model.merge_and_unload()

# 保存合并后的模型
merged_model.save_pretrained("./output/qwen2.5-7b-merged")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")
tokenizer.save_pretrained("./output/qwen2.5-7b-merged")

# 部署到 vLLM
# vllm serve ./output/qwen2.5-7b-merged --port 8000
```

### vLLM + LoRA 动态加载

```python
# === 方式2：vLLM 动态加载多个 LoRA ===
# 启动时加载基础模型 + 多个 LoRA 适配器
"""
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules \
    sql-lora=./loras/sql-lora \
    code-lora=./loras/code-lora \
    chat-lora=./loras/chat-lora
"""

# 请求时指定使用哪个 LoRA
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="not-needed")

# 用 SQL LoRA
response = client.chat.completions.create(
    model="sql-lora",
    messages=[{"role": "user", "content": "查询所有活跃用户"}],
)

# 用代码 LoRA
response = client.chat.completions.create(
    model="code-lora",
    messages=[{"role": "user", "content": "实现快速排序"}],
)
```

### 在 LangChain 中使用微调模型

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool

# 连接 vLLM 部署的微调模型
finetuned_llm = ChatOpenAI(
    model="sql-lora",  # 使用微调后的 LoRA
    openai_api_base="http://localhost:8000/v1",
    openai_api_key="not-needed",
    temperature=0.3,  # 微调模型可用较低温度
)

# 直接使用（微调后的格式/风格已内化）
response = finetuned_llm.invoke("查询所有2024年的订单")
# 微调后模型直接输出 SQL，不需要复杂 Prompt

# 在 LangGraph Agent 中使用
@tool
def execute_sql(sql: str) -> str:
    """执行 SQL 查询"""
    return f"执行结果: ..."

agent = create_react_agent(finetuned_llm, [execute_sql])
```

---

## 6. 评估微调效果

### 评估流程

```python
from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, GEval
from datasets import Dataset

# === 对比评估：微调前 vs 微调后 ===

# 评估数据集（不同于训练集）
eval_data = [
    {"input": "查询销售前十的商品", "expected": "SELECT * FROM products ORDER BY sales DESC LIMIT 10"},
    {"input": "统计每个部门的员工数", "expected": "SELECT dept, COUNT(*) FROM employees GROUP BY dept"},
]

# 微调前的模型
base_model = ChatOpenAI(model="Qwen2.5-7B-Instruct", openai_api_base="http://localhost:8000/v1")

# 微调后的模型
finetuned_model = ChatOpenAI(model="sql-lora", openai_api_base="http://localhost:8000/v1")

# 生成测试用例
def make_test_cases(model, data):
    cases = []
    for item in data:
        response = model.invoke(item["input"]).content
        cases.append(LLMTestCase(
            input=item["input"],
            actual_output=response,
            expected_output=item["expected"],
        ))
    return cases

# 评估
metric = GEval(
    name="SQL准确性",
    criteria="判断生成的SQL是否正确、完整",
    evaluation_params=["actual_output", "expected_output"],
    threshold=0.7,
)

base_cases = make_test_cases(base_model, eval_data)
finetuned_cases = make_test_cases(finetuned_model, eval_data)

print("=== 微调前 ===")
evaluate(base_cases, [metric])

print("=== 微调后 ===")
evaluate(finetuned_cases, [metric])
```

### 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 过拟合（背训练数据） | 数据少/epoch多 | 增加 dropout、减少 epoch、增数据 |
| 欠拟合（没学会） | 数据少/epoch少/lr小 | 增 epoch、调大 lr、增数据 |
| 灾难性遗忘 | 学新忘旧 | 降低 lr、加通用数据混训 |
| 生成变短 | DPO beta 过大 | 降低 beta (0.05-0.1) |
| 格式不稳定 | 数据格式不一致 | 统一训练数据格式 |

---

## 7. 成本估算

```python
@dataclass
class FineTuningCost:
    """微调成本估算"""

    # QLoRA 微调 7B 模型
    gpu_hours_7b: float = 2.0       # 训练时间（1000条数据，3轮）
    gpu_price_per_hour: float = 2.0  # RTX 4090 租赁约 $2/h

    # 72B 模型
    gpu_hours_72b: float = 8.0
    gpu_price_72b: float = 4.0    # A100 租赁约 $4/h

    def qlora_7b_cost(self) -> float:
        return self.gpu_hours_7b * self.gpu_price_per_hour

    def qlora_72b_cost(self) -> float:
        return self.gpu_hours_72b * self.gpu_price_72b

    def dpo_cost(self, data_size: int = 500) -> float:
        """DPO 通常比 SFT 多 50% 时间"""
        hours = self.gpu_hours_7b * 1.5 * (data_size / 1000)
        return hours * self.gpu_price_per_hour


cost = FineTuningCost()
print(f"QLoRA 7B 微调: ${cost.qlora_7b_cost():.1f}")     # ~$4
print(f"QLoRA 72B 微调: ${cost.qlora_72b_cost():.1f}")   # ~$32
print(f"DPO 对齐: ${cost.dpo_cost():.1f}")                 # ~$6
```

---

## 8. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解微调 vs Prompt vs RAG 的选型 | ☐ |
| 理解 LoRA/QLoRA 原理 | ☐ |
| 能用 QLoRA 微调开源模型 | ☐ |
| 知道 LoRA 参数如何选择 | ☐ |
| 理解 DPO 与 RLHF 的区别 | ☐ |
| 能用 DPO 进行偏好对齐 | ☐ |
| 能将微调模型部署到 vLLM | ☐ |
| 在 LangChain 中使用微调模型 | ☐ |
| 有微调效果评估方案 | ☐ |

---

## 9. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 34 | 微调 vs RAG 选型 | 微调选型 |
| 52 | 模型微调入门 | 微调基础 |
| 112 | 评测数据集构建 | 评估数据 |
| 121 | RAGAS 评估框架 | 效果评估 |
| 123 | 模型蒸馏与轻量化部署 | 轻量化 |
| 132 | 评测数据集构建与管理 | 数据集 |
| 136 | 模型选型决策 | 模型选型 |
| 155 | 模型蒸馏与轻量化部署 | 蒸馏部署 |
| 168 | 模型选型决策矩阵进阶 | 进阶选型 |
| 434 | 自托管 LLM 与本地推理部署 | 微调后部署到 vLLM |
| 435 | LLM 评测工具链集成 | 评估工具 |
