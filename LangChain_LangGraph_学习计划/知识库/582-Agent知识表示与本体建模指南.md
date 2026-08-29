# Agent 知识表示与本体建模指南

> Agent 怎么"理解"知识？不只是存文本——需要结构化的知识表示和本体模型来支持推理。本指南讲解知识表示方法、本体构建、知识图谱与向量检索的融合。

---

## 1. 知识表示方法

```mermaid
graph TB
    KR["知识表示方法"]

    KR --> TEXT["文本表示<br/>自然语言描述<br/>最灵活但不精确"]
    KR --> ONTO["本体表示<br/>类/属性/关系<br/>精确但需建模"]
    KR --> GRAPH["图谱表示<br/>实体-关系-实体<br/>支持多跳推理"]
    KR --> VECTOR["向量表示<br/>嵌入向量<br/>支持语义检索"]

    style KR fill:#E3F2FD,stroke:#1565C0,stroke-width=3px
    style GRAPH fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px
```

---

## 2. 本体建模

```python
@dataclass
class OntologyBuilder:
    """本体构建器"""

    async def build_ontology(self, domain: str, documents: list) -> dict:
        """从文档自动构建本体"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""为 {domain} 领域构建本体。

参考文档:
{json.dumps(documents[:5], ensure_ascii=False)[:2000]}

输出 JSON:
{{
    "classes": [
        {{"name": "类名", "parent": "父类", "properties": ["属性1", "属性2"]}}
    ],
    "relations": [
        {{"name": "关系名", "domain": "源类", "range": "目标类", "cardinality": "1:N"}}
    ],
    "instances": [
        {{"class": "类名", "name": "实例名", "properties": {{"key": "value"}}}}
    ]
}}""")

        return json.loads(response.content)

    async def validate_ontology(self, ontology: dict) -> dict:
        """验证本体一致性"""
        issues = []

        # 检查类的继承环
        classes = {c["name"]: c.get("parent") for c in ontology.get("classes", [])}
        for cls, parent in classes.items():
            if parent and self._has_cycle(cls, parent, classes):
                issues.append(f"继承环: {cls}")

        # 检查关系类型
        valid_classes = set(classes.keys())
        for rel in ontology.get("relations", []):
            if rel["domain"] not in valid_classes:
                issues.append(f"关系 {rel['name']} 的 domain 无效")
            if rel["range"] not in valid_classes:
                issues.append(f"关系 {rel['name']} 的 range 无效")

        return {"valid": len(issues) == 0, "issues": issues}

    def _has_cycle(self, cls, parent, classes, visited=None):
        if visited is None: visited = set()
        if cls in visited: return True
        visited.add(cls)
        if parent and parent in classes:
            return self._has_cycle(parent, classes.get(parent), classes, visited)
        return False
```

---

## 3. 检查清单

| 检查项 | 状态 |
|--------|------|
| 理解四种知识表示 | ☐ |
| 实现了本体构建 | ☐ |
| 实现了本体验证 | ☐ |
| 理解图谱+向量融合 | ☐ |

---

## 4. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 463 | GraphRAG | 图谱 |
| 566 | 知识图谱推理 | 推理 |
| 567 | 企业搜索 | 搜索 |
| 569 | 数据治理 | 治理 |
