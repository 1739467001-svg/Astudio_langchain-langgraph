# Agent 反馈学习图解

> 用图解理解反馈收集、分析归因和持续优化飞轮。

---

## 一、反馈学习闭环

```mermaid
graph LR
    A["Agent回答"] → B["用户反馈"]
    B → C["分析归因"]
    C → D["改进措施"]
    D → E["A/B测试"]
    E →|"B更好"| F["上线B"]
    F → A
    E →|"A更好"| B

    style B fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style E fill:#C8E6C9
```

---

## 二、三种反馈类型

```mermaid
graph TB
    subgraph 类型 &#123;"三种反馈"&#125;
        F1["显式反馈<br/>👍/👎/评分"]
        F2["隐式反馈<br/>复制/重生成/转人工"]
        F3["修正反馈<br/>用户改了答案<br/>最有价值"]
    end

    style F3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 三、反馈分析

```mermaid
graph TB
    NEGATIVE["负面反馈"] → ANALYZE["LLM分析归因"]
    ANALYZE → CAT&#123;"问题类别"&#125;
    CAT -->|检索不准| C1["优化检索"]
    CAT -->|推理错误| C2["改进Prompt"]
    CAT -->|格式错误| C3["加输出约束"]
    CAT -->|幻觉| C4["加验证+护栏"]
    CAT -->|内容缺失| C5["补充知识库"]

    style ANALYZE fill:#FFF9C4
```

---

## 四、持续优化飞轮

```mermaid
graph TB
    F1["上线运行"] → F2["收集反馈"]
    F2 → F3["分析归因"]
    F3 → F4["制定改进"]
    F4 → F5["A/B测试"]
    F5 →|"B更好"| F6["上线B版本"]
    F5 →|"A更好"| F2
    F6 → F1

    style F2 fill:#FFF9C4
    style F5 fill:#C8E6C9
    style F6 fill:#C8E6C9
```

---

## 五、改进措施矩阵

| 问题类别 | 改进措施 | 优先级 |
|----------|----------|--------|
| 检索不准 | 查询重写+重排序 | ★★★ |
| 推理错误 | 加CoT+改Prompt | ★★★ |
| 格式错误 | 加结构化输出 | ★★☆ |
| 幻觉 | Self-RAG+护栏 | ★★★ |
| 内容缺失 | 补知识库+Web搜索 | ★★☆ |

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有反馈收集 | ☐ |
| 有修正反馈 | ☐ |
| 有分析归因 | ☐ |
| 有A/B测试 | ☐ |
| 有持续飞轮 | ☐ |
