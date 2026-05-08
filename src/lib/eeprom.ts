export interface Transponder {
  freq: number // MHz
  srate: number // kS/s
  pol: number // 0=H 1=V 2=H+22kHz 3=V+22kHz
  fecMod: number // raw byte — high nibble=mod, low nibble=FEC (not yet fully confirmed)
}

export interface SatelliteRecord {
  index: number
  name: string
  flags: number
  reservedA: number[] // 10 bytes
  transponders: Transponder[] // 4 entries
  reservedB: number[] // 8 bytes
  pad: number[] // 5 bytes
}

const SAT_TABLE = 0x400
const RECORD_SIZE = 64
export const SAT_COUNT = 29

function u16le(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8)
}

function writeU16le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >> 8) & 0xff
}

export function parseEeprom(buf: Uint8Array): SatelliteRecord[] {
  return Array.from({ length: SAT_COUNT }, (_, i) => {
    const b = SAT_TABLE + i * RECORD_SIZE
    const name = String.fromCharCode(...buf.slice(b, b + 16)).trim()
    const flags = buf[b + 0x10]
    const reservedA = Array.from(buf.slice(b + 0x11, b + 0x1b))
    const transponders: Transponder[] = Array.from({ length: 4 }, (_, t) => ({
      freq: u16le(buf, b + 0x1b + t * 2),
      srate: u16le(buf, b + 0x23 + t * 2),
      pol: buf[b + 0x2b + t],
      fecMod: buf[b + 0x37 + t],
    }))
    const reservedB = Array.from(buf.slice(b + 0x2f, b + 0x37))
    const pad = Array.from(buf.slice(b + 0x3b, b + 0x40))
    return { index: i, name, flags, reservedA, transponders, reservedB, pad }
  })
}

export function applyEeprom(buf: Uint8Array, records: SatelliteRecord[]): void {
  for (let i = 0; i < Math.min(records.length, SAT_COUNT); i++) {
    const b = SAT_TABLE + i * RECORD_SIZE
    const rec = records[i]

    for (let j = 0; j < 16; j++) {
      buf[b + j] = j < rec.name.length ? rec.name.charCodeAt(j) : 0x20
    }

    buf[b + 0x10] = rec.flags
    for (let j = 0; j < 10; j++) buf[b + 0x11 + j] = rec.reservedA[j] ?? 0

    for (let t = 0; t < 4; t++) {
      const tp = rec.transponders[t]
      writeU16le(buf, b + 0x1b + t * 2, tp.freq)
      writeU16le(buf, b + 0x23 + t * 2, tp.srate)
      buf[b + 0x2b + t] = tp.pol
      buf[b + 0x37 + t] = tp.fecMod
    }

    for (let j = 0; j < 8; j++) buf[b + 0x2f + j] = rec.reservedB[j] ?? 0
    for (let j = 0; j < 5; j++) buf[b + 0x3b + j] = rec.pad[j] ?? 0
  }
}
