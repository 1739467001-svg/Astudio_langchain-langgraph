# Prompt 工程模式图解

> 用图解方式理解 Prompt 的各种设计模式、技巧和最佳实践。

---

## 一、Prompt 的五要素结构

```mermaid
graph TB
    subgraph 完整Prompt结构
        R["1️⃣ 角色设定 (Role)<br/>'你是一位资深数据分析师'"]
        T["2️⃣ 任务描述 (Task)<br/>'请分析以下销售数据趋势'"]
        C["3️⃣ 上下文 (Context)<br/>数据文件路径、背景说明"]
        S["4️⃣ 约束 (Constraints)<br/>'输出JSON格式，不超过500字'"]
        E["5️⃣ 示例 (Examples)<br/>输入→输出的样本"]
    end

    R --> T --> C --> S --> E

    style R fill:#E3F2FD
    style T fill:#FFF9C4
    style C fill:#FFE0B2
    style S fill:#F3E5F5
    style E fill:#C8E6C9
```

### 五要素对比

```mermaid
graph LR
    subgraph 差Prompt ["❌ 差的 Prompt"]
        B1["'写个翻译'"]
    end

    subgraph 好Prompt ["✅ 好的 Prompt"]
        G1["角色: 你是专业翻译"]
        G2["任务: 将中文翻译为英文"]
        G3["上下文: 这是产品说明书"]
        G4["约束: 保留专有名词，括号注释原义"]
        G5["示例: '智能耳机' → 'Smart Earphones'"]
    end

    B1 --> BO["输出: 质量不可控<br/>格式随意"]
    G1 & G2 & G3 & G4 & G5 --> GO["输出: 质量稳定<br/>格式一致"]

    style 差Prompt fill:#FFCDD2
    style 好Prompt fill:#C8E6C9
```

## 二、角色设定模式

```mermaid
graph TB
    subgraph 角色对输出的影响
        R1["角色: 教师<br/>输出: 浅显易懂，有比喻"]
        R2["角色: 专家<br/>输出: 专业术语，深入分析"]
        R3["角色: 编辑<br/>输出: 关注措辞和结构"]
        R4["角色: 审计师<br/>输出: 关注风险和合规"]
    end

    style R1 fill:#E3F2FD
    style R2 fill:#FFE0B2
    style R3 fill:#F3E5F5
    style R4 fill:#C8E6C9
```

### 角色设定模板

```python
# 专家模式（准确、深度）
EXPERT_ROLE = """你是一位有20年经验的&#123;field&#125;专家。
你的回答具有以下特点：
1. 使用准确的术语
2. 深入分析根本原因
3. 给出可操作的建议
4. 引用行业最佳实践
"""

# 教师模式（易懂、循序渐进）
TEACHER_ROLE = """你是一位耐心的&#123;field&#125;老师，擅长给零基础学生讲解。
你的回答具有以下特点：
1. 用简单的比喻解释复杂概念
2. 循序渐进，先基础后进阶
3. 每个概念配一个例子
4. 检查学生是否理解
"""

# 审查模式（严格、找问题）
REVIEWER_ROLE = """你是一位严格的&#123;field&#125;审查员。
你的目标是发现问题和风险。
1. 列出所有潜在问题
2. 标注严重程度（高/中/低）
3. 给出修复建议
4. 如果没有问题，明确说明
"""
```

## 三、Few-Shot 模式

```mermaid
graph TB
    subgraph Few-Shot流程
        S["System: 角色+规则"]
        S --> E1["Example 1: 输入→输出"]
        E1 --> E2["Example 2: 输入→输出"]
        E2 --> E3["Example 3: 输入→输出"]
        E3 --> Q["实际查询: 输入→?"]
    end

    Q --> PAT["LLM 识别模式"]
    PAT --> A["按示例格式生成输出"]

    style S fill:#E3F2FD
    style E1 fill:#FFF9C4
    style E2 fill:#FFF9C4
    style E3 fill:#FFF9C4
    style A fill:#C8E6C9
```

### Few-Shot vs Zero-Shot vs One-Shot

```mermaid
graph TB
    subgraph Zero-Shot ["Zero-Shot（零样本）"]
        Z1["指令: '判断情感'"]
        Z2["输入: '太棒了'"]
        Z3["输出: ?（LLM自行推断）"]
    end

    subgraph One-Shot ["One-Shot（单样本）"]
        O1["指令: '判断情感'"]
        O2["示例: '太好→正面'"]
        O3["输入: '太棒了'"]
        O4["输出: 正面 ✓"]
    end

    subgraph Few-Shot ["Few-Shot（多样本）"]
        F1["指令: '判断情感'"]
        F2["示例1: '太好→正面'"]
        F3["示例2: '很差→负面'"]
        F4["示例3: '一般→中性'"]
        F5["输入: '太棒了'"]
        F6["输出: 正面 ✓✓"]
    end

    style Zero-Shot fill:#FFE0B2
    style One-Shot fill:#E3F2FD
    style Few-Shot fill:#C8E6C9
```

## 四、Chain of Thought 模式

```mermaid
graph TB
    subgraph 直接回答 ["❌ 直接回答（可能出错）"]
        D1["问题: '一个商店有23个苹果，卖了17个，又进了12个，还有多少？'"]
        D1 --> D2["回答: '18个' (可能算错)"]
    end

    subgraph 思维链 ["✅ Chain of Thought"]
        C1["问题: 同上"]
        C1 --> C2["推理: 有23个，卖了17个剩23-17=6个，又进了12个是6+12=18个"]
        C2 --> C3["回答: 18个 ✓"]
    end

    style 直接回答 fill:#FFCDD2
    style 思维链 fill:#C8E6C9
```

