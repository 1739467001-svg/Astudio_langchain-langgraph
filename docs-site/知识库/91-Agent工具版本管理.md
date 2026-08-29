# Agent 工具版本管理

> 工具会更新、会废弃、会被替换。如何管理工具的多个版本？这份指南覆盖工具版本化和迁移。

---

## 一、工具版本管理的挑战

```mermaid
graph TB
    subgraph 挑战 &#123;"工具版本管理的挑战"&#125;
        C1["🔄 工具升级<br/>API变化导致旧代码不兼容"]
        C2["⚠️ 工具废弃<br/>旧工具不再维护"]
        C3["🔀 多版本共存<br/>v1和v2同时可用"]
        C4["📋 迁移策略<br/>如何平滑从v1迁移到v2"]
    end

    style 挑战 fill:'#E3F2FD'
```

## 二、工具版本化设计

```python
from langchain_core.tools import tool
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

class ToolVersion(BaseModel):
    """工具版本信息"""
    name: str
    version: str
    deprecated: bool = False
    deprecated_at: str = ""
    deprecation_message: str = ""
    successor: str = ""           # 替代工具名
    available_until: str = ""      # 废弃日期

class VersionedToolRegistry:
    """版本化工具注册表"""
    def __init__(self):
        self.versions: dict[str, list[ToolVersion]] = &#123;&#125;
        self.tools: dict[str, dict[str, any]] = &#123;&#125;  # name -> &#123;version: tool_func&#125;

    def register(self, name: str, version: str, tool_func, deprecated: bool = False):
        """注册工具版本"""
        if name not in self.versions:
            self.versions[name] = []
        self.versions[name].append(ToolVersion(
            name=name, version=version, deprecated=deprecated,
            deprecated_at=datetime.now().isoformat() if deprecated else "",
        ))
        if name not in self.tools:
            self.tools[name] = &#123;&#125;
        self.tools[name][version] = tool_func

    def get(self, name: str, version: str = "latest") -> any:
        """获取指定版本的工具"""
        if name not in self.tools:
            raise ValueError(f"工具 &#123;name&#125; 不存在")

        versions = self.versions[name]
        if version == "latest":
            # 获取最新非废弃版本
            active = [v for v in versions if not v.deprecated]
            if not active:
                raise ValueError(f"工具 &#123;name&#125; 已全部废弃")
            version = active[-1].version

        if version not in self.tools[name]:
            raise ValueError(f"工具 &#123;name&#125; 版本 &#123;version&#125; 不存在")

        # 检查废弃警告
        for v in versions:
            if v.version == version and v.deprecated:
                print(f"⚠️ 工具 &#123;name&#125;@&#123;version&#125; 已废弃，建议使用 &#123;v.successor&#125;")

        return self.tools[name][version]

    def list_versions(self, name: str) -> list[str]:
        """列出工具的所有版本"""
        return [v.version for v in self.versions.get(name, [])]

    def deprecate(self, name: str, version: str, successor: str = "", message: str = ""):
        """废弃工具版本"""
        for v in self.versions.get(name, []):
            if v.version == version:
                v.deprecated = True
                v.successor = successor
                v.deprecation_message = message
                print(f"⚠️ &#123;name&#125;@&#123;version&#125; 已标记废弃")

# 使用
registry = VersionedToolRegistry()

# 注册v1和v2
@tool
def search_v1(query: str) -> str:
    """搜索互联网（v1，基础版）。"""
    return f"v1搜索结果: &#123;query&#125;"

@tool
def search_v2(query: str, max_results: int = 5) -> str:
    """搜索互联网（v2，支持结果数量控制）。"""
    return f"v2搜索结果(最多&#123;max_results&#125;条): &#123;query&#125;"

registry.register("search", "1.0", search_v1)
registry.register("search", "2.0", search_v2)

# 废弃v1
registry.deprecate("search", "1.0", successor="2.0", message="v1不支持结果数量控制")

# 使用：默认获取最新版
search_tool = registry.get("search")  # → v2
# 获取指定版本
search_v1 = registry.get("search", "1.0")  # → 打印废弃警告
```

## 三、迁移策略

```mermaid
graph TB
    subgraph 迁移流程 &#123;"工具版本迁移流程"&#125;
        S1["1.发布新版本<br/>v2上线，v1仍可用"]
        S1 --> S2["2.废弃旧版本<br/>v1标记废弃+警告"]
        S2 --> S3["3.过渡期<br/>监控v1使用量"]
        S3 --> S4["4.强制迁移<br/>v1返回错误指向v2"]
        S4 --> S5["5.移除v1<br/>代码中删除v1"]
    end

    style 迁移流程 fill:'#C8E6C9'
```

### 渐进式迁移代码

```python
def get_tool_with_migration(name: str, registry: VersionedToolRegistry):
    """带迁移提示的工具获取"""
    tool = registry.get(name, "latest")

    # 检查是否有废弃的旧版本仍被使用
    versions = registry.versions.get(name, [])
    for v in versions:
        if v.deprecated and v.successor:
            # 记录谁还在用旧版本
            print(f"⚠️ 提示: &#123;name&#125;@&#123;v.version&#125; 已废弃，请迁移到 &#123;v.successor&#125;")

    return tool
```

## 四、兼容性策略

| 策略 | 说明 | 适用 |
|------|------|------|
| 向后兼容 | v2兼容v1的调用方式 | 参数可选新增 |
| 过渡期共存 | v1和v2同时可用 | 大改动 |
| 一次性替换 | v2直接替换v1 | 内部工具 |
| 适配器模式 | v1调用转为v2调用 | API差异大 |
