# Agent 数据分析与可视化自动化指南

> 用户上传一份 Excel："帮我分析这份销售数据，找出趋势和异常"——Agent 需要：读取数据→清洗→统计分析→生成图表→输出洞察。本指南系统讲解 Agent 如何自动化数据分析全流程、代码生成执行、图表生成、洞察提取。

---

## 1. 数据分析 Agent 架构

### 工作流

```mermaid
graph TB
    UPLOAD["用户上传数据"] --> PARSE["解析数据<br/>CSV/Excel/JSON"]
    PARSE --> PROFILE["数据画像<br/>行列/类型/缺失/分布"]
    PROFILE --> CLEAN["数据清洗<br/>去重/填充/类型转换"]
    CLEAN --> ANALYZE["统计分析<br/>趋势/相关性/异常"]
    ANALYZE --> VIZ["生成图表<br/>折线/柱状/散布/热力"]
    VIZ --> INSIGHT["提取洞察<br/>自然语言总结"]
    INSIGHT --> REPORT["输出报告<br/>图表+文字"]

    style PROFILE fill:#E3F2FD,stroke:#1565C0,stroke-width:2px
    style VIZ fill:#FFF9C4,stroke:#F9A825,stroke-width:2px
    style INSIGHT fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 数据解析与画像

```python
import pandas as pd
from dataclasses import dataclass
from langchain_core.tools import tool

@tool
def load_data(filepath: str) -> str:
    """加载数据文件（CSV/Excel/JSON），返回数据摘要"""
    if filepath.endswith(".csv"):
        df = pd.read_csv(filepath)
    elif filepath.endswith(".xlsx"):
        df = pd.read_excel(filepath)
    elif filepath.endswith(".json"):
        df = pd.read_json(filepath)
    else:
        return f"不支持的格式: &#123;filepath&#125;"

    # 数据画像
    profile = &#123;
        "shape": f"&#123;df.shape[0]&#125;行 × &#123;df.shape[1]&#125;列",
        "columns": df.dtypes.astype(str).to_dict(),
        "missing": df.isnull().sum().to_dict(),
        "numeric_columns": df.select_dtypes(include=["number"]).columns.tolist(),
        "categorical_columns": df.select_dtypes(include=["object"]).columns.tolist(),
        "sample": df.head(3).to_dict(orient="records"),
    &#125;
    return json.dumps(profile, ensure_ascii=False, default=str)

@tool
def data_profile(df_path: str) -> str:
    """生成数据详细画像"""
    df = pd.read_csv(df_path)
    profile = &#123;
        "基本信息": &#123;
            "行数": len(df),
            "列数": len(df.columns),
            "内存占用": f"&#123;df.memory_usage(deep=True).sum() / 1024:.1f&#125; KB",
        &#125;,
        "数值列统计": df.describe().to_dict(),
        "缺失值": df.isnull().sum().to_dict(),
        "唯一值": &#123;col: df[col].nunique() for col in df.columns&#125;,
    &#125;
    return json.dumps(profile, ensure_ascii=False, default=str)
```

---

## 3. 统计分析

```python
@tool
def analyze_trends(df_path: str, date_col: str, value_col: str) -> str:
    """分析时间趋势"""
    df = pd.read_csv(df_path)
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)

    # 月度趋势
    monthly = df.groupby(df[date_col].dt.to_period("M"))[value_col].agg(["mean", "sum", "count"])

    # 环比增长
    monthly["growth_rate"] = monthly["sum"].pct_change() * 100

    # 趋势判断
    recent_growth = monthly["growth_rate"].tail(3).mean()
    trend = "上升" if recent_growth > 5 else "下降" if recent_growth < -5 else "平稳"

    result = &#123;
        "trend": trend,
        "avg_growth_rate": f"&#123;recent_growth:.1f&#125;%",
        "monthly_summary": monthly.tail(6).to_dict(),
        "peak_month": monthly["sum"].idxmax().strftime("%Y-%m"),
        "peak_value": float(monthly["sum"].max()),
    &#125;
    return json.dumps(result, ensure_ascii=False, default=str)

@tool
def detect_anomalies(df_path: str, column: str, method: str = "iqr") -> str:
    """异常检测"""
    df = pd.read_csv(df_path)
    values = df[column].dropna()

    if method == "iqr":
        Q1 = values.quantile(0.25)
        Q3 = values.quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        anomalies = df[(df[column] < lower) | (df[column] > upper)]
    elif method == "zscore":
        z_scores = (values - values.mean()) / values.std()
        anomalies = df[abs(z_scores) > 3]

    result = &#123;
        "method": method,
        "anomaly_count": len(anomalies),
        "anomaly_rate": f"&#123;len(anomalies) / len(df) * 100:.1f&#125;%",
        "threshold": &#123;"lower": float(lower) if method == "iqr" else -3, "upper": float(upper) if method == "iqr" else 3&#125;,
        "anomalies": anomalies.head(10).to_dict(orient="records"),
    &#125;
    return json.dumps(result, ensure_ascii=False, default=str)

