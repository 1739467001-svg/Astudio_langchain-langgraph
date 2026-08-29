# Agent 内容生成与文档自动化指南

> Agent 不只会回答问题——它还能生成报告、写文档、创作内容、自动化文档更新。从周报自动化到技术文档同步、从营销文案批量生成到合同模板填充，Agent 正在接管内容生产。本指南系统讲解内容生成 Agent 的架构、模板系统、多格式输出、质量控制，以及实际应用场景。

---

## 1. 内容生成 Agent 架构

### 工作流

```mermaid
graph TB
    INPUT["输入需求<br/>主题/数据/模板"] --> PLAN["规划<br/>大纲+结构"]
    PLAN --> DRAFT["起草<br/>分段生成"]
    DRAFT --> REVIEW["审查<br/>质量检查+校对"]
    REVIEW --> FORMAT["格式化<br/>Markdown/Word/PDF"]
    FORMAT --> OUTPUT["输出<br/>文档+元数据"]

    style PLAN fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DRAFT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style FORMAT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

### 生成类型

| 类型 | 输入 | 输出 | 示例 |
|------|------|------|------|
| 报告生成 | 数据+模板 | 结构化报告 | 周报/月报/分析报告 |
| 文档生成 | 主题+大纲 | 完整文档 | 技术文档/用户手册 |
| 内容创作 | 主题+风格 | 创意内容 | 营销文案/博客/社媒 |
| 文档翻译 | 原文+目标语言 | 翻译文档 | 多语言文档 |
| 文档摘要 | 长文档 | 摘要 | 论文摘要/会议纪要 |
| 模板填充 | 模板+数据 | 定制文档 | 合同/发票/通知 |

---

## 2. 模板系统

### 模板引擎

```python
from langchain_core.prompts import ChatPromptTemplate
from dataclasses import dataclass
from datetime import datetime

@dataclass
class DocumentTemplate:
    """文档模板"""
    name: str
    sections: list           # 章节定义
    variables: dict          # 变量
    style_guide: str = ""    # 风格指南
    output_format: str = "markdown"  # markdown / html / plain

# 报告模板
report_template = DocumentTemplate(
    name="周报模板",
    sections=[
        &#123;"title": "本周概要", "type": "summary", "min_words": 100, "max_words": 300&#125;,
        &#123;"title": "完成事项", "type": "list", "source": "completed_tasks"&#125;,
        &#123;"title": "进行中", "type": "list", "source": "ongoing_tasks"&#125;,
        &#123;"title": "下周计划", "type": "list", "source": "next_week_plan"&#125;,
        &#123;"title": "风险与问题", "type": "paragraph", "min_words": 50&#125;,
    ],
    variables=&#123;
        "author": "",
        "department": "",
        "week_date": "",
        "completed_tasks": [],
        "ongoing_tasks": [],
        "next_week_plan": [],
        "risks": "",
    &#125;,
    style_guide="正式、简洁、数据驱动",
    output_format="markdown",
)

@dataclass
class ContentGenerator:
    """内容生成器"""

    async def generate_document(self, template: DocumentTemplate,
                                 data: dict) -> str:
        """根据模板生成文档"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        # 合并变量
        variables = &#123;**template.variables, **data&#125;

        # 逐章节生成
        sections_content = []
        for section in template.sections:
            section_prompt = self._build_section_prompt(section, variables, template.style_guide)
            response = await llm.ainvoke(section_prompt)
            sections_content.append(&#123;
                "title": section["title"],
                "content": response.content,
            &#125;)

        # 组装文档
        document = self._assemble_document(template, sections_content)

        return document

    def _build_section_prompt(self, section: dict, variables: dict, style: str) -> str:
        """构建章节 Prompt"""
        source_data = ""
        if "source" in section:
            source_data = variables.get(section["source"], "")

        prompt = f"""请撰写文档章节。

章节标题: &#123;section['title']&#125;
风格要求: &#123;style&#125;
字数要求: &#123;section.get('min_words', 50)&#125;-&#123;section.get('max_words', 500)&#125;字

参考数据:
&#123;json.dumps(source_data, ensure_ascii=False) if source_data else '无'&#125;

上下文信息:
- 作者: &#123;variables.get('author', '')&#125;
- 部门: &#123;variables.get('department', '')&#125;
- 日期: &#123;variables.get('week_date', '')&#125;

