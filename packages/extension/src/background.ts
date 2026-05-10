import { startWsClient } from "./background/ws-client"
import { startLoginMonitor } from "./background/state"

startWsClient()
startLoginMonitor()
