# Server 启动指南

## 前置条件

确保本机已安装：
- Python 3.12+
- Redis（Docker 方式不需要单独装）

项目使用 `packages/server/.venv` 虚拟环境，依赖已装好。

---

## 方式一：直接启动（最常用）

```bash
cd packages/server && source .venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

或者用根目录的 pnpm 脚本（等效）：

```bash
pnpm dev:srv
```

> `--reload` 会在代码变更时自动重启，开发必备。

---

## 方式二：Docker Compose 启动（含 Redis）

```bash
docker-compose up -d
```

这会同时启动 server（端口 8000）和 Redis（端口 6379）。
仅启单个服务：

```bash
docker-compose up -d server    # 只启 server
docker-compose up -d redis     # 只启 redis
```

---

## 启动后验证

```bash
curl http://localhost:8000/api/stations?q=北京
```

返回车站列表 JSON 即说明启动成功。

---

## 环境变量（可选）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./easyhome.db` | 数据库连接 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接 |
| `SCAN_INTERVAL` | `2.0` | 扫描间隔（秒） |

---

## 常见问题

**Redis 连不上？** 确保 Redis 在运行：
```bash
redis-server --daemonize yes   # 后台启动 Redis
```

**需要走代理？** server 容器内不走宿主机代理，宿主机直接启动需要时：
```bash
export http_proxy=http://127.0.0.1:10808
export https_proxy=http://127.0.0.1:10808
```
