import type { OrderSignal, Segment } from '../lib/types'
import { solveSlideCaptcha } from './captcha'

export async function executeOrder(signal: OrderSignal): Promise<{ status: string; orderId?: string }> {
  try {
    await fillQueryForm(signal.segments[0])

    const submitBtn = await waitForElement('#submitOrder_id, .btn-buy, [onclick*="submitOrder"]', 5000)
    if (!submitBtn) return { status: 'failed', reason: '找不到提交按钮' }
    ;(submitBtn as HTMLElement).click()

    await sleep(800)
    await solveSlideCaptcha()

    const confirmBtn = await waitForElement('#qr_submit_id, [onclick*="confirm"], .btn-confirm', 3000)
    if (confirmBtn) {
      ;(confirmBtn as HTMLElement).click()
      return { status: 'success' }
    }

    return { status: 'success' }
  } catch (e) {
    return { status: 'error', reason: String(e) }
  }
}

async function fillQueryForm(seg: Segment): Promise<void> {
  const setVal = (id: string, val: string) => {
    const el = document.querySelector(`#${id}`) as HTMLInputElement | null
    if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })) }
  }
  setVal('fromStationText', seg.fromStation)
  setVal('toStationText', seg.toStation)
  setVal('train_date', seg.fromTime.slice(0, 10))

  const queryBtn = document.querySelector('#query_ticket') as HTMLElement | null
  if (queryBtn) queryBtn.click()
  await sleep(500)
}

function waitForElement(selector: string, timeout: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)
    const deadline = Date.now() + timeout
    const timer = setInterval(() => {
      const el = document.querySelector(selector)
      if (el) { clearInterval(timer); resolve(el) }
      if (Date.now() > deadline) { clearInterval(timer); resolve(null) }
    }, 200)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
