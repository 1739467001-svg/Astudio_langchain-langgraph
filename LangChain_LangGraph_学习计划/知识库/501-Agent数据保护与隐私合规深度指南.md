# Agent 数据保护与隐私合规深度指南

> Agent 处理用户对话——其中包含姓名、手机号、身份证、银行卡、健康信息。GDPR 要求"被遗忘权"、PIPL 要求"数据可携带"、用户要求"删除我的数据"。本指南深度讲解 PII 生命周期管理、数据主体权利实现、合规审计自动化。

---

## 1. PII 生命周期

### 数据流全链路

```mermaid
graph LR
    COLLECT["采集<br/>用户输入"] --> PROCESS["处理<br/>LLM推理"] --> STORE["存储<br/>数据库/向量库"]
    STORE --> USE["使用<br/>检索/分析"]
    USE --> ARCHIVE["归档<br/>冷存储"]
    ARCHIVE --> DELETE["删除<br/>彻底清除"]

    DELETE_NOTE["被遗忘权<br/>用户随时可请求"]
    DELETE_NOTE -.-> DELETE

    style COLLECT fill:#E3F2FD,stroke:#1565C0
    style STORE fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style DELETE fill:#FFCCBC,stroke:#D84315,stroke-width=2px
```

### PII 类型与风险

| PII 类型 | 风险等级 | 检测正则 | 处理方式 |
|---------|---------|---------|---------|
| 手机号 | 高 | `1[3-9]\d{9}` | 脱敏 |
| 身份证 | 极高 | `\d{17}[\dXx]` | 加密+脱敏 |
| 银行卡 | 极高 | `\d{16,19}` | 加密+脱敏 |
| 邮箱 | 中 | `[\w.-]+@[\w.-]+` | 脱敏 |
| 地址 | 中 | 无固定正则 | LLM识别 |
| 健康信息 | 极高 | 无固定正则 | LLM识别+加密 |
| API Key | 极高 | `sk-[a-zA-Z0-9]+` | 立即删除 |

---

## 2. PII 检测与脱敏

### 全链路脱敏管道

```python
from dataclasses import dataclass, field
import re
from datetime import datetime

@dataclass
class PIILifecycleManager:
    """PII 生命周期管理器"""

    # PII 检测规则
    pii_patterns = {
        "phone": (r'1[3-9]\d{9}', "1**-****-****"),
        "id_card": (r'\d{17}[\dXx]', "******************"),
        "bank_card": (r'\d{16,19}', "****-****-****-****"),
        "email": (r'[\w.-]+@[\w.-]+\.\w+', "***@***.***"),
        "api_key": (r'sk-[a-zA-Z0-9]{20,}', "sk-***"),
        "passport": (r'[A-Z]\d{8}', "*********"),
    }

    async def sanitize_input(self, text: str) -> dict:
        """输入脱敏：用户输入到 Agent 前"""
        sanitized = text
        detected = []

        for pii_type, (pattern, replacement) in self.pii_patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                sanitized = re.sub(pattern, replacement, sanitized)
                detected.append({
                    "type": pii_type,
                    "count": len(matches),
                    "masked": True,
                })

        # LLM 检测非结构化 PII
        unstructured = await self._detect_unstructured_pii(text)
        if unstructured:
            sanitized = await self._mask_unstructured(sanitized, unstructured)
            detected.extend(unstructured)

        return {
            "original_length": len(text),
            "sanitized_length": len(sanitized),
            "pii_detected": detected,
            "sanitized_text": sanitized,
        }

    async def sanitize_output(self, output: str) -> str:
        """输出脱敏：Agent 回复给用户前"""
        sanitized = output
        for pii_type, (pattern, replacement) in self.pii_patterns.items():
            sanitized = re.sub(pattern, replacement, sanitized)
        return sanitized

    async def sanitize_for_storage(self, data: dict) -> dict:
        """存储脱敏：写入数据库前"""
        import json
        text = json.dumps(data, ensure_ascii=False)

        # 存储前加密敏感字段
        for pii_type, (pattern, _) in self.pii_patterns.items():
            matches = re.findall(pattern, text)
            if matches:
                # 加密后存储（可解密）
                for match in matches:
                    encrypted = await self._encrypt(match, pii_type)
                    text = text.replace(match, encrypted)

        return json.loads(text)

    async def sanitize_for_logging(self, log_entry: str) -> str:
        """日志脱敏：写入日志前"""
        sanitized = log_entry
        for pii_type, (pattern, replacement) in self.pii_patterns.items():
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
        return sanitized

    async def _detect_unstructured_pii(self, text: str) -> list:
        """LLM 检测非结构化 PII"""
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

        response = await llm.ainvoke(
            f"""检测以下文本中的敏感信息（PII）。

文本: {text[:500]}

检测类型：地址、健康状况、宗教信仰、政治观点、性取向
如果有，输出 JSON: [{{"type": "...", "content": "..."}}]
如果没有，输出 []。"""
        )

        try:
            return json.loads(response.content)
        except:
            return []

    async def _mask_unstructured(self, text: str, items: list) -> str:
        """脱敏非结构化 PII"""
        for item in items:
            if "content" in item and item["content"] in text:
                text = text.replace(item["content"], f"[{item['type']}已隐藏]")
        return text

    async def _encrypt(self, value: str, pii_type: str) -> str:
        """加密 PII 值"""
        # 实际中用 AES-256 + KMS
        return f"ENC_{pii_type}_{hash(value) % 10000}"
```

