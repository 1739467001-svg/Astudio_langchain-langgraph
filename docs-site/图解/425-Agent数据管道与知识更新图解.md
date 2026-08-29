# Agent 数据管道与知识更新图解

> 知识库如何持续保鲜？本图解可视化数据管道全流程和增量更新机制。

---

## 数据管道全流程

```mermaid
graph LR
    SRC["数据源<br/>API/文件/网页/DB"] --> COLLECT["采集"]
    COLLECT --> CLEAN["清洗<br/>去重/去噪/过滤"]
    CLEAN --> CHUNK["分块<br/>自适应策略"]
    CHUNK --> EMBED["向量化"]
    EMBED --> INDEX["索引"]
    INDEX --> STORE["向量库"]
    STORE --> RETRIEVE["检索"]
    RETRIEVE --> AGENT["Agent回答"]

    style COLLECT fill:#E3F2FD,stroke:#1565C0
    style CHUNK fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style STORE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 增量更新

```mermaid
graph TB
    NEW["新数据"] --> DIFF&#123;"变更检测"&#125;
    DIFF --> ADDED["➕ 新增"]
    DIFF --> MODIFIED["📝 修改"]
    DIFF --> DELETED["➖ 删除"]

    ADDED --> ADD_VEC["添加到向量库"]
    MODIFIED --> DEL_VEC["删除旧版本"] --> ADD_VEC
    DELETED --> DEL_VEC2["从向量库删除"]

    style DIFF fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style ADD_VEC fill:#C8E6C9,stroke:#2E7D32
    style DEL_VEC fill:#FFCCBC,stroke:#D84315
    style DEL_VEC2 fill:#FFCCBC,stroke:#D84315
```

---

## 定时调度

```mermaid
graph TB
    SCHED["调度器"]

    SCHED --> DAILY["每天2:00<br/>全量刷新<br/>重新建立索引"]
    SCHED --> HOURLY["每小时<br/>增量更新<br/>检测变更"]
    SCHED --> MIN5["每5分钟<br/>网页变化检查<br/>保持实时"]

    style DAILY fill:#E3F2FD,stroke:#1565C0
    style HOURLY fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style MIN5 fill:#C8E6C9,stroke:#2E7D32
```

---

## 失效检测

| 检测项 | 触发条件 | 处理方式 |
|--------|---------|---------|
| 时间过期 | >90天未更新 | 重新采集/删除 |
| 链接失效 | URL不可访问 | 标记/删除 |
| 内容过短 | <50字符 | 质量检查 |
| 检索分数低 | Top得分<0.5 | 重新分块 |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 多源采集 | ☐ |
| 数据清洗 | ☐ |
| 自适应分块 | ☐ |
| 增量更新 | ☐ |
| 定时调度 | ☐ |
| 失效检测 | ☐ |
| 质量监控 | ☐ |
