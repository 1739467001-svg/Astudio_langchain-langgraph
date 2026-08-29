# Agent 智能汽车与自动驾驶辅助指南

> 智能汽车不只是车——它是移动的 Agent：感知环境、规划路线、辅助驾驶、预测危险、提供车载服务。本指南系统讲解车载 Agent 架构、环境感知融合、驾驶决策、危险预测、车载语音助手。

---

## 1. 车载 Agent 架构

### 工作流

```mermaid
graph TB
    SENSORS["传感器融合<br/>摄像头/雷达/激光雷达"] --> PERCEIVE["环境感知<br/>目标检测/车道/行人"]
    PERCEIVE --> PREDICT["行为预测<br/>他车/行人轨迹"]
    PREDICT --> DECIDE["驾驶决策<br/>变道/刹车/加速"]
    DECIDE --> CONTROL["车辆控制<br/>转向/油门/制动"]
    PERCEIVE --> VOICE["语音助手<br/>导航/娱乐/车控"]
    DECIDE --> HMI["人机交互<br/>HUD/仪表盘"]

    style SENSORS fill:#E3F2FD,stroke:#1565C0,stroke-width=2px
    style DECIDE fill:#FFF9C4,stroke:#F9A825,stroke-width=3px
    style CONTROL fill:#C8E6C9,stroke:#2E7D32,stroke-width=2px
```

---

## 2. 环境感知

```python
@dataclass
class PerceptionAgent:
    """环境感知 Agent"""

    async def perceive(self, camera_frame: str, radar_data: dict,
                       lidar_data: dict = None) -> dict:
        """多传感器融合感知"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # VLM 分析摄像头画面
        import base64
        with open(camera_frame, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([
            HumanMessage(content=[
                &#123;"type": "text", "text": """分析驾驶场景。输出 JSON:
&#123;
    "objects": [&#123;"type": "car/pedestrian/cyclist/sign/light", "position": "left/center/right", "distance": "near/medium/far", "speed": "static/slow/fast"&#125;],
    "lane": &#123;"detected": true, "type": "solid/dashed", "deviation": "left/center/right"&#125;,
    "traffic_signs": ["限速60", "禁止超车"],
    "traffic_light": "red/green/yellow",
    "road_condition": "dry/wet/snowy",
    "risk_level": "low/medium/high",
    "recommended_action": "保持/减速/刹车/变道"
&#125;"""&#125;,
                &#123;"type": "image_url", "image_url": &#123;"url": f"data:image/png;base64,&#123;img_b64&#125;"&#125;&#125;,
            ])
        ])

        # 融合雷达数据
        result = json.loads(response.content)
        result["radar_objects"] = radar_data.get("objects", [])
        result["sensor_fusion"] = "camera+radar" + ("+lidar" if lidar_data else "")

        return result
```

---

## 3. 危险预测

```python
@dataclass
class HazardPredictor:
    """危险预测器"""

    async def predict(self, perception: dict, driving_state: dict) -> dict:
        """预测潜在危险"""
        risk_score = 0
        hazards = []

        # 前车距离
        front_objects = [o for o in perception.get("objects", []) if o.get("position") == "center" and o.get("type") == "car"]
        if front_objects:
            front = front_objects[0]
            if front.get("distance") == "near":
                risk_score += 30
                hazards.append(&#123;"type": "前车过近", "severity": "high", "action": "准备刹车"&#125;)

        # 行人
        pedestrians = [o for o in perception.get("objects", []) if o.get("type") == "pedestrian"]
        if pedestrians:
            risk_score += 20
            hazards.append(&#123;"type": "检测到行人", "severity": "medium", "action": "减速观察"&#125;)

        # 路况
        if perception.get("road_condition") == "wet":
            risk_score += 15
            hazards.append(&#123;"type": "路面湿滑", "severity": "medium", "action": "降低速度"&#125;)

        # 速度
        speed = driving_state.get("speed_kmh", 0)
        if speed > 120:
            risk_score += 20
            hazards.append(&#123;"type": "车速过快", "severity": "high", "action": "建议减速"&#125;)

        return &#123;
            "risk_score": min(100, risk_score),
            "risk_level": "high" if risk_score > 50 else "medium" if risk_score > 25 else "low",
            "hazards": hazards,
            "recommended_action": "减速" if risk_score > 50 else "保持警惕" if risk_score > 25 else "正常驾驶",
        &#125;
```

---

## 4. 车载语音助手

```python
@dataclass
class VehicleVoiceAssistant:
    """车载语音助手"""

    async def handle(self, command: str, vehicle_state: dict) -> str:
        """处理语音指令"""
        llm = ChatOpenAI(model="gpt-4o", temperature=0.3)

        prompt = f"""你是车载语音助手。处理用户指令。

指令: &#123;command&#125;
车辆状态: 速度&#123;vehicle_state.get('speed_kmh', 0)&#125;km/h, 位置&#123;vehicle_state.get('location', '未知')&#125;

可执行操作:
- 导航：设置目的地/查询路线/避开拥堵
- 媒体：播放音乐/电台/播客
- 车控：空调/车窗/座椅加热
- 信息：天气/新闻/日程
- 电话：拨打/接听

注意：驾驶时回复要简洁，不分散注意力。

回答:"""

        response = await llm.ainvoke(prompt)
        return response.content
```

---

## 5. 检查清单

| 检查项 | 状态 |
|--------|------|
| 实现了多传感器融合感知 | ☐ |
| 实现了危险预测（多维风险评分） | ☐ |
| 实现了车载语音助手 | ☐ |
| 有驾驶决策建议 | ☐ |
| 有人机交互设计 | ☐ |

---

## 6. 与其他知识库的关联

| 关联编号 | 文档 | 关系 |
|----------|------|------|
| 44 | 智能交通管理 Agent | 交通 |
| 534 | Agent 智慧交通 | 交通 |
| 432 | Computer Use | 视觉 |
| 443 | 多模态文档智能 | 多模态 |
| 537 | Agent 旅游规划 | 出行 |
| 540 | Agent 智能建筑 | 建筑 |