---

## 3. 数据主体权利

### 被遗忘权

```python
@dataclass
class DataSubjectRights:
    """数据主体权利实现"""

    async def handle_deletion_request(self, user_id: str) -> dict:
        """被遗忘权：删除用户所有数据"""
        deleted = {}

        # 1. 对话历史
        result = await db.conversations.delete_many({"user_id": user_id})
        deleted["conversations"] = result.deleted_count

        # 2. 向量库中的数据
        await vectorstore.delete(filter={"user_id": user_id})
        deleted["vector_docs"] = "deleted"

        # 3. 用户偏好
        result = await db.preferences.delete_many({"user_id": user_id})
        deleted["preferences"] = result.deleted_count

        # 4. 记忆/画像
        result = await db.memories.delete_many({"user_id": user_id})
        deleted["memories"] = result.deleted_count

        # 5. 审计日志中的 PII（保留审计但脱敏）
        await db.audit_logs.update_many(
            {"user_id": user_id},
            {"$set": {"user_id": "[deleted]", "content": "[deleted]"}},
        )
        deleted["audit_logs"] = "anonymized"

        # 6. 缓存
        await cache.delete(f"user:{user_id}:*")
        deleted["cache"] = "cleared"

        return {
            "user_id": user_id,
            "deleted": deleted,
            "completed_at": datetime.utcnow().isoformat(),
        }

    async def handle_access_request(self, user_id: str) -> dict:
        """数据访问权：导出用户所有数据"""
        data = {
            "conversations": await db.conversations.find({"user_id": user_id}).to_list(None),
            "preferences": await db.preferences.find({"user_id": user_id}).to_list(None),
            "memories": await db.memories.find({"user_id": user_id}).to_list(None),
            "feedback": await db.feedback.find({"user_id": user_id}).to_list(None),
        }

        return {
            "user_id": user_id,
            "data": data,
            "exported_at": datetime.utcnow().isoformat(),
            "format": "JSON",
        }

    async def handle_correction_request(self, user_id: str, corrections: dict) -> dict:
        """数据更正权"""
        updated = {}

        if "name" in corrections:
            await db.preferences.update_one(
                {"user_id": user_id},
                {"$set": {"name": corrections["name"]}},
            )
            updated["name"] = True

        if "email" in corrections:
            await db.preferences.update_one(
                {"user_id": user_id},
                {"$set": {"email": corrections["email"]}},
            )
            updated["email"] = True

        return {"updated": updated, "user_id": user_id}
```

---

## 4. 数据保留策略

```python
@dataclass
class DataRetentionPolicy:
    """数据保留策略"""

    retention_rules = {
        "conversations": {"days": 90, "action": "auto_delete"},
        "vector_embeddings": {"days": 180, "action": "re_index"},
        "audit_logs": {"days": 365, "action": "archive"},
        "user_feedback": {"days": 365, "action": "keep"},
        "error_logs": {"days": 30, "action": "delete"},
        "session_data": {"days": 7, "action": "delete"},
        "cache": {"days": 1, "action": "auto_expire"},
    }

    async def enforce_retention(self):
        """执行数据保留策略"""
        now = datetime.utcnow()

        for data_type, rule in self.retention_rules.items():
            cutoff = now - timedelta(days=rule["days"])

            if rule["action"] == "auto_delete":
                result = await db[data_type].delete_many({
                    "created_at": {"$lt": cutoff.isoformat()}
                })
                print(f"{data_type}: 删除 {result.deleted_count} 条")

            elif rule["action"] == "archive":
                # 先归档再删除
                to_archive = await db[data_type].find({
                    "created_at": {"$lt": cutoff.isoformat()}
                }).to_list(None)
                if to_archive:
                    await db[f"{data_type}_archive"].insert_many(to_archive)
                    await db[data_type].delete_many({
                        "created_at": {"$lt": cutoff.isoformat()}
                    })

    async def get_retention_report(self) -> dict:
        """保留报告"""
        report = {}
        for data_type, rule in self.retention_rules.items():
            count = await db[data_type].count_documents({})
            report[data_type] = {
                "count": count,
                "retention_days": rule["days"],
                "action": rule["action"],
            }
        return report
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了全链路脱敏管道 | ☐ |
| 实现了输入/输出/存储/日志脱敏 | ☐ |
| 实现了被遗忘权（数据删除） | ☐ |
| 实现了数据访问权（数据导出） | ☐ |
| 实现了数据更正权 | ☐ |
| 配置了数据保留策略 | ☐ |
| 能自动执行保留策略 | ☐ |
| LLM 检测非结构化 PII | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 39 | 数据隐私与合规 | 隐私 |
| 109 | 数据隐私技术 | 技术 |
| 119 | 数据隐私技术 | 技术 |
| 141 | OWASP LLM Top10 | 安全 |
| 151 | LLM 应用数据隐私技术 | 隐私 |
| 181 | 数据脱敏 | 脱敏 |
| 213 | 数据脱敏与 PII 防护 | PII |
| 394 | 数据脱敏管道与隐私保护 | 管道 |
| 424 | 数据脱敏管道与隐私保护 | 管道 |
| 438 | NeMo Guardrails | 护栏 |
| 449 | 隐私计算与联邦学习 | 隐私计算 |
| 451 | LLM 应用合规与法律 | 合规 |
| 477 | Agent 数据安全与加密 | 加密 |
| 500 | Agent 越狱防护 | 安全 |
