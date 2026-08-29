# LLM 应用灰度发布与版本管理

> LLM 应用的"发布"不是简单的代码部署——Prompt、模型、向量库都可能变化。需要灰度发布机制。

---

## 一、为什么需要灰度发布

```mermaid
graph TB
    subgraph 直接发布 &#123;"❌ 直接全量发布"&#125;
        D1["新版本上线"] --> D2["如果有问题<br/>所有用户受影响"]
        D2 --> D3["回滚需要时间"]
    end

    subgraph 灰度发布 &#123;"✅ 灰度发布"&#125;
        G1["新版本上线"] --> G2["先给5%用户使用"]
        G2 --> G3&#123;"监控指标?"&#125;
        G3 -->|"正常"| G4["扩大到20%→50%→100%"]
        G3 -->|"异常"| G5["回滚(只影响5%)"]
    end

    style 直接发布 fill:'#FFCDD2'
    style 灰度发布 fill:'#C8E6C9'
```

## 二、版本管理的三个维度

```mermaid
graph TB
    subgraph 三维版本 &#123;"LLM应用版本三维度"&#125;
        V1["代码版本<br/>Python代码变更<br/>(git管理)"]
        V2["Prompt版本<br/>System Prompt/模板变更<br/>(Prompt注册表)"]
        V3["数据版本<br/>向量库/知识库变更<br/>(索引版本)"]
    end

    style 三维版本 fill:'#E3F2FD'
```

## 三、灰度发布实现

### 3.1 基于用户路由的灰度

```python
import hashlib

class CanaryRouter:
    """灰度路由器：按用户ID百分比分流"""
    def __init__(self):
        self.versions = &#123;
            "stable": &#123;"prompt": "v1.0", "model": "gpt-4o-mini", "vectorstore": "v1"&#125;,
            "canary": &#123;"prompt": "v1.1", "model": "gpt-4o-mini", "vectorstore": "v1"&#125;,
        &#125;
        self.canary_percentage = 5  # 5%用户使用canary

    def get_version(self, user_id: str) -> str:
        """根据用户ID决定用哪个版本"""
        # 用hash确保同一用户始终到同一版本
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        if hash_val < self.canary_percentage:
            return "canary"
        return "stable"

    def get_config(self, user_id: str) -> dict:
        """获取版本配置"""
        version = self.get_version(user_id)
        return self.versions[version]

# 使用
router = CanaryRouter()

def chat_with_canary(user_id: str, question: str) -> str:
    """带灰度发布的聊天"""
    config = router.get_config(user_id)
    version = router.get_version(user_id)

    # 根据版本选择Prompt和模型
    prompt = get_prompt("qa_system", config["prompt"])
    llm = get_llm(model=config["model"])

    chain = prompt | llm | StrOutputParser()
    result = chain.invoke(&#123;"input": question&#125;)

    # 记录版本信息用于对比
    log_version(user_id, version, question, result)
    return result
```

### 3.2 A/B 测试

```python
class ABTestManager:
    """A/B测试管理器"""
    def __init__(self):
        self.experiments = &#123;&#125;

    def create_experiment(self, name: str, variants: dict, traffic_split: dict):
        """创建实验"""
        self.experiments[name] = &#123;
            "variants": variants,       # &#123;"A": config_a, "B": config_b&#125;
            "traffic_split": traffic_split,  # &#123;"A": 50, "B": 50&#125;
            "results": &#123;"A": [], "B": []&#125;,
        &#125;

    def assign(self, experiment: str, user_id: str) -> str:
        """分配用户到实验组"""
        exp = self.experiments.get(experiment)
        if not exp:
            return "A"

        hash_val = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        cumulative = 0
        for variant, percentage in exp["traffic_split"].items():
            cumulative += percentage
            if hash_val < cumulative:
                return variant
        return list(exp["traffic_split"].keys())[-1]

    def record_result(self, experiment: str, variant: str, metric: float):
        """记录结果"""
        if experiment in self.experiments:
            self.experiments[experiment]["results"][variant].append(metric)

    def compare(self, experiment: str) -> dict:
        """对比结果"""
        exp = self.experiments.get(experiment)
        if not exp:
            return &#123;&#125;
        results = &#123;&#125;
        for variant, metrics in exp["results"].items():
            if metrics:
                results[variant] = &#123;
                    "count": len(metrics),
                    "avg": sum(metrics) / len(metrics),
                &#125;
        return results
```

## 四、向量库版本管理

```python
class VersionedVectorStore:
    """带版本的向量库管理"""
    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_version_path(self, version: str) -> str:
        return f"&#123;self.base_path&#125;/v&#123;version&#125;"

    def build_new_version(self, documents, version: str):
        """构建新版本索引"""
        path = self.get_version_path(version)
        db = FAISS.from_documents(documents, embeddings)
        db.save_local(path)
        print(f"✅ 版本 &#123;version&#125; 已构建: &#123;path&#125;")
        return db

    def load_version(self, version: str):
        """加载指定版本"""
        path = self.get_version_path(version)
        return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)

    def list_versions(self) -> list[str]:
        """列出所有版本"""
        import os
        if not os.path.exists(self.base_path):
            return []
        return sorted([
            d.replace("v", "") for d in os.listdir(self.base_path)
            if d.startswith("v")
        ])

    def rollback(self, target_version: str):
        """回滚到指定版本"""
        versions = self.list_versions()
        if target_version in versions:
            print(f"✅ 回滚到版本 &#123;target_version&#125;")
            return self.load_version(target_version)
        print(f"❌ 版本 &#123;target_version&#125; 不存在")
```

## 五、灰度发布检查清单

| 步骤 | 检查项 | 状态 |
|------|--------|------|
| 发布前 | 新版本通过测试 | ☐ |
| 发布前 | 监控就位 | ☐ |
| 发布 | 灰度比例5% | ☐ |
| 观察 | 延迟正常 | ☐ |
| 观察 | 错误率正常 | ☐ |
| 观察 | 满意度正常 | ☐ |
| 扩大 | 逐步扩大到100% | ☐ |
| 完成 | 标记旧版本为归档 | ☐ |

## 六、回滚策略

```mermaid
graph TB
    subgraph 回滚 &#123;"回滚决策"&#125;
        M["监控指标"] --> CHECK&#123;"是否异常?"&#125;
        CHECK -->|"延迟↑30%+"| ROLL["立即回滚"]
        CHECK -->|"错误率↑5%+"| ROLL
        CHECK -->|"满意度↓10%+"| ROLL
        CHECK -->|"正常"| CONTINUE["继续灰度"]
        ROLL --> RESTORE["恢复到上一稳定版本"]
    end

    style ROLL fill:'#FFCDD2'
    style CONTINUE fill:'#C8E6C9'
```
