import asyncio
import time
import random

class RateLimiter:
    def __init__(self, min_interval: float = 1.0, max_interval: float = 5.0):
        self.min = min_interval
        self.max = max_interval
        self._last_call: float = 0.0

    async def wait(self):
        now = time.monotonic()
        since_last = now - self._last_call
        if since_last < self.min:
            await asyncio.sleep(self.min - since_last + random.uniform(0, self.max - self.min))
        self._last_call = time.monotonic()

rate_limiter = RateLimiter()
