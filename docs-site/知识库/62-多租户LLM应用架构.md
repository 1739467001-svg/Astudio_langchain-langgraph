# 多租户 LLM 应用架构

> 多个组织/团队共享一个 LLM 应用实例，但数据完全隔离。本指南覆盖多租户架构设计。

---

## 一、多租户的价值与挑战

```mermaid
graph TB
    subgraph 单租户 &#123;"单租户（每个客户独立部署）"&#125;
        S1["客户A: 独立实例"]
        S2["客户B: 独立实例"]
        S3["客户C: 独立实例"]
        Note1["✅ 完全隔离 ✅ 可定制<br/>❌ 成本高 ❌ 运维复杂"]
    end

    subgraph 多租户 &#123;"多租户（共享实例+逻辑隔离）"&#125;
        M1["共享应用实例"]
        M1 --> MA["客户A数据(隔离)"]
        M1 --> MB["客户B数据(隔离)"]
        M1 --> MC["客户C数据(隔离)"]
        Note2["✅ 成本低 ✅ 运维简单<br/>⚠️ 需要严格的隔离"]
    end

    style 单租户 fill:'#FFE0B2'
    style 多租户 fill:'#C8E6C9'
```

## 二、隔离层级

```mermaid
graph TB
    subgraph 隔离层级 &#123;"三种隔离层级（从弱到强）"&#125;
        L1["Level 1: 应用层隔离<br/>同一DB+tenant_id字段过滤<br/>✅ 最简单 ⚠️ 依赖应用正确性"]
        L2["Level 2: Schema隔离<br/>每个租户独立Schema<br/>✅ DB级隔离 ⚠️ Schema管理"]
        L3["Level 3: 独立DB<br/>每个租户独立数据库<br/>✅ 最强隔离 ❌ 成本高"]
    end

    L1 --> L2 --> L3

    style L1 fill:'#C8E6C9'
    style L3 fill:'#FFCDD2'
```

## 三、实现方案

### 3.1 应用层隔离（推荐起步）

```python
from pydantic import BaseModel

class TenantContext(BaseModel):
    """租户上下文（贯穿整个请求链路）"""
    tenant_id: str
    tenant_name: str = ""

# 每次请求注入租户上下文
def get_tenant_llm(tenant: TenantContext):
    """获取租户专属的LLM配置"""
    tenant_configs = &#123;
        "tenant_a": &#123;"model": "gpt-4o-mini", "temperature": 0&#125;,
        "tenant_b": &#123;"model": "gpt-4o", "temperature": 0.7&#125;,
    &#125;
    config = tenant_configs.get(tenant.tenant_id, &#123;"model": "gpt-4o-mini"&#125;)
    return ChatOpenAI(**config)

# 向量库按租户隔离
def get_tenant_vectorstore(tenant: TenantContext):
    """获取租户专属的向量库"""
    index_path = f"data/vector_store/&#123;tenant.tenant_id&#125;"
    if os.path.exists(index_path):
        return FAISS.load_local(index_path, embeddings, allow_dangerous_deserialization=True)
    return None  # 该租户无数据

# 对话历史按租户隔离
def get_tenant_history(tenant: TenantContext, session_id: str):
    """获取租户专属对话历史"""
    return SQLChatMessageHistory(
        session_id=f"&#123;tenant.tenant_id&#125;_&#123;session_id&#125;",  # 加租户前缀
        connection_string="sqlite:///chat.db"
    )
```

### 3.2 多租户 RAG

```python
def tenant_rag(tenant: TenantContext, question: str) -> str:
    """租户隔离的RAG问答"""
    # 1. 只检索该租户的向量库
    vectorstore = get_tenant_vectorstore(tenant)
    if not vectorstore:
        return "您的知识库为空，请先上传文档。"

    # 2. 检索
    docs = vectorstore.similarity_search(question, k=3)
    context = "\n".join(d.page_content for d in docs)

    # 3. 生成（用租户配置的LLM）
    llm = get_tenant_llm(tenant)
    prompt = ChatPromptTemplate.from_template(
        f"你是&#123;tenant.tenant_name&#125;的AI助手。基于知识回答：\n&#123;&#123;context&#125;&#125;\n问题：&#123;&#123;question&#125;&#125;"
    )
    chain = prompt | llm | StrOutputParser()
    return chain.invoke(&#123;"context": context, "question": question&#125;)
```

## 四、数据隔离检查

```mermaid
graph TB
    subgraph 隔离检查 &#123;"多租户隔离检查清单"&#125;
        C1["✅ 向量库按tenant_id分区"]
        C2["✅ 对话历史加tenant_id前缀"]
        C3["✅ LLM配置可按租户定制"]
        C4["✅ 文档存储按租户分目录"]
        C5["✅ API鉴权包含tenant_id"]
        C6["✅ 日志不泄露跨租户信息"]
        C7["✅ 缓存Key包含tenant_id"]
    end

    style 隔离检查 fill:'#E3F2FD'
```

## 五、选型建议

| 规模 | 隔离方案 | 场景 |
|------|---------|------|
| <10租户 | 独立DB | 大客户/高安全 |
| 10-100租户 | Schema隔离 | 中型企业SaaS |
| >100租户 | 应用层隔离 | 大规模SaaS |
| 学习/原型 | 应用层隔离 | 单机多用户 |
