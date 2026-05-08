import type { PlasmoCSConfig } from "plasmo"
import type { OrderSignal } from "./lib/types"
import { executeOrder } from "./content/executor"

export const config: PlasmoCSConfig = {
  matches: ["https://kyfw.12306.cn/*"]
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ORDER_SIGNAL') {
    executeOrder(msg as OrderSignal).then(result => {
      chrome.runtime.sendMessage({ type: 'ORDER_RESULT', taskId: msg.taskId, result })
    })
    sendResponse({ ack: true })
  }
  return true
})
