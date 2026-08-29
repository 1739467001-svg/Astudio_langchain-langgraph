# Computer Use 与浏览器自动化 Agent 指南

> 2024 年 10 月，Anthropic 发布 Claude Computer Use：模型可以直接"看"屏幕截图，移动鼠标、点击按钮、输入文字——像人类一样操作电脑。2025 年 OpenAI 发布 Operator，Google 发布 Project Mariner。浏览器自动化从"写脚本控制 DOM"进化到"AI 看屏幕自主操作"。本指南详解 Computer Use 架构、与 LangChain 的集成方式，以及浏览器自动化 Agent 的生产实践。

---

## 1. 从脚本自动化到 AI 自主操作

### 传统浏览器自动化

```
传统方式（Selenium / Playwright / Puppeteer）：
  开发者写代码 → 定位元素 → 点击/输入 → 验证结果
  - 需要提前知道页面结构
  - 页面改版 = 脚本失效
  - 只能处理预设路径
  - 无法处理验证码/动态内容
```

### AI 驱动的浏览器自动化

```
AI 方式（Computer Use / Browser Agent）：
  Agent 看截图 → 理解页面 → 决定操作 → 执行 → 看新截图 → 继续

  优势：
  - 不依赖 DOM 结构，看截图就行
  - 页面改版也能适应
  - 能处理意外弹窗和验证流程
  - 能自主探索未知页面

  挑战：
  - 速度慢（每步都要截图+推理）
  - 成本高（每步消耗 Token）
  - 可能点错（视觉理解不完美）
  - 安全风险（AI 能操作真实浏览器）
```

---

## 2. Computer Use 核心架构

### 工作循环

```mermaid
graph LR
    A["截取屏幕"] --> B["发送截图给 LLM"]
    B --> C["LLM 分析画面<br/>决定下一步操作"]
    C --> D["执行操作<br/>点击/输入/滚动"]
    D --> E&#123;"任务完成?"&#125;
    E -->|"否"| A
    E -->|"是"| F["返回结果"]

    style A fill:#E3F2FD,stroke:#1565C0
    style B fill:#FFF9C4,stroke:#F9A825
    style C fill:#F3E5F5,stroke:#7B1FA2,stroke-width:3px
    style D fill:#C8E5F5,stroke:#2E7D32
    style F fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

### Anthropic Computer Use API

```python
from anthropic import Anthropic

client = Anthropic()

# Computer Use 三个核心工具
computer_tool = &#123;
    "type": "computer_20241022",
    "name": "computer",
    "display_width_px": 1024,
    "display_height_px": 768,
    "display_number": 1,
&#125;

text_editor_tool = &#123;
    "type": "text_editor_20241022",
    "name": "str_replace_editor"
&#125;

bash_tool = &#123;
    "type": "bash_20241022",
    "name": "bash"
&#125;

# 基本调用
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    tools=[computer_tool, text_editor_tool, bash_tool],
    messages=[&#123;
        "role": "user",
        "content": "打开浏览器，搜索'LangChain 教程'，找到第一个结果并打开"
    &#125;]
)

# 解析模型返回的操作指令
for block in response.content:
    if block.type == "tool_use":
        if block.name == "computer":
            action = block.input["action"]  # click, type, scroll, screenshot...
            print(f"操作: &#123;action&#125;")
            print(f"参数: &#123;block.input&#125;")
```

### 操作类型详解

```python
# Computer Use 支持的操作

# === 屏幕操作 ===
# screenshot: 截取当前屏幕
# click: 点击坐标 (x, y)
# double_click: 双击
# triple_click: 三击
# right_click: 右键点击

# === 键盘操作 ===
# type: 输入文本
# key: 按键（如 "Return", "ctrl+c", "alt+Tab"）

# === 滚动 ===
# scroll: 在坐标 (x, y) 处滚动
#   direction: up, down, left, right
#   scroll_amount: 滚动量

# === 等待 ===
# wait: 等待指定秒数

