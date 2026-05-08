import { create } from "zustand"
import { parseEeprom, type SatelliteRecord, type Transponder } from "./eeprom"

interface EepromStore {
  buf: Uint8Array | null
  satellites: SatelliteRecord[]
  load: (raw: Uint8Array) => void
  patchSat: (idx: number, patch: Partial<SatelliteRecord>) => void
  patchTp: (satIdx: number, tpIdx: number, patch: Partial<Transponder>) => void
}

export const useEepromStore = create<EepromStore>(set => ({
  buf: null,
  satellites: [],

  load: raw =>
    set({ buf: raw, satellites: parseEeprom(raw) }),

  patchSat: (idx, patch) =>
    set(state => ({
      satellites: state.satellites.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    })),

  patchTp: (satIdx, tpIdx, patch) =>
    set(state => ({
      satellites: state.satellites.map((s, i) => {
        if (i !== satIdx) return s
        return {
          ...s,
          transponders: s.transponders.map((tp, ti) =>
            ti === tpIdx ? { ...tp, ...patch } : tp,
          ),
        }
      }),
    })),
}))
