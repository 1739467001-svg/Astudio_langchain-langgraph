# LangGraph 调试与可视化

> 知识库 18/166/200/280 有调试基础。这篇整合为工具指南——图结构可视化、执行追踪和断点调试。

---

## 一、调试工具全景

```mermaid
graph TB
    subgraph 工具 {"调试工具"}
        T1["LangGraph Studio<br/>图结构可视化+交互"]
        T2["LangSmith<br/>执行追踪+评估"]
        T3["Python调试<br/>断点+状态检查"]
        T4["print/logger<br/>简单有效"]
    end

    style T1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、Studio 可视化

```bash
# 启动Studio
langgraph dev

# 配置langgraph.json
{
  "dependencies": ["."],
  "graphs": {"my_agent": "./src/agent.py:graph"},
  "env": ".env"
}
```

Studio 功能：
- 图结构可视化（节点+边+条件路由）
- 交互式运行（输入→运行→看结果）
- 状态检查（每步 State 快照）
- 时间旅行（回到任意步骤）
- 断点调试（节点前后暂停）
- 多轮对话测试

---

## 三、代码调试

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

# 1. 检查图结构
app = graph.compile(checkpointer=MemorySaver())

# 2. 查看状态
config = {"configurable": {"thread_id": "debug-1"}}
state = app.get_state(config)
print(f"当前节点: {state.next}")
print(f"State值: {list(state.values.keys())}")

# 3. 查看历史
for snap in app.get_state_history(config):
    print(f"步骤: {snap.next}, 检查点: {snap.config['configurable'].get('checkpoint_id', '?')}")

# 4. 修改状态后继续
app.update_state(config, values={"messages": [new_msg]})
result = app.invoke(None, config)

# 5. 添加调试日志
import logging
logging.basicConfig(level=logging.DEBUG)
# LangGraph会输出详细的执行日志
```

---

## 四、常见调试场景

| 场景 | 方法 |
|------|------|
| Agent死循环 | Studio看图+检查条件路由+设recursion_limit |
| 检索不到 | 检查向量库+查询日志+相似度分数 |
| interrupt不恢复 | 检查checkpointer+thread_id一致性 |
| 状态丢失 | 检查Reducer配置+状态字段类型 |
| 工具调用失败 | LangSmith看工具输入输出+错误信息 |

---

## 五、最佳实践

| 工具 | 场景 | 优先级 |
|------|------|--------|
| Studio | 开发调试 | ★★★ |
| LangSmith | 生产追踪 | ★★★ |
| get_state | 状态排查 | ★★★ |
| 时间旅行 | 回到出错点 | ★★☆ |
| print | 快速验证 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 能用Studio可视化 | ☐ |
| 能查状态和历史 | ☐ |
