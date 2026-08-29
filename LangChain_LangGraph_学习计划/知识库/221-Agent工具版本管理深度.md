# Agent 工具版本管理深度

> 工具的参数变了、行为变了、返回格式变了——但 Agent 还在用旧版本。工具版本管理让工具升级不破坏现有 Agent。

---

## 一、版本管理策略

```mermaid
graph TB
    subgraph 策略 {"工具版本管理"}
        S1["语义版本号<br/>major.minor.patch"]
        S2["向后兼容<br/>新版本不破坏旧调用"]
        S3["废弃流程<br/>deprecated→sunset"]
        S4["路由兼容<br/>Agent自动用最新"]
    end

    style 策略 fill:#E3F2FD
    style S2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、实现

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Any

class VersionStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"

@dataclass
class ToolVersion:
    """工具版本。"""
    tool_name: str
    version: str            # "1.0.0"
    handler: Callable
    status: VersionStatus = VersionStatus.ACTIVE
    deprecated_at: str = ""
    sunset_date: str = ""
    breaking_changes: str = ""
    changelog: str = ""

class ToolVersionRegistry:
    """工具版本注册表。"""

    def __init__(self):
        self.versions: dict[str, list[ToolVersion]] = {}  # {tool_name: [versions]}

    def register(self, version: ToolVersion):
        """注册工具版本。"""
        if version.tool_name not in self.versions:
            self.versions[version.tool_name] = []
        self.versions[version.tool_name].append(version)

    def get_active(self, tool_name: str) -> ToolVersion | None:
        """获取活跃版本。"""
        for v in reversed(self.versions.get(tool_name, [])):
            if v.status == VersionStatus.ACTIVE:
                return v
        return None

    def get_version(self, tool_name: str, version: str) -> ToolVersion | None:
        """获取指定版本。"""
        for v in self.versions.get(tool_name, []):
            if v.version == version:
                return v
        return None

    def deprecate(self, tool_name: str, version: str, sunset_date: str = ""):
        """标记版本废弃。"""
        for v in self.versions.get(tool_name, []):
            if v.version == version:
                v.status = VersionStatus.DEPRECATED
                v.deprecated_at = datetime.now().isoformat()
                v.sunset_date = sunset_date

    def get_compatible(self, tool_name: str, required_version: str = "") -> ToolVersion | None:
        """获取兼容版本。

        语义版本规则：
        - major不同=不兼容
        - minor更高=兼容（新功能）
        - patch更高=兼容（bug修复）
        """
        if not required_version:
            return self.get_active(tool_name)

        required_major = required_version.split(".")[0]
        for v in reversed(self.versions.get(tool_name, [])):
            if v.status != VersionStatus.ACTIVE:
                continue
            v_major = v.version.split(".")[0]
            if v_major == required_major:
                return v
        return self.get_active(tool_name)

    def history(self, tool_name: str) -> list[dict]:
        """获取版本历史。"""
        return [
            {
                "version": v.version,
                "status": v.status.value,
                "changelog": v.changelog,
                "breaking": v.breaking_changes,
            }
            for v in self.versions.get(tool_name, [])
        ]
```

---

## 三、向后兼容检查

```python
class CompatibilityChecker:
    """向后兼容检查器。"""

    @staticmethod
    def check_compatibility(
        old_version: ToolVersion,
        new_version: ToolVersion,
    ) -> dict:
        """检查新版本是否向后兼容。"""
        issues = []

        old_parts = old_version.version.split(".")
        new_parts = new_version.version.split(".")

        if len(old_parts) >= 1 and len(new_parts) >= 1:
            if old_parts[0] != new_parts[0]:
                issues.append("Major版本不同——可能有不兼容变更")

        return {
            "compatible": len(issues) == 0,
            "issues": issues,
            "breaking_changes": new_version.breaking_changes,
            "recommendation": "可以直接升级" if not issues else "需要修改Agent代码",
        }
```

---

## 四、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 用语义版本号 | major.minor.patch | ★★★ |
| 新版本向后兼容 | 不破坏旧调用 | ★★★ |
| 废弃要给过渡期 | deprecated→sunset | ★★★ |
| 有changelog | 每次变更记录 | ★★☆ |
| breaking_changes标注 | 知道哪些不兼容 | ★★☆ |

---

## 五、检查清单

| 检查项 | 状态 |
|--------|------|
| 有版本注册表 | ☐ |
| 有兼容性检查 | ☐ |
| 有废弃流程 | ☐ |
| 有版本历史 | ☐ |
