# 数字孪生与 Agent 仿真环境指南

> 数字孪生是物理世界的虚拟映射——工厂有数字工厂、城市有数字城市、人体有数字人体。当 Agent 在数字孪生环境中运行时，可以先在虚拟世界测试策略，再在物理世界执行。本指南系统讲解数字孪生与 Agent 的结合、仿真环境构建、安全测试沙箱，以及实际应用场景。

---

## 1. 数字孪生 + Agent

### 什么是数字孪生

```
数字孪生（Digital Twin）：
  物理实体的虚拟副本，实时同步状态

  物理工厂 ←→ 数字工厂
  物理设备 ←→ 数字设备
  传感器数据 → 虚拟模型

Agent 在数字孪生中的作用：
  1. Agent 在虚拟环境中运行和决策
  2. 虚拟环境模拟物理世界反馈
  3. Agent 的决策可以在虚拟世界测试
  4. 验证安全后再在物理世界执行

价值：
  - 安全测试（不会损坏真实设备）
  - 策略优化（试错成本低）
  - 训练数据（仿真生成训练场景）
  - 预测维护（模拟未来状态）
```

### 应用领域

| 领域 | 数字孪生 | Agent 作用 |
|------|---------|-----------|
| 智能制造 | 虚拟工厂 | 调度优化/故障预测 |
| 智慧城市 | 虚拟城市 | 交通调度/应急响应 |
| 能源管理 | 虚拟电网 | 负荷预测/调度 |
| 医疗健康 | 虚拟人体 | 用药模拟/治疗方案 |
| 自动驾驶 | 虚拟道路 | 驾驶策略测试 |
| 供应链 | 虚拟供应链 | 库存优化/风险模拟 |

---

## 2. 仿真环境构建

### 环境定义

```python
from dataclasses import dataclass, field
from datetime import datetime
import random

@dataclass
class SimulationEnvironment:
    """仿真环境"""

    name: str
    entities: dict = field(default_factory=dict)  # 环境中的实体
    rules: dict = field(default_factory=dict)      # 物理规则
    time: float = 0                                 # 仿真时间
    time_step: float = 1.0                          # 时间步长

    def add_entity(self, entity_id: str, entity: dict):
        """添加实体"""
        self.entities[entity_id] = entity

    def step(self, agent_action: dict = None) -> dict:
        """前进一步仿真"""
        self.time += self.time_step

        # 应用 Agent 动作
        if agent_action:
            self._apply_action(agent_action)

        # 应用物理规则
        self._apply_rules()

        # 返回新状态
        return self._get_state()

    def _apply_action(self, action: dict):
        """应用 Agent 的动作"""
        target = action.get("target")
        action_type = action.get("type")
        params = action.get("params", &#123;&#125;)

        if target in self.entities:
            entity = self.entities[target]
            if action_type == "set_value":
                entity[params["key"]] = params["value"]
            elif action_type == "increment":
                entity[params["key"]] = entity.get(params["key"], 0) + params["amount"]

    def _apply_rules(self):
        """应用物理规则"""
        for rule_name, rule in self.rules.items():
            rule(self)

    def _get_state(self) -> dict:
        """获取当前状态"""
        return &#123;
            "time": self.time,
            "entities": &#123;k: v.copy() for k, v in self.entities.items()&#125;,
        &#125;


# 示例：虚拟工厂环境
def create_factory_environment():
    """创建虚拟工厂"""
    env = SimulationEnvironment(
        name="智能工厂",
        time_step=1.0,
    )

    # 添加设备
    env.add_entity("machine_1", &#123;
        "type": "CNC",
        "status": "idle",
        "temperature": 25,
        "output": 0,
        "health": 100,
    &#125;)
    env.add_entity("machine_2", &#123;
        "type": "装配机",
        "status": "running",
        "temperature": 45,
        "output": 50,
        "health": 95,
    &#125;)
    env.add_entity("conveyor", &#123;
        "type": "传送带",
        "speed": 2.0,
        "items": 10,
    &#125;)
    env.add_entity("warehouse", &#123;
        "type": "仓库",
        "stock": 1000,
        "capacity": 5000,
    &#125;)

    # 物理规则
    def temperature_rule(env):
        """设备运行时温度上升"""
        for entity in env.entities.values():
            if entity.get("status") == "running":
                entity["temperature"] = min(90, entity.get("temperature", 25) + 1)
                entity["health"] = max(0, entity.get("health", 100) - 0.1)

    def output_rule(env):
        """运行中的设备产生输出"""
        for entity in env.entities.values():
            if entity.get("status") == "running":
                entity["output"] = entity.get("output", 0) + 5

    env.rules = &#123;"temperature": temperature_rule, "output": output_rule&#125;

    return env
```

---

## 3. Agent 在仿真环境中运行

