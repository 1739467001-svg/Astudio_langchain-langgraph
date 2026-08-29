# AI 编程 Agent 与代码自动化图解

> 从代码补全到自主编程——AI 编程 Agent 的工作循环、架构设计和安全沙箱。本图解可视化完整链路。

---

## 三个层次

```mermaid
graph LR
    L1["层次1: 代码补全<br/>Copilot 式<br/>人主导, AI 辅助"]
    L1 --> L2["层次2: 对话编程<br/>Cursor Chat 式<br/>AI 生成, 人审查"]
    L2 --> L3["层次3: 自主 Agent<br/>Devin 式<br/>AI 主导全流程"]

    style L1 fill:#C8E6C9,stroke:#2E7D32
    style L2 fill:#FFF9C4,stroke:#F9A825
    style L3 fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px
```

---

## 工作循环

```mermaid
graph TB
    TASK["用户任务"] --> PLAN["📋 规划<br/>分解任务+技术选型"]
    PLAN --> CODE["💻 编码<br/>生成代码文件"]
    CODE --> RUN["⚡ 执行<br/>运行代码"]
    RUN --> TEST{"🧪 测试通过?"}
    TEST -->|"通过"| REVIEW["🔍 审查<br/>代码质量检查"]
    TEST -->|"失败"| DEBUG["🐛 调试<br/>分析错误+修复"]
    DEBUG --> RUN
    REVIEW --> COMMIT["📦 提交<br/>Git commit"]
    COMMIT --> DONE["✅ 完成"]

    style PLAN fill:#E3F2FD,stroke:#1565C0
    style CODE fill:#FFF9C4,stroke:#F9A825
    style RUN fill:#F3E5F5,stroke:#7B1FA2
    style DEBUG fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style DONE fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 核心工具集

```mermaid
graph TB
    TOOLS["编程 Agent 工具集"]

    TOOLS --> FILE["文件操作<br/>read_file / write_file<br/>list_directory"]
    TOOLS --> CMD["命令执行<br/>run_command<br/>install_package"]
    TOOLS --> TEST_T["测试运行<br/>run_tests<br/>run_python"]
    TOOLS --> GIT["Git 操作<br/>status / add / commit<br/>diff / log"]

    style TOOLS fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style FILE fill:#C8E6C9,stroke:#2E7D32
    style CMD fill:#FFF9C4,stroke:#F9A825
    style TEST_T fill:#F3E5F5,stroke:#7B1FA2
    style GIT fill:#FFCCBC,stroke:#D84315
```

---

## 沙箱隔离方案

```mermaid
graph TB
    CODE["AI 生成的代码"] --> SANDBOX{"选择沙箱"}

    SANDBOX --> DOCKER["Docker 容器<br/>进程隔离+网络隔离<br/>内存/CPU限制"]
    SANDBOX --> E2B["E2B 云沙箱<br/>完全隔离环境<br/>免运维"]
    SANDBOX --> LOCAL["受限 Python<br/>黑名单模块/函数<br/>最轻量但最弱"]

    style DOCKER fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style E2B fill:#E3F2FD,stroke:#1565C0
    style LOCAL fill:#FFCCBC,stroke:#D84315
```

---

## Agent 架构对比

```mermaid
graph TB
    Q["任务复杂度?"] --> SIMPLE{"简单?"}
    SIMPLE -->|"是"| REACT["ReAct<br/>简单直接"]
    SIMPLE -->|"否"| COMPLEX{"需要规划?"}
    COMPLEX -->|"是"| PLANEXEC["Plan-Execute<br/>先规划后执行"]
    COMPLEX -->|"否"| MULTI{"需要专业化?"}
    MULTI -->|"是"| MULTIAGENT["Multi-Agent<br/>分工协作"]
    MULTI -->|"否"| REACT

    style REACT fill:#C8E6C9,stroke:#2E7D32
    style PLANEXEC fill:#FFF9C4,stroke:#F9A825
    style MULTIAGENT fill:#F3E5F5,stroke:#7B1FA2
```

---

## 能力对比

| 能力 | 补全式 | 对话式 | Agent 式 |
|------|--------|--------|---------|
| 生成范围 | 单行/函数 | 整文件 | 多文件/项目 |
| 运行代码 | ❌ | ❌ | ✅ |
| 自主调试 | ❌ | 有限 | ✅ |
| 写+跑测试 | ❌ | ✅ | ✅ |
| Git 操作 | ❌ | ❌ | ✅ |
| 自主规划 | ❌ | ❌ | ✅ |

---

## 成本对比

```mermaid
graph LR
    SIMPLE["简单任务<br/>修 bug/函数<br/>~$0.015<br/>~100s"]
    SIMPLE --> MODERATE["中等任务<br/>完整模块<br/>~$0.05<br/>~300s"]
    MODERATE --> COMPLEX["复杂任务<br/>多文件项目<br/>~$0.25<br/>~5000s"]

    style SIMPLE fill:#C8E6C9,stroke:#2E7D32
    style MODERATE fill:#FFF9C4,stroke:#F9A825
    style COMPLEX fill:#FFCCBC,stroke:#D84315
```

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解三个层次 | ☐ |
| 核心工具集实现 | ☐ |
| 规划-编码-测试-调试循环 | ☐ |
| 代码沙箱配置 | ☐ |
| 代码审查功能 | ☐ |
| 架构选型理解 | ☐ |
| 成本模型理解 | ☐ |
| 安全风险处理 | ☐ |
