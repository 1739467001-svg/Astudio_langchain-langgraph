import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'LangChain & LangGraph 学习平台',
  description: '从零到精通 LangChain 与 LangGraph 的完整知识体系 · 1243 篇文档 · 35+ 行业应用',
  lang: 'zh-CN',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    ['meta', { name: 'author', content: 'AStudio' }],
    ['meta', { property: 'og:title', content: 'LangChain & LangGraph 学习平台' }],
    ['meta', { property: 'og:description', content: '1243 篇文档 · 35+ 行业应用 · 从零到精通' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
      rel: 'stylesheet'
    }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'LangChain & LangGraph',

    nav: [
      { text: '首页', link: '/' },
      { text: '学习课程', link: '/课程/00-课程总览与学习路径' },
      { text: '知识库', link: '/知识库/01-技术术语表' },
      { text: '图解', link: '/图解/00-学习路线全景图' },
      { text: '实战案例', link: '/实战案例库/00-案例库导读' },
      { text: '学习评估', link: '/学习评估/01-学习里程碑与进度跟踪' },
      {
        text: '外部链接',
        items: [
          { text: 'LangChain 官方', link: 'https://python.langchain.com' },
          { text: 'LangGraph 官方', link: 'https://langchain-ai.github.io/langgraph' },
          { text: 'GitHub 仓库', link: 'https://github.com/1739467001-svg/Astudio_langchain-langgraph' },
        ]
      },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/1739467001-svg/Astudio_langchain-langgraph' }
    ],

    footer: {
      message: '1243 篇文档 · 35+ 行业应用 · Mermaid 图表 · 持续更新中',
      copyright: 'MIT Licensed · Built with VitePress'
    },

    sidebar: {
      '/课程/': [
        {
          text: '学习课程',
          collapsed: false,
          items: [
            { text: '00 - 课程总览与学习路径', link: '/课程/00-课程总览与学习路径' },
            { text: '01 - 前置知识准备', link: '/课程/01-前置知识准备' },
            { text: '02 - LangChain 入门', link: '/课程/02-LangChain入门-初识框架' },
            { text: '03 - 核心概念 Models-Prompts-Parsers', link: '/课程/03-核心概念-Models-Prompts-Parsers' },
            { text: '04 - Memory 与对话管理', link: '/课程/04-Memory与对话管理' },
            { text: '05 - Chains 链式调用', link: '/课程/05-Chains-链式调用' },
            { text: '06 - Agents 与 Tools', link: '/课程/06-Agents与Tools-智能代理' },
            { text: '07 - RAG 检索增强生成', link: '/课程/07-RAG检索增强生成' },
            { text: '08 - LangChain 进阶与最佳实践', link: '/课程/08-LangChain进阶与最佳实践' },
            { text: '09 - LangGraph 入门', link: '/课程/09-LangGraph入门-图式编排' },
            { text: '10 - LangGraph 核心概念', link: '/课程/10-LangGraph核心概念-State-Nodes-Edges' },
            { text: '11 - 复杂工作流与多 Agent', link: '/课程/11-构建复杂工作流与多Agent系统' },
            { text: '12 - 实战项目从零到一', link: '/课程/12-实战项目-从零到一' },
          ]
        }
      ],

      '/知识库/': [
        {
          text: '基础参考 (01-13)',
          collapsed: true,
          items: [
            { text: '01 - 技术术语表', link: '/知识库/01-技术术语表' },
            { text: '02 - LangChain 架构详解', link: '/知识库/02-LangChain架构详解' },
            { text: '03 - LangGraph 架构详解', link: '/知识库/03-LangGraph架构详解' },
            { text: '04 - API 参考与速查', link: '/知识库/04-API参考与速查手册' },
            { text: '05 - 代码示例集', link: '/知识库/05-代码示例集' },
            { text: '06 - 环境配置指南', link: '/知识库/06-环境配置指南' },
            { text: '07 - 常见问题与排错', link: '/知识库/07-常见问题与排错指南' },
            { text: '08 - 版本演进与生态', link: '/知识库/08-版本演进与生态' },
            { text: '09 - Prompt 工程实战', link: '/知识库/09-Prompt工程实战指南' },
            { text: '10 - 安全与合规', link: '/知识库/10-安全与合规指南' },
            { text: '11 - 评估与测试', link: '/知识库/11-LLM应用评估与测试' },
            { text: '12 - 向量数据库对比', link: '/知识库/12-向量数据库深度对比' },
            { text: '13 - 流式输出与异步', link: '/知识库/13-流式输出与异步编程专题' },
          ]
        },
        {
          text: '前沿技术指南 (427+)',
          collapsed: true,
          items: [
            { text: '427 - MCP 协议与工具集成', link: '/知识库/427-MCP协议与LangChain工具集成指南' },
            { text: '428 - 推理模型与 Agent', link: '/知识库/428-推理模型与Agent集成指南' },
            { text: '429 - 可恢复性与容错', link: '/知识库/429-Agent可恢复性与容错编排指南' },
            { text: '430 - Agentic RAG', link: '/知识库/430-Agentic RAG与自适应检索决策指南' },
            { text: '431 - 长上下文与 RAG', link: '/知识库/431-长上下文模型与RAG策略权衡指南' },
            { text: '432 - Computer Use', link: '/知识库/432-Computer Use与浏览器自动化Agent指南' },
            { text: '433 - Realtime API 语音', link: '/知识库/433-OpenAI Realtime API与语音Agent指南' },
            { text: '434 - 自托管 LLM', link: '/知识库/434-自托管LLM与本地推理部署指南' },
            { text: '435 - 评测工具链', link: '/知识库/435-LLM评测工具链集成指南' },
            { text: '436 - AI 编程 Agent', link: '/知识库/436-AI编程Agent与代码自动化指南' },
            { text: '437 - OpenAI Agents SDK', link: '/知识库/437-OpenAI Agents SDK与多Agent框架指南' },
            { text: '438 - NeMo Guardrails', link: '/知识库/438-NeMo Guardrails与Agent护栏系统指南' },
            { text: '439 - PEFT 微调与 DPO', link: '/知识库/439-PEFT微调与DPO对齐实践指南' },
            { text: '440 - 前端与聊天 UI', link: '/知识库/440-Agent前端与聊天UI构建指南' },
            { text: '441 - LangGraph Platform', link: '/知识库/441-LangGraph Platform部署与生产化指南' },
            { text: '442 - 身份认证与授权', link: '/知识库/442-Agent身份认证与授权体系指南' },
            { text: '443 - 多模态文档 OCR', link: '/知识库/443-多模态文档智能与OCR-Agent指南' },
            { text: '444 - 可解释性 XAI', link: '/知识库/444-Agent可解释性与XAI指南' },
            { text: '445 - 调试与可观测', link: '/知识库/445-Agent调试与可观测工具链指南' },
            { text: '446 - 记忆架构', link: '/知识库/446-Agent记忆架构与长期记忆系统指南' },
          ]
        },
        {
          text: '安全合规与伦理 (447-501)',
          collapsed: true,
          items: [
            { text: '447 - AI 伦理与偏见', link: '/知识库/447-AI伦理与偏见检测指南' },
            { text: '448 - 红队测试与攻防', link: '/知识库/448-Agent红队测试与对抗攻防深度指南' },
            { text: '449 - 隐私计算与联邦学习', link: '/知识库/449-隐私计算与联邦学习指南' },
            { text: '450 - 经济模型与激励', link: '/知识库/450-Agent经济模型与激励机制指南' },
            { text: '451 - 合规与法律框架', link: '/知识库/451-LLM应用合规与法律框架指南' },
            { text: '477 - 数据安全与加密', link: '/知识库/477-Agent数据安全与加密体系指南' },
            { text: '490 - 安全审计与合规', link: '/知识库/490-Agent安全审计与合规自动化指南' },
            { text: '500 - 越狱防护与注入', link: '/知识库/500-Agent越狱防护与提示注入防御深度指南' },
            { text: '501 - 数据保护与隐私', link: '/知识库/501-Agent数据保护与隐私合规深度指南' },
            { text: '561 - 红队工具链', link: '/知识库/561-Agent安全攻防实战与红队工具链指南' },
            { text: '576 - 伦理治理与负责任AI', link: '/知识库/576-Agent伦理治理与负责任AI体系指南' },
          ]
        },
        {
          text: '运维与部署 (478-511)',
          collapsed: true,
          items: [
            { text: '478 - AIOps 智能运维', link: '/知识库/478-AIOps与智能运维指南' },
            { text: '479 - 自动扩缩容', link: '/知识库/479-Agent自动扩缩容与弹性指南' },
            { text: '480 - 日志管理与审计', link: '/知识库/480-Agent日志管理与审计追溯指南' },
            { text: '481 - 变更管理与发布', link: '/知识库/481-Agent变更管理与发布流程指南' },
            { text: '482 - API 设计与 OpenAPI', link: '/知识库/482-Agent API设计与OpenAPI规范指南' },
            { text: '484 - 跨平台与多端', link: '/知识库/484-Agent跨平台与多端部署指南' },
            { text: '485 - 调度与 Cron', link: '/知识库/485-Agent调度与定时任务Cron指南' },
            { text: '486 - Webhook 与通知', link: '/知识库/486-Agent Webhook与事件驱动通知指南' },
            { text: '487 - 最佳实践与反模式', link: '/知识库/487-Agent最佳实践与反模式深度指南' },
            { text: '488 - 环境管理与配置', link: '/知识库/488-Agent环境管理与配置即代码指南' },
            { text: '489 - 容器化与 K8s', link: '/知识库/489-Agent容器化与K8s生产部署指南' },
            { text: '490 - 版本兼容与升级', link: '/知识库/490-Agent版本兼容与平滑升级指南' },
            { text: '491 - 冷启动与预热', link: '/知识库/491-Agent冷启动优化与预热策略指南' },
            { text: '492 - 异地多活与灾备', link: '/知识库/492-Agent异地多活与灾难恢复深度指南' },
            { text: '502 - 可观测性三支柱', link: '/知识库/502-Agent可观测性三支柱整合指南' },
            { text: '503 - SRE 与 On-Call', link: '/知识库/503-Agent SRE与On-Call事件管理指南' },
            { text: '504 - DevOps 与 CI/CD', link: '/知识库/504-Agent DevOps与CI-CD流水线工程化指南' },
            { text: '505 - 云原生与 Serverless', link: '/知识库/505-Agent云原生与Serverless部署指南' },
            { text: '506 - 微服务与服务网格', link: '/知识库/506-Agent微服务拆分与服务网格指南' },
            { text: '507 - 错误处理与恢复', link: '/知识库/507-Agent错误处理与异常恢复工程化指南' },
            { text: '509 - 优雅关闭与排空', link: '/知识库/509-Agent优雅关闭与排空深度指南' },
            { text: '510 - 配置热更新', link: '/知识库/510-Agent配置热更新与动态配置中心指南' },
            { text: '511 - 回滚与版本管理', link: '/知识库/511-Agent回滚与版本管理工程化指南' },
          ]
        },
        {
          text: '工程深度 (512-531)',
          collapsed: true,
          items: [
            { text: '512 - 对话状态机', link: '/知识库/512-Agent对话状态机与槽位填充深度指南' },
            { text: '513 - 推理链优化', link: '/知识库/513-Agent推理链优化与思维链工程化指南' },
            { text: '514 - 工具编排', link: '/知识库/514-Agent工具编排与动态工具链指南' },
            { text: '515 - 情景与语义记忆', link: '/知识库/515-Agent情景记忆与语义记忆深度指南' },
            { text: '516 - 踩坑实录', link: '/知识库/516-Agent踩坑实录与生产事故案例分析指南' },
            { text: '517 - 数据分析可视化', link: '/知识库/517-Agent数据分析与可视化自动化指南' },
            { text: '518 - 代码生成与审查', link: '/知识库/518-Agent代码生成与代码审查深度指南' },
            { text: '519 - 多语言翻译', link: '/知识库/519-Agent多语言翻译与国际化指南' },
            { text: '520 - 搜索增强', link: '/知识库/520-Agent搜索增强与网页信息提取指南' },
            { text: '521 - 内容创作', link: '/知识库/521-Agent内容创作与写作辅助深度指南' },
          ]
        },
        {
          text: '行业应用 (522-556)',
          collapsed: true,
          items: [
            { text: '522 - 教育应用', link: '/知识库/522-Agent教育应用与智能学习辅导指南' },
            { text: '523 - 医疗辅助', link: '/知识库/523-Agent医疗辅助与诊断支持指南' },
            { text: '524 - 金融风控', link: '/知识库/524-Agent金融风控与智能投顾指南' },
            { text: '525 - 法律辅助', link: '/知识库/525-Agent法律辅助与合同审查指南' },
            { text: '526 - 客服自动化', link: '/知识库/526-Agent客服自动化与智能对话指南' },
            { text: '527 - 智能制造', link: '/知识库/527-Agent智能制造与工业互联网指南' },
            { text: '528 - 供应链优化', link: '/知识库/528-Agent供应链优化与物流管理指南' },
            { text: '529 - 能源管理', link: '/知识库/529-Agent能源管理与电力调度指南' },
            { text: '530 - 人力资源', link: '/知识库/530-Agent人力资源与智能招聘指南' },
            { text: '531 - 税务申报', link: '/知识库/531-Agent税务申报与智能审计指南' },
            { text: '532 - 智慧政务', link: '/知识库/532-Agent智慧政务与公共服务指南' },
            { text: '533 - 农业智能化', link: '/知识库/533-Agent农业智能化与精准种植指南' },
            { text: '534 - 智慧交通', link: '/知识库/534-Agent智慧交通与城市管理指南' },
            { text: '535 - 零售电商', link: '/知识库/535-Agent零售电商与智能营销指南' },
            { text: '536 - 心理咨询', link: '/知识库/536-Agent心理咨询与心理健康服务指南' },
            { text: '537 - 旅游规划', link: '/知识库/537-Agent旅游规划与智能出行指南' },
            { text: '538 - 保险理赔', link: '/知识库/538-Agent保险理赔与智能核保指南' },
            { text: '539 - 专利分析', link: '/知识库/539-Agent专利分析与知识产权管理指南' },
            { text: '540 - 智能建筑', link: '/知识库/540-Agent智能建筑与物业管理指南' },
            { text: '541 - 医药研发', link: '/知识库/541-Agent医药研发与临床试验指南' },
            { text: '542 - 环保监测', link: '/知识库/542-Agent环保监测与碳排放管理指南' },
            { text: '543 - 智能汽车', link: '/知识库/543-Agent智能汽车与自动驾驶辅助指南' },
            { text: '544 - 食品安全', link: '/知识库/544-Agent食品安全与质量追溯指南' },
            { text: '545 - 新闻媒体', link: '/知识库/545-Agent新闻媒体与内容采编指南' },
            { text: '546 - 城市规划', link: '/知识库/546-Agent城市规划与智慧社区指南' },
            { text: '547 - 半导体制造', link: '/知识库/547-Agent半导体制造与良率优化指南' },
            { text: '548 - 影视制作', link: '/知识库/548-Agent影视制作与内容创作指南' },
            { text: '549 - 气象预报', link: '/知识库/549-Agent气象预报与灾害预警指南' },
            { text: '550 - 房地产估值', link: '/知识库/550-Agent房地产智能估值与交易指南' },
            { text: '551 - 图书馆管理', link: '/知识库/551-Agent图书馆与智能知识管理指南' },
            { text: '552 - 游戏开发', link: '/知识库/552-Agent游戏开发与智能NPC指南' },
            { text: '553 - 体育分析', link: '/知识库/553-Agent体育分析与赛事辅助指南' },
            { text: '554 - 化工安全', link: '/知识库/554-Agent化工生产安全与工艺优化指南' },
            { text: '555 - 海洋海事', link: '/知识库/555-Agent海洋探索与海事管理指南' },
            { text: '556 - 会展管理', link: '/知识库/556-Agent会展活动管理与智能场馆指南' },
          ]
        },
        {
          text: '前沿探索 (557-591)',
          collapsed: true,
          items: [
            { text: '557 - 多模态融合', link: '/知识库/557-Agent多模态融合与跨模态推理深度指南' },
            { text: '558 - 知识蒸馏', link: '/知识库/558-Agent知识蒸馏与模型压缩实践指南' },
            { text: '559 - 联邦学习', link: '/知识库/559-Agent联邦学习与隐私保护深度指南' },
            { text: '560 - 自进化闭环', link: '/知识库/560-Agent自进化与持续学习闭环指南' },
            { text: '562 - 边缘计算', link: '/知识库/562-Agent边缘计算与端侧部署深度指南' },
            { text: '563 - 量子计算融合', link: '/知识库/563-Agent量子计算融合与未来展望指南' },
            { text: '564 - 区块链应用', link: '/知识库/564-Agent区块链与去中心化应用指南' },
            { text: '565 - 数字人与元宇宙', link: '/知识库/565-Agent数字人虚拟助手与元宇宙指南' },
            { text: '566 - 知识图谱推理', link: '/知识库/566-Agent知识图谱推理与因果推断指南' },
            { text: '567 - 知识管理与搜索', link: '/知识库/567-Agent知识管理与企业搜索深度指南' },
            { text: '568 - 自动化测试', link: '/知识库/568-Agent自动化测试与质量保障体系指南' },
            { text: '569 - 数据治理', link: '/知识库/569-Agent数据治理与数据质量管理指南' },
            { text: '570 - 实时决策', link: '/知识库/570-Agent实时决策与流式处理指南' },
            { text: '571 - 对话体验设计', link: '/知识库/571-Agent自然语言交互与对话体验设计指南' },
            { text: '572 - 运筹优化', link: '/知识库/572-Agent智能决策与运筹优化指南' },
            { text: '573 - 自然语言编程', link: '/知识库/573-Agent自然语言编程与代码即指令指南' },
            { text: '574 - 博弈论与机制设计', link: '/知识库/574-Agent多Agent博弈论与机制设计深度指南' },
            { text: '575 - 认知架构', link: '/知识库/575-Agent认知架构与思维模型指南' },
            { text: '577 - 信任与声誉', link: '/知识库/577-Agent信任与声誉系统指南' },
            { text: '578 - 委托代理', link: '/知识库/578-Agent委托代理与权限委派指南' },
            { text: '579 - 多轮谈判', link: '/知识库/579-Agent多轮谈判与协商协议指南' },
            { text: '580 - 任务分解', link: '/知识库/580-Agent任务分解与分布式执行指南' },
            { text: '581 - 知识更新', link: '/知识库/581-Agent知识更新与增量学习指南' },
            { text: '582 - 知识表示', link: '/知识库/582-Agent知识表示与本体建模指南' },
            { text: '583 - 语义理解', link: '/知识库/583-Agent语义理解与意图深层解析指南' },
            { text: '584 - 自适应推理', link: '/知识库/584-Agent自适应推理与动态策略选择指南' },
            { text: '585 - 情感计算', link: '/知识库/585-Agent多模态情感计算与共情能力指南' },
            { text: '586 - 群体涌现', link: '/知识库/586-Agent群体涌现行为与复杂性管理指南' },
            { text: '587 - Prompt 范式', link: '/知识库/587-Agent提示工程高级模式与范式指南' },
            { text: '588 - 向量库调优', link: '/知识库/588-Agent向量数据库选型与性能调优深度指南' },
            { text: '589 - 流式架构', link: '/知识库/589-Agent流式架构与实时通信工程化指南' },
            { text: '591 - CI/CD 流水线', link: '/知识库/591-Agent持续集成与自动化部署流水线指南' },
          ]
        },
      ],

      '/图解/': [
        {
          text: '基础图解 (00-12)',
          collapsed: false,
          items: [
            { text: '00 - 学习路线全景图', link: '/图解/00-学习路线全景图' },
            { text: '01 - LangChain 生态架构', link: '/图解/01-LangChain生态架构图解' },
            { text: '02 - LCEL 数据流', link: '/图解/02-LCEL数据流图解' },
            { text: '03 - RAG 全流程', link: '/图解/03-RAG全流程图解' },
            { text: '04 - Agent 工作原理', link: '/图解/04-Agent工作原理图解' },
            { text: '05 - Memory 机制', link: '/图解/05-Memory机制图解' },
            { text: '06 - LangGraph 图结构', link: '/图解/06-LangGraph图结构图解' },
            { text: '07 - 多 Agent 架构', link: '/图解/07-多Agent架构图解' },
          ]
        },
        {
          text: '前沿图解 (397+)',
          collapsed: true,
          items: [
            { text: '397 - MCP 协议', link: '/图解/397-MCP协议与LangChain工具集成图解' },
            { text: '398 - 推理模型', link: '/图解/398-推理模型与Agent集成图解' },
            { text: '407 - Agents SDK', link: '/图解/407-OpenAI Agents SDK与多Agent框架图解' },
            { text: '432 - Agent 设计模式', link: '/图解/432-Agent设计模式与参考架构图解' },
            { text: '457 - 最佳实践与反模式', link: '/图解/457-Agent最佳实践与反模式深度图解' },
            { text: '486 - 踩坑实录', link: '/图解/486-Agent踩坑实录与生产事故案例分析图解' },
            { text: '532 - 边缘计算', link: '/图解/532-Agent边缘计算与端侧部署深度图解' },
            { text: '536 - 知识图谱推理', link: '/图解/536-Agent知识图谱推理与因果推断图解' },
            { text: '557 - Prompt 范式', link: '/图解/557-Agent提示工程高级模式与范式图解' },
            { text: '561 - CI/CD 流水线', link: '/图解/561-Agent持续集成与自动化部署流水线图解' },
          ]
        },
      ],

      '/实战案例库/': [
        {
          text: '基础实战',
          collapsed: false,
          items: [
            { text: '00 - 案例库导读', link: '/实战案例库/00-案例库导读' },
            { text: '01 - 智能客服机器人', link: '/实战案例库/01-智能客服机器人' },
            { text: '02 - 多文档 RAG 问答', link: '/实战案例库/02-多文档RAG问答系统' },
            { text: '03 - 代码审查助手', link: '/实战案例库/03-代码审查助手' },
            { text: '04 - 数据分析对话助手', link: '/实战案例库/04-数据分析对话助手' },
            { text: '05 - 多模态文档助手', link: '/实战案例库/05-多模态文档助手' },
            { text: '06 - SQL 数据分析 Agent', link: '/实战案例库/06-SQL数据分析Agent' },
          ]
        },
        {
          text: '进阶实战',
          collapsed: false,
          items: [
            { text: '07 - 实战索引', link: '/实战案例库/07-实战索引与学习路径串联' },
            { text: '08 - Web 搜索 Agent', link: '/实战案例库/08-Web搜索研究Agent' },
            { text: '09 - 自动化工作流', link: '/实战案例库/09-自动化工作流Agent实战' },
            { text: '10 - 进阶 RAG 问答', link: '/实战案例库/10-进阶RAG问答系统实战' },
            { text: '11 - 多 Agent 协作', link: '/实战案例库/11-多Agent协作研究系统' },
            { text: '12 - 数据科学分析', link: '/实战案例库/12-数据科学分析Agent实战' },
          ]
        },
        {
          text: '行业实战精选',
          collapsed: true,
          items: [
            { text: '48 - 智能酒店管理', link: '/实战案例库/48-智能酒店管理Agent实战' },
            { text: '56 - 智能海关通关', link: '/实战案例库/56-智能海关通关Agent实战' },
            { text: '68 - 智能税务申报', link: '/实战案例库/68-智能税务申报Agent实战' },
            { text: '71 - 智能投顾协商', link: '/实战案例库/71-智能投顾多Agent协商实战' },
          ]
        },
      ],

      '/学习评估/': [
        {
          text: '学习评估',
          collapsed: false,
          items: [
            { text: '01 - 里程碑与进度跟踪', link: '/学习评估/01-学习里程碑与进度跟踪' },
            { text: '02 - 题库与面试准备', link: '/学习评估/02-知识检验题库与面试准备' },
            { text: '03 - 速查卡', link: '/学习评估/03-速查卡' },
            { text: '04 - 学习行动计划', link: '/学习评估/04-学习行动计划' },
          ]
        }
      ],
    },

    outline: { level: 2, label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    lastUpdatedText: '最后更新',
  },

  mermaid: { theme: 'default' },
  markdown: { lineNumbers: true },
  srcDir: '.',
  srcExclude: ['**/README.md', 'node_modules/**', 'copy-docs.sh'],
  ignoreDeadLinks: true,
}))
