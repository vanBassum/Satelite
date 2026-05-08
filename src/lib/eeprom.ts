export interface Transponder {
  freq: number // MHz
  srate: number // kS/s
  pol: number // 0=H 1=V (2=H+22kHz 3=V+22kHz not confirmed in any known file)
  fecMod: number // nibble-packed: high nibble = modulation (0x1=QPSK), low nibble = FEC numerator (1=1/2 2=2/3 3=3/4 5=5/6 7=7/8)
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

export type FieldType =
  | 'header' | 'config' | 'profile' | 'lnb' | 'ch_table' | 'firmware' | 'version'
  | 'name' | 'flags' | 'reservedA'
  | 'freq' | 'srate' | 'pol' | 'reservedB'
  | 'fecmod' | 'pad' | 'unknown'

export interface ByteAnnotation {
  type: FieldType
  label: string
}

export function buildByteMap(bufLen: number): ByteAnnotation[] {
  const map: ByteAnnotation[] = Array.from({ length: bufLen }, (_, i) => ({
    type: 'unknown' as FieldType,
    label: `0x${i.toString(16).toUpperCase().padStart(4, '0')}`,
  }))

  // Generic header baseline — overridden below for identified regions
  for (let i = 0; i < Math.min(SAT_TABLE, bufLen); i++)
    map[i] = { type: 'header', label: `Header +0x${i.toString(16).toUpperCase().padStart(3, '0')}` }

  // Device configuration block (0x000–0x07F)
  for (let i = 0; i < 0x080 && i < bufLen; i++)
    map[i] = { type: 'config', label: `Config +0x${i.toString(16).toUpperCase().padStart(3, '0')}` }

  // Antenna profile name slots (0x0A6–0x105): 6 × 16-byte null-padded strings
  // Known names in this sample: Cosmo Vision, Caro Vision TWIN, Samy Vision,
  //   Oyster Vision 2+, Caro Vision 2+, Spare1
  for (let p = 0; p < 6; p++) {
    for (let j = 0; j < 16; j++) {
      const off = 0x0A6 + p * 16 + j
      if (off < bufLen)
        map[off] = { type: 'profile', label: `Profile ${p + 1} · Name [${j}]` }
    }
  }

  // LNB / signal configuration block (0x1F6–0x205)
  for (let i = 0; i < 16 && 0x1F6 + i < bufLen; i++)
    map[0x1F6 + i] = { type: 'lnb', label: `LNB Config [${i}]` }

  // Channel frequency table (0x206–0x36D): 180 × U16 LE presets (default = 999)
  for (let ch = 0; ch < 180; ch++) {
    const off = 0x206 + ch * 2
    if (off < bufLen)     map[off]     = { type: 'ch_table', label: `Channel ${ch + 1} · freq lo` }
    if (off + 1 < bufLen) map[off + 1] = { type: 'ch_table', label: `Channel ${ch + 1} · freq hi` }
  }

  // Firmware magic (0x37A–0x37C: 99 AA 55) + ID string "UEU/30MAR2009" (0x37C–0x389)
  for (let i = 0; i < 16 && 0x37A + i < bufLen; i++)
    map[0x37A + i] = { type: 'firmware', label: i < 3 ? `Firmware Magic [${i}]` : `Firmware ID [${i - 3}]` }

  // Firmware version info (0x3A0–0x3AF)
  for (let i = 0; i < 16 && 0x3A0 + i < bufLen; i++)
    map[0x3A0 + i] = { type: 'version', label: `Version Info [${i}]` }

  for (let s = 0; s < SAT_COUNT; s++) {
    const b = SAT_TABLE + s * RECORD_SIZE
    if (b >= bufLen) break
    const sn = `Sat ${s + 1}`

    for (let j = 0; j < 16 && b + j < bufLen; j++)
      map[b + j] = { type: 'name', label: `${sn} · Name [${j}]` }
    if (b + 16 < bufLen)
      map[b + 16] = { type: 'flags', label: `${sn} · Flags` }
    for (let j = 0; j < 10 && b + 17 + j < bufLen; j++)
      map[b + 17 + j] = { type: 'reservedA', label: `${sn} · Reserved A [${j}]` }

    for (let t = 0; t < 4; t++) {
      const f = b + 0x1b + t * 2
      if (f < bufLen) map[f] = { type: 'freq', label: `${sn} · TP${t + 1} Freq lo` }
      if (f + 1 < bufLen) map[f + 1] = { type: 'freq', label: `${sn} · TP${t + 1} Freq hi` }
      const sr = b + 0x23 + t * 2
      if (sr < bufLen) map[sr] = { type: 'srate', label: `${sn} · TP${t + 1} SRate lo` }
      if (sr + 1 < bufLen) map[sr + 1] = { type: 'srate', label: `${sn} · TP${t + 1} SRate hi` }
      const p = b + 0x2b + t
      if (p < bufLen) map[p] = { type: 'pol', label: `${sn} · TP${t + 1} Polarization` }
      const fm = b + 0x37 + t
      if (fm < bufLen) map[fm] = { type: 'fecmod', label: `${sn} · TP${t + 1} FEC/Mod` }
    }

    for (let j = 0; j < 8 && b + 0x2f + j < bufLen; j++)
      map[b + 0x2f + j] = { type: 'reservedB', label: `${sn} · Reserved B [${j}]` }
    for (let j = 0; j < 5 && b + 0x3b + j < bufLen; j++)
      map[b + 0x3b + j] = { type: 'pad', label: `${sn} · Pad [${j}]` }
  }

  return map
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
