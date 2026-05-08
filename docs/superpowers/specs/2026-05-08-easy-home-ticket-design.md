# EasyHome Ticket — 智能抢票系统设计文档

版本: v1.0 | 日期: 2026-05-08

## 1. 概述

解决节假日 12306 直达票难买问题。基于"本地后端高频监控 + 浏览器插件下单执行"架构，支持同车换乘拆段、买长乘短、固定车次监听等策略。私有化 Docker 部署，数据不外泄。

### 1.1 角色与场景

| 角色 | 痛点 | 系统方案 |
|------|------|----------|
| 候鸟型用户 | 节假日直达票秒光 | 自动拆段搜索，有票插件本地占座 |
| 通勤型用户 | 不愿支付三方手续费 | 私有化 Docker 部署，免费监控 |
| 保命上车用户 | 必须按时到达 | "买长乘短"策略 |

### 1.2 架构决策

- **后端直连 12306 API**：本地部署，同 IP，无云端风控问题
- **插件仅负责 UI + 下单执行**：借浏览器登录态，动作视为本人操作
- **WebSocket 本地通信**：延迟 <100ms，满足端到端 500ms 响应窗口

## 2. 整体架构

```
┌─────────────── Docker (本地) ───────────────────────────┐
│                                                          │
│  ┌─────────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  FastAPI :8000   │  │  Redis   │  │    SQLite     │  │
│  │  WebSocket + API │  │  缓存    │  │  任务持久化    │  │
│  └────────┬─────────┘  └──────────┘  └───────────────┘  │
│           │                                               │
│  ┌────────┴─────────┐                                    │
│  │  采集引擎         │ → 12306 公开查询接口               │
│  │  拆段算法         │                                    │
│  │  任务调度器       │                                    │
│  │  通知服务         │ → SMTP / Webhook                  │
│  └──────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
            │ WebSocket (ws://localhost:8000/ws)
            ▼
┌────────────── Chrome Extension (Plasmo) ─────────────────┐
│                                                          │
│  ┌─────────────┐  ┌──────────────────────────────────┐  │
│  │  Popup      │  │  Dashboard (独立标签页)            │  │
│  │  快捷面板    │  │  任务管理/方案列表/运行看板       │  │
│  └─────────────┘  └──────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Content Script                                     │ │
│  │  12306 页面注入 → 自动下单 / 滑块辅助 / 登录态复用  │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## 3. 后端设计

### 3.1 采集引擎

对接 12306 公开查询接口（逆向）:

- **车站数据**：解析 `station_name.js`，站名到电报码映射
- **余票查询**：`GET /otn/leftTicket/queryZ`，参数：出发站、到达站、日期、车次(可选)、票种
- **车次时刻表**：`GET /otn/czxx/queryByTrainNo`，参数：车次、日期，返回全路径停靠站序列
- **限流控制**：本地部署无需代理池，控制 QPS 模拟人类行为（随机间隔 1-5s，UA 轮换）

支持所有列车类型：G/D/C/K/T/Z，席别多选。

### 3.2 拆段算法

**输入**：出发站 A，目的站 D，日期，时段范围，溢价上限（默认 30 元），可选固定车次列表

**Step 1 — 直达监控**：查 A→D 所有在售车次，创建直达监控任务。

**Step 2 — 拆段**：对每趟经停车次获取全路径 A-B-C-D-E，生成：

| 策略 | 方案示例 | 换乘次数 |
|------|----------|----------|
| 同车换乘 | [A-B] + [B-D]、[A-C] + [C-D] | 1（换座不下车）|
| 买长乘短 | [A-E] 全程票 | 0 |
| 非同车换乘 | [A-B]车次1 + [B-D]车次2 | 1（换车换站）|

买长乘短条件：Price(A-E) - Price(A-D) ≤ Max_Extra_Fee

**Step 3 — 优先级排序**：

1. 直达 [A-D] — 价格最低，0 换乘
2. 同车换乘 — 同车不下车
3. 买长乘短 — 多花钱但省事
4. 非同车换乘 — 保底方案

每个方案生成独立 MonitorTask，后台并行扫描。

**状态联动**：当某方案第一段占座成功后，自动将其第二段优先级提至最高。若第二段始终无票，触发"保上车"提醒。

### 3.3 任务调度器

- 高频扫描：支持 1-5s 自定义间隔
- 每个方案独立扫描协程，Redis 缓存去重
- 候补同步：无票但 12306 开启候补时，推送候补提交提示

### 3.4 通知服务

采用发件箱模式，支持多通道：

| 通道 | 实现 |
|------|------|
| SMTP 邮件 | 用户配置 SMTP_HOST/PORT/USER/PASS |
| Webhook | 企业微信/钉钉 webhook URL |

**通知场景**：

| 事件 | 优先级 | 内容 |
|------|--------|------|
| 占座成功 | 紧急 | 车次/席别/价格 + 支付链接 + 截止时间 |
| 一段买到另一段无票 | 高 | 提醒"保上车"+ 车上补票 |
| 任务状态变更 | 低 | 启停确认 |
| Server 异常 | 高 | 采集失败/网络告警 |

## 4. 插件端设计

### 4.1 Dashboard（独立标签页）

三栏布局：

- **左栏 — 任务列表**：创建/编辑/启用/停用任务，显示各任务运行状态指示灯
- **中栏 — 方案看板**：选中任务的拆段方案表格，每行显示方案详情和票状态（有票=高亮、无票=灰、已占座=绿、已购=蓝）
- **右栏 — 实时日志**：WebSocket 推送的事件流，可筛选/暂停

底部状态栏：WebSocket 连接状态、Server 版本、扫描速率。

### 4.2 任务创建表单

字段：
- 出发站 / 目的站（下拉搜索 + 电报码）
- 出行日期
- 时段偏好（默认 00:00-23:59）
- 席别多选：二等座、一等座、硬卧、软卧、商务座
- 溢价上限（默认 30 元）
- 策略多选：直达、同车换乘、买长乘短、非同车换乘
- 固定车次（可选）：输入车次号，逗号分隔，仅监控这些车次
- 乘车人：姓名、证件类型、证件号

### 4.3 Content Script 执行器（12306 页面注入）

下单流程：

1. WebSocket 收到 `ORDER_SIGNAL` → 唤起/复用 12306 预订页 tab
2. 自动填入：出发站→目的站→日期→车次→席别→乘车人
3. 提交订单：点击"提交订单"+ 滑块验证辅助（检测 canvas 元素 → 计算偏移 → 模拟拖拽轨迹）
4. 结果回传 Server，Server 触发通知

安全：下单 IP 和 Cookie 均为用户本地浏览器，12306 视角即用户本人操作。

## 5. WebSocket 通信协议

### 5.1 消息类型

**客户端 → 服务端**：

| 类型 | 用途 |
|------|------|
| CREATE_TASK | 创建监控任务 |
| UPDATE_TASK | 修改/启停任务 |
| DELETE_TASK | 删除任务 |
| GET_SOLUTIONS | 获取拆段方案列表 |
| QUERY_TRAINS | 手动查询车次 |
| ORDER_RESULT | 下单结果回传 |
| HEARTBEAT | 心跳（30s） |

**服务端 → 客户端**：

| 类型 | 用途 |
|------|------|
| TASK_SYNCED | 任务同步确认 |
| SOLUTION_UPDATE | 方案票状态实时更新 |
| ORDER_SIGNAL | 有票！立即下单指令 |
| SCAN_LOG | 扫描日志流 |
| ALERT | 提醒/告警 |
| ERROR | 异常通知 |

### 5.2 核心消息体

```json
// ORDER_SIGNAL
{
  "type": "ORDER_SIGNAL",
  "taskId": "uuid",
  "planType": "direct | split | longer",
  "trainNo": "G123",
  "segments": [
    { "from": "上海虹桥", "to": "南京南", "seatType": "二等座", "price": 139.5 }
  ],
  "passengerIds": ["pas_001"],
  "deadline": "2026-04-30T14:25:00Z"
}
```

## 6. 数据模型

### 6.1 任务表 (tasks)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 任务名称 |
| from_station | TEXT | 出发站电报码 |
| to_station | TEXT | 目的站电报码 |
| travel_date | DATE | 出行日期 |
| time_start | TEXT | 时段开始 "08:00" |
| time_end | TEXT | 时段结束 "18:00" |
| max_extra_fee | INTEGER | 溢价上限（元）|
| seat_types | TEXT | JSON: ["二等座","一等座"] |
| train_nos | TEXT | JSON: ["G123"] 或 null=不限 |
| strategies | TEXT | JSON: ["direct","split","longer"] |
| passengers | TEXT | JSON: [{name, id_type, id_number}] |
| status | TEXT | active/paused/completed |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### 6.2 监控方案表 (solutions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| task_id | TEXT FK | tasks.id |
| plan_type | TEXT | direct/split/longer/cross |
| train_no | TEXT | 车次号 |
| segments | TEXT | JSON: [{from, to, seat_type, price}] |
| total_price | REAL | 总票价 |
| extra_fee | REAL | 溢价金额 |
| priority | INTEGER | 1-4 |
| ticket_status | TEXT | pending/available/sold/booked |
| locked_segment_index | INTEGER | 已买到第几段的索引 |
| created_at | DATETIME | |

### 6.3 扫描日志 (scan_logs)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| task_id | TEXT | |
| solution_id | TEXT | |
| event | TEXT | scanning/ticket_found/order_sent/booked/error |
| detail | TEXT | JSON |
| created_at | DATETIME | |

### 6.4 通知配置 (notification_config)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | |
| channel | TEXT | email/webhook |
| config | TEXT | JSON: {smtp_host, ...} 或 {webhook_url} |
| enabled | BOOLEAN | |

## 7. 部署结构

```
easy-home-ticket/
├── docker-compose.yml
├── packages/
│   ├── server/                    # FastAPI 后端
│   │   ├── Dockerfile
│   │   ├── main.py               # 入口: FastAPI + WebSocket
│   │   ├── config.py             # 配置管理
│   │   ├── models/               # SQLite ORM 模型
│   │   ├── engine/               # 采集引擎
│   │   │   ├── collector.py      # 12306 API 请求封装
│   │   │   ├── station.py        # 站名映射
│   │   │   └── rate_limiter.py   # QPS 控制
│   │   ├── algorithm/            # 拆段算法
│   │   │   ├── splitter.py       # 同车换乘拆段
│   │   │   ├── longer.py         # 买长乘短计算
│   │   │   └── ranker.py         # 优先级排序
│   │   ├── scheduler/            # 任务调度
│   │   │   ├── scanner.py        # 高频扫描循环
│   │   │   └── dispatcher.py     # WebSocket 消息分发
│   │   ├── notifier/             # 通知服务
│   │   │   ├── email.py
│   │   │   └── webhook.py
│   │   └── ws_manager.py         # WebSocket 连接管理
│   │
│   └── extension/                # Chrome 插件 (Plasmo)
│       ├── src/
│       │   ├── dashboard/        # 独立标签页 (完整看板)
│       │   │   ├── index.tsx     # 主布局
│       │   │   ├── task-list.tsx # 任务列表
│       │   │   ├── solution-board.tsx  # 方案看板
│       │   │   ├── log-stream.tsx     # 实时日志
│       │   │   └── task-form.tsx      # 任务创建表单
│       │   ├── popup.tsx         # 快捷弹窗
│       │   ├── content/         # 12306 页面注入
│       │   │   ├── executor.ts   # 自动下单引擎
│       │   │   └── captcha.ts    # 滑块辅助
│       │   ├── background/      # Service Worker
│       │   │   ├── ws-client.ts  # WebSocket 客户端
│       │   │   └── state.ts      # 消息路由 + 状态管理
│       │   └── lib/
│       │       ├── types.ts      # 类型定义
│       │       └── api.ts        # REST + WS 封装
│       └── package.json
```

## 8. 非功能需求

- **风控避让**：下单动作在用户本地 IP 执行，请求 UA 模拟真实浏览器
- **私有化**：Docker 一键部署，数据存本地 SQLite/Redis，不泄露账号信息
- **响应速度**：监控发现 → 插件下单延迟 <500ms
- **可靠性**：WebSocket 断线自动重连，扫描任务持久化，重启恢复
