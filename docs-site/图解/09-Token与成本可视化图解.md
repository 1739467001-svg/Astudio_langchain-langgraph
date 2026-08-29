# Token 与成本可视化图解

> 理解 Token 计数方式和 LLM 调用成本结构，学会估算和控制费用。

---

## 一、Token 是什么

```mermaid
graph LR
    subgraph 输入文本
        T["Hello, world! 你好世界"]
    end

    subgraph Token化 ["Token 化过程"]
        T --> TK["Tokenizer 分词"]
        TK --> R1["'Hello' → 1 token"]
        TK --> R2["',' → 1 token"]
        TK --> R3["' world' → 1 token"]
        TK --> R4["'!' → 1 token"]
        TK --> R5["'你' → 1 token"]
        TK --> R6["'好' → 1 token"]
        TK --> R7["'世' → 1 token"]
        TK --> R8["'界' → 1 token"]
    end

    R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8 --> TOTAL["总计: 8 tokens"]

    style T fill:#E3F2FD
    style TOTAL fill:#C8E6C9
```

### 中英文 Token 对比

```mermaid
graph TB
    subgraph 英文 ["英文 Token"]
        E1["'Hello world' = 2 tokens"]
        E2["'Artificial intelligence is great' = 5 tokens"]
        E3["1 英文单词 ≈ 1 token"]
    end

    subgraph 中文 ["中文 Token"]
        C1["'你好' = 2 tokens"]
        C2["'人工智能很好' = 6 tokens"]
        C3["1 中文字 ≈ 1.5 tokens"]
    end

    subgraph 结论
        note1["中文比英文消耗更多 Token"]
        note2["相同语义，中文约贵 1.5-2 倍"]
    end

    style 英文 fill:#E3F2FD
    style 中文 fill:#FFF3E0
    style 结论 fill:#C8E6C9
```

## 二、成本结构

```mermaid
graph TB
    subgraph 一次API调用的费用
        INPUT["输入Token费用<br/>（你发给LLM的内容）"]
        OUTPUT["输出Token费用<br/>（LLM返回的内容）"]
    end

    subgraph 影响输入Token的因素
        I1["System Prompt"]
        I2["用户问题"]
        I3["对话历史（越多越贵）"]
        I4["RAG检索的上下文"]
        I5["Few-Shot示例"]
    end

    subgraph 影响输出Token的因素
        O1["回答长度"]
        O2["max_tokens设置"]
        O3["temperature（高→可能更长）"]
    end

    I1 & I2 & I3 & I4 & I5 --> INPUT
    O1 & O2 & O3 --> OUTPUT

    style INPUT fill:#E3F2FD
    style OUTPUT fill:#FFE0B2
```

### 各模型价格对比（参考值）

```mermaid
graph TB
    subgraph 便宜 ["便宜（学习/开发用）"]
        M1["GPT-4o-mini<br/>输入 $0.15/M tokens<br/>输出 $0.60/M tokens"]
        M2["Claude 3.5 Haiku<br/>类似价格"]
        M3["本地Ollama<br/>$0（免费）"]
    end

    subgraph 中等 ["中等（日常生产用）"]
        M4["GPT-4o<br/>输入 $2.50/M<br/>输出 $10.00/M"]
        M5["Claude 3.5 Sonnet<br/>类似价格"]
    end

    subgraph 昂贵 ["昂贵（重度推理用）"]
        M6["GPT-4o (大量调用)<br/>月费可达数百美元"]
    end

    style 便宜 fill:#C8E6C9
    style 中等 fill:#FFE0B2
    style 昂贵 fill:#FFCDD2
```

> ⚠️ 价格可能有变动，请以 [OpenAI 定价页](https://openai.com/pricing) 为准。

## 三、成本计算实例

```mermaid
graph TB
    subgraph 示例调用 ["一次典型的RAG问答调用"]
        SP["System Prompt: 200 tokens"]
        CTX["RAG上下文: 1500 tokens"]
        HIST["对话历史: 800 tokens"]
        Q["用户问题: 50 tokens"]
        A["LLM回答: 300 tokens"]
    end

    SP --> IT["输入总计: 2550 tokens"]
    CTX --> IT
    HIST --> IT
    Q --> IT
    A --> OT["输出总计: 300 tokens"]

    IT --> COST
    OT --> COST

    COST["费用计算 (GPT-4o-mini):<br/>输入: 2550 × $0.15/1M = $0.000383<br/>输出: 300 × $0.60/1M = $0.000180<br/>合计: $0.000563<br/>≈ 人民币 0.004元"]

    style COST fill:#C8E6C9
```

### 月度成本估算

```mermaid
graph TB
    subgraph 场景 ["场景：客服机器人"]
        S1["每次对话约消耗<br/>输入2500 + 输出300 = 2800 tokens"]
        S2["每天500次对话"]
        S3["每月15000次对话"]
    end

    S1 --> CALC["月度计算: 15000 × 2800 = 42,000,000 tokens"]
    CALC --> SPLIT["输入: 37,500,000<br/>输出: 4,500,000"]
    SPLIT --> COST1["GPT-4o-mini:<br/>37.5M×$0.15/M + 4.5M×$0.60/M<br/>= $5.625 + $2.70 = $8.33/月"]
    SPLIT --> COST2["GPT-4o:<br/>37.5M×$2.50/M + 4.5M×$10.00/M<br/>= $93.75 + $45 = $138.75/月"]

    style COST1 fill:#C8E6C9
    style COST2 fill:#FFCDD2
```

## 四、省钱策略

```mermaid
graph TD
    SAVE["降低成本"] --> S1["用小模型<br/>(GPT-4o-mini代替GPT-4o)"]
    SAVE --> S2["启用缓存<br/>(重复问题不调用API)"]
    SAVE --> S3["精简Prompt<br/>(缩短System Prompt)"]
    SAVE --> S4["截断历史<br/>(不传全部对话历史)"]
    SAVE --> S5["控制RAG的k值<br/>(减少检索片段数)"]
    SAVE --> S6["设置max_tokens<br/>(限制输出长度)"]
    SAVE --> S7["批处理<br/>(batch代替循环invoke)"]

    S1 --> E1["节省约90%"]
    S2 --> E2["重复调用节省100%"]
    S3 --> E3["节省10-30%输入"]
    S4 --> E4["节省50%+输入"]
    S5 --> E5["节省30%+输入"]
    S6 --> E6["节省输出成本"]
    S7 --> E7["节省时间(非费用)"]

    style E1 fill:#C8E6C9
    style E2 fill:#C8E6C9
```

## 五、Token 统计代码

```python
# 运行时统计 Token
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini")
response = llm.invoke("解释什么是递归")

usage = response.usage_metadata
print(f"输入Tokens: &#123;usage['input_tokens']&#125;")
print(f"输出Tokens: &#123;usage['output_tokens']&#125;")
print(f"总Tokens: &#123;usage['total_tokens']&#125;")

# 估算成本
INPUT_PRICE = 0.15 / 1_000_000  # $0.15 per 1M
OUTPUT_PRICE = 0.60 / 1_000_000  # $0.60 per 1M
cost = (usage['input_tokens'] * INPUT_PRICE +
        usage['output_tokens'] * OUTPUT_PRICE)
print(f"本次成本: $&#123;cost:.6f&#125;")
```