# 执行示例
def execute_computer_action(action_input: dict, screen_width=1024, screen_height=768):
    """执行 Computer Use 返回的操作"""
    action = action_input["action"]

    if action == "screenshot":
        return take_screenshot()

    elif action == "click":
        x, y = action_input["coordinate"]
        # 注意：模型返回的坐标基于 display_width_px × display_height_px
        # 需要映射到实际屏幕分辨率
        actual_x = int(x / screen_width * actual_screen_width)
        actual_y = int(y / screen_height * actual_screen_height)
        pyautogui.click(actual_x, actual_y)
        return &#123;"status": "clicked", "position": (actual_x, actual_y)&#125;

    elif action == "type":
        text = action_input["text"]
        pyautogui.typewrite(text, interval=0.05)
        return &#123;"status": "typed", "text": text&#125;

    elif action == "key":
        keys = action_input["text"]  # "ctrl+c", "Return" 等
        # 转换并执行按键
        execute_key_combination(keys)
        return &#123;"status": "key_pressed", "keys": keys&#125;

    elif action == "scroll":
        x, y = action_input["coordinate"]
        direction = action_input["coordinate"]  # up/down
        scroll_amount = action_input.get("scroll_amount", 3)
        execute_scroll(x, y, direction, scroll_amount)
        return &#123;"status": "scrolled"&#125;

    elif action == "wait":
        duration = action_input.get("duration", 1)
        time.sleep(duration)
        return &#123;"status": "waited"&#125;
```

---

## 3. LangGraph 浏览器自动化 Agent

### 完整架构

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
import base64
from anthropic import Anthropic

class BrowserAgentState(TypedDict):
    task: str                    # 用户任务描述
    messages: list               # 对话历史
    screenshots: list            # 截图历史
    actions_taken: list          # 已执行操作
    current_screenshot: str      # 当前截图（base64）
    step: int                    # 当前步骤
    max_steps: int               # 最大步骤
    task_complete: bool          # 任务是否完成
    result: str                  # 最终结果

# 初始化 Claude 客户端
client = Anthropic()

# === 截图节点 ===
async def screenshot_node(state: BrowserAgentState):
    """截取当前屏幕"""
    screenshot = take_screenshot_base64()
    return &#123;
        "current_screenshot": screenshot,
        "screenshots": state.get("screenshots", []) + [screenshot],
        "step": state.get("step", 0) + 1,
    &#125;

# === 决策节点 ===
async def decide_action_node(state: BrowserAgentState):
    """让 Claude 分析截图并决定下一步"""
    screenshot_b64 = state["current_screenshot"]

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        tools=[&#123;
            "type": "computer_20241022",
            "name": "computer",
            "display_width_px": 1024,
            "display_height_px": 768,
        &#125;],
        messages=[&#123;
            "role": "user",
            "content": [
                &#123;
                    "type": "image",
                    "source": &#123;
                        "type": "base64",
                        "media_type": "image/png",
                        "data": screenshot_b64,
                    &#125;
                &#125;,
                &#123;
                    "type": "text",
                    "text": f"任务: &#123;state['task']&#125;\n\n"
                           f"已执行步骤: &#123;state.get('actions_taken', [])&#125;\n"
                           f"当前步骤: &#123;state['step']&#125;/&#123;state['max_steps']&#125;\n"
                           f"请分析当前屏幕，决定下一步操作。"
                &#125;
            ]
        &#125;]
    )

    # 解析 Claude 的操作指令
    action = None
    reasoning = ""
    for block in response.content:
        if block.type == "tool_use" and block.name == "computer":
            action = block.input
        elif block.type == "text":
            reasoning = block.text

    return &#123;
        "messages": state.get("messages", []) + [&#123;"role": "assistant", "content": reasoning&#125;],
        "actions_taken": state.get("actions_taken", []) + [action] if action else state.get("actions_taken", []),
        "pending_action": action,
    &#125;

# === 执行节点 ===
async def execute_action_node(state: BrowserAgentState):
    """执行 Claude 决定的操作"""
    action = state.get("pending_action")
    if not action:
        return &#123;"task_complete": True&#125;

    result = execute_computer_action(action)

    # 检查 Claude 是否说任务完成
    last_reasoning = state["messages"][-1]["content"] if state.get("messages") else ""
    task_complete = "完成" in last_reasoning or "任务结束" in last_reasoning

    return &#123;
        "task_complete": task_complete,
        "pending_action": None,
    &#125;

# === 路由 ===
def route_after_action(state: BrowserAgentState):
    if state.get("task_complete"):
        return END
    if state.get("step", 0) >= state.get("max_steps", 20):
        return END  # 达到最大步骤
    return "screenshot"

# 构建图
graph = StateGraph(BrowserAgentState)
graph.add_node("screenshot", screenshot_node)
graph.add_node("decide", decide_action_node)
graph.add_node("execute", execute_action_node)

graph.add_edge(START, "screenshot")
graph.add_edge("screenshot", "decide")
graph.add_edge("decide", "execute")
graph.add_conditional_edges("execute", route_after_action, &#123;
    "screenshot": "screenshot",
    END: END,
&#125;)

browser_agent = graph.compile()

# 使用
result = await browser_agent.ainvoke(&#123;
    "task": "打开 GitHub，搜索 langchain-ai/langgraph，截图搜索结果",
    "max_steps": 15,
    "step": 0,
    "task_complete": False,
    "messages": [],
    "screenshots": [],
    "actions_taken": [],
&#125;)
```

