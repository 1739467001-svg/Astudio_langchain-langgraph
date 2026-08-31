---
layout: home

hero:
  name: LangChain & LangGraph
  text: 系统学习平台
  tagline: 1243 篇文档 · 35+ 行业应用 · 从零基础到生产部署的完整知识体系
  image:
    src: /logo.svg
    alt: LangChain & LangGraph
  actions:
    - theme: brand
      text: 开始学习
      link: /课程/00-课程总览与学习路径
    - theme: alt
      text: 知识库
      link: /知识库/01-技术术语表
    - theme: alt
      text: 实战案例
      link: /实战案例库/00-案例库导读

features:
  - icon: 📚
    title: 13 篇系统课程
    details: 从零基础到实战项目，循序渐进掌握 LangChain 与 LangGraph 框架。每课配有代码示例和练习。
    link: /课程/00-课程总览与学习路径
    linkText: 查看课程 →
  - icon: 📖
    title: 591 篇知识库
    details: 技术细节、架构解析、代码示例、API 速查，覆盖基础到前沿的完整技术栈。
    link: /知识库/01-技术术语表
    linkText: 浏览知识库 →
  - icon: 📊
    title: 562 篇图解
    details: Mermaid 流程图、架构图、决策树，可视化理解每个概念和技术关系。
    link: /图解/00-学习路线全景图
    linkText: 查看图解 →
  - icon: 🚀
    title: 72 篇实战案例
    details: 完整可运行的项目，覆盖客服、RAG、数据分析、多 Agent、35+ 行业场景。
    link: /实战案例库/00-案例库导读
    linkText: 浏览案例 →
  - icon: 📝
    title: 学习评估体系
    details: 里程碑跟踪、知识检验题库、速查卡、四阶段学习行动计划。
    link: /学习评估/04-学习行动计划
    linkText: 查看计划 →
  - icon: 🌐
    title: 35+ 行业应用
    details: 教育、医疗、金融、法律、制造、交通、能源、半导体、医药等垂直领域深度指南。
    link: /知识库/522-Agent教育应用与智能学习辅导指南
    linkText: 行业应用 →
---

<style>
:root {
  --stat-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04));
  --stat-border: rgba(99, 102, 241, 0.12);
  --stat-number: #6366f1;
  --stat-label: #6b7280;
  --path-line: linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef);
  --card-bg: rgba(255, 255, 255, 0.6);
  --card-border: rgba(99, 102, 241, 0.1);
  --card-shadow: 0 4px 24px rgba(99, 102, 241, 0.06);
}
.dark {
  --stat-bg: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.06));
  --stat-border: rgba(99, 102, 241, 0.2);
  --stat-number: #818cf8;
  --stat-label: #9ca3af;
  --card-bg: rgba(26, 26, 46, 0.6);
  --card-border: rgba(99, 102, 241, 0.15);
  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

/* 统计面板 */
.stats-panel {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  max-width: 960px;
  margin: 0 auto 48px;
  padding: 0 24px;
}
.stat-card {
  background: var(--stat-bg);
  border: 1px solid var(--stat-border);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.3);
}
.stat-number {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 6px;
}
.stat-label {
  font-size: 13px;
  color: var(--stat-label);
  font-weight: 500;
}