### CoT 的三种触发方式

```mermaid
graph TB
    subgraph 方式1 ["方式1: System Prompt 引导"]
        W1["'请一步步思考后回答'"]
    end

    subgraph 方式2 ["方式2: Few-Shot 展示推理"]
        W2["示例包含推理过程:<br/>'推理：...<br/>答案：...'"]
    end

    subgraph 方式3 ["方式3: 显式指令"]
        W3["'先写出推理步骤，再给出最终答案<br/>推理：___<br/>答案：___'"]
    end

    style W1 fill:#E3F2FD
    style W2 fill:#FFF9C4
    style W3 fill:#C8E6C9
```

## 五、输出格式控制模式

```mermaid
graph TB
    subgraph 格式控制策略
        F1["策略1: 文字描述格式<br/>'请用JSON格式回答'"]
        F2["策略2: OutputParser注入格式指令<br/>parser.get_format_instructions()"]
        F3["策略3: Few-Shot展示格式<br/>示例中展示期望的输出格式"]
        F4["策略4: with_structured_output<br/>LLM原生结构化输出"]
    end

    F1 --> R1["可靠性: ★★☆<br/>LLM可能不遵守"]
    F2 --> R2["可靠性: ★★★<br/>附带schema描述"]
    F3 --> R3["可靠性: ★★★<br/>示例引导"]
    F4 --> R4["可靠性: ★★★★<br/>模型原生支持"]

    style R1 fill:#FFE0B2
    style R2 fill:#C8E6C9
    style R3 fill:#C8E6C9
    style R4 fill:#C8E6C9
```

## 六、RAG Prompt 模式

```mermaid
graph TB
    subgraph RAG Prompt结构
        S["System: '你是知识库助手<br/>只基于背景知识回答'"]
        CTX["背景知识: &#123;检索到的文档片段&#125;"]
        Q["用户问题: &#123;question&#125;"]
        RULES["规则:<br/>1. 不编造<br/>2. 标注来源<br/>3. 不知道就说不知道"]
    end

    S --> CTX --> RULES --> Q --> A["回答: 基于上下文生成"]

    style S fill:#E3F2FD
    style CTX fill:#FFE0B2
    style Q fill:#FFF9C4
    style A fill:#C8E6C9
```

### 防幻觉 Prompt 策略

```mermaid
graph TB
    subgraph 防幻觉策略
        H1["1. 明确说'只基于背景知识'"]
        H2["2. 加'不知道就说不知道'"]
        H3["3. 要求标注来源"]
        H4["4. 降低temperature到0"]
        H5["5. 减少Few-Shot数量<br/>(避免模式污染)"]
    end

    style H1 fill:#C8E6C9
    style H2 fill:#C8E6C9
    style H3 fill:#C8E6C9
    style H4 fill:#C8E6C9
    style H5 fill:#FFE0B2
```

## 七、Prompt 调试决策树

```mermaid
graph TD
    PROBLEM["输出不符合预期"] --> Q1&#123;"什么问题?"&#125;

    Q1 -->|"格式不对"| F1["加OutputParser<br/>或Few-Shot示例"]
    Q1 -->|"内容跑题"| F2["任务描述更具体<br/>或添加约束"]
    Q1 -->|"编造信息"| F3["加'不知道就说不知道'<br/>降低temperature"]
    Q1 -->|"太啰嗦"| F4["加字数限制<br/>或max_tokens"]
    Q1 -->|"太简单"| F5["提高temperature<br/>或换更强模型"]
    Q1 -->|"不稳定"| F6["降低temperature到0<br/>固定Few-Shot"]
    Q1 -->|"中文质量差"| F7["明确要求'用中文回答'<br/>添加中文Few-Shot"]

    style F1 fill:#E3F2FD
    style F2 fill:#FFF9C4
    style F3 fill:#C8E6C9
    style F4 fill:#FFE0B2
    style F5 fill:#F3E5F5
    style F6 fill:#C8E6C9
    style F7 fill:#E3F2FD
```

## 八、Prompt 复杂度选择

```mermaid
graph LR
    subgraph 简单任务 ["简单任务"]
        S1["直接写指令<br/>不需要角色设定"]
        S2["示例: '翻译为英文: 你好'"]
    end

    subgraph 中等任务 ["中等任务"]
        M1["角色 + 任务 + 约束"]
        M2["示例: '你是翻译助手<br/>将以下文本翻译为英文<br/>保留专有名词'"]
    end

    subgraph 复杂任务 ["复杂任务"]
        L1["角色 + 任务 + 上下文<br/>+ 约束 + Few-Shot"]
        L2["示例: RAG、Agent、<br/>多步骤推理"]
    end

    style 简单任务 fill:#C8E6C9
    style 中等任务 fill:#FFF3E0
    style 复杂任务 fill:#F3E5F5
```

```mermaid
graph TD
    Q&#123;"任务复杂度?"&#125;
    Q -->|"简单（翻译、分类）"| SIMPLE["角色(可选) + 指令"]
    Q -->|"中等（摘要、改写）"| MEDIUM["角色 + 指令 + 约束"]
    Q -->|"复杂（RAG、推理）"| COMPLEX["角色 + 指令 + 上下文 + 约束 + Few-Shot + CoT"]

    style SIMPLE fill:#C8E6C9
    style MEDIUM fill:#FFF3E0
    style COMPLEX fill:#F3E5F5
```