---

## 4. Playwright 集成方案

### 为什么用 Playwright 而不是 pyautogui

```
pyautogui（控制真实鼠标键盘）：
  - 控制的是操作者正在用的电脑
  - 会干扰用户操作
  - 依赖屏幕分辨率
  - 无法多开

Playwright（控制浏览器实例）：
  - 独立的无头浏览器
  - 不干扰用户
  - 分辨率可控
  - 可多开并行
  - 更安全（沙箱化）
```

### Playwright + Claude 集成

```python
from playwright.async_api import async_playwright
import base64

class PlaywrightComputerUse:
    """Playwright 驱动的 Computer Use 实现"""

    def __init__(self, viewport_width=1024, viewport_height=768):
        self.width = viewport_width
        self.height = viewport_height
        self.browser = None
        self.page = None

    async def start(self):
        """启动浏览器"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=False,  # 有头模式，方便调试
            args=[f"--window-size=&#123;self.width&#125;,&#123;self.height&#125;"]
        )
        self.page = await self.browser.new_page(
            viewport=&#123;"width": self.width, "height": self.height&#125;
        )

    async def screenshot(self) -> str:
        """截取页面截图，返回 base64"""
        screenshot_bytes = await self.page.screenshot()
        return base64.b64encode(screenshot_bytes).decode()

    async def click(self, x: int, y: int):
        """点击指定坐标"""
        await self.page.mouse.click(x, y)

    async def type_text(self, text: str):
        """输入文本"""
        await self.page.keyboard.type(text, delay=50)

    async def key(self, keys: str):
        """按键组合"""
        # "ctrl+c" → "Control+c"
        key_map = &#123;"ctrl": "Control", "alt": "Alt", "shift": "Shift"&#125;
        parts = keys.split("+")
        mapped = [key_map.get(p.lower(), p) for p in parts]
        if len(mapped) == 1:
            await self.page.keyboard.press(mapped[0])
        else:
            for key in mapped[:-1]:
                await self.page.keyboard.down(key)
            await self.page.keyboard.press(mapped[-1])
            for key in reversed(mapped[:-1]):
                await self.page.keyboard.up(key)

    async def scroll(self, x: int, y: int, direction: str, amount: int = 3):
        """滚动页面"""
        await self.page.mouse.move(x, y)
        delta = amount * 100
        if direction == "down":
            await self.page.mouse.wheel(0, delta)
        elif direction == "up":
            await self.page.mouse.wheel(0, -delta)

    async def execute_action(self, action_input: dict):
        """执行 Claude 返回的操作"""
        action = action_input["action"]

        if action == "screenshot":
            return await self.screenshot()

        elif action == "click":
            x, y = action_input["coordinate"]
            await self.click(x, y)

        elif action == "type":
            await self.type_text(action_input["text"])

        elif action == "key":
            await self.key(action_input["text"])

        elif action == "scroll":
            x, y = action_input["coordinate"]
            direction = action_input.get("scroll_direction", "down")
            await self.scroll(x, y, direction)

        elif action == "wait":
            await asyncio.sleep(action_input.get("duration", 1))

        # 操作后等待页面渲染
        await asyncio.sleep(0.5)
        return await self.screenshot()

    async def close(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
```

### 完整 Agent 循环