请直接输出章节内容，不要重复标题。"""

        return prompt

    def _assemble_document(self, template: DocumentTemplate, sections: list) -> str:
        """组装文档"""
        parts = [f"# &#123;template.name&#125;\n"]

        for section in sections:
            parts.append(f"\n## &#123;section['title']&#125;\n")
            parts.append(section["content"])

        parts.append(f"\n---\n*生成时间: &#123;datetime.utcnow().strftime('%Y-%m-%d %H:%M')&#125;*")

        return "\n".join(parts)
```

---

## 3. 多格式输出

```python
@dataclass
class MultiFormatExporter:
    """多格式导出器"""

    async def export(self, content: str, format: str, filename: str = "") -> str:
        """导出为指定格式"""
        if format == "markdown":
            return self._export_markdown(content, filename)
        elif format == "html":
            return self._export_html(content, filename)
        elif format == "pdf":
            return await self._export_pdf(content, filename)
        elif format == "docx":
            return await self._export_docx(content, filename)
        else:
            return content

    def _export_markdown(self, content: str, filename: str) -> str:
        """导出 Markdown"""
        filepath = f"/tmp/&#123;filename or 'output'&#125;.md"
        with open(filepath, "w") as f:
            f.write(content)
        return filepath

    def _export_html(self, content: str, filename: str) -> str:
        """导出 HTML（Markdown→HTML）"""
        import markdown
        html_content = markdown.markdown(content, extensions=["tables", "codehilite"])

        # 包装为完整 HTML
        full_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>文档</title></head>
<body>&#123;html_content&#125;</body>
</html>"""

        filepath = f"/tmp/&#123;filename or 'output'&#125;.html"
        with open(filepath, "w") as f:
            f.write(full_html)
        return filepath

    async def _export_pdf(self, content: str, filename: str) -> str:
        """导出 PDF"""
        # 先转 HTML 再转 PDF
        html_path = self._export_html(content, filename)
        pdf_path = html_path.replace(".html", ".pdf")

        # 使用 wkhtmltopdf 或 weasyprint
        import subprocess
        subprocess.run(["wkhtmltopdf", html_path, pdf_path], capture_output=True)
        return pdf_path

    async def _export_docx(self, content: str, filename: str) -> str:
        """导出 Word"""
        from docx import Document as DocxDocument

        doc = DocxDocument()

        # 简单 Markdown 解析
        for line in content.split("\n"):
            if line.startswith("# "):
                doc.add_heading(line[2:], level=1)
            elif line.startswith("## "):
                doc.add_heading(line[3:], level=2)
            elif line.startswith("- "):
                doc.add_paragraph(line[2:], style="List Bullet")
            elif line.strip():
                doc.add_paragraph(line)

        filepath = f"/tmp/&#123;filename or 'output'&#125;.docx"
        doc.save(filepath)
        return filepath
