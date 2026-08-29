# 自动 Prompt 优化与元学习指南

> 手写 Prompt 是一门"玄学"——换个词、调个顺序，效果就不同。DSPy 把它变成了工程：定义输入输出、让优化器自动搜索最优 Prompt。本指南系统讲解自动 Prompt 优化（APO）、DSPy 框架、元学习方法，以及从手工调参到自动化优化的完整路径。

---

## 1. 为什么需要自动 Prompt 优化

### 手工 Prompt 的问题

```
手工调 Prompt：
  工程师凭直觉改 Prompt → 跑测试 → 看效果 → 再改
  - 效率低（每改一次要手动跑评估）
  - 不可复现（为什么这个 Prompt 好？）
  - 局部最优（人想不到的组合）
  - 依赖个人经验

自动 Prompt 优化：
  定义任务+评估集 → 优化器搜索最优 Prompt → 自动评估
  - 可复现（搜索过程可追踪）
  - 可能找到人想不到的组合
  - 可量化（每个变体有评分）
  - 工程化（CI/CD 集成）
```

---

## 2. DSPy 框架

### 核心概念

```python
# pip install dspy

import dspy

# DSPy 的核心理念：
# 不写 Prompt，写"签名"（Signature）
# 不手动调 Prompt，用"优化器"（Optimizer）自动搜索

# === 基本用法 ===

# 1. 配置 LLM
lm = dspy.LM("openai/gpt-4o-mini")
dspy.configure(lm=lm)

# 2. 定义签名（输入→输出）
class QASignature(dspy.Signature):
    """回答问题。"""
    question: str = dspy.InputField(desc="用户的问题")
    answer: str = dspy.OutputField(desc="简洁准确的回答")

# 3. 定义模块
class QA(dspy.Module):
    def __init__(self):
        self.generate = dspy.ChainOfThought(QASignature)

    def forward(self, question: str):
        return self.generate(question=question)

# 4. 使用
qa = QA()
result = qa(question="什么是 RAG？")
print(result.answer)
```

### DSPy 优化器

```python
# 5. 准备训练数据
trainset = [
    dspy.Example(question="什么是RAG？", answer="检索增强生成").with_inputs("question"),
    dspy.Example(question="什么是Agent？", answer="能自主决策和行动的AI").with_inputs("question"),
    dspy.Example(question="LCEL是什么？", answer="LangChain表达式语言").with_inputs("question"),
] * 5  # 复制增加样本量

# 6. 定义评估函数
def evaluate_qa(example, pred, trace=None):
    # 简单的包含检查
    return example.answer.lower() in pred.answer.lower()

# 7. 用优化器自动优化
from dspy.teleprompt import BootstrapFewShot

optimizer = BootstrapFewShot(
    metric=evaluate_qa,
    max_bootstrapped_demos=3,
    max_labeled_demos=5,
)

# 自动搜索最优 Prompt（包括 few-shot 示例选择）
optimized_qa = optimizer.compile(QA(), trainset=trainset)

# 8. 使用优化后的模块
result = optimized_qa(question="什么是LangGraph？")
# DSPy 自动选择了最优的 Prompt 结构和 few-shot 示例

# 9. 查看优化后的 Prompt
print(optimized_qa)
# 可以看到 DSPy 自动添加了哪些 few-shot 示例
```

### 高级优化器

```python
# === BootstrapFewShotWithRandomSearch ===
# 随机搜索 + few-shot 引导
from dspy.teleprompt import BootstrapFewShotWithRandomSearch

optimizer = BootstrapFewShotWithRandomSearch(
    metric=evaluate_qa,
    max_bootstrapped_demos=4,
    num_candidate_programs=10,  # 搜索 10 个候选
)
optimized = optimizer.compile(QA(), trainset=trainset)

# === MIPROv2 ===
# 更高级的优化器，优化指令文本 + few-shot
from dspy.teleprompt import MIPROv2

optimizer = MIPROv2(
    metric=evaluate_qa,
    num_threads=4,
    init_temperature=1.0,
)
optimized = optimizer.compile(QA(), trainset=trainset, valset=devset)

# === BayesianOptimization ===
# 贝叶斯优化搜索
from dspy.teleprompt import BayesianOptimization

optimizer = BayesianOptimization(
    metric=evaluate_qa,
)
```