```python
async def run_browser_agent(task: str, max_steps: int = 20):
    """运行浏览器自动化 Agent"""
    pw = PlaywrightComputerUse()
    await pw.start()

    try:
        client = Anthropic()
        messages = []

        for step in range(max_steps):
            # 1. 截图
            screenshot_b64 = await pw.screenshot()

            # 2. 发给 Claude 决策
            messages.append(&#123;
                "role": "user",
                "content": [
                    &#123;
                        "type": "image",
                        "source": &#123;
                            "type": "base64",
                            "media_type": "image/png",
                            "data": screenshot_b64,
                        &#125;
                    &#125;,
                    &#123;
                        "type": "text",
                        "text": f"任务: &#123;task&#125;\n步骤 &#123;step+1&#125;/&#123;max_steps&#125;"
                    &#125;
                ]
            &#125;)

            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                tools=[&#123;
                    "type": "computer_20241022",
                    "name": "computer",
                    "display_width_px": 1024,
                    "display_height_px": 768,
                &#125;],
                messages=messages
            )

            messages.append(&#123;"role": "assistant", "content": response.content&#125;)

            # 3. 执行操作
            for block in response.content:
                if block.type == "tool_use" and block.name == "computer":
                    print(f"步骤 &#123;step+1&#125;: &#123;block.input.get('action', '?')&#125;")
                    result_b64 = await pw.execute_action(block.input)

                    # 把执行结果（新截图）返回给 Claude
                    messages.append(&#123;
                        "role": "user",
                        "content": [&#123;
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": [&#123;
                                "type": "image",
                                "source": &#123;
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": result_b64,
                                &#125;
                            &#125;]
                        &#125;]
                    &#125;)

                elif block.type == "text":
                    print(f"Claude: &#123;block.text&#125;")
                    if "完成" in block.text or "任务结束" in block.text:
                        return block.text

            if response.stop_reason == "end_turn":
                break

        return "达到最大步骤限制"

    finally:
        await pw.close()
```

---

## 5. 安全与沙箱化

### 安全风险矩阵

| 风险 | 严重程度 | 缓解策略 |
|------|----------|----------|
| AI 点击恶意链接 | 高 | URL 白名单 |
| AI 输入敏感信息 | 高 | 输入内容审计 |
| AI 下载恶意文件 | 高 | 下载目录隔离 |
| AI 操作非目标页面 | 中 | 页面 URL 限制 |
| AI 执行时间过长 | 中 | 步数限制 + 超时 |
| 截图包含隐私信息 | 高 | 截图前脱敏 |

### 安全包装器

```python
@dataclass
class SafeBrowserConfig:
    """安全浏览器配置"""
    # URL 白名单
    allowed_domains: set = None  # &#123;"github.com", "google.com"&#125;
    # 禁止操作的域名
    blocked_domains: set = None  # &#123;"bank.com", "paypal.com"&#125;
    # 输入内容审计
    blocked_input_patterns: list = None  # [r'\d&#123;16&#125;', r'password']  # 信用卡号、密码
    # 最大步骤
    max_steps: int = 20
    # 每步超时
    step_timeout: float = 30.0
    # 是否允许下载
    allow_downloads: bool = False
    # 下载目录
    download_dir: str = "/tmp/browser_downloads"

    def check_url(self, url: str) -> bool:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        if self.blocked_domains and domain in self.blocked_domains:
            return False
        if self.allowed_domains and domain not in self.allowed_domains:
            return False
        return True

    def check_input(self, text: str) -> bool:
        import re
        if self.blocked_input_patterns:
            for pattern in self.blocked_input_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return False
        return True


class SafePlaywrightComputerUse(PlaywrightComputerUse):
    """带安全检查的 Playwright Computer Use"""

    def __init__(self, config: SafeBrowserConfig):
        super().__init__()
        self.config = config

    async def click(self, x: int, y: int):
        # 检查当前页面 URL
        current_url = self.page.url
        if not self.config.check_url(current_url):
            raise SecurityError(f"禁止操作域名: &#123;current_url&#125;")
        await super().click(x, y)

    async def type_text(self, text: str):
        if not self.config.check_input(text):
            raise SecurityError(f"输入内容被安全策略拦截")
        await super().type_text(text)
```

---

## 6. 替代方案对比

### 浏览器自动化方案对比

