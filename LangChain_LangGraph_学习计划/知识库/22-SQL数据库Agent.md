# SQL 数据库 Agent

> 用 LangChain + LangGraph 构建能查询数据库的智能 Agent，用户用自然语言查询 SQL。

---

## 一、什么是 SQL Agent

```mermaid
graph LR
    subgraph 传统SQL查询
        U1["用户需要会写SQL"] --> S1["手写SQL语句"]
        S1 --> DB1["数据库"]
    end

    subgraph SQLAgent ["SQL Agent"]
        U2["用户: '上个月销量最高的产品'"] --> AGENT["Agent自动生成SQL"]
        AGENT --> DB2["数据库"]
        DB2 --> AGENT
        AGENT --> R["用自然语言回答"]
    end

    style 传统SQL查询 fill:#FFCDD2
    style SQLAgent fill:#C8E6C9
```

## 二、准备工作

### 2.1 安装依赖

```bash
pip install langchain langchain-openai langchain-community langgraph
```

### 2.2 准备示例数据库

```python
import sqlite3

def create_sample_db():
    """创建示例销售数据库"""
    conn = sqlite3.connect("sales.db")
    cursor = conn.cursor()

    # 创建表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            price REAL,
            stock INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY,
            product_id INTEGER,
            quantity INTEGER,
            sale_date TEXT,
            region TEXT,
            total_amount REAL,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    """)

    # 插入示例数据
    products = [
        (1, "蓝牙耳机", "电子产品", 299.0, 50),
        (2, "手机壳", "配件", 39.0, 200),
        (3, "USB充电器", "电子产品", 59.0, 100),
        (4, "数据线", "配件", 19.0, 300),
        (5, "智能音箱", "电子产品", 499.0, 30),
    ]

    import random
    from datetime import datetime, timedelta

    sales = []
    regions = ["华北", "华东", "华南", "西南", "西北"]
    for _ in range(100):
        pid = random.choice([1, 2, 3, 4, 5])
        qty = random.randint(1, 10)
        days_ago = random.randint(0, 60)
        date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        region = random.choice(regions)
        price = [p[3] for p in products if p[0] == pid][0]
        total = round(qty * price, 2)
        sales.append((None, pid, qty, date, region, total))

    cursor.executemany("INSERT INTO products VALUES (?,?,?,?,?)", products)
    cursor.executemany("INSERT INTO sales VALUES (?,?,?,?,?,?)", sales)

    conn.commit()
    conn.close()
    print("✅ 数据库创建完成: sales.db")

create_sample_db()
```

## 三、方式一：使用 LangChain 内置 SQL Agent

```python
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent

load_dotenv()

# 1. 连接数据库
db = SQLDatabase.from_uri("sqlite:///sales.db")
print(f"可用表: {db.get_usable_table_names()}")

# 2. 创建LLM
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 3. 创建SQL Agent
agent_executor = create_sql_agent(
    llm=llm,
    db=db,
    verbose=True,
    top_k=10,  # 查询结果最多返回10行
)

# 4. 使用
result = agent_executor.invoke({
    "input": "上个月销量最高的产品是什么？"
})
print(result["output"])
```

## 四、方式二：用 LangGraph 自定义 SQL Agent

```mermaid
graph TB
    START([START]) --> GEN["SQL生成节点<br/>LLM根据问题生成SQL"]
    GEN --> EXEC["执行节点<br/>执行SQL获取结果"]
    EXEC --> CHECK{"执行成功?"}
    CHECK -->|"成功"| ANSWER["回答节点<br/>LLM基于结果回答"]
    CHECK -->|"失败"| FIX["修复节点<br/>LLM分析错误重新生成"]
    FIX --> GEN
    ANSWER --> END([END])

    style GEN fill:#E3F2FD
    style EXEC fill:#FFE0B2
    style CHECK fill:#FFF9C4
    style FIX fill:#FFCDD2
    style ANSWER fill:#C8E6C9
```

```python
from dotenv import load_dotenv
from typing import TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.utilities import SQLDatabase
from langgraph.graph import StateGraph, START, END

load_dotenv()
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
db = SQLDatabase.from_uri("sqlite:///sales.db")

class SQLAgentState(TypedDict):
    question: str       # 用户问题
    sql: str             # 生成的SQL
    result: str          # 查询结果
    error: str           # 错误信息
    retry: int           # 重试次数
    answer: str          # 最终回答

# 获取表结构（用于LLM生成SQL）
schema_info = db.get_table_info()

def generate_sql_node(state: SQLAgentState) -> dict:
    """生成SQL查询"""
    error_hint = ""
    if state.get("error"):
        error_hint = f"\n\n上次SQL出错：{state['error']}\n请修正SQL。"

    prompt = ChatPromptTemplate.from_template(
        """你是SQL专家。根据用户问题生成SQLite查询。

数据库表结构：
{schema}

规则：
1. 只输出SQL语句，不要解释
2. 使用SQLite兼容语法
3. 只查询（SELECT），不要修改数据

用户问题：{question}{error_hint}

SQL："""
    )
    chain = prompt | llm | StrOutputParser()
    sql = chain.invoke({
        "schema": schema_info,
        "question": state["question"],
        "error_hint": error_hint,
    }).strip()

    # 清理SQL
    if sql.startswith("```"):
        sql = sql.replace("```sql", "").replace("```", "").strip()

    return {"sql": sql, "retry": state.get("retry", 0) + 1}

