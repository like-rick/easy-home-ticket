const STORE_KEY = 'easyticket_tasks'

export interface StoredTask {
  id: string
  name: string
  fromStation: string
  toStation: string
  trainNo: string
  travelDate: string
  timeStart: string
  timeEnd: string
  passengers: PassengerInfo[]
  // strategy options
  splitTicket: boolean    // 上车补票
  extraOneStop: boolean   // 多买一站
  extraTwoStop: boolean   // 多买两站
  // runtime
  status: 'not_started' | 'scanning' | 'ordered' | 'waitlisted'
  strategies: StrategyOption[]  // generated strategies with costs
  createdAt: number
}

export interface PassengerInfo {
  id: string
  name: string
  idType: string
  idNumber: string
}

export interface StrategyOption {
  type: 'direct' | 'split' | 'longer1' | 'longer2'
  label: string
  fromStation: string
  toStation: string
  extraFee: number
  totalPrice: number
  enabled: boolean
}

export async function loadTasks(): Promise<StoredTask[]> {
  const data = await chrome.storage.local.get(STORE_KEY)
  return data[STORE_KEY] || []
}

export async function saveTask(task: StoredTask): Promise<void> {
  const tasks = await loadTasks()
  const idx = tasks.findIndex(t => t.id === task.id)
  if (idx >= 0) tasks[idx] = task
  else tasks.push(task)
  await chrome.storage.local.set({ [STORE_KEY]: tasks })
}

export async function removeTask(taskId: string): Promise<void> {
  const tasks = (await loadTasks()).filter(t => t.id !== taskId)
  await chrome.storage.local.set({ [STORE_KEY]: tasks })
}
