# Agent 工具沙箱隔离机制深度

> 知识库 101 仅 234 行、知识库 134 讲了代码执行沙箱。这篇深入 Agent 工具调用的安全隔离——文件系统隔离、网络隔离、进程隔离和权限模型。

---

## 一、隔离层次

```mermaid
graph TB
    subgraph 层次 &#123;"4层隔离"&#125;
        L1["权限层<br/>工具级权限策略"]
        L2["文件层<br/>路径白名单"]
        L3["网络层<br/>域名白名单"]
        L4["进程层<br/>资源限制+超时"]
    end

    style 层次 fill:#E3F2FD
    style L1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px
```

---

## 二、文件系统隔离

```python
import os
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class FilesystemPolicy:
    """文件系统隔离策略。"""
    allowed_dirs: list[str] = field(default_factory=lambda: ["/tmp/agent/"])
    denied_paths: list[str] = field(default_factory=lambda: [
        "/etc/passwd", "/etc/shadow", "/root/",
        "/.ssh/", "/.env", "/credentials",
    ])
    max_file_size_mb: int = 10
    read_only: bool = False

class FilesystemGuard:
    """文件系统隔离器。"""

    def __init__(self, policy: FilesystemPolicy = FilesystemPolicy()):
        self.policy = policy

    def validate_path(self, path: str, operation: str = "read") -> dict:
        """验证文件路径是否安全。"""
        abs_path = os.path.abspath(path)

        # 检查禁止路径
        for denied in self.policy.denied_paths:
            if denied in abs_path:
                return &#123;"allowed": False, "reason": f"禁止访问路径: &#123;denied&#125;"&#125;

        # 检查允许目录
        if self.policy.allowed_dirs:
            in_allowed = any(abs_path.startswith(d) for d in self.policy.allowed_dirs)
            if not in_allowed:
                return &#123;"allowed": False, "reason": f"路径不在允许目录内: &#123;abs_path&#125;"&#125;

        # 写操作检查
        if operation == "write" and self.policy.read_only:
            return &#123;"allowed": False, "reason": "只读模式，禁止写入"&#125;

        return &#123;"allowed": True, "path": abs_path&#125;

    def validate_file_size(self, path: str) -> dict:
        """验证文件大小。"""
        try:
            size = os.path.getsize(path)
            max_bytes = self.policy.max_file_size_mb * 1024 * 1024
            if size > max_bytes:
                return &#123;"allowed": False, "reason": f"文件过大: &#123;size&#125; > &#123;max_bytes&#125;"&#125;
            return &#123;"allowed": True, "size": size&#125;
        except FileNotFoundError:
            return &#123;"allowed": False, "reason": "文件不存在"&#125;
```

---

## 三、网络隔离

```python
import re
from dataclasses import dataclass, field

@dataclass
class NetworkPolicy:
    """网络隔离策略。"""
    allowed_domains: list[str] = field(default_factory=lambda: [
        "api.openai.com",
        "api.tavily.com",
        "api.anthropic.com",
    ])
    blocked_domains: list[str] = field(default_factory=lambda: [
        "evil.com", "malware.cn", "phishing.net",
    ])
    allow_all: bool = False  # True=禁网

class NetworkGuard:
    """网络隔离器。"""

    def __init__(self, policy: NetworkPolicy = NetworkPolicy()):
        self.policy = policy

    def validate_url(self, url: str) -> dict:
        """验证URL是否安全。"""
        if self.policy.allow_all:
            return &#123;"allowed": False, "reason": "网络已禁用"&#125;

        # 提取域名
        domain_match = re.search(r'https?://([^/]+)', url)
        if not domain_match:
            return &#123;"allowed": False, "reason": "无效URL"&#125;

        domain = domain_match.group(1)

        # 检查黑名单
        for blocked in self.policy.blocked_domains:
            if blocked in domain:
                return &#123;"allowed": False, "reason": f"域名被禁止: &#123;domain&#125;"&#125;

        # 检查白名单
        if self.policy.allowed_domains:
            if not any(d in domain for d in self.policy.allowed_domains):
                return &#123;"allowed": False, "reason": f"域名不在白名单: &#123;domain&#125;"&#125;

        return &#123;"allowed": True, "domain": domain&#125;
```

---

## 四、进程隔离

```python
import subprocess
import resource
import tempfile
from dataclasses import dataclass

@dataclass
class ProcessPolicy:
    """进程隔离策略。"""
    max_cpu_seconds: int = 30
    max_memory_mb: int = 256
    max_output_size: int = 10000  # 字符
    timeout: int = 30

class ProcessGuard:
    """进程隔离器。"""

    def __init__(self, policy: ProcessPolicy = ProcessPolicy()):
        self.policy = policy

    def execute(self, command: list[str], code: str = None) -> dict:
        """在隔离环境中执行。"""
        workdir = tempfile.mkdtemp(prefix="sandbox_")

        if code:
            code_file = os.path.join(workdir, "code.py")
            with open(code_file, "w") as f:
                f.write(code)
            command = ["python3", code_file]

        def set_limits():
            # 内存限制
            max_mem = self.policy.max_memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (max_mem, max_mem))
            # CPU时间限制
            resource.setrlimit(resource.RLIMIT_CPU, (self.policy.max_cpu_seconds, self.policy.max_cpu_seconds))

        try:
            result = subprocess.run(
                command,
                capture_output=True, text=True,
                timeout=self.policy.timeout,
                cwd=workdir,
                env=&#123;"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/tmp"&#125;,
                preexec_fn=set_limits,
            )

            stdout = result.stdout[:self.policy.max_output_size]
            stderr = result.stderr[:self.policy.max_output_size // 2]

            return &#123;
                "success": result.returncode == 0,
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": result.returncode,
            &#125;
        except subprocess.TimeoutExpired:
            return &#123;"success": False, "stdout": "", "stderr": "执行超时", "exit_code": -1&#125;
        finally:
            import shutil
            shutil.rmtree(workdir, ignore_errors=True)
```

---

## 五、综合安全策略

```python
class ComprehensiveSecurityGuard:
    """综合安全防护——组合文件+网络+进程隔离。"""

    def __init__(self):
        self.fs_guard = FilesystemGuard()
        self.net_guard = NetworkGuard()
        self.proc_guard = ProcessGuard()

    def check_tool_call(self, tool_name: str, args: dict) -> dict:
        """检查工具调用安全性。"""
        # 文件路径检查
        for key, value in args.items():
            if isinstance(value, str) and "/" in value:
                fs_result = self.fs_guard.validate_path(value)
                if not fs_result["allowed"]:
                    return &#123;"allowed": False, "reason": fs_result["reason"], "type": "filesystem"&#125;

            if isinstance(value, str) and value.startswith("http"):
                net_result = self.net_guard.validate_url(value)
                if not net_result["allowed"]:
                    return &#123;"allowed": False, "reason": net_result["reason"], "type": "network"&#125;

        return &#123;"allowed": True&#125;
```

---

## 六、最佳实践

| 实践 | 说明 | 优先级 |
|------|------|--------|
| 文件路径白名单 | 只允许临时目录 | ★★★ |
| 网络域名白名单 | 只允许已知API | ★★★ |
| 进程资源限制 | 内存+CPU+超时 | ★★★ |
| 禁止路径检查 | /etc/.ssh/.env | ★★★ |
| 综合安全检查 | 文件+网络+进程 | ★★☆ |

---

## 七、检查清单

| 检查项 | 状态 |
|--------|------|
| 有文件系统隔离 | ☐ |
| 有网络隔离 | ☐ |
| 有进程隔离 | ☐ |
| 有综合安全检查 | ☐ |