```

---

## 4. 质量控制

```python
@dataclass
class ContentQualityChecker:
    """内容质量检查器"""

    async def check(self, content: str, requirements: dict) -> dict:
        """检查内容质量"""
        checks = &#123;&#125;

        # 1. 字数检查
        min_words = requirements.get("min_words", 100)
        max_words = requirements.get("max_words", 10000)
        word_count = len(content.split())
        checks["word_count"] = &#123;
            "actual": word_count,
            "min": min_words,
            "max": max_words,
            "passed": min_words <= word_count <= max_words,
        &#125;

        # 2. 结构检查
        required_sections = requirements.get("required_sections", [])
        found_sections = [s for s in required_sections if s in content]
        checks["structure"] = &#123;
            "required": required_sections,
            "found": found_sections,
            "passed": len(found_sections) == len(required_sections),
        &#125;

        # 3. 语言质量
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        response = await llm.ainvoke(
            f"评估以下内容的语言质量。检查：语法错误、逻辑连贯、表达清晰。只输出 JSON: &#123;&#123;\"score\": 0-1, \"issues\": []&#125;&#125;\n\n&#123;content[:2000]&#125;"
        )
        try:
            checks["language"] = json.loads(response.content)
        except:
            checks["language"] = &#123;"score": 0.8&#125;

        # 4. 查重（自抄袭）
        checks["originality"] = await self._check_originality(content)

        # 5. 格式检查
        checks["formatting"] = &#123;
            "has_headings": "#" in content,
            "has_lists": "-" in content or "*" in content,
            "passed": True,
        &#125;

        # 总体判断
        all_passed = all(c.get("passed", c.get("score", 1) >= 0.7) for c in checks.values())

        return &#123;
            "passed": all_passed,
            "checks": checks,
            "recommendations": self._generate_recommendations(checks),
        &#125;

    async def _check_originality(self, content: str) -> dict:
        """查重检查"""
        # 重复句子检测
        sentences = [s.strip() for s in content.split("。") if s.strip()]
        if len(sentences) < 2:
            return &#123;"score": 1.0, "duplicate_ratio": 0&#125;

        seen = set()
        duplicates = 0
        for s in sentences:
            if s in seen:
                duplicates += 1
            seen.add(s)

        ratio = duplicates / len(sentences)
        return &#123;"score": 1 - ratio, "duplicate_ratio": ratio&#125;

    def _generate_recommendations(self, checks: dict) -> list:
        """生成改进建议"""
        recs = []
        if not checks.get("word_count", &#123;&#125;).get("passed"):
            recs.append("调整字数到要求范围内")
        if not checks.get("structure", &#123;&#125;).get("passed"):
            recs.append("补充缺失的章节")
        if checks.get("language", &#123;&#125;).get("score", 1) < 0.8:
            recs.append("修正语法和表达问题")
        if checks.get("originality", &#123;&#125;).get("score", 1) < 0.9:
            recs.append("减少重复内容，增加原创性")
        return recs
```

---

## 5. 应用场景实现

### 周报自动化

```python
async def auto_weekly_report(user_id: str, week_data: dict) -> str:
    """周报自动化生成"""
    generator = ContentGenerator()

    # 数据准备
    data = &#123;
        "author": week_data.get("author", ""),
        "department": week_data.get("department", ""),
        "week_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "completed_tasks": week_data.get("completed", []),
        "ongoing_tasks": week_data.get("ongoing", []),
        "next_week_plan": week_data.get("planned", []),
        "risks": week_data.get("risks", ""),
    &#125;

    # 生成
    content = await generator.generate_document(report_template, data)

    # 质量检查
    checker = ContentQualityChecker()
    quality = await checker.check(content, &#123;
        "min_words": 300,
        "max_words": 2000,
        "required_sections": ["本周概要", "完成事项", "下周计划"],
    &#125;)

    if not quality["passed"]:
        # 自动修正
        content = await self._auto_fix(content, quality["recommendations"])

    # 导出
    exporter = MultiFormatExporter()
    filepath = await exporter.export(content, "docx", f"周报_&#123;data['week_date']&#125;")

    return &#123;"content": content, "file": filepath, "quality": quality&#125;
```

### 技术文档同步

```python
async def sync_tech_docs(code_repo: str, doc_repo: str):
    """代码变更时自动更新技术文档"""
    # 1. 检测代码变更
    changes = await detect_code_changes(code_repo)

    # 2. 为每个变更生成文档更新
    for change in changes:
        doc_content = await generate_doc_for_change(change)

        # 3. 更新文档仓库
        await update_documentation(doc_repo, change["file"], doc_content)

    # 4. 生成变更摘要
    summary = await generate_changelog(changes)

    return &#123;"updated_docs": len(changes), "summary": summary&#125;
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解六种内容生成类型 | ☐ |
| 实现了模板系统 | ☐ |
| 实现了多格式导出 | ☐ |
| 实现了质量检查 | ☐ |
| 实现了周报自动化 | ☐ |
| 实现了文档同步 | ☐ |
| 能批量生成 | ☐ |
| 有自动修正机制 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 12 | Prompt 工程实战 | Prompt |
| 21 | 高级 Prompt 技巧 | 技巧 |
| 23 | 文档处理管线 | 文档处理 |
| 31 | 文档处理管线 | 管线 |
| 70 | LLM 应用设计文档模板 | 模板 |
| 135 | 设计文档模板 | 模板 |
| 167 | 设计文档模板 | 模板 |
| 214 | 设计文档图解 | 文档 |
| 363 | 提示词模板库 | 模板库 |
| 393 | 提示词模板库与复用 | 模板复用 |
| 465 | RPA 与业务流程自动化 | 自动化 |
