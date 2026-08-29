# Agent 工具沙箱隔离机制

> Agent 执行代码或访问系统时，必须有安全隔离。这份指南覆盖沙箱隔离的完整方案。

---

## 一、沙箱隔离的必要性

```mermaid
graph TB
    subgraph 无沙箱 &#123;"❌ 无沙箱隔离"&#125;
        A1["Agent执行代码"] --> A2["可访问文件系统"]
        A2 --> A3["可执行系统命令"]
        A3 --> A4["❌ 数据泄露/破坏风险"]
    end

    subgraph 有沙箱 &#123;"✅ 沙箱隔离"&#125;
        B1["Agent执行代码"] --> B2["沙箱环境"]
        B2 --> B3["限制文件访问"]
        B3 --> B4["限制系统命令"]
        B4 --> B5["限制网络/时间"]
        B5 --> B6["✅ 安全隔离"]
    end

    style 无沙箱 fill:'#FFCDD2'
    style 有沙箱 fill:'#C8E6C9'
```

## 二、隔离层级

```mermaid
graph TB
    subgraph 四层隔离 &#123;"Agent 沙箱四层隔离"&#125;
        L1["Layer 1: 代码过滤<br/>禁止危险模块/函数"]
        L2["Layer 2: 执行隔离<br/>subprocess + 超时"]
        L3["Layer 3: 文件系统隔离<br/>限制工作目录"]
        L4["Layer 4: 容器隔离<br/>Docker容器执行"]
    end

    L1 --> L2 --> L3 --> L4

    style L1 fill:'#C8E6C9'
    style L4 fill:'#F3E5F5'
```

## 三、实现

### 3.1 Layer 1: 代码过滤

```python
import re

FORBIDDEN_PATTERNS = [
    r"import\s+os",
    r"import\s+subprocess",
    r"import\s+sys",
    r"os\.system",
    r"os\.remove",
    r"os\.rmdir",
    r"os\.exec",
    r"subprocess\.",
    r"__import__",
    r"eval\s*\(",
    r"exec\s*\(",
    r"open\s*\(",  # 文件操作
    r"shutil\.",
    r"pathlib\.Path.*unlink",
]

def filter_code(code: str) -> tuple[str, bool, str]:
    """过滤危险代码"""
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            return ("", False, f"禁止使用: &#123;pattern&#125;")
    return (code, True, "passed")
```

### 3.2 Layer 2: 执行隔离

```python
import subprocess
import tempfile
import os

def safe_execute(code: str, timeout: int = 10, work_dir: str = None) -> dict:
    """安全执行代码（subprocess隔离+超时）"""
    # 先过滤
    filtered, ok, reason = filter_code(code)
    if not ok:
        return &#123;"output": "", "error": reason, "success": False&#125;

    # 在临时目录执行
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(filtered)
        f.flush()
        script_path = f.name

    try:
        # 限制环境变量+超时
        env = &#123;"PATH": "/usr/bin", "HOME": "/tmp"&#125;  # 最小化环境
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
            cwd=work_dir or "/tmp",  # 限制工作目录
        )
        return &#123;
            "output": result.stdout[:2000],
            "error": result.stderr[:500] if result.stderr else "",
            "success": result.returncode == 0,
        &#125;
    except subprocess.TimeoutExpired:
        return &#123;"output": "", "error": f"执行超时(&#123;timeout&#125;秒)", "success": False&#125;
    except Exception as e:
        return &#123;"output": "", "error": str(e), "success": False&#125;
    finally:
        os.unlink(script_path)
```

### 3.3 Layer 3: 工作目录隔离

```python
import tempfile
from contextlib import contextmanager

@contextmanager
def sandbox_workspace():
    """创建沙箱工作目录"""
    tmpdir = tempfile.mkdtemp(prefix="sandbox_")
    original_cwd = os.getcwd()
    try:
        os.chdir(tmpdir)
        yield tmpdir
    finally:
        os.chdir(original_cwd)
        # 清理沙箱目录
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

# 使用
with sandbox_workspace() as workdir:
    # Agent在此目录工作，不能访问外部
    safe_execute(code, work_dir=workdir)
```

### 3.4 Layer 4: Docker 容器隔离

```python
def docker_execute(code: str, image: str = "python:3.11-slim", timeout: int = 30) -> dict:
    """在Docker容器中执行（最强隔离）"""
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        f.flush()
        script_path = f.name

    try:
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "--network=none",          # 无网络
                "--memory=256m",           # 限制内存
                "--cpus=0.5",              # 限制CPU
                f"--timeout=&#123;timeout&#125;",     # 限制时间
                "-v", f"&#123;script_path&#125;:/app/script.py",
                image,
                "python", "/app/script.py",
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 5,  # Docker超时+缓冲
        )
        return &#123;
            "output": result.stdout[:2000],
            "error": result.stderr[:500] if result.stderr else "",
            "success": result.returncode == 0,
        &#125;
    except Exception as e:
        return &#123;"output": "", "error": str(e), "success": False&#125;
    finally:
        os.unlink(script_path)
```

## 四、工具调用沙箱

```python
from langchain_core.tools import tool

@tool
def safe_python_execute(code: str, timeout: int = 10) -> str:
    """安全执行Python代码。在沙箱中运行，有超时和模块限制。

    Args:
        code: Python代码
        timeout: 超时秒数，默认10
    """
    result = safe_execute(code, timeout=timeout)
    if result["success"]:
        return result["output"] or "(无输出)"
    else:
        return f"执行失败: &#123;result['error']&#125;"
```

## 五、隔离策略选择

```mermaid
graph TD
    Q&#123;"Agent执行什么?"&#125;
    Q -->|"只读取数据"| FILTER["✅ Layer1过滤"]
    Q -->"|执行代码"| SUB["✅ Layer1+2<br/>过滤+subprocess"]
    Q -->|"生成文件"| FS["✅ Layer1+2+3<br/>+工作目录隔离"]
    Q -->|"不可信代码"| DOCKER["✅ 全部四层<br/>Docker容器"]
    Q -->|"只调用API"| API["✅ 不需要沙箱<br/>网络限制即可"]

    style FILTER fill:'#C8E6C9'
    style DOCKER fill:'#F3E5F5'
```

## 六、检查清单

| 检查项 | 说明 | 状态 |
|--------|------|------|
| 代码过滤 | 禁止危险模块 | ☐ |
| 超时限制 | 防止死循环 | ☐ |
| 工作目录隔离 | 限制文件访问 | ☐ |
| 环境变量限制 | 最小化环境 | ☐ |
| 内存/CPU限制 | 防止资源耗尽 | ☐ |
| 网络限制 | 禁止网络访问 | ☐ |
| 输出长度限制 | 防止输出爆炸 | ☐ |
| 容器隔离（可选） | Docker最强隔离 | ☐ |
