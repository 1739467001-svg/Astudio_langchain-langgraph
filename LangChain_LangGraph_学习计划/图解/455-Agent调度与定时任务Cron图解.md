# Agent 调度与定时任务 Cron 图解

> Agent 主动做事：每天早报、每周周报、每分钟检测。本图解可视化调度架构。

---

## 调度场景

```mermaid
graph TB
    SCHED["定时调度"]

    SCHED --> DAILY["每日早报<br/>9:00<br/>采集+生成+发送"]
    SCHED --> WEEKLY["每周周报<br/>周一9:00<br/>汇总+分析+报告"]
    SCHED --> KB["知识库更新<br/>2:00<br/>采集+清洗+索引"]
    SCHED --> CHECK["异常检测<br/>每1分钟<br/>指标+诊断+告警"]
    SCHED --> CLEAN["数据清理<br/>周日0:00<br/>过期+优化"]

    style SCHED fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style DAILY fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
    style CHECK fill:#FFCCBC,stroke:#D84315,stroke-width:2px
```

---

## Cron 速查

```
分 时 日 月 周
*  *  *  *  *  → 每分钟
0  9  *  *  *  → 每天9:00
0  9  *  *  1  → 每周一9:00
*/5 *  *  *  *  → 每5分钟
0  */2 *  *  *  → 每2小时
0  9  1  *  *  → 每月1日9:00
30 23  *  *  *  → 每天23:30
```

---

## APScheduler 集成

```mermaid
graph TB
    CONFIG["任务配置<br/>Cron表达式"] --> SCHEDULER["APScheduler"]
    SCHEDULER --> TRIGGER["触发执行"]
    TRIGGER --> AGENT["Agent任务"]
    AGENT --> RESULT["结果+通知"]

    style SCHEDULER fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style AGENT fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| Cron表达式 | ☐ |
| 调度器实现 | ☐ |
| 每日/每周/间隔 | ☐ |
| 早报任务 | ☐ |
| 知识库更新 | ☐ |
| 异常检测 | ☐ |
| LangGraph Cron | ☐ |
