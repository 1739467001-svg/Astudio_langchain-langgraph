# Agent 个性化与用户画像系统图解

> 同一 Agent 对不同用户给出不同回答。本图解可视化画像构建和个性化策略。

---

## 画像维度

```mermaid
graph TB
    PROFILE["用户画像"]

    PROFILE --> TECH["技术画像<br/>水平/框架/语言"]
    PROFILE --> PREF["偏好画像<br/>风格/细节/emoji"]
    PROFILE --> BEHAV["行为画像<br/>话题/查询模式/活跃时间"]
    PROFILE --> HIST["交互画像<br/>次数/满意度/最后交互"]

    style PROFILE fill:#E3F2FD,stroke:#1565C0,stroke-width:3px
    style TECH fill:#C8E6C9,stroke:#2E7D32
    style PREF fill:#FFF9C4,stroke:#F9A825
    style BEHAV fill:#F3E5F5,stroke:#7B1FA2
    style HIST fill:#FFCCBC,stroke:#D84315
```

---

## 画像构建

```mermaid
graph TB
    EXPLICIT["显式采集<br/>注册时填写<br/>角色/水平/风格"]
    IMPLICIT["隐式推断<br/>从交互历史<br/>话题/模式/满意度"]
    UPDATE["自动更新<br/>每次交互后<br/>移动平均"]

    EXPLICIT --> PROFILE["用户画像"]
    IMPLICIT --> PROFILE
    UPDATE --> PROFILE

    style EXPLICIT fill:#E3F2FD,stroke:#1565C0
    style IMPLICIT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style UPDATE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 个性化流程

```mermaid
graph LR
    QUERY["用户提问"] --> LOAD["加载画像"]
    LOAD --> PROMPT["动态组装Prompt<br/>技术水平/风格/兴趣"]
    PROMPT --> MODEL["选择模型<br/>满意度低→更好模型"]
    MODEL --> RESP["个性化回答"]
    RESP --> UPDATE["更新画像"]

    style LOAD fill:#E3F2FD,stroke:#1565C0
    style PROMPT fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style UPDATE fill:#C8E6C9,stroke:#2E7D32
```

---

## 技术水平适配

| 水平 | 回答策略 | 示例 |
|------|---------|------|
| 入门 | 通俗语言+详细步骤+避免术语 | "RAG 就像是帮AI查资料再回答" |
| 中级 | 专业术语+适度深度 | "RAG 通过向量检索增强生成" |
| 专家 | 直接技术细节+不解释基础 | "PagedAttention + Continuous Batching" |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解画像维度 | ☐ |
| 显式+隐式采集 | ☐ |
| 画像自动更新 | ☐ |
| 画像驱动Prompt | ☐ |
| 个性化推荐 | ☐ |
| LangGraph集成 | ☐ |
