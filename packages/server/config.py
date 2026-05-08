import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./easyhome.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SCAN_INTERVAL_SECONDS = float(os.getenv("SCAN_INTERVAL", "2.0"))
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
]
