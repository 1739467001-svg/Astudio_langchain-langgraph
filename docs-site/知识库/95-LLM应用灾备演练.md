# LLM 应用灾备演练

> 不出问题不代表没问题。主动进行灾备演练，在真正的故障发生前发现弱点。

---

## 一、灾备演练的价值

```mermaid
graph TB
    subgraph 不演练 &#123;"❌ 不演练"&#125;
        N1["平时没问题"] --> N2["出故障时手忙脚乱"]
        N2 --> N3["恢复时间长<br/>用户投诉多"]
    end

    subgraph 演练 &#123;"✅ 定期演练"&#125;
        T1["主动模拟故障"] --> T2["发现弱点"]
        T2 --> T3["提前修复"]
        T3 --> T4["真正故障时快速恢复"]
    end

    style 不演练 fill:'#FFCDD2'
    style 演练 fill:'#C8E6C9'
```

## 二、演练场景设计

```mermaid
graph TB
    subgraph 演练场景 &#123;"五个演练场景"&#125;
        S1["🔴 模型API宕机<br/>OpenAI不可用时能否降级"]
        S2["🔴 向量库故障<br/>FAISS文件损坏时能否恢复"]
        S3["🟡 数据库故障<br/>对话历史DB不可用"]
        S4["🟡 网络分区<br/>API延迟10秒时"]
        S5["🟢 高负载<br/>QPS突增10倍"]
    end

    style 演练场景 fill:'#E3F2FD'
```

## 三、演练实现

### 3.1 模拟API故障

```python
class FailoverLLM:
    """带故障转移的LLM（已覆盖）"""
    # 参见知识库/63-LLM应用容灾与高可用.md

def simulate_api_outage():
    """演练：模拟API故障"""
    print("🔴 演练: 模拟OpenAI API不可用")

    # 用Mock模拟API失败
    from unittest.mock import patch, MagicMock
    mock_llm = MagicMock()
    mock_llm.invoke.side_effect = Exception("Simulated API outage")

    # 测试是否正确降级
    failover = FailoverLLM()
    # 替换主模型为会失败的Mock
    failover.models[0] = ("OpenAI(MOCK)", mock_llm)

    try:
        result = failover.invoke("测试问题")
        # 验证：应该降级到备用模型
        print(f"✅ 降级成功: &#123;result&#125;")
    except Exception as e:
        print(f"❌ 降级失败: &#123;e&#125;")

    # 检查健康状态
    health = failover.health
    print(f"健康状态: &#123;health&#125;")
```

### 3.2 模拟向量库故障

```python
import os

def simulate_vectorstore_failure(vectorstore_path: str):
    """演练：模拟向量库文件损坏"""
    print("🔴 演练: 模拟向量库故障")

    # Step 1: 模拟文件被删除
    if os.path.exists(vectorstore_path):
        backup = vectorstore_path + ".bak"
        os.rename(vectorstore_path, backup)
        print(f"  已临时移走向量库文件")

    # Step 2: 测试应用行为
    try:
        db = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
        print("❌ 应该失败但没有")
    except Exception:
        print("✅ 正确检测到向量库不可用")

        # Step 3: 测试是否有备份恢复
        if os.path.exists(backup):
            os.rename(backup, vectorstore_path)
            db = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
            print("✅ 从备份恢复成功")

def simulate_db_failure():
    """演练：模拟对话历史DB不可用"""
    print("🔴 演练: 模拟数据库故障")

    # 用错误的连接字符串
    try:
        history = SQLChatMessageHistory(
            session_id="test",
            connection_string="sqlite:///nonexistent/path/db.db"
        )
        history.add_user_message("测试")
        print("❌ 应该失败但没有")
    except Exception:
        print("✅ 正确处理了DB故障")
```

### 3.3 模拟高负载

```python
import asyncio
import time

async def simulate_high_load(chat_func, concurrency: int = 50):
    """演练：模拟高并发"""
    print(f"🟡 演练: 模拟&#123;concurrency&#125;并发请求")

    async def single_request(i):
        start = time.time()
        try:
            result = await chat_func(f"问题&#123;i&#125;")
            latency = time.time() - start
            return &#123;"success": True, "latency": latency&#125;
        except Exception as e:
            latency = time.time() - start
            return &#123;"success": False, "error": str(e), "latency": latency&#125;

    start = time.time()
    tasks = [single_request(i) for i in range(concurrency)]
    results = await asyncio.gather(*tasks)
    total_time = time.time() - start

    # 分析结果
    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]
    latencies = sorted([r["latency"] for r in successes])

    print(f"  总耗时: &#123;total_time:.1f&#125;s")
    print(f"  成功: &#123;len(successes)&#125;/&#123;concurrency&#125;")
    print(f"  失败: &#123;len(failures)&#125;")
    if latencies:
        print(f"  P50延迟: &#123;latencies[len(latencies)//2]:.2f&#125;s")
        print(f"  P95延迟: &#123;latencies[int(len(latencies)*0.95)]:.2f&#125;s")
```

## 四、演练流程

```mermaid
graph TB
    subgraph 演练流程 &#123;"灾备演练流程"&#125;
        P1["1. 制定演练计划<br/>选择场景+定义指标"]
        P1 --> P2["2. 通知相关人员<br/>告知演练时间"]
        P2 --> P3["3. 执行故障注入<br/>按计划模拟故障"]
        P3 --> P4["4. 观察系统行为<br/>记录降级/恢复"]
        P4 --> P5["5. 恢复正常<br/>撤销故障注入"]
        P5 --> P6["6. 总结复盘<br/>发现弱点+改进"]
    end

    P6 -.->|"改进后"| P1

    style P1 fill:'#E3F2FD'
    style P5 fill:'#C8E6C9'
```

## 五、演练检查表

| 场景 | 预期行为 | 验证方法 | 状态 |
|------|---------|---------|------|
| API宕机 | 降级到备用模型 | 检查返回结果来源 | ☐ |
| 向量库损坏 | 返回友好错误或搜索兜底 | 检查降级行为 | ☐ |
| DB不可用 | 新对话可继续(无历史) | 检查是否崩溃 | ☐ |
| 网络延迟 | 超时后重试或降级 | 检查超时处理 | ☐ |
| 高并发 | 限流生效+无崩溃 | 检查成功率和延迟 | ☐ |
| 恢复时间 | 故障恢复后立即正常 | 恢复后测试 | ☐ |