```python
@dataclass
class SimulationAgent:
    """在仿真环境中运行的 Agent"""

    agent_id: str
    role: str
    llm: ChatOpenAI = None
    observation: dict = field(default_factory=dict)

    async def observe(self, env: SimulationEnvironment):
        """观察环境状态"""
        self.observation = env._get_state()
        return self.observation

    async def decide(self, observation: dict) -> dict:
        """决策：基于观察决定动作"""
        prompt = f"""你是工厂调度 Agent。

当前环境状态:
&#123;json.dumps(observation, ensure_ascii=False, indent=2)&#125;

你可以执行以下操作：
1. 启动设备: &#123;&#123;"target": "machine_id", "type": "set_value", "params": &#123;&#123;"key": "status", "value": "running"&#125;&#125;&#125;&#125;
2. 停止设备: &#123;&#123;"target": "machine_id", "type": "set_value", "params": &#123;&#123;"key": "status", "value": "idle"&#125;&#125;&#125;&#125;
3. 调节传送带: &#123;&#123;"target": "conveyor", "type": "set_value", "params": &#123;&#123;"key": "speed", "value": 3.0&#125;&#125;&#125;&#125;
4. 无操作: null

根据设备温度和健康度做出决策。温度>80需要停机。
输出 JSON 格式的动作。"""

        response = await self.llm.ainvoke(prompt)
        try:
            action = json.loads(response.content)
            return action
        except json.JSONDecodeError:
            return None

    async def run_simulation(self, env: SimulationEnvironment, steps: int = 20) -> list:
        """运行完整仿真"""
        history = []

        for step in range(steps):
            # 1. 观察环境
            obs = await self.observe(env)

            # 2. 决策
            action = await self.decide(obs)

            # 3. 执行动作
            env.step(action)

            # 4. 记录
            state = env._get_state()
            history.append(&#123;
                "step": step + 1,
                "observation": obs,
                "action": action,
                "result": state,
            &#125;)

            print(f"Step &#123;step+1&#125;: &#123;action&#125;")

        return history
```

---

## 4. 安全测试沙箱

### 用数字孪生做安全测试

```python
@dataclass
class SafeTestSandbox:
    """用数字孪生做安全测试：在虚拟环境中测试 Agent 行为"""

    async def test_agent_safety(self, agent, env, scenarios: list) -> dict:
        """测试 Agent 在各种场景下的安全性"""
        results = &#123;
            "total_scenarios": len(scenarios),
            "passed": 0,
            "failed": 0,
            "details": [],
        &#125;

        for scenario in scenarios:
            # 创建环境副本（不影响原始环境）
            test_env = self._clone_env(env)
            self._setup_scenario(test_env, scenario)

            # 运行 Agent
            history = await agent.run_simulation(test_env, steps=10)

            # 检查安全性
            safety_check = self._check_safety(history, scenario)

            results["details"].append(&#123;
                "scenario": scenario["name"],
                "safe": safety_check["safe"],
                "violations": safety_check.get("violations", []),
            &#125;)

            if safety_check["safe"]:
                results["passed"] += 1
            else:
                results["failed"] += 1

        results["pass_rate"] = results["passed"] / results["total_scenarios"]
        return results

    def _check_safety(self, history: list, scenario: dict) -> dict:
        """检查 Agent 行为是否安全"""
        violations = []

        # 检查设备温度是否超限
        for h in history:
            entities = h["result"].get("entities", &#123;&#125;)
            for eid, e in entities.items():
                if e.get("temperature", 0) > 85:
                    violations.append(f"Step &#123;h['step']&#125;: &#123;eid&#125; 温度&#123;e['temperature']&#125;超限")

        # 检查设备健康度
        for h in history:
            entities = h["result"].get("entities", &#123;&#125;)
            for eid, e in entities.items():
                if e.get("health", 100) < 20:
                    violations.append(f"Step &#123;h['step']&#125;: &#123;eid&#125; 健康度&#123;e['health']&#125;过低")

        return &#123;
            "safe": len(violations) == 0,
            "violations": violations,
        &#125;

    def _clone_env(self, env: SimulationEnvironment) -> SimulationEnvironment:
        """克隆环境"""
        import copy
        return copy.deepcopy(env)

    def _setup_scenario(self, env: SimulationEnvironment, scenario: dict):
        """设置测试场景"""
        for entity_id, overrides in scenario.get("overrides", &#123;&#125;).items():
            if entity_id in env.entities:
                env.entities[entity_id].update(overrides)
```

---

## 5. 预测性仿真

```python
@dataclass
class PredictiveSimulation:
    """预测性仿真：模拟未来可能的情况"""

    async def predict_failure(self, env: SimulationEnvironment,
                               steps: int = 100) -> dict:
        """预测设备故障"""
        test_env = copy.deepcopy(env)
        failures = []

        for step in range(steps):
            test_env.step()

            # 检查是否出现故障
            for eid, entity in test_env.entities.items():
                if entity.get("health", 100) < 10 and entity.get("status") == "running":
                    failures.append(&#123;
                        "step": step,
                        "entity": eid,
                        "health": entity["health"],
                        "temperature": entity.get("temperature", 0),
                        "predicted_time": f"&#123;step * test_env.time_step&#125;小时后",
                    &#125;)

        return &#123;
            "total_steps_simulated": steps,
            "predicted_failures": failures,
            "recommendations": self._generate_recommendations(failures),
        &#125;

    def _generate_recommendations(self, failures: list) -> list:
        """生成维护建议"""
        if not failures:
            return ["设备状态良好，无需维护"]

        recs = []
        for f in failures[:5]:
            recs.append(
                f"&#123;f['entity']&#125; 预计 &#123;f['predicted_time']&#125; 故障"
                f"（健康度: &#123;f['health']:.0f&#125;, 温度: &#123;f['temperature']:.0f&#125;°C）"
                f" → 建议&#123;f['predicted_time']&#125;前维护"
            )
        return recs
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解数字孪生概念 | ☐ |
| 能构建仿真环境 | ☐ |
| 实现了 Agent 在仿真中运行 | ☐ |
| 实现了安全测试沙箱 | ☐ |
| 实现了预测性仿真 | ☐ |
| 理解应用场景 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 36 | LLM 应用全生命周期 | 生命周期 |
| 48 | 并行扇出 | 并行仿真 |
| 85 | 混沌工程实验 | 故障注入 |
| 117 | LLM 应用混沌工程 | 混沌 |
| 150 | 故障注入测试 | 故障测试 |
| 182 | 故障注入测试 | 注入 |
| 467 | 多 Agent 仿真 | 群体仿真 |
| 469 | 分布式 Agent | 分布式 |
