import type { StationInfo } from './types'

// ---- keys ----

const KEY_TASKS = 'easyticket_tasks'
const KEY_STATIONS = 'easyticket_stations'
const KEY_STATIONS_TS = 'easyticket_stations_ts'
const STATION_CACHE_TTL = 24 * 3600_000 // 24 hours

// ---- types ----

export interface StoredTask {
  id: string
  name: string
  fromStation: string
  toStation: string
  fromCode: string
  toCode: string
  trainNo: string
  travelDate: string
  seatTypes: string[]
  passengers: PassengerInfo[]
  splitTicket: boolean
  extraOneStop: boolean
  status: 'pending' | 'scanning' | 'ordered' | 'waitlisted'
  strategies: StrategyOption[]
  createdAt: number
}

export interface PassengerInfo {
  id: string
  name: string
  idType: string
  idNumber: string
}

export interface StrategyOption {
  type: 'direct' | 'split' | 'longer1'
  label: string
  fromStation: string
  toStation: string
  fromStationName: string
  toStationName: string
  extraFee: number
  totalPrice: number
  enabled: boolean
}

// ---- tasks ----

export async function loadTasks(): Promise<StoredTask[]> {
  const data = await chrome.storage.local.get(KEY_TASKS)
  return data[KEY_TASKS] || []
}

export async function saveTask(task: StoredTask): Promise<void> {
  const tasks = await loadTasks()
  const idx = tasks.findIndex(t => t.id === task.id)
  if (idx >= 0) tasks[idx] = task
  else tasks.push(task)
  await chrome.storage.local.set({ [KEY_TASKS]: tasks })
}

export async function removeTask(taskId: string): Promise<void> {
  const tasks = (await loadTasks()).filter(t => t.id !== taskId)
  await chrome.storage.local.set({ [KEY_TASKS]: tasks })
}

// ---- stations ----

async function fetchStationsFrom12306(): Promise<StationInfo[]> {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: 'https://kyfw.12306.cn/*' }, (tabs) => {
      const tab = tabs.find(t => !t.discarded)
      if (!tab?.id) { resolve([]); return }
      chrome.tabs.sendMessage(tab.id, { type: 'FETCH_STATIONS' }, (response) => {
        if (chrome.runtime.lastError || !response || response.error) { resolve([]); return }
        resolve(response.stations || [])
      })
    })
  })
}

export async function searchStations(q: string): Promise<StationInfo[]> {
  const data = await chrome.storage.local.get([KEY_STATIONS, KEY_STATIONS_TS])
  const cached: StationInfo[] | undefined = data[KEY_STATIONS]
  const ts: number | undefined = data[KEY_STATIONS_TS]

  if (cached && cached.length > 0 && ts && (Date.now() - ts < STATION_CACHE_TTL)) {
    if (!q) return cached.slice(0, 200)
    const lower = q.toLowerCase()
    return cached.filter(s =>
      s.name.includes(q) || s.pinyin.startsWith(lower) || s.pinyin.includes(lower)
    ).slice(0, 50)
  }

  const fresh = await fetchStationsFrom12306()
  if (fresh.length > 0) {
    await chrome.storage.local.set({ [KEY_STATIONS]: fresh, [KEY_STATIONS_TS]: Date.now() })
  }

  if (!q) return fresh.slice(0, 200)
  const lower = q.toLowerCase()
  return fresh.filter(s =>
    s.name.includes(q) || s.pinyin.startsWith(lower) || s.pinyin.includes(lower)
  ).slice(0, 50)
}
