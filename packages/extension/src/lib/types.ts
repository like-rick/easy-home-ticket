export interface StationInfo {
  name: string
  code: string
  pinyin: string
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
  trainNo: string
  travelDate: string
  timeStart: string
  timeEnd: string
  seatTypes: string[]
  passengers: Passenger[]
  splitTicket: boolean
  extraOneStop: boolean
  extraTwoStop: boolean
}
