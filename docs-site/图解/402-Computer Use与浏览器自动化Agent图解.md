# Computer Use 与浏览器自动化 Agent 图解

> AI 看屏幕、移鼠标、点按钮——像人一样操作电脑。本图解可视化 Computer Use 的核心循环、安全策略和方案对比。

---

## 工作循环

```mermaid
graph LR
    A["📸 截取屏幕"] --> B["🧠 LLM 分析截图<br/>理解页面内容"]
    B --> C["🎯 决定操作<br/>点击/输入/滚动"]
    C --> D["⚡ 执行操作"]
    D --> E&#123;"任务完成?"&#125;
    E -->|"否"| A
    E -->|"是"| F["✅ 返回结果"]

    style B fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px
    style A fill:#E3F2FD,stroke:#1565C0
    style D fill:#C8E6C9,stroke:#2E7D32
```

---

## 操作类型

```mermaid
graph TB
    OPS["Computer Use 操作"]

    OPS --> SCREEN["屏幕操作"]
    OPS --> KEY["键盘操作"]
    OPS --> NAV["导航操作"]

    SCREEN --> S1["screenshot 截图"]
    SCREEN --> S2["click(x,y) 点击"]
    SCREEN --> S3["right_click 右键"]
    SCREEN --> S4["scroll 滚动"]

    KEY --> K1["type 输入文本"]
    KEY --> K2["key 按键组合<br/>ctrl+c / Return"]

    NAV --> N1["wait 等待"]
    NAV --> N2["cursor 移动光标"]

    style OPS fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style SCREEN fill:#FFF9C4,stroke:#F9A825
    style KEY fill:#F3E5F5,stroke:#7B1FA2
    style NAV fill:#C8E6C9,stroke:#2E7D32
```

---

## 传统自动化 vs AI 驱动

```mermaid
graph LR
    subgraph "传统（Playwright/Selenium）"
        T1["写代码定位元素"] --> T2["点击/输入"]
        T2 --> T3["验证结果"]
        T3 --> T4["页面改版→脚本失效 ❌"]
    end

    subgraph "AI 驱动（Computer Use）"
        A1["截图给 LLM"] --> A2["LLM 看图决策"]
        A2 --> A3["执行操作"]
        A3 --> A4["页面改版也能适应 ✅"]
    end

    style T4 fill:#FFCCBC,stroke:#D84315
    style A4 fill:#C8E6C9,stroke:#2E7D32
```

---

## 方案对比

| 方案 | 速度 | 成本 | 适应性 | 安全 |
|------|------|------|--------|------|
| Anthropic Computer Use | 慢(4s/步) | 高 | 极强 | 需沙箱 |
| Playwright + LLM | 中 | 中 | 中 | 较好 |
| Browser Use(开源) | 中 | 中 | 强 | 一般 |
| 纯 Playwright | 快 | 低 | 弱 | 好 |

---

## 安全策略

```mermaid
graph LR
    REQ["操作请求"] --> URL&#123;"URL 白名单"&#125;
    URL -->|"通过"| INPUT&#123;"输入审计"&#125;
    URL -->|"拒绝"| BLOCK1["⛔ 拒绝"]
    INPUT -->|"安全"| EXEC["✅ 执行"]
    INPUT -->|"敏感"| BLOCK2["⛔ 拦截"]

    style URL fill:#FFCCBC,stroke:#D84315
    style INPUT fill:#FFF9C4,stroke:#F9A825
    style EXEC fill:#C8E6C9,stroke:#2E7D32
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Computer Use 工作循环 | ☐ |
| 能调用 Computer Use API | ☐ |
| 理解操作类型 | ☐ |
| Playwright 集成 | ☐ |
| 安全策略配置 | ☐ |
| 成本模型理解 | ☐ |
