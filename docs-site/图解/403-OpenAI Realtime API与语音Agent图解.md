# OpenAI Realtime API 与语音 Agent 图解

> 语音输入直接到语音输出，端到端延迟不到 1 秒。本图解可视化 Realtime API 架构、事件流和打断处理。

---

## 三段式 vs Realtime

```mermaid
graph TB
    subgraph "传统三段式（延迟 2-5s）"
        U1["用户说话"] --> STT["STT 语音转文字"]
        STT --> LLM1["LLM 生成文字"]
        LLM1 --> TTS["TTS 文字转语音"]
        TTS --> A1["AI 说话"]
    end

    subgraph "Realtime API（延迟 <1s）"
        U2["用户说话"] <--> RT["Realtime Model<br/>端到端语音"]
        RT <--> A2["AI 说话"]
    end

    style STT fill:#FFCCBC,stroke:#D84315
    style LLM1 fill:#FFF9C4,stroke:#F9A825
    style TTS fill:#FFCCBC,stroke:#D84315
    style RT fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 事件驱动模型

```mermaid
graph TB
    subgraph "客户端 → 服务器"
        C1["session.update 配置"]
        C2["input_audio_buffer.append 音频"]
        C3["response.create 请求回复"]
        C4["conversation.item.create 添加对话项"]
    end

    subgraph "服务器 → 客户端"
        S1["speech_started 用户开始说话"]
        S2["speech_stopped 用户停止说话"]
        S3["response.audio.delta 音频增量"]
        S4["response.audio_transcript.delta 文字增量"]
        S5["function_call_arguments 函数调用"]
        S6["response.done 回复完成"]
    end

    style C2 fill:#E3F2FD,stroke:#1565C0
    style S1 fill:#FFF9C4,stroke:#F9A825
    style S3 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
    style S5 fill:#F3E5F5,stroke:#7B1FA2
```

---

## 打断处理

```mermaid
graph TB
    AI["AI 正在说话"] --> LISTEN["VAD 检测用户声音"]
    LISTEN --> DETECT&#123;"用户开始说话?"&#125;
    DETECT -->|"是"| CANCEL["取消当前回复<br/>response.cancel"]
    CANCEL --> CLEAR["清空音频队列"]
    CLEAR --> LISTEN2["等待用户说完"]
    DETECT -->|"否"| CONTINUE["继续播放"]
    LISTEN2 --> PROCESS["处理新输入"]

    style CANCEL fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style PROCESS fill:#C8E6C9,stroke:#2E7D32
```

---

## 方案对比

| 方案 | 延迟 | 中文支持 | 成本/分钟 | 离线 |
|------|------|---------|----------|------|
| OpenAI Realtime | <1s | 好 | $1.4 | ❌ |
| 讯飞+LLM+讯飞TTS | 1-2s | 极好 | ¥0.05 | ❌ |
| Whisper+LLM+Coqui | 2-4s | 好 | ¥0 | ✅ |
| Deepgram+LLM+ElevenLabs | 1-2s | 中 | $0.3 | ❌ |

---

## 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Realtime vs 三段式 | ☐ |
| 知道事件驱动模型 | ☐ |
| 能配置会话参数 | ☐ |
| 处理打断逻辑 | ☐ |
| LangGraph 集成函数调用 | ☐ |
| 成本模型理解 | ☐ |
