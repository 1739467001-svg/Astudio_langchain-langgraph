# LLM 应用日志规范

> 好的日志让你不用猜就能定位问题。这份指南定义 LLM 应用的结构化日志标准。

---

## 一、为什么需要日志规范

```mermaid
graph TB
    subgraph 无日志 {"❌ 无结构化日志"}
        N1["print('调用LLM')<br/>print(result)"]
        N2["❌ 难以搜索<br/>❌ 无法聚合统计<br/>❌ 无法关联请求"]
    end

    subgraph 有规范 {"✅ 结构化日志"}
        Y1["JSON格式<br/>带user_id/request_id/step"]
        Y2["✅ 可搜索<br/>✅ 可统计<br/>✅ 可追踪完整链路"]
    end

    style 无日志 fill:'#FFCDD2'
    style 有规范 fill:'#C8E6C9'
```

## 二、日志规范

### 2.1 日志格式

```python
import json
import logging
from datetime import datetime

class LLMLogger:
    """LLM应用结构化日志器"""
    def __init__(self, name: str = "llm_app"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        if not self.logger.handlers:
            self.logger.addHandler(handler)

    def _log(self, level: str, event: str, **kwargs):
        """结构化日志"""
        record = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "event": event,
            **kwargs,
        }
        self.logger.info(json.dumps(record, ensure_ascii=False))

    def log_request(self, request_id: str, user_id: str, input_text: str):
        """记录请求开始"""
        self._log("INFO", "request_start",
            request_id=request_id, user_id=user_id,
            input_length=len(input_text),
            input_preview=input_text[:100])

    def log_llm_call(self, request_id: str, model: str, input_tokens: int, output_tokens: int, latency: float):
        """记录LLM调用"""
        self._log("INFO", "llm_call",
            request_id=request_id, model=model,
            input_tokens=input_tokens, output_tokens=output_tokens,
            latency_ms=round(latency * 1000))

    def log_tool_call(self, request_id: str, tool_name: str, input_str: str, output_str: str, success: bool):
        """记录工具调用"""
        self._log("INFO", "tool_call",
            request_id=request_id, tool_name=tool_name,
            input_preview=input_str[:100],
            output_preview=output_str[:100],
            success=success)

    def log_error(self, request_id: str, error: str, stage: str = ""):
        """记录错误"""
        self._log("ERROR", "error",
            request_id=request_id, error=error, stage=stage)

    def log_response(self, request_id: str, output_text: str, latency: float):
        """记录请求完成"""
        self._log("INFO", "request_end",
            request_id=request_id,
            output_length=len(output_text),
            output_preview=output_text[:100],
            total_latency_ms=round(latency * 1000))
```

### 2.2 日志输出示例

```json
{"timestamp":"2025-01-15T10:30:00","level":"INFO","event":"request_start","request_id":"req_001","user_id":"user_A","input_length":15,"input_preview":"查一下ORD001"}
{"timestamp":"2025-01-15T10:30:00","level":"INFO","event":"tool_call","request_id":"req_001","tool_name":"query_order","input_preview":"ORD001","output_preview":"已发货，明天送达","success":true}
{"timestamp":"2025-01-15T10:30:03","level":"INFO","event":"llm_call","request_id":"req_001","model":"gpt-4o-mini","input_tokens":350,"output_tokens":80,"latency_ms":2800}
{"timestamp":"2025-01-15T10:30:03","level":"INFO","event":"request_end","request_id":"req_001","output_length":50,"output_preview":"您的订单ORD001已发货...","total_latency_ms":3100}
```

## 三、日志使用

```python
import uuid

logger = LLMLogger()

def chat_with_logging(user_id: str, question: str, chain) -> str:
    """带完整日志的聊天"""
    request_id = f"req_{uuid.uuid4().hex[:8]}"

    # 记录请求
    logger.log_request(request_id, user_id, question)

    try:
        import time
        start = time.time()

        # 调用LLM
        response = chain.invoke({"input": question})
        latency = time.time() - start

        # 记录LLM调用
        if hasattr(response, 'usage_metadata'):
            usage = response.usage_metadata
            logger.log_llm_call(request_id, "gpt-4o-mini",
                usage.get("input_tokens", 0),
                usage.get("output_tokens", 0),
                latency)

        # 记录响应
        logger.log_response(request_id, str(response), latency)
        return response

    except Exception as e:
        logger.log_error(request_id, str(e), "llm_call")
        return "服务暂时不可用"
```

## 四、日志级别规范

| 级别 | 何时使用 | 示例 |
|------|---------|------|
| ERROR | 错误/异常 | LLM调用失败、工具执行出错 |
| WARN | 警告但不致命 | 缓存未命中、重试中、接近限流 |
| INFO | 正常流程 | 请求开始/结束、工具调用 |
| DEBUG | 调试详情 | 完整Prompt、完整响应、State值 |

## 五、日志分析

```python
def analyze_logs(log_file: str) -> dict:
    """分析日志文件"""
    import json

    stats = {
        "total_requests": 0,
        "errors": 0,
        "tool_calls": 0,
        "total_tokens": 0,
        "total_latency_ms": 0,
    }

    with open(log_file) as f:
        for line in f:
            try:
                record = json.loads(line.strip())
                if record["event"] == "request_start":
                    stats["total_requests"] += 1
                elif record["event"] == "error":
                    stats["errors"] += 1
                elif record["event"] == "tool_call":
                    stats["tool_calls"] += 1
                elif record["event"] == "llm_call":
                    stats["total_tokens"] += record.get("input_tokens", 0) + record.get("output_tokens", 0)
                    stats["total_latency_ms"] += record.get("latency_ms", 0)
            except:
                pass

    return stats
```