def execute_sql_node(state: SQLAgentState) -> dict:
    """执行SQL"""
    try:
        result = db.run(state["sql"])
        return {"result": str(result), "error": ""}
    except Exception as e:
        return {"result": "", "error": str(e)}

def route_after_exec(state: SQLAgentState) -> str:
    """根据执行结果路由"""
    if state.get("error"):
        if state.get("retry", 0) >= 3:
            return "answer"  # 超过重试，用错误信息回答
        return "fix"
    return "answer"

def answer_node(state: SQLAgentState) -> dict:
    """基于查询结果回答用户"""
    if state.get("error") and state.get("retry", 0) >= 3:
        return {"answer": f"查询失败，已重试{state['retry']}次。错误：{state['error']}"}

    prompt = ChatPromptTemplate.from_template(
        """基于SQL查询结果回答用户问题。

用户问题：{question}
执行的SQL：{sql}
查询结果：{result}

请用自然语言回答（中文）："""
    )
    chain = prompt | llm | StrOutputParser()
    answer = chain.invoke({
        "question": state["question"],
        "sql": state["sql"],
        "result": state.get("result", "(无结果)"),
    })
    return {"answer": answer}

# 构建图
graph = StateGraph(SQLAgentState)
graph.add_node("generate", generate_sql_node)
graph.add_node("execute", execute_sql_node)
graph.add_node("answer", answer_node)

graph.add_edge(START, "generate")
graph.add_edge("generate", "execute")
graph.add_conditional_edges(
    "execute",
    route_after_exec,
    {"fix": "generate", "answer": "answer"}
)
graph.add_edge("answer", END)

app = graph.compile()

# 使用
def query(question: str):
    result = app.invoke({
        "question": question,
        "sql": "",
        "result": "",
        "error": "",
        "retry": 0,
        "answer": "",
    })
    print(f"\n问题: {question}")
    print(f"SQL: {result['sql']}")
    print(f"回答: {result['answer']}")
    return result

# 测试
query("销量最高的产品是什么？")
query("各区域的总销售额是多少？")
query("电子产品的平均价格是多少？")
```

## 五、SQL 自纠错流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant G as Graph
    participant L as LLM
    participant D as 数据库

    U->>G: "上个月销量最高的产品"

    G->>L: 生成SQL（带表结构）
    L-->>G: SELECT name FROM ... GROUP BY ... ORDER BY ... LIMIT 1

    G->>D: 执行SQL
    D-->>G: ❌ Error: no such column: month

    Note over G: 重试1次
    G->>L: SQL出错，修正。错误：no such column
    L-->>G: SELECT p.name ... WHERE sale_date LIKE '2025-07%'

    G->>D: 执行修正后的SQL
    D-->>G: 蓝牙耳机

    G->>L: 基于结果生成回答
    L-->>G: "上个月销量最高的产品是蓝牙耳机"

    G-->>U: "上个月销量最高的产品是蓝牙耳机"
```

## 六、安全注意事项

```mermaid
graph TB
    subgraph 安全策略
        S1["✅ 只给SELECT权限<br/>数据库用户只读"]
        S2["✅ 限制返回行数<br/>top_k参数"]
        S3["✅ 参数化查询<br/>避免SQL注入"]
        S4["✅ 表名白名单<br/>只暴露需要的表"]
        S5["❌ 不要暴露敏感表<br/>用户表/密码表/日志表"]
        S6["✅ 查询超时<br/>设置执行超时"]
    end

    style S5 fill:#FFCDD2
    style S1 fill:#C8E6C9
    style S2 fill:#C8E6C9
    style S3 fill:#C8E6C9
    style S4 fill:#C8E6C9
    style S6 fill:#C8E6C9
```

```python
# 只暴露特定表（隐藏敏感表）
db = SQLDatabase.from_uri(
    "sqlite:///sales.db",
    include_tables=["products", "sales"],  # 只暴露这两个表
    # 不暴露 users, passwords, logs 等敏感表
)

# 只读连接（PostgreSQL示例）
# db = SQLDatabase.from_uri(
#     "postgresql://readonly_user:password@localhost/mydb"
# )
# readonly_user 只有SELECT权限
```

## 七、适用场景

| 场景 | 适合度 | 说明 |
|------|--------|------|
| 数据查询 | ✅ 最适合 | "上个月销量多少" |
| 数据统计 | ✅ 适合 | "各区域销售对比" |
| 数据分析 | ✅ 适合 | "哪种产品利润率最高" |
| 报表生成 | ✅ 适合 | "生成本月销售摘要" |
| 数据修改 | ⚠️ 需谨慎 | 需要额外安全措施 |
| 复杂分析 | ⚠️ 可能不够 | 多表JOIN可能出错 |
| 实时监控 | ❌ 不适合 | 用专门的BI工具更好 |