@tool
def correlation_analysis(df_path: str) -> str:
    """相关性分析"""
    df = pd.read_csv(df_path)
    numeric = df.select_dtypes(include=["number"])
    corr = numeric.corr()

    # 找强相关对
    strong = []
    for i in range(len(corr.columns)):
        for j in range(i + 1, len(corr.columns)):
            val = corr.iloc[i, j]
            if abs(val) > 0.5:
                strong.append(&#123;
                    "var1": corr.columns[i],
                    "var2": corr.columns[j],
                    "correlation": float(val),
                    "strength": "强正相关" if val > 0.7 else "正相关" if val > 0 else "强负相关" if val < -0.7 else "负相关",
                &#125;)

    return json.dumps(&#123;"strong_correlations": strong&#125;, ensure_ascii=False, default=str)
```

---

## 4. 图表生成

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

@tool
def generate_chart(df_path: str, chart_type: str, x_col: str, y_col: str,
                   output_path: str = "/tmp/chart.png") -> str:
    """生成图表
    
    Args:
        df_path: 数据文件路径
        chart_type: 图表类型 (line/bar/scatter/hist/heatmap/box)
        x_col: X轴列名
        y_col: Y轴列名
        output_path: 输出图片路径
    """
    df = pd.read_csv(df_path)

    fig, ax = plt.subplots(figsize=(10, 6))

    if chart_type == "line":
        df.plot(x=x_col, y=y_col, ax=ax, kind="line")
    elif chart_type == "bar":
        df.plot(x=x_col, y=y_col, ax=ax, kind="bar")
    elif chart_type == "scatter":
        df.plot(x=x_col, y=y_col, ax=ax, kind="scatter")
    elif chart_type == "hist":
        df[y_col].hist(ax=ax, bins=30)
    elif chart_type == "box":
        df.boxplot(column=y_col, by=x_col, ax=ax)
    elif chart_type == "heatmap":
        numeric = df.select_dtypes(include=["number"])
        sns.heatmap(numeric.corr(), annot=True, cmap="coolwarm", ax=ax)

    ax.set_title(f"&#123;y_col&#125; by &#123;x_col&#125;")
    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()

    return f"图表已生成: &#123;output_path&#125;"
```

---

## 5. 洞察提取

```python
@dataclass
class InsightExtractor:
    """从分析结果中提取自然语言洞察"""

    async def extract(self, analysis_results: dict, data_profile: dict) -> str:
        """生成数据洞察报告"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""基于以下数据分析结果，生成一份简洁的数据洞察报告。

数据概况:
&#123;json.dumps(data_profile, ensure_ascii=False, indent=2)[:1000]&#125;

分析结果:
&#123;json.dumps(analysis_results, ensure_ascii=False, indent=2)[:2000]&#125;

请输出：
1. 关键发现（3-5条，每条一句话）
2. 趋势分析（上升/下降/平稳）
3. 异常说明（如有）
4. 建议措施（2-3条）

用中文，简洁专业。"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 6. LangGraph 数据分析 Agent

```python
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from typing import TypedDict

class DataAnalysisState(TypedDict):
    filepath: str
    profile: str
    analysis: str
    chart_path: str
    insights: str
    report: str

# Agent 使用代码执行工具
data_tools = [load_data, data_profile, analyze_trends, detect_anomalies,
              correlation_analysis, generate_chart]

data_agent = create_react_agent(
    ChatOpenAI(model="gpt-4o", temperature=0),
    data_tools,
    prompt="""你是数据分析专家。根据用户的数据文件：
1. 先加载数据并生成画像
2. 进行趋势分析、异常检测、相关性分析
3. 生成可视化图表
4. 总结关键洞察
用中文回答。"""
)

# 使用
result = data_agent.invoke(&#123;
    "messages": [&#123;"role": "user", "content": "分析 /tmp/sales_data.csv 的销售趋势和异常"&#125;]
&#125;)
```

---

## 7. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了数据解析（CSV/Excel/JSON） | ☐ |
| 实现了数据画像 | ☐ |
| 实现了趋势分析 | ☐ |
| 实现了异常检测（IQR/Z-Score） | ☐ |
| 实现了相关性分析 | ☐ |
| 实现了图表生成（6 种类型） | ☐ |
| 实现了洞察提取 | ☐ |
| 在 LangGraph 中集成了数据分析 Agent | ☐ |

---

## 8. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 22 | SQL 数据库 Agent | 数据库 |
| 23 | 文档处理管线 | 文档 |
| 61 | 批量处理与 ETL | ETL |
| 134 | Agent 代码执行沙箱 | 沙箱 |
| 186 | 批量处理 ETL | ETL |
| 218 | 批量处理 ETL | ETL |
| 436 | AI 编程 Agent | 代码 |
| 455 | Agent 数据管道 | 管道 |
| 483 | Agent 内容生成 | 生成 |
