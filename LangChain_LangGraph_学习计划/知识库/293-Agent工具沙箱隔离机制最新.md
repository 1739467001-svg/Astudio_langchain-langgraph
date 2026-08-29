# Agent 工具沙箱隔离机制最新

> 知识库 101 有 234 行、知识库 227 有深度。这篇整合为最新——4 层隔离和综合安全检查。

---

## 一、4层隔离

```mermaid
graph TB
    L1["权限层: 工具级权限策略"]
    L2["文件层: 路径白名单"]
    L3["网络层: 域名白名单"]
    L4["进程层: 资源限制"]

    style L1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、实现

```python
import os, re
from dataclasses import dataclass, field

@dataclass
class FilesystemPolicy:
    allowed_dirs: list[str] = field(default_factory=lambda: ["/tmp/agent/"])
    denied_paths: list[str] = field(default_factory=lambda: ["/etc/", "/.ssh/", "/.env", "/root/"])
    max_file_size_mb: int = 10

class FilesystemGuard:
    """文件系统隔离器。"""

    def __init__(self, policy: FilesystemPolicy = FilesystemPolicy()):
        self.policy = policy

    def validate_path(self, path: str, operation: str = "read") -> dict:
        abs_path = os.path.abspath(path)
        for denied in self.policy.denied_paths:
            if denied in abs_path:
                return {"allowed": False, "reason": f"禁止访问: {denied}"}
        if self.policy.allowed_dirs:
            if not any(abs_path.startswith(d) for d in self.policy.allowed_dirs):
                return {"allowed": False, "reason": f"不在允许目录: {abs_path}"}
        return {"allowed": True, "path": abs_path}


@dataclass
class NetworkPolicy:
    allowed_domains: list[str] = field(default_factory=lambda: ["api.openai.com", "api.tavily.com"])
    blocked_domains: list[str] = field(default_factory=lambda: ["evil.com", "malware.cn"])

class NetworkGuard:
    """网络隔离器。"""

    def __init__(self, policy: NetworkPolicy = NetworkPolicy()):
        self.policy = policy

    def validate_url(self, url: str) -> dict:
        domain_match = re.search(r'https?://([^/]+)', url)
        if not domain_match:
            return {"allowed": False, "reason": "无效URL"}
        domain = domain_match.group(1)
        for blocked in self.policy.blocked_domains:
            if blocked in domain:
                return {"allowed": False, "reason": f"域名被禁止: {domain}"}
        if self.policy.allowed_domains:
            if not any(d in domain for d in self.policy.allowed_domains):
                return {"allowed": False, "reason": f"不在白名单: {domain}"}
        return {"allowed": True, "domain": domain}


class ComprehensiveSecurityGuard:
    """综合安全防护——组合文件+网络检查。"""

    def __init__(self):
        self.fs_guard = FilesystemGuard()
        self.net_guard = NetworkGuard()

    def check_tool_call(self, tool_name: str, args: dict) -> dict:
        """检查工具调用安全性。"""
        for key, value in args.items():
            if isinstance(value, str):
                if "/" in value:
                    fs = self.fs_guard.validate_path(value)
                    if not fs["allowed"]:
                        return {"allowed": False, "reason": fs["reason"], "type": "filesystem"}
                if value.startswith("http"):
                    net = self.net_guard.validate_url(value)
                    if not net["allowed"]:
                        return {"allowed": False, "reason": net["reason"], "type": "network"}
        return {"allowed": True}
```

---

## 三、最佳实践

| 层 | 策略 | 优先级 |
|------|------|--------|
| 文件 | 路径白名单 | ★★★ |
| 网络 | 域名白名单 | ★★★ |
| 进程 | 内存+CPU+超时 | ★★★ |
| 权限 | 工具最小权限 | ★★★ |
| 综合 | 文件+网络+进程 | ★★☆ |

---

## 四、检查清单

| 检查项 | 状态 |
|--------|------|
| 有文件系统隔离 | ☐ |
| 有网络隔离 | ☐ |
| 有综合安全检查 | ☐ |
