export interface StationInfo {
  name: string
  code: string
  pinyin: string
}

export interface Segment {
  fromStation: string
  toStation: string
  fromTime: string
  toTime: string
  trainNo: string
  seatType: string
  price: number
}

export interface Passenger {
  id: string
  name: string
  idType: string
  idNumber: string
}

export interface TaskConfig {
  name: string
  fromStation: string
  toStation: string
  travelDate: string
  timeStart: string
  timeEnd: string
  maxExtraFee: number
  seatTypes: string[]
  trainNos?: string[]
  strategies: string[]
  passengers: Passenger[]
}

export interface SolutionData {
  id: string
  planType: 'direct' | 'split' | 'longer' | 'cross'
  trainNo: string
  segments: Segment[]
  totalPrice: number
  extraFee: number
  priority: number
  ticketStatus: 'pending' | 'available' | 'sold' | 'booked'
}

export interface OrderSignal {
  type: 'ORDER_SIGNAL'
  taskId: string
  planType: string
  trainNo: string
  segments: Segment[]
  passengerIds: string[]
  deadline: string
}

export type WsMessage =
  | { type: 'TASK_SYNCED'; taskId: string }
  | { type: 'SOLUTION_UPDATE'; taskId: string; solutionId?: string; status?: string; solutions?: SolutionData[]; detail?: Record<string, unknown> }
  | { type: 'SCAN_LOG'; taskId: string; solutionId: string; event: string; detail: string }
  | { type: 'ORDER_SIGNAL' } & OrderSignal
  | { type: 'ALERT'; taskId: string; message: string }
  | { type: 'ERROR'; message: string }
  | { type: 'HEARTBEAT' }