---

## 3. 自动 Prompt 优化（APO）

### 元 Prompt 方法

```python
@dataclass
class AutoPromptOptimizer:
    """用 LLM 自动优化 Prompt"""

    async def optimize(self, initial_prompt: str, train_data: list,
                      eval_func: callable, iterations: int = 5) -> dict:
        """自动优化 Prompt"""
        current_prompt = initial_prompt
        best_score = 0
        best_prompt = current_prompt
        history = []

        for i in range(iterations):
            # 1. 用当前 Prompt 评估
            scores = []
            for data in train_data:
                result = await self._run_prompt(current_prompt, data["input"])
                score = eval_func(result, data["expected"])
                scores.append(score)

            avg_score = sum(scores) / len(scores)
            history.append(&#123;"iteration": i+1, "prompt": current_prompt, "score": avg_score&#125;)

            if avg_score > best_score:
                best_score = avg_score
                best_prompt = current_prompt

            # 2. 让 LLM 分析失败并改进 Prompt
            failed_cases = [
                &#123;"input": d["input"], "expected": d["expected"], "got": await self._run_prompt(current_prompt, d["input"])&#125;
                for d in train_data if eval_func(await self._run_prompt(current_prompt, d["input"]), d["expected"]) < 0.5
            ]

            if failed_cases:
                meta_prompt = f"""你是一个 Prompt 优化专家。

当前 Prompt:
&#123;current_prompt&#125;

当前评分: &#123;avg_score:.2f&#125;

失败的案例:
&#123;json.dumps(failed_cases[:3], ensure_ascii=False, indent=2)&#125;

请分析失败原因并改进 Prompt。输出改进后的 Prompt（只输出 Prompt 本身）。"""

                llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
                response = await llm.ainvoke(meta_prompt)
                current_prompt = response.content

        return &#123;
            "initial_prompt": initial_prompt,
            "optimized_prompt": best_prompt,
            "initial_score": history[0]["score"],
            "optimized_score": best_score,
            "improvement": best_score - history[0]["score"],
            "history": history,
        &#125;

    async def _run_prompt(self, prompt: str, input_data: str) -> str:
        """运行 Prompt"""
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(f"&#123;prompt&#125;\n\n输入: &#123;input_data&#125;")
        return response.content
```

---

## 4. 元学习

### Learn to Learn

```python
@dataclass
class MetaLearner:
    """元学习：让模型学会学习"""

    async def meta_learn(self, tasks: list) -> dict:
        """从多个任务中学习"如何学习""""
        # 元学习思路：
        # 在多个任务上训练
        # 提取跨任务的通用策略

        strategies = []
        for task in tasks:
            # 每个任务学到的策略
            strategy = await self._learn_strategy(task)
            strategies.append(&#123;"task": task["name"], "strategy": strategy&#125;)

        # 元学习：从策略中提取通用模式
        meta_prompt = f"""以下是在不同任务中学到的 Prompt 策略：

&#123;json.dumps(strategies, ensure_ascii=False, indent=2)&#125;

请提取跨任务的通用 Prompt 策略原则（5 条）。"""

        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        response = await llm.ainvoke(meta_prompt)

        return &#123;
            "task_strategies": strategies,
            "meta_strategy": response.content,
        &#125;

    async def _learn_strategy(self, task: dict) -> str:
        """在单个任务上学习策略"""
        result = await AutoPromptOptimizer().optimize(
            initial_prompt=task.get("initial_prompt", "回答问题"),
            train_data=task.get("train_data", []),
            eval_func=task.get("eval_func", lambda r, e: 1.0),
        )
        return result["optimized_prompt"]
```

