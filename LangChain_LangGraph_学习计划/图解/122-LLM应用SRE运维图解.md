# LLM 应用 SRE 运维图解

> 用图解理解事故分级、响应流程和复盘要点。

---

## 一、LLM SRE独特挑战

```mermaid
graph TB
    subgraph 额外关注 {"LLM SRE额外关注"}
        L1["模型API可用性"]
        L2["Token消耗趋势"]
        L3["幻觉率"]
        L4["Agent行为"]
        L5["向量库健康"]
    end

    style 额外关注 fill:#FFCDD2
```

---

## 二、事故四级

```mermaid
graph TB
    SEV1["SEV1: 系统宕机<br/>5分钟响应"] --> SEV2["SEV2: 严重退化<br/>30分钟响应"]
    SEV2 --> SEV3["SEV3: 局部问题<br/>2小时响应"]
    SEV3 --> SEV4["SEV4: 小问题<br/>下个工作日"]

    style SEV1 fill:#FFCDD2,stroke:#C62828,stroke-width:3px
    style SEV2 fill:#FFE0B2
    style SEV3 fill:#FFF9C4
    style SEV4 fill:#C8E6C9
```

---

## 三、事故响应流程

```mermaid
graph LR
    S1["检测"] --> S2["分类"] --> S3["响应"] --> S4["缓解"] --> S5["复盘"]

    style S1 fill:#FFCDD2
    style S4 fill:#FFF9C4,stroke:#F9A825,stroke-width:3px
    style S5 fill:#C8E6C9
```

---

## 四、缓解措施

```mermaid
graph TB
    API_DOWN["API不可用<br/>→ 切备用模型+降级"]
    HIGH_ERR["高错误率<br/>→ 检查部署+增加重试"]
    HIGH_LAT["高延迟<br/>→ 关重排序+增缓存TTL"]
    AGENT_LOOP["Agent死循环<br/>→ 检查max_iterations"]
    VEC_SLOW["向量库慢<br/>→ 重建索引+检查内存"]

    style API_DOWN fill:#FFCDD2
    style HIGH_ERR fill:#FFE0B2
    style HIGH_LAT fill:#FFF9C4
```

---

## 五、复盘5要素

```mermaid
graph TB
    subgraph 复盘 {"复盘5要素"}
        R1["时间线"]
        R2["根因(5Why)"]
        R3["影响评估"]
        R4["改进项"]
        R5["经验文档化"]
    end

    style 复盘 fill:#E3F2FD
```

---

## 六、检查清单

| 检查项 | 状态 |
|--------|------|
| 有事故分级 | ☐ |
| 有响应流程 | ☐ |
| 有值班制度 | ☐ |
| 有复盘模板 | ☐ |
| 有运维手册 | ☐ |
