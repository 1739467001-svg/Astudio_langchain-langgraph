# Agent 自愈图解

> 用图解理解 Agent 的四种自愈模式。

---

## 一、自愈的价值

```mermaid
graph TB
    subgraph 无自愈 &#123;"❌ 无自愈"&#125;
        E1["出错"] --> E2["崩溃"] --> E3["用户手动重试"]
    end

    subgraph 有自愈 &#123;"✅ 有自愈"&#125;
        S1["出错"] --> S2["检测异常"] --> S3["自动调整"] --> S4["恢复继续"]
    end

    style 无自愈 fill:'#FFCDD2'
    style 有自愈 fill:'#C8E6C9'
```

## 二、四种自愈模式

```mermaid
graph TB
    subgraph 四种模式 &#123;"Agent 自愈四种模式"&#125;
        M1["1.重试自愈<br/>失败→指数退避→重试<br/>适合: 超时/限流"]
        M2["2.降级自愈<br/>复杂方案→简单方案<br/>适合: Agent失败→Chain"]
        M3["3.换路径自愈<br/>工具A→工具B<br/>适合: 主工具不可用"]
        M4["4.状态修复自愈<br/>截断/重置/修复State<br/>适合: 数据异常"]
    end

    style M1 fill:'#C8E6C9'
    style M2 fill:'#E3F2FD'
    style M3 fill:'#FFF9C4'
    style M4 fill:'#F3E5F5'
```

## 三、自愈决策

```mermaid
graph TD
    Q&#123;"错误类型?"&#125;
    Q -->|"临时性(超时/限流)"| R["重试自愈"]
    Q -->|"方法失败(工具不可用)"| D["降级/换路径"]
    Q -->|"State损坏(数据异常)"| S["状态修复"]
    Q -->|"永久性(认证失败)"| F["❌ 无法自愈→报错"]

    style R fill:'#C8E6C9'
    style F fill:'#FFCDD2'
```

## 四、LangGraph 自愈流程

```mermaid
graph TB
    S([START]) --> P["处理节点<br/>(带try-catch)"]
    P --> CHECK&#123;"有错误?"&#125;
    CHECK -->|"无"| DONE([END ✅])
    CHECK -->|"有"| HEAL&#123;"自愈检查"&#125;
    HEAL -->|"可重试<br/>retry<3"| P
    HEAL -->|"降级"| FALL["降级节点<br/>简单方案"]
    HEAL -->|"无法自愈"| FAIL["返回错误"]

    FALL --> DONE

    style CHECK fill:'#FFF9C4'
    style HEAL fill:'#FFE0B2'
    style DONE fill:'#C8E6C9'
```

## 五、自愈检查清单

| 检查项 | 状态 |
|--------|------|
| 重试机制 | ☐ |
| 降级方案 | ☐ |
| 工具备用 | ☐ |
| State修复 | ☐ |
| 自愈记录 | ☐ |
| 自愈上限 | ☐ |