/* 学习路径 */
.learning-path {
  max-width: 960px;
  margin: 0 auto 48px;
  padding: 0 24px;
}
.learning-path h2 {
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 32px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.path-steps {
  display: flex;
  justify-content: space-between;
  position: relative;
  flex-wrap: wrap;
  gap: 16px;
}
.path-steps::before {
  content: '';
  position: absolute;
  top: 28px;
  left: 10%;
  right: 10%;
  height: 3px;
  background: var(--path-line);
  border-radius: 2px;
  opacity: 0.3;
}
.path-step {
  position: relative;
  z-index: 1;
  text-align: center;
  flex: 1;
  min-width: 140px;
}
.path-step-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
  transition: all 0.3s;
}
.path-step:hover .path-step-icon {
  transform: scale(1.1);
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
}
.path-step-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 4px;
}
.path-step-desc {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

/* 特色板块 */
.feature-section {
  max-width: 960px;
  margin: 0 auto 48px;
  padding: 0 24px;
}
.feature-section h2 {
  text-align: center;
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 32px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
}
.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--card-shadow);
  border-color: rgba(99, 102, 241, 0.25);
}
.feature-card-icon {
  font-size: 32px;
  margin-bottom: 12px;
}
.feature-card-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 8px;
}
.feature-card-desc {
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

/* 行业标签云 */
.industry-cloud {
  max-width: 960px;
  margin: 0 auto 48px;
  padding: 0 24px;
  text-align: center;
}
.industry-cloud h2 {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.industry-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}
.industry-tag {
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--stat-bg);
  border: 1px solid var(--stat-border);
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  transition: all 0.3s;
  cursor: default;
}
.industry-tag:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08));
  border-color: rgba(99, 102, 241, 0.3);
  color: var(--vp-c-brand);
  transform: translateY(-2px);
}

/* CTA */
.cta-section {
  max-width: 720px;
  margin: 0 auto 48px;
  padding: 0 24px;
  text-align: center;
}
.cta-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04));
  border: 1px solid var(--stat-border);
  border-radius: 20px;
  padding: 48px 32px;
}
.cta-title {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.cta-desc {
  font-size: 16px;
  color: var(--vp-c-text-2);
  margin-bottom: 24px;
  line-height: 1.6;
}
.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.cta-btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  text-decoration: none !important;
  transition: all 0.3s;
}
.cta-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff !important;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}
.cta-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
}
.cta-btn-secondary {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1) !important;
  border: 1px solid var(--vp-c-divider);
}
.cta-btn-secondary:hover {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand) !important;
}

@media (max-width: 768px) {
  .stats-panel { grid-template-columns: repeat(2, 1fr); }
  .feature-grid { grid-template-columns: 1fr; }
  .path-steps::before { display: none; }
  .path-step { min-width: 45%; }
}
</style>

<div class="stats-panel">
  <div class="stat-card">
    <div class="stat-number">13</div>
    <div class="stat-label">学习课程</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">591</div>
    <div class="stat-label">知识库</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">562</div>
    <div class="stat-label">图解</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">72</div>
    <div class="stat-label">实战案例</div>
  </div>
  <div class="stat-card">
    <div class="stat-number">35+</div>
    <div class="stat-label">行业应用</div>
  </div>
</div>

<div class="learning-path">
  <h2>学习路径</h2>
  <div class="path-steps">
    <div class="path-step">
      <div class="path-step-icon">🌱</div>
      <div class="path-step-title">基础通关</div>
      <div class="path-step-desc">1-2 周 · 课程 00-08</div>
    </div>
    <div class="path-step">
      <div class="path-step-icon">⚙️</div>
      <div class="path-step-title">LangGraph</div>
      <div class="path-step-desc">1-2 周 · 课程 09-12</div>
    </div>
    <div class="path-step">
      <div class="path-step-icon">🚀</div>
      <div class="path-step-title">实战项目</div>
      <div class="path-step-desc">2-4 周 · 做一个</div>
    </div>
    <div class="path-step">
      <div class="path-step-icon">🏗️</div>
      <div class="path-step-title">生产化</div>
      <div class="path-step-desc">按需 · 部署运维</div>
    </div>
    <div class="path-step">
      <div class="path-step-icon">🔬</div>
      <div class="path-step-title">深度探索</div>
      <div class="path-step-desc">按需 · 前沿专题</div>
    </div>
  </div>
</div>

