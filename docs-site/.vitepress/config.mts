import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'LangChain & LangGraph 学习平台',
  description: '从零到精通 LangChain 与 LangGraph 的完整学习体系',
  lang: 'zh-CN',
  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { name: 'author', content: 'AStudio' }],
  ],

  themeConfig: {
    // 站点级别配置
    logo: '/logo.svg',
    siteTitle: 'LangChain & LangGraph 学习平台',

    // 导航栏
    nav: [
      { text: '🏠 首页', link: '/' },
      { text: '📚 学习课程', link: '/课程/00-课程总览与学习路径' },
      { text: '📖 知识库', link: '/知识库/01-技术术语表' },
      { text: '📊 图解', link: '/图解/00-学习路线全景图' },
      { text: '🚀 实战案例', link: '/实战案例库/00-案例库导读' },
      { text: '📝 学习评估', link: '/学习评估/01-学习里程碑与进度跟踪' },
      {
        text: '🔗 外部链接',
        items: [
          { text: 'LangChain 官方文档', link: 'https://python.langchain.com' },
          { text: 'LangGraph 官方文档', link: 'https://langchain-ai.github.io/langgraph' },
          { text: 'GitHub 仓库', link: 'https://github.com/1739467001-svg/Astudio_langchain-langgraph' },
        ]
      },
    ],

    // 搜索
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/1739467001-svg/Astudio_langchain-langgraph' }
    ],

    // 页脚
    footer: {
      message: '基于 1171+ 篇文档构建 · 涵盖 35+ 行业应用 · 持续更新中',
      copyright: 'MIT Licensed · Built with VitePress'
    },

    // 侧边栏
    sidebar: {
      // 学习课程侧边栏
      '/课程/': [
        {
          text: '📘 学习课程',
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

      // 知识库侧边栏（按分类）
      '/知识库/': [
        {
          text: '📖 基础参考篇 (01-13)',
          collapsed: true,
          items: [
            { text: '01 - 技术术语表', link: '/知识库/01-技术术语表' },
            { text: '02 - LangChain 架构详解', link: '/知识库/02-LangChain架构详解' },
            { text: '03 - LangGraph 架构详解', link: '/知识库/03-LangGraph架构详解' },
            { text: '04 - API 参考与速查手册', link: '/知识库/04-API参考与速查手册' },
            { text: '05 - 代码示例集', link: '/知识库/05-代码示例集' },
            { text: '06 - 环境配置指南', link: '/知识库/06-环境配置指南' },
            { text: '07 - 常见问题与排错指南', link: '/知识库/07-常见问题与排错指南' },
            { text: '08 - 版本演进与生态', link: '/知识库/08-版本演进与生态' },
            { text: '09 - Prompt 工程实战指南', link: '/知识库/09-Prompt工程实战指南' },
            { text: '10 - 安全与合规指南', link: '/知识库/10-安全与合规指南' },
            { text: '11 - LLM 应用评估与测试', link: '/知识库/11-LLM应用评估与测试' },
            { text: '12 - 向量数据库深度对比', link: '/知识库/12-向量数据库深度对比' },
            { text: '13 - 流式输出与异步编程', link: '/知识库/13-流式输出与异步编程专题' },
          ]
        },
        {
          text: '📖 前沿技术指南',
          collapsed: true,
          items: [
            { text: '427 - MCP 协议与工具集成', link: '/知识库/427-MCP协议与LangChain工具集成指南' },
            { text: '428 - 推理模型与 Agent 集成', link: '/知识库/428-推理模型与Agent集成指南' },
            { text: '429 - Agent 可恢复性与容错编排', link: '/知识库/429-Agent可恢复性与容错编排指南' },
            { text: '430 - Agentic RAG 与自适应检索', link: '/知识库/430-Agentic RAG与自适应检索决策指南' },
            { text: '431 - 长上下文模型与 RAG 策略', link: '/知识库/431-长上下文模型与RAG策略权衡指南' },
            { text: '432 - Computer Use 与浏览器自动化', link: '/知识库/432-Computer Use与浏览器自动化Agent指南' },
            { text: '433 - OpenAI Realtime API 与语音 Agent', link: '/知识库/433-OpenAI Realtime API与语音Agent指南' },
            { text: '434 - 自托管 LLM 与本地推理部署', link: '/知识库/434-自托管LLM与本地推理部署指南' },
            { text: '435 - LLM 评测工具链集成', link: '/知识库/435-LLM评测工具链集成指南' },
            { text: '436 - AI 编程 Agent 与代码自动化', link: '/知识库/436-AI编程Agent与代码自动化指南' },
            { text: '437 - OpenAI Agents SDK 与多 Agent 框架', link: '/知识库/437-OpenAI Agents SDK与多Agent框架指南' },
            { text: '438 - NeMo Guardrails 与护栏系统', link: '/知识库/438-NeMo Guardrails与Agent护栏系统指南' },
            { text: '439 - PEFT 微调与 DPO 对齐', link: '/知识库/439-PEFT微调与DPO对齐实践指南' },
            { text: '440 - Agent 前端与聊天 UI 构建', link: '/知识库/440-Agent前端与聊天UI构建指南' },
            { text: '441 - LangGraph Platform 部署', link: '/知识库/441-LangGraph Platform部署与生产化指南' },
            { text: '442 - Agent 身份认证与授权', link: '/知识库/442-Agent身份认证与授权体系指南' },
            { text: '443 - 多模态文档智能与 OCR', link: '/知识库/443-多模态文档智能与OCR-Agent指南' },
            { text: '444 - Agent 可解释性与 XAI', link: '/知识库/444-Agent可解释性与XAI指南' },
            { text: '445 - Agent 调试与可观测工具链', link: '/知识库/445-Agent调试与可观测工具链指南' },
            { text: '446 - Agent 记忆架构与长期记忆', link: '/知识库/446-Agent记忆架构与长期记忆系统指南' },
            { text: '447 - AI 伦理与偏见检测', link: '/知识库/447-AI伦理与偏见检测指南' },
            { text: '448 - Agent 红队测试与对抗攻防', link: '/知识库/448-Agent红队测试与对抗攻防深度指南' },
            { text: '449 - 隐私计算与联邦学习', link: '/知识库/449-隐私计算与联邦学习指南' },
            { text: '450 - Agent 经济模型与激励机制', link: '/知识库/450-Agent经济模型与激励机制指南' },
            { text: '451 - LLM 应用合规与法律框架', link: '/知识库/451-LLM应用合规与法律框架指南' },
            { text: '462 - Agent 设计模式与参考架构', link: '/知识库/462-Agent设计模式与参考架构指南' },
            { text: '463 - GraphRAG 与知识图谱', link: '/知识库/463-GraphRAG与知识图谱实体抽取指南' },
            { text: '464 - 强化学习与 RLHF 对齐', link: '/知识库/464-强化学习与RLHF对齐指南' },
            { text: '465 - RPA 与业务流程自动化', link: '/知识库/465-RPA与业务流程自动化Agent指南' },
            { text: '466 - Agent 数据流与 DAG 编排', link: '/知识库/466-Agent数据流与DAG编排引擎指南' },
            { text: '467 - 多 Agent 仿真与群体智能', link: '/知识库/467-多Agent仿真与群体智能指南' },
            { text: '468 - 自动 Prompt 优化与元学习', link: '/知识库/468-自动Prompt优化与元学习指南' },
            { text: '469 - 分布式 Agent 与边缘部署', link: '/知识库/469-分布式Agent与边缘部署指南' },
            { text: '470 - Agent 生态系统与互操作', link: '/知识库/470-Agent生态系统与标准互操作指南' },
            { text: '471 - 数字孪生与 Agent 仿真', link: '/知识库/471-数字孪生与Agent仿真环境指南' },
            { text: '472 - Agent 质量度量与基准测试', link: '/知识库/472-Agent质量度量与基准测试体系指南' },
            { text: '473 - Agent 可靠性与韧性工程', link: '/知识库/473-Agent可靠性与韧性工程指南' },
            { text: '474 - Agent 会话管理与上下文工程', link: '/知识库/474-Agent会话管理与上下文工程指南' },
            { text: '475 - Agent 性能调优与延迟优化', link: '/知识库/475-Agent性能调优与延迟优化指南' },
            { text: '476 - Agent 计费与成本管理', link: '/知识库/476-Agent计费与成本管理深度指南' },
            { text: '477 - Agent 数据安全与加密', link: '/知识库/477-Agent数据安全与加密体系指南' },
            { text: '478 - AIOps 与智能运维', link: '/知识库/478-AIOps与智能运维指南' },
            { text: '479 - Agent 自动扩缩容与弹性', link: '/知识库/479-Agent自动扩缩容与弹性指南' },
            { text: '480 - Agent 日志管理与审计', link: '/知识库/480-Agent日志管理与审计追溯指南' },
            { text: '481 - Agent 变更管理与发布流程', link: '/知识库/481-Agent变更管理与发布流程指南' },
            { text: '482 - Agent API 设计与 OpenAPI', link: '/知识库/482-Agent API设计与OpenAPI规范指南' },
            { text: '483 - Agent 内容生成与文档自动化', link: '/知识库/483-Agent内容生成与文档自动化指南' },
            { text: '484 - Agent 跨平台与多端部署', link: '/知识库/484-Agent跨平台与多端部署指南' },
            { text: '485 - Agent 调度与定时任务 Cron', link: '/知识库/485-Agent调度与定时任务Cron指南' },
            { text: '486 - Agent Webhook 与事件驱动通知', link: '/知识库/486-Agent Webhook与事件驱动通知指南' },
            { text: '487 - Agent 最佳实践与反模式', link: '/知识库/487-Agent最佳实践与反模式深度指南' },
            { text: '488 - Agent 环境管理与配置即代码', link: '/知识库/488-Agent环境管理与配置即代码指南' },
            { text: '489 - Agent 容器化与 K8s 部署', link: '/知识库/489-Agent容器化与K8s生产部署指南' },
            { text: '490 - Agent 版本兼容与平滑升级', link: '/知识库/490-Agent版本兼容与平滑升级指南' },
            { text: '491 - Agent 冷启动优化与预热', link: '/知识库/491-Agent冷启动优化与预热策略指南' },
            { text: '492 - Agent 异地多活与灾难恢复', link: '/知识库/492-Agent异地多活与灾难恢复深度指南' },
            { text: '493 - Agent 数据迁移与零停机搬迁', link: '/知识库/493-Agent数据迁移与零停机搬迁指南' },
            { text: '494 - Agent 混合搜索与语义检索', link: '/知识库/494-Agent混合搜索与语义检索增强指南' },
            { text: '495 - Agent 工具选择与智能编排', link: '/知识库/495-Agent工具选择与智能编排指南' },
            { text: '496 - Agent 经验沉淀与组织知识库', link: '/知识库/496-Agent经验沉淀与组织知识库指南' },
            { text: '497 - Agent 对话压缩与长上下文', link: '/知识库/497-Agent对话压缩与长上下文管理深度指南' },
            { text: '498 - Agent 语义缓存与智能缓存', link: '/知识库/498-Agent语义缓存与智能缓存策略深度指南' },
            { text: '499 - Agent 性能压测与负载基准', link: '/知识库/499-Agent性能压测与负载基准指南' },
            { text: '500 - Agent 越狱防护与注入防御', link: '/知识库/500-Agent越狱防护与提示注入防御深度指南' },
            { text: '501 - Agent 数据保护与隐私合规', link: '/知识库/501-Agent数据保护与隐私合规深度指南' },
            { text: '502 - Agent 可观测性三支柱整合', link: '/知识库/502-Agent可观测性三支柱整合指南' },
            { text: '503 - Agent SRE 与 On-Call 事件管理', link: '/知识库/503-Agent SRE与On-Call事件管理指南' },
            { text: '504 - Agent DevOps 与 CI/CD 流水线', link: '/知识库/504-Agent DevOps与CI-CD流水线工程化指南' },
            { text: '505 - Agent 云原生与 Serverless', link: '/知识库/505-Agent云原生与Serverless部署指南' },
            { text: '506 - Agent 微服务拆分与服务网格', link: '/知识库/506-Agent微服务拆分与服务网格指南' },
            { text: '507 - Agent 错误处理与异常恢复', link: '/知识库/507-Agent错误处理与异常恢复工程化指南' },
            { text: '508 - Agent 限流配额与流量治理', link: '/知识库/508-Agent限流配额与流量治理指南' },
            { text: '509 - Agent 优雅关闭与排空', link: '/知识库/509-Agent优雅关闭与排空深度指南' },
            { text: '510 - Agent 配置热更新与动态配置', link: '/知识库/510-Agent配置热更新与动态配置中心指南' },
            { text: '511 - Agent 回滚与版本管理', link: '/知识库/511-Agent回滚与版本管理工程化指南' },
            { text: '512 - Agent 对话状态机与槽位填充', link: '/知识库/512-Agent对话状态机与槽位填充深度指南' },
            { text: '513 - Agent 推理链优化与思维链', link: '/知识库/513-Agent推理链优化与思维链工程化指南' },
            { text: '514 - Agent 工具编排与动态工具链', link: '/知识库/514-Agent工具编排与动态工具链指南' },
            { text: '515 - Agent 情景记忆与语义记忆', link: '/知识库/515-Agent情景记忆与语义记忆深度指南' },
            { text: '516 - Agent 踩坑实录与事故分析', link: '/知识库/516-Agent踩坑实录与生产事故案例分析指南' },
            { text: '517 - Agent 数据分析与可视化', link: '/知识库/517-Agent数据分析与可视化自动化指南' },
            { text: '518 - Agent 代码生成与代码审查', link: '/知识库/518-Agent代码生成与代码审查深度指南' },
            { text: '519 - Agent 多语言翻译与国际化', link: '/知识库/519-Agent多语言翻译与国际化指南' },
            { text: '520 - Agent 搜索增强与网页提取', link: '/知识库/520-Agent搜索增强与网页信息提取指南' },
            { text: '521 - Agent 内容创作与写作辅助', link: '/知识库/521-Agent内容创作与写作辅助深度指南' },
          ]
        },
        {
          text: '📖 行业应用指南',
          collapsed: true,
          items: [
            { text: '522 - 教育应用与智能学习', link: '/知识库/522-Agent教育应用与智能学习辅导指南' },
            { text: '523 - 医疗辅助与诊断支持', link: '/知识库/523-Agent医疗辅助与诊断支持指南' },
            { text: '524 - 金融风控与智能投顾', link: '/知识库/524-Agent金融风控与智能投顾指南' },
            { text: '525 - 法律辅助与合同审查', link: '/知识库/525-Agent法律辅助与合同审查指南' },
            { text: '526 - 客服自动化与智能对话', link: '/知识库/526-Agent客服自动化与智能对话指南' },
            { text: '527 - 智能制造与工业互联网', link: '/知识库/527-Agent智能制造与工业互联网指南' },
            { text: '528 - 供应链优化与物流管理', link: '/知识库/528-Agent供应链优化与物流管理指南' },
            { text: '529 - 能源管理与电力调度', link: '/知识库/529-Agent能源管理与电力调度指南' },
            { text: '530 - 人力资源与智能招聘', link: '/知识库/530-Agent人力资源与智能招聘指南' },
            { text: '531 - 税务申报与智能审计', link: '/知识库/531-Agent税务申报与智能审计指南' },
            { text: '532 - 智慧政务与公共服务', link: '/知识库/532-Agent智慧政务与公共服务指南' },
            { text: '533 - 农业智能化与精准种植', link: '/知识库/533-Agent农业智能化与精准种植指南' },
            { text: '534 - 智慧交通与城市管理', link: '/知识库/534-Agent智慧交通与城市管理指南' },
            { text: '535 - 零售电商与智能营销', link: '/知识库/535-Agent零售电商与智能营销指南' },
            { text: '536 - 心理咨询与心理健康', link: '/知识库/536-Agent心理咨询与心理健康服务指南' },
            { text: '537 - 旅游规划与智能出行', link: '/知识库/537-Agent旅游规划与智能出行指南' },
            { text: '538 - 保险理赔与智能核保', link: '/知识库/538-Agent保险理赔与智能核保指南' },
            { text: '539 - 专利分析与知识产权', link: '/知识库/539-Agent专利分析与知识产权管理指南' },
            { text: '540 - 智能建筑与物业管理', link: '/知识库/540-Agent智能建筑与物业管理指南' },
            { text: '541 - 医药研发与临床试验', link: '/知识库/541-Agent医药研发与临床试验指南' },
            { text: '542 - 环保监测与碳排放管理', link: '/知识库/542-Agent环保监测与碳排放管理指南' },
            { text: '543 - 智能汽车与自动驾驶辅助', link: '/知识库/543-Agent智能汽车与自动驾驶辅助指南' },
            { text: '544 - 食品安全与质量追溯', link: '/知识库/544-Agent食品安全与质量追溯指南' },
            { text: '545 - 新闻媒体与内容采编', link: '/知识库/545-Agent新闻媒体与内容采编指南' },
            { text: '546 - 城市规划与智慧社区', link: '/知识库/546-Agent城市规划与智慧社区指南' },
            { text: '547 - 半导体制造与良率优化', link: '/知识库/547-Agent半导体制造与良率优化指南' },
            { text: '548 - 影视制作与内容创作', link: '/知识库/548-Agent影视制作与内容创作指南' },
            { text: '549 - 气象预报与灾害预警', link: '/知识库/549-Agent气象预报与灾害预警指南' },
            { text: '550 - 房地产智能估值与交易', link: '/知识库/550-Agent房地产智能估值与交易指南' },
            { text: '551 - 图书馆与智能知识管理', link: '/知识库/551-Agent图书馆与智能知识管理指南' },
            { text: '552 - 游戏开发与智能 NPC', link: '/知识库/552-Agent游戏开发与智能NPC指南' },
            { text: '553 - 体育分析与赛事辅助', link: '/知识库/553-Agent体育分析与赛事辅助指南' },
            { text: '554 - 化工生产安全与工艺优化', link: '/知识库/554-Agent化工生产安全与工艺优化指南' },
            { text: '555 - 海洋探索与海事管理', link: '/知识库/555-Agent海洋探索与海事管理指南' },
            { text: '556 - 会展活动管理与智能场馆', link: '/知识库/556-Agent会展活动管理与智能场馆指南' },
          ]
        },
      ],

      // 图解侧边栏
      '/图解/': [
        {
          text: '📊 基础图解 (00-12)',
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
            { text: '08 - 技术选型决策树', link: '/图解/08-技术选型决策树' },
            { text: '09 - Token 与成本可视化', link: '/图解/09-Token与成本可视化图解' },
            { text: '10 - 流式输出原理', link: '/图解/10-流式输出原理图解' },
            { text: '11 - LangGraph 检查点', link: '/图解/11-LangGraph检查点与时间旅行图解' },
            { text: '12 - Prompt 工程模式', link: '/图解/12-Prompt工程模式图解' },
          ]
        },
        {
          text: '📊 前沿图解 (397+)',
          collapsed: true,
          items: [
            { text: '397 - MCP 协议', link: '/图解/397-MCP协议与LangChain工具集成图解' },
            { text: '398 - 推理模型', link: '/图解/398-推理模型与Agent集成图解' },
            { text: '399 - Agent 可恢复性', link: '/图解/399-Agent可恢复性与容错编排图解' },
            { text: '400 - Agentic RAG', link: '/图解/400-AgenticRAG与自适应检索决策图解' },
            { text: '401 - 长上下文与 RAG', link: '/图解/401-长上下文模型与RAG策略权衡图解' },
            { text: '432 - Computer Use', link: '/图解/402-Computer Use与浏览器自动化Agent图解' },
            { text: '437 - OpenAI Agents SDK', link: '/图解/407-OpenAI Agents SDK与多Agent框架图解' },
            { text: '462 - Agent 设计模式', link: '/图解/432-Agent设计模式与参考架构图解' },
            { text: '487 - 最佳实践与反模式', link: '/图解/457-Agent最佳实践与反模式深度图解' },
            { text: '516 - 踩坑实录', link: '/图解/486-Agent踩坑实录与生产事故案例分析图解' },
          ]
        },
      ],

      // 实战案例侧边栏
      '/实战案例库/': [
        {
          text: '🚀 基础实战',
          collapsed: false,
          items: [
            { text: '00 - 案例库导读', link: '/实战案例库/00-案例库导读' },
            { text: '01 - 智能客服机器人', link: '/实战案例库/01-智能客服机器人' },
            { text: '02 - 多文档 RAG 问答系统', link: '/实战案例库/02-多文档RAG问答系统' },
            { text: '03 - 代码审查助手', link: '/实战案例库/03-代码审查助手' },
            { text: '04 - 数据分析对话助手', link: '/实战案例库/04-数据分析对话助手' },
            { text: '05 - 多模态文档助手', link: '/实战案例库/05-多模态文档助手' },
            { text: '06 - SQL 数据分析 Agent', link: '/实战案例库/06-SQL数据分析Agent' },
          ]
        },
        {
          text: '🚀 进阶实战',
          collapsed: false,
          items: [
            { text: '07 - 实战索引与路径串联', link: '/实战案例库/07-实战索引与学习路径串联' },
            { text: '08 - Web 搜索研究 Agent', link: '/实战案例库/08-Web搜索研究Agent' },
            { text: '09 - 自动化工作流 Agent', link: '/实战案例库/09-自动化工作流Agent实战' },
            { text: '10 - 进阶 RAG 问答系统', link: '/实战案例库/10-进阶RAG问答系统实战' },
            { text: '11 - 多 Agent 协作研究系统', link: '/实战案例库/11-多Agent协作研究系统' },
            { text: '12 - 数据科学分析 Agent', link: '/实战案例库/12-数据科学分析Agent实战' },
          ]
        },
        {
          text: '🚀 行业实战',
          collapsed: true,
          items: [
            { text: '13 - 智能客服系统进阶', link: '/实战案例库/13-智能客服系统进阶实战' },
            { text: '48 - 智能酒店管理', link: '/实战案例库/48-智能酒店管理Agent实战' },
            { text: '56 - 智能海关通关', link: '/实战案例库/56-智能海关通关Agent实战' },
            { text: '68 - 智能税务申报', link: '/实战案例库/68-智能税务申报Agent实战' },
            { text: '71 - 智能投顾多 Agent 协商', link: '/实战案例库/71-智能投顾多Agent协商实战' },
          ]
        },
      ],

      // 学习评估侧边栏
      '/学习评估/': [
        {
          text: '📝 学习评估',
          collapsed: false,
          items: [
            { text: '01 - 学习里程碑与进度跟踪', link: '/学习评估/01-学习里程碑与进度跟踪' },
            { text: '02 - 知识检验题库与面试准备', link: '/学习评估/02-知识检验题库与面试准备' },
            { text: '03 - 速查卡', link: '/学习评估/03-速查卡' },
            { text: '04 - 学习行动计划', link: '/学习评估/04-学习行动计划' },
          ]
        }
      ],
    },

    // 页面元信息
    outline: {
      level: 2,
      label: '本页目录'
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部'
  },

  // Mermaid 配置
  mermaid: {
    theme: 'default'
  },

  // Markdown 配置
  markdown: {
    lineNumbers: true,
  },

  // Vite 配置
  vite: {
    plugins: [],
  },

  // 构建配置
  srcDir: '.',

  // 忽略的文件
  srcExclude: ['**/README.md', 'node_modules/**'],

  // 忽略死链接
  ignoreDeadLinks: true,
}))
