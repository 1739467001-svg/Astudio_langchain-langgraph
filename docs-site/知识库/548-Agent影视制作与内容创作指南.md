# Agent 影视制作与内容创作指南

> 影视制作涉及剧本、选角、拍摄、剪辑、特效——Agent 能辅助剧本创作、生成分镜、优化剪辑、制作字幕。本指南系统讲解影视 Agent 架构、剧本辅助、视频剪辑、字幕生成、内容审核。

---

## 1. 影视 Agent 架构

### 工作流

```mermaid
graph TB
    SCRIPT["剧本创作<br/>大纲→分场→对白"] --> STORYBOARD["分镜规划<br/>画面/镜头"]
    STORYBOARD --> SHOOT["拍摄辅助<br/>机位/灯光"]
    SHOOT --> EDIT["智能剪辑<br/>素材筛选/拼接"]
    EDIT --> VFX["特效建议<br/>场景/合成"]
    EDIT --> SUBTITLE["字幕生成<br/>语音识别+翻译"]
    EDIT --> REVIEW["内容审核<br/>合规检查"]

    style SCRIPT fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style EDIT fill:#FFF9C4,stroke:#F9A825,stroke-width=2px
    style SUBTITLE fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 剧本辅助

```python
@dataclass
class ScreenplayAssistant:
    """剧本辅助 Agent"""

    async def generate_outline(self, concept: str, genre: str,
                              target_length: str = "90分钟") -> dict:
        """生成剧本大纲"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

        response = await llm.ainvoke(f"""生成电影剧本大纲。

概念: &#123;concept&#125;
类型: &#123;genre&#125;
目标时长: &#123;target_length&#125;

输出 JSON:
&#123;&#123;
    "title": "片名",
    "logline": "一句话概括",
    "acts": [
        &#123;&#123;
            "act": "第一幕",
            "summary": "摘要",
            "key_scenes": [&#123;&#123;"scene": 1, "location": "...", "summary": "...", "characters": []&#125;&#125;]
        &#125;&#125;
    ],
    "characters": [&#123;&#123;"name": "...", "role": "主角/配角", "arc": "人物弧线"&#125;&#125;],
    "themes": ["主题"]
&#125;&#125;""")

        return json.loads(response.content)

    async def write_dialogue(self, scene: dict, characters: dict,
                             style: str = "自然") -> str:
        """写对白"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.8)

        prompt = f"""写场景对白。

场景: &#123;json.dumps(scene, ensure_ascii=False)&#125;
角色: &#123;json.dumps(characters, ensure_ascii=False)&#125;
风格: &#123;style&#125;

要求: 对白自然、符合角色性格、推动剧情。只输出对白。"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 3. 智能剪辑

```python
@dataclass
class SmartEditor:
    """智能剪辑器"""

    async def analyze_footage(self, footage_list: list, script: dict) -> dict:
        """分析素材"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        response = await llm.ainvoke(f"""分析拍摄素材并生成剪辑方案。

素材列表: &#123;json.dumps(footage_list[:20], ensure_ascii=False)&#125;
剧本: &#123;json.dumps(script, ensure_ascii=False)[:1000]&#125;

输出 JSON:
&#123;&#123;
    "edit_plan": [
        &#123;&#123;
            "sequence": 1,
            "scene": "...",
            "clips": ["素材ID"],
            "transition": "硬切/淡入淡出/叠化",
            "duration_seconds": 5,
            "notes": "剪辑说明"
        &#125;&#125;
    ],
    "total_duration_minutes": 85,
    "pacing": "节奏分析",
    "suggestions": ["剪辑建议"]
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 4. 字幕生成

```python
@dataclass
class SubtitleGenerator:
    """字幕生成器"""

    async def generate(self, audio_path: str, source_lang: str = "zh",
                       target_langs: list = None) -> dict:
        """生成字幕"""
        # 1. 语音识别（ASR）
        transcript = await self._transcribe(audio_path, source_lang)

        # 2. 生成 SRT 格式
        srt = self._to_srt(transcript)

        # 3. 翻译
        translations = &#123;&#125;
        if target_langs:
            for lang in target_langs:
                translations[lang] = await self._translate_subtitles(transcript, source_lang, lang)

        return &#123;
            "source_language": source_lang,
            "srt": srt,
            "translations": translations,
            "total_segments": len(transcript),
        &#125;

    async def _transcribe(self, audio_path: str, lang: str) -> list:
        """语音识别"""
        # 使用 Whisper
        from langchain_community.document_loaders import WhisperTranscriber
        transcriber = WhisperTranscriber(model_name="base")
        result = await transcriber.atranscribe(audio_path)
        return [&#123;"start": 0, "end": 5, "text": result&#125;]

    def _to_srt(self, segments: list) -> str:
        """转 SRT 格式"""
        srt = ""
        for i, seg in enumerate(segments, 1):
            start = self._format_time(seg["start"])
            end = self._format_time(seg["end"])
            srt += f"&#123;i&#125;\n&#123;start&#125; --> &#123;end&#125;\n&#123;seg['text']&#125;\n\n"
        return srt

    def _format_time(self, seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"&#123;h:02d&#125;:&#123;m:02d&#125;:&#123;s:02d&#125;,&#123;ms:03d&#125;"

    async def _translate_subtitles(self, segments: list, source: str, target: str) -> str:
        """翻译字幕"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
        texts = [seg["text"] for seg in segments]
        response = await llm.ainvoke(f"翻译以下字幕从&#123;source&#125;到&#123;target&#125;。保持时间戳不变。\n\n" + "\n".join(texts))
        return response.content
```

---

## 5. 内容审核

```python
@dataclass
class ContentReviewer:
    """内容审核器"""

    async def review(self, content: str, content_type: str = "video") -> dict:
        """审核内容"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        response = await llm.ainvoke(f"""审核影视内容合规性。

内容: &#123;content[:2000]&#125;
类型: &#123;content_type&#125;

检查项:
1. 暴力/血腥程度
2. 色情/低俗内容
3. 政治敏感
4. 未成年人保护
5. 版权问题

输出 JSON:
&#123;&#123;
    "overall_rating": "G/PG/PG-13/R",
    "issues": [&#123;&#123;"type": "...", "severity": "high/medium/low", "scene": "...", "recommendation": "剪辑建议"&#125;&#125;],
    "compliant": true/false,
    "modifications_needed": ["需要的修改"]
&#125;&#125;""")

        return json.loads(response.content)
```

---

## 6. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了剧本大纲生成 | ☐ |
| 实现了对白写作 | ☐ |
| 实现了智能剪辑方案 | ☐ |
| 实现了字幕生成（ASR+翻译） | ☐ |
| 实现了内容审核 | ☐ |
| 有分级建议 | ☐ |

---

## 7. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 15 | 多模态应用开发 | 多模态 |
| 433 | OpenAI Realtime API | 语音 |
| 453 | 视频理解 | 视频 |
| 519 | Agent 多语言翻译 | 翻译 |
| 521 | Agent 内容创作 | 创作 |
| 545 | Agent 新闻媒体 | 媒体 |