---

## 5. 自我改进循环

```python
@dataclass
class SelfImprovingAgent:
    """自我改进的 Agent"""

    async def self_improve(self, task: str, initial_prompt: str,
                           feedback_source: callable, rounds: int = 5) -> dict:
        """自我改进循环"""
        current_prompt = initial_prompt
        improvements = []

        for r in range(rounds):
            # 1. 执行任务
            result = await self._execute(current_prompt, task)

            # 2. 获取反馈
            feedback = await feedback_source(result, task)

            # 3. 基于反馈改进 Prompt
            improvement = await self._improve_prompt(current_prompt, result, feedback)

            improvements.append(&#123;
                "round": r + 1,
                "prompt": current_prompt,
                "result": result[:200],
                "feedback": feedback,
                "improved_prompt": improvement,
            &#125;)

            current_prompt = improvement

        return &#123;
            "initial_prompt": initial_prompt,
            "final_prompt": current_prompt,
            "improvements": improvements,
        &#125;

    async def _improve_prompt(self, prompt: str, result: str, feedback: str) -> str:
        """基于反馈改进 Prompt"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
        response = await llm.ainvoke(
            f"""改进以下 Prompt。

当前 Prompt:
&#123;prompt&#125;

执行结果:
&#123;result[:500]&#125;

反馈:
&#123;feedback&#125;

输出改进后的 Prompt（只输出 Prompt 本身）。"""
        )
        return response.content
```

---

## 6. 优化效果评估

```python
@dataclass
class PromptEvaluationSuite:
    """Prompt 优化效果评估"""

    async def compare(self, original: str, optimized: str, test_cases: list) -> dict:
        """对比优化前后效果"""
        original_scores = []
        optimized_scores = []

        for case in test_cases:
            # 原始 Prompt
            orig_result = await self._run(original, case["input"])
            orig_score = case["eval_func"](orig_result, case["expected"])
            original_scores.append(orig_score)

            # 优化后 Prompt
            opt_result = await self._run(optimized, case["input"])
            opt_score = case["eval_func"](opt_result, case["expected"])
            optimized_scores.append(opt_score)

        return &#123;
            "original_avg": sum(original_scores) / len(original_scores),
            "optimized_avg": sum(optimized_scores) / len(optimized_scores),
            "improvement": sum(optimized_scores) / len(optimized_scores) - sum(original_scores) / len(original_scores),
            "improved_cases": sum(1 for o, n in zip(original_scores, optimized_scores) if n > o),
            "degraded_cases": sum(1 for o, n in zip(original_scores, optimized_scores) if n < o),
            "unchanged_cases": sum(1 for o, n in zip(original_scores, optimized_scores) if n == o),
        &#125;
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解自动 Prompt 优化的价值 | ☐ |
| 能用 DSPy 定义签名和模块 | ☐ |
| 能用 DSPy 优化器编译 | ☐ |
| 实现了元 Prompt 优化（APO） | ☐ |
| 理解元学习概念 | ☐ |
| 实现了自我改进循环 | ☐ |
| 有优化效果评估方案 | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 09 | Prompt 工程实战 | Prompt 基础 |
| 12 | Prompt 工程模式图解 | Prompt 模式 |
| 21 | 高级 Prompt 技巧 | 高级技巧 |
| 138 | Prompt 工程进阶 | 进阶 |
| 161 | Prompt 版本管理 | 版本管理 |
| 193 | Prompt 版本管理 | 版本 |
| 363 | 提示词模板库 | 模板 |
| 369 | Prompt 版本对比与回归 | 回归 |
| 389 | 提示词版本管理 | 版本 |
| 393 | 反馈循环与自动调优 | 自动调优 |
| 419 | 提示词版本管理与 AB 测试 | AB 测试 |
| 457 | LLMOps | 生命周期 |
