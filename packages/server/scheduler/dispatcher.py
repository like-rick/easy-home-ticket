from ws_manager import ws_manager

async def push_solution_update(task_id: str, solution_id: str, status: str, detail: dict | None = None):
    await ws_manager.broadcast({
        "type": "SOLUTION_UPDATE",
        "taskId": task_id,
        "solutionId": solution_id,
        "status": status,
        "detail": detail or {},
    })

async def push_scan_log(task_id: str, solution_id: str, event: str, detail: str = ""):
    await ws_manager.broadcast({
        "type": "SCAN_LOG",
        "taskId": task_id,
        "solutionId": solution_id,
        "event": event,
        "detail": detail,
    })

async def push_order_signal(task_id: str, plan_type: str, train_no: str,
                             segments: list[dict], passenger_ids: list[str], deadline: str):
    await ws_manager.broadcast({
        "type": "ORDER_SIGNAL",
        "taskId": task_id,
        "planType": plan_type,
        "trainNo": train_no,
        "segments": segments,
        "passengerIds": passenger_ids,
        "deadline": deadline,
    })

async def push_alert(task_id: str, message: str):
    await ws_manager.broadcast({
        "type": "ALERT",
        "taskId": task_id,
        "message": message,
    })