<div class="feature-section">
  <h2>核心能力</h2>
  <div class="feature-grid">
    <div class="feature-card">
      <div class="feature-card-icon">🧠</div>
      <div class="feature-card-title">Agent 架构设计</div>
      <div class="feature-card-desc">ReAct、Plan-Execute、Reflection、Supervisor 等 12 种设计模式，覆盖从简单到复杂的多 Agent 系统。</div>
    </div>
    <div class="feature-card">
      <div class="feature-card-icon">🔍</div>
      <div class="feature-card-title">RAG 全流程</div>
      <div class="feature-card-desc">分块策略、混合检索、RRF 融合、重排序、Agentic RAG、GraphRAG，从基础到前沿的完整 RAG 技术栈。</div>
    </div>
    <div class="feature-card">
      <div class="feature-card-icon">🛡️</div>
      <div class="feature-card-title">安全与合规</div>
      <div class="feature-card-desc">越狱防护、提示注入防御、5 级防御体系、数据脱敏、链式哈希审计、负责任 AI 框架。</div>
    </div>
    <div class="feature-card">
      <div class="feature-card-icon">📊</div>
      <div class="feature-card-title">运维与监控</div>
      <div class="feature-card-desc">可观测性三支柱、SRE、AIOps、自动扩缩容、CI/CD 流水线、金丝雀发布、自动回滚。</div>
    </div>
    <div class="feature-card">
      <div class="feature-card-icon">⚡</div>
      <div class="feature-card-title">性能优化</div>
      <div class="feature-card-desc">推理引擎深度优化、HNSW 调优、语义缓存、流式架构、Token 预算管理、成本控制。</div>
    </div>
    <div class="feature-card">
      <div class="feature-card-icon">🌐</div>
      <div class="feature-card-title">MCP 与生态</div>
      <div class="feature-card-desc">MCP 协议、A2A 通信、OpenAI Agents SDK、多框架互操作、Agent 市场与生态标准。</div>
    </div>
  </div>
</div>

<div class="industry-cloud">
  <h2>行业应用全景</h2>
  <div class="industry-tags">
    <span class="industry-tag">🎓 教育</span>
    <span class="industry-tag">🏥 医疗</span>
    <span class="industry-tag">💰 金融</span>
    <span class="industry-tag">⚖️ 法律</span>
    <span class="industry-tag">🏭 制造</span>
    <span class="industry-tag">🚗 汽车</span>
    <span class="industry-tag">🚢 海事</span>
    <span class="industry-tag">⚡ 能源</span>
    <span class="industry-tag">🚦 交通</span>
    <span class="industry-tag">🛒 零售</span>
    <span class="industry-tag">🧠 心理健康</span>
    <span class="industry-tag">✈️ 旅游</span>
    <span class="industry-tag">📋 保险</span>
    <span class="industry-tag">📊 专利</span>
    <span class="industry-tag">🏗️ 建筑</span>
    <span class="industry-tag">💊 医药</span>
    <span class="industry-tag">🌱 农业</span>
    <span class="industry-tag">🌍 环保</span>
    <span class="industry-tag">🎮 游戏</span>
    <span class="industry-tag">⚽ 体育</span>
    <span class="industry-tag">🧪 化工</span>
    <span class="industry-tag">📰 新闻</span>
    <span class="industry-tag">🏙️ 城市</span>
    <span class="industry-tag">📡 气象</span>
    <span class="industry-tag">🏠 房地产</span>
    <span class="industry-tag">📚 图书馆</span>
    <span class="industry-tag">🎬 影视</span>
    <span class="industry-tag">🖥️ 半导体</span>
    <span class="industry-tag">🏛️ 政务</span>
    <span class="industry-tag">👥 人力资源</span>
    <span class="industry-tag">🧾 税务</span>
    <span class="industry-tag">🍽️ 食品安全</span>
    <span class="industry-tag">🎪 会展</span>
    <span class="industry-tag">💼 供应链</span>
    <span class="industry-tag">🏢 物业</span>
  </div>
</div>

<div class="cta-section">
  <div class="cta-card">
    <div class="cta-title">现在就开始你的学习之旅</div>
    <div class="cta-desc">从零基础到生产部署，1243 篇文档构成完整知识体系。不需要任何 AI 或编程的高级知识，我们会从零开始。</div>
    <div class="cta-buttons">
      <a href="/课程/00-课程总览与学习路径" class="cta-btn cta-btn-primary">📚 开始学习</a>
      <a href="/学习评估/04-学习行动计划" class="cta-btn cta-btn-secondary">📋 查看行动计划</a>
    </div>
  </div>
</div>