| 方案 | 类型 | 优势 | 劣势 | 适用场景 |
|------|------|------|------|----------|
| Anthropic Computer Use | AI 视觉操作 | 适应任何界面 | 慢、贵、需 Claude | 复杂未知页面 |
| Playwright + LLM | 混合方案 | DOM+视觉结合 | 需适配代码 | 结构化页面 |
| Browser Use (开源) | 纯 AI 驱动 | 开源、可定制 | 效果依赖模型 | 通用浏览器任务 |
| Skyvern (开源) | AI + 工作流 | 企业级、可扩展 | 部署复杂 | 企业自动化 |
| Selenium | 纯脚本 | 稳定、成熟 | 不适应变化 | 固定流程 |

### Browser Use 开源框架

```python
# pip install browser-use

from browser_use import Agent
from langchain_openai import ChatOpenAI

# Browser Use: 开源的 AI 浏览器自动化框架
agent = Agent(
    task="去京东搜索'Python编程'书籍，找到评分最高的，截图结果",
    llm=ChatOpenAI(model="gpt-4o"),
)

result = await agent.run()
# Browser Use 自动处理：
# 1. 打开浏览器
# 2. 导航到 jd.com
# 3. 输入搜索词
# 4. 分析结果
# 5. 截图
```

---

## 7. 成本与性能分析

### 单步成本估算

```python
@dataclass
class ComputerUseCost:
    """Computer Use 成本模型"""

    # Claude 3.5 Sonnet 定价
    input_price_per_m: float = 3.00   # $/百万 Token
    output_price_per_m: float = 15.00

    # 每步平均 Token 消耗
    screenshot_tokens: int = 1500     # 截图图片 Token
    context_tokens: int = 500         # 上下文文本 Token
    output_tokens: int = 300          # 模型输出 Token

    def step_cost(self) -> float:
        """单步成本"""
        input_tokens = self.screenshot_tokens + self.context_tokens
        input_cost = input_tokens / 1_000_000 * self.input_price_per_m
        output_cost = self.output_tokens / 1_000_000 * self.output_price_per_m
        return input_cost + output_cost

    def task_cost(self, steps: int) -> float:
        """完整任务成本"""
        # 后续步骤上下文增长
        total = 0
        for i in range(steps):
            self.context_tokens = 500 + i * 200  # 上下文逐步增长
            total += self.step_cost()
        return total

    def task_time(self, steps: int) -> float:
        """预估任务耗时（秒）"""
        # 截图 0.5s + 模型推理 3-5s + 执行 0.5s
        per_step = 4.0
        return steps * per_step


cost = ComputerUseCost()
print(f"单步成本: $&#123;cost.step_cost():.4f&#125;")      # ~$0.006
print(f"10步任务成本: $&#123;cost.task_cost(10):.4f&#125;") # ~$0.08
print(f"10步任务耗时: &#123;cost.task_time(10):.0f&#125;秒") # ~40秒
```

---

## 8. 典型应用场景

| 场景 | 步骤数 | 成本 | 可靠性 |
|------|--------|------|--------|
| 网页信息采集 | 5-10 | $0.03-0.06 | 高 |
| 表单自动填写 | 3-5 | $0.02-0.03 | 高 |
| 多步骤注册流程 | 8-15 | $0.05-0.10 | 中 |
| 数据对比采集 | 10-20 | $0.06-0.15 | 中 |
| 复杂交互测试 | 15-30 | $0.10-0.30 | 低 |

---

## 9. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解 Computer Use 的工作循环 | ☐ |
| 能调用 Anthropic Computer Use API | ☐ |
| 理解操作类型（click/type/scroll/key） | ☐ |
| 实现了 LangGraph 浏览器 Agent | ☐ |
| 能用 Playwright 替代 pyautogui | ☐ |
| 配置了安全策略（URL白名单/输入审计） | ☐ |
| 理解成本模型和性能瓶颈 | ☐ |
| 了解 Browser Use 等开源替代方案 | ☐ |

---

## 10. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 多模态应用开发 | 截图理解属于多模态 |
| 49 | Web 搜索与浏览 Agent | 浏览器 Agent 基础 |
| 134 | Agent 代码执行沙箱安全指南 | 浏览器沙箱化 |
| 142 | 多模态生成 | 图像理解能力 |
| 191 | Agent 多模态交互指南 | 多模态交互模式 |
| 427 | MCP 协议与 LangChain 工具集成 | MCP Server 可暴露浏览器工具 |
| 428 | 推理模型与 Agent 集成 | 推理模型用于操作决策 |
