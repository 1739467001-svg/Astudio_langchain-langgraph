# SLO 告警图解

> 用图解理解 LLM 应用的 SLO 定义和告警机制。

---

## 一、SLO/SLI/SLA 关系

```mermaid
graph TB
    subgraph 三概念 &#123;"SLI → SLO → SLA"&#125;
        SLI["SLI(指标)<br/>实际测量值<br/>延迟P95=3.2s"]
        SLO["SLO(目标)<br/>期望值<br/>延迟P95<5s"]
        SLA["SLA(协议)<br/>给用户承诺<br/>99.9%可用"]
        SLI -->|"对比"| SLO
        SLO -->|"基于"| SLA
    end

    style 三概念 fill:'#E3F2FD'
```

## 二、SLO 看板

```mermaid
graph TB
    subgraph 看板 &#123;"SLO 监控看板"&#125;
        A["📊 可用性<br/>目标: 99.9%<br/>当前: 99.95% ✅"]
        B["⏱️ P95延迟<br/>目标: <5s<br/>当前: 3.2s ✅"]
        C["❌ 错误率<br/>目标: <5%<br/>当前: 2.1% ✅"]
        D["💰 日成本<br/>目标: <$50<br/>当前: $32 ✅"]
        E["🎯 质量<br/>目标: >85%<br/>当前: 88% ✅"]
    end

    style 看板 fill:'#C8E6C9'
```

## 三、告警流程

```mermaid
graph TB
    SLI["SLI指标<br/>收集"] --> CHECK&#123;"对比SLO"&#125;
    CHECK -->|"达标"| OK["✅ 正常"]
    CHECK -->|"超限"| ALERT["⚠️ 告警"]
    ALERT --> LVL&#123;"级别?"&#125;
    LVL -->|"WARN"| NOTIF["通知运维"]
    LVL -->|"ERROR"| URGENT["紧急通知<br/>邮件/短信"]

    style OK fill:'#C8E6C9'
    style ALERT fill:'#FFE0B2'
    style URGENT fill:'#FFCDD2'
```

## 四、SLO 检查清单

| SLO | 目标 | 告警阈值 |
|-----|------|---------|
| 可用性 | 99.9% | <99.5% |
| 延迟P95 | <5s | >5s |
| 错误率 | <5% | >5% |
| 质量 | >85% | <80% |
| 日成本 | <$50 | >$40 |
