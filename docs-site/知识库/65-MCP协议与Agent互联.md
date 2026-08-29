# MCP 协议与 Agent 互联

> MCP（Model Context Protocol）是 Anthropic 提出的开放标准，让 LLM 与外部工具/数据源以统一方式连接。

---

## 一、MCP 是什么

```mermaid
graph TB
    subgraph MCP &#123;"MCP (Model Context Protocol)"&#125;
        LLM["LLM/Agent<br/>(MCP Client)"] --> PROTO["MCP协议<br/>(标准接口)"]
        PROTO --> S1["MCP Server A<br/>(文件系统)"]
        PROTO --> S2["MCP Server B<br/>(数据库)"]
        PROTO --> S3["MCP Server C<br/>(API)"]
        PROTO --> S4["MCP Server D<br/>(自定义)"]
    end

    NOTE["MCP = LLM的USB-C接口<br/>统一标准，即插即用"]

    style MCP fill:'#E3F2FD'
    style NOTE fill:'#C8E6C9'
```

## 二、MCP vs 传统工具调用

```mermaid
graph TB
    subgraph 传统 &#123;"传统工具调用"&#125;
        T1["每个工具单独定义<br/>每个Agent单独配置<br/>工具和Agent紧耦合"]
    end

    subgraph MCP方案 &#123;"MCP方案"&#125;
        M1["工具封装为MCP Server<br/>Agent通过MCP协议发现和调用<br/>解耦+标准化+可复用"]
    end

    style 传统 fill:'#FFE0B2'
    style MCP方案 fill:'#C8E6C9'
```

| 特性 | 传统 @tool | MCP |
|------|-----------|-----|
| 定义方式 | Python函数 | MCP Server |
| 发现方式 | 代码中硬编码 | 运行时动态发现 |
| 复用性 | 每个Agent单独绑定 | 一个Server多Agent共用 |
| 标准化 | 各框架不同 | 统一协议 |
| 生态 | 限于LangChain | 跨框架(Anthropic/LangChain等) |

## 三、MCP 核心概念

```mermaid
graph TB
    subgraph MCP架构 &#123;"MCP 三要素"&#125;
        C["Client (LLM侧)<br/>发起请求，发现工具"]
        S["Server (工具侧)<br/>提供工具能力"]
        P["Protocol (协议)<br/>JSON-RPC 通信"]
    end

    C <-->|P| S

    subgraph Server能力 &#123;"MCP Server 提供三种能力"&#125;
        R1["Tools: 可执行的工具<br/>(搜索/计算/查询)"]
        R2["Resources: 可读取的数据<br/>(文件/数据库)"]
        R3["Prompts: 预定义的提示词<br/>(模板)"]
    end

    S --> R1 & R2 & R3

    style MCP架构 fill:'#E3F2FD'
```

## 四、MCP 与 LangChain

```python
# LangChain 已支持 MCP（通过 langchain-mcp 适配器）
# pip install langchain-mcp

# 方式1: 将MCP Server的工具转为LangChain工具
from langchain_mcp import load_mcp_tools

# 连接到MCP Server
# tools = await load_mcp_tools(
#     session=client_session,
#     server_name="my_mcp_server"
# )

# 方式2: 在Agent中使用MCP工具
# from langchain.agents import create_tool_calling_agent, AgentExecutor
# agent = create_tool_calling_agent(llm, tools, prompt)
# executor = AgentExecutor(agent=agent, tools=tools)
```

## 五、MCP 的价值

```mermaid
graph TB
    subgraph 价值 &#123;"MCP的核心价值"&#125;
        V1["标准化<br/>工具定义统一<br/>跨框架兼容"]
        V2["解耦<br/>工具开发与Agent开发分离"]
        V3["生态<br/>社区共享MCP Server"]
        V4["动态发现<br/>运行时自动发现可用工具"]
    end

    style 价值 fill:'#C8E6C9'
```

## 六、什么时候关注 MCP

| 你的情况 | 建议 |
|---------|------|
| 学习阶段 | 先学@tool，MCP了解概念即可 |
| 单框架应用 | @tool足够，不需要MCP |
| 多框架混用 | MCP可以统一工具接口 |
| 构建工具生态 | MCP让工具可被复用 |
| 企业级多团队 | MCP解耦工具开发和使用团队 |

> 💡 MCP 仍在早期发展阶段。对于学习者和大多数项目，LangChain 的 `@tool` 仍是首选。MCP 更适合构建跨框架的工具生态。
