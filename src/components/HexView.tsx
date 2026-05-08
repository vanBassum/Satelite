import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { buildByteMap, type ByteAnnotation, type FieldType, type SatelliteRecord } from "@/lib/eeprom"
import { useEepromStore } from "@/lib/store"

const FIELD_META: Record<FieldType, { label: string; cls: string; activeCls: string; detail: string }> = {
  config:    { label: "Device Config",     cls: "bg-amber-100 dark:bg-amber-900/50",    activeCls: "bg-amber-200 dark:bg-amber-800",     detail: "0x000–0x07F · 128 bytes\nMotor + LO config, L-band frequency presets (1100 / 1500 / 1890 MHz)" },
  profile:   { label: "Profile Names",     cls: "bg-teal-100 dark:bg-teal-900/50",      activeCls: "bg-teal-200 dark:bg-teal-800",       detail: "0x0A6–0x105 · 96 bytes\n6 × 16-byte antenna profile name slots" },
  lnb:       { label: "LNB Config",        cls: "bg-indigo-100 dark:bg-indigo-900/50",  activeCls: "bg-indigo-200 dark:bg-indigo-800",   detail: "0x1F6–0x205 · 16 bytes\nLNB and signal configuration block" },
  ch_table:  { label: "Channel Table",     cls: "bg-orange-100 dark:bg-orange-900/50",  activeCls: "bg-orange-200 dark:bg-orange-800",   detail: "0x206–0x36D · 360 bytes\n180 × U16-LE channel frequency presets (default 999)" },
  firmware:  { label: "Firmware Magic/ID", cls: "bg-red-100 dark:bg-red-900/50",        activeCls: "bg-red-200 dark:bg-red-800",         detail: "0x37A–0x389 · 16 bytes\nMagic 99 AA 55 + firmware ID string" },
  version:   { label: "Version Info",      cls: "bg-pink-100 dark:bg-pink-900/50",      activeCls: "bg-pink-200 dark:bg-pink-800",       detail: "0x3A0–0x3AF · 16 bytes\nFirmware version bytes" },
  header:    { label: "Header (unknown)",  cls: "bg-slate-100 dark:bg-slate-800",       activeCls: "bg-slate-200 dark:bg-slate-700",     detail: "0x000–0x3FF · remaining bytes\nUnidentified header region" },
  name:      { label: "Sat Name",          cls: "bg-blue-100 dark:bg-blue-900/60",      activeCls: "bg-blue-200 dark:bg-blue-800",       detail: "+0x00–0x0F · 16 bytes per record\nASCII satellite name, space-padded" },
  flags:     { label: "Flags",             cls: "bg-violet-100 dark:bg-violet-900/60",  activeCls: "bg-violet-200 dark:bg-violet-800",   detail: "+0x10 · 1 byte per record\nSatellite flags (exact meaning TBD)" },
  reservedA: { label: "Reserved A",        cls: "bg-slate-50 dark:bg-slate-800/50",     activeCls: "bg-slate-200 dark:bg-slate-700",     detail: "+0x11–0x1A · 10 bytes per record\nUnused / reserved" },
  freq:      { label: "Frequency",         cls: "bg-green-100 dark:bg-green-900/60",    activeCls: "bg-green-200 dark:bg-green-800",     detail: "+0x1B–0x22 · 8 bytes per record\n4 × U16-LE transponder frequency in MHz" },
  srate:     { label: "Symbol Rate",       cls: "bg-yellow-100 dark:bg-yellow-900/60",  activeCls: "bg-yellow-200 dark:bg-yellow-800",   detail: "+0x23–0x2A · 8 bytes per record\n4 × U16-LE symbol rate in kS/s" },
  pol:       { label: "Polarization",      cls: "bg-rose-100 dark:bg-rose-900/60",      activeCls: "bg-rose-200 dark:bg-rose-800",       detail: "+0x2B–0x2E · 4 bytes per record\n0=H · 1=V (2/3 = +22kHz unconfirmed)" },
  reservedB: { label: "Reserved B",        cls: "bg-slate-50 dark:bg-slate-800/50",     activeCls: "bg-slate-200 dark:bg-slate-700",     detail: "+0x2F–0x36 · 8 bytes per record\nUnused / reserved" },
  fecmod:    { label: "FEC / Mod",         cls: "bg-cyan-100 dark:bg-cyan-900/60",      activeCls: "bg-cyan-200 dark:bg-cyan-800",       detail: "+0x37–0x3A · 4 bytes per record\nHigh nibble = mod (0x1=QPSK)\nLow nibble = FEC numerator (1=1/2 2=2/3 3=3/4 5=5/6 7=7/8)" },
  pad:       { label: "Pad",               cls: "bg-neutral-100 dark:bg-neutral-800",   activeCls: "bg-neutral-200 dark:bg-neutral-700", detail: "+0x3B–0x3F · 5 bytes per record\nPadding bytes" },
  unknown:   { label: "Unknown",           cls: "bg-background",                        activeCls: "bg-muted",                           detail: "Unidentified bytes" },
}

const LEGEND_TYPES: FieldType[] = [
  "config", "profile", "lnb", "ch_table", "firmware", "version", "header",
  "name", "flags", "freq", "srate", "pol", "fecmod",
  "reservedA", "reservedB", "pad", "unknown",
]

const ROW_SIZE = 16

const POL_LABEL = ["H", "V", "H+22k", "V+22k"]

function parsedLines(
  type: FieldType,
  buf: Uint8Array,
  satellites: SatelliteRecord[],
  hoveredOffset: number | null,
): string[] {
  if (hoveredOffset === null) return []

  switch (type) {
    case "profile": {
      const p = Math.floor((hoveredOffset - 0x0A6) / 16)
      if (p < 0 || p >= 6 || 0x0A6 + p * 16 + 16 > buf.length) return []
      const name = String.fromCharCode(...buf.slice(0x0A6 + p * 16, 0x0A6 + p * 16 + 16))
        .replace(/[\x00\s]+$/, "")
        .trim()
      return [`Profile ${p + 1}: ${name || "(empty)"}`]
    }
    case "firmware": {
      if (0x38A > buf.length) return []
      const magic = Array.from(buf.slice(0x37A, 0x37D))
        .map(b => b.toString(16).toUpperCase().padStart(2, "0"))
        .join(" ")
      const id = String.fromCharCode(...buf.slice(0x37D, 0x38A)).replace(/\x00/g, "").trim()
      return [`Magic: ${magic}`, `ID: ${id}`]
    }
    case "version": {
      if (0x3B0 > buf.length) return []
      return [
        Array.from(buf.slice(0x3A0, 0x3B0))
          .map(b => b.toString(16).toUpperCase().padStart(2, "0"))
          .join(" "),
      ]
    }
    case "ch_table": {
      const ch = Math.floor((hoveredOffset - 0x206) / 2)
      if (ch < 0 || ch >= 180) return []
      const off = 0x206 + ch * 2
      const freq = buf[off] | (buf[off + 1] << 8)
      return [`Channel ${ch + 1}: ${freq} MHz`]
    }
    default: {
      if (hoveredOffset < 0x400) return []
      const satIdx = Math.floor((hoveredOffset - 0x400) / 64)
      if (satIdx < 0 || satIdx >= satellites.length) return []
      const s = satellites[satIdx]
      const tps = s.transponders.map(tp => tp)
      switch (type) {
        case "name":    return [s.name.trim()]
        case "flags":   return [`0x${s.flags.toString(16).padStart(2, "0").toUpperCase()}`]
        case "freq":    return [tps.map(tp => tp.freq  ? `${tp.freq} MHz`  : "—").join(" / ")]
        case "srate":   return [tps.map(tp => tp.srate ? `${tp.srate} kS/s` : "—").join(" / ")]
        case "pol":     return [tps.map(tp => POL_LABEL[tp.pol] ?? "?").join(" / ")]
        case "fecmod":  return [tps.map(tp => {
          const mod = (tp.fecMod >> 4) & 0xf
          const fec = tp.fecMod & 0xf
          const modStr = mod === 1 ? "QPSK" : `mod=0x${mod.toString(16)}`
          const fecTable: Record<number, string> = { 1: "1/2", 2: "2/3", 3: "3/4", 5: "5/6", 7: "7/8" }
          const fecStr = fecTable[fec] ?? `FEC=0x${fec.toString(16)}`
          return tp.fecMod ? `${modStr} ${fecStr}` : "—"
        }).join(" / ")]
        default:        return []
      }
    }
  }
}

export function HexView() {
  const buf = useEepromStore(s => s.buf)!
  const satellites = useEepromStore(s => s.satellites)
  const byteMap = useMemo(() => buildByteMap(buf.length), [buf.length])
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)
  const [highlightType, setHighlightType] = useState<FieldType | null>(null)

  const hoveredAnn: ByteAnnotation | null =
    hoveredOffset !== null ? byteMap[hoveredOffset] : null
  const activeType = highlightType ?? hoveredAnn?.type ?? null

  const rows = useMemo(() => {
    const out: { offset: number; bytes: number[] }[] = []
    for (let i = 0; i < buf.length; i += ROW_SIZE)
      out.push({ offset: i, bytes: Array.from(buf.slice(i, i + ROW_SIZE)) })
    return out
  }, [buf])

  function byteCls(offset: number, ci: number): string {
    const { type } = byteMap[offset]
    const meta = FIELD_META[type]
    const isActive = activeType !== null && type === activeType
    const isExact = offset === hoveredOffset
    return cn(
      "w-[1.6rem] cursor-default text-center",
      ci === 8 && "ml-2",
      isActive ? meta.activeCls : meta.cls,
      isExact && "ring-1 ring-inset ring-border",
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Hex grid */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-5">
        <div>
          {rows.map(({ offset, bytes }) => (
            <div key={offset} className="flex items-center">
              <span className="mr-3 w-10 shrink-0 select-none text-muted-foreground">
                {offset.toString(16).toUpperCase().padStart(4, "0")}
              </span>
              <span className="flex">
                {bytes.map((byte, ci) => {
                  const off = offset + ci
                  return (
                    <span
                      key={ci}
                      className={byteCls(off, ci)}
                      onMouseEnter={() => setHoveredOffset(off)}
                      onMouseLeave={() => setHoveredOffset(null)}
                    >
                      {byte.toString(16).toUpperCase().padStart(2, "0")}
                    </span>
                  )
                })}
              </span>
              <span className="ml-3 select-none text-muted-foreground/50">
                {bytes.map(b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "·")).join("")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right legend panel */}
      <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-l">
        {/* Hovered byte info */}
        <div className="flex min-h-[5rem] flex-col justify-center border-b p-3 text-xs">
          {hoveredAnn ? (
            <>
              <div className="font-medium leading-snug">{hoveredAnn.label}</div>
              <div className="mt-1 font-mono text-muted-foreground">
                {"0x" + hoveredOffset!.toString(16).toUpperCase().padStart(4, "0")}
                {" · "}
                {"0x" + buf[hoveredOffset!].toString(16).toUpperCase().padStart(2, "0")}
                {" = "}
                {buf[hoveredOffset!]}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">Hover over a byte</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-0.5 overflow-auto p-2">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Legend</p>
          {LEGEND_TYPES.map(type => {
            const meta = FIELD_META[type]
            const isActive =
              highlightType === type || (highlightType === null && activeType === type)
            const lines = isActive ? parsedLines(type, buf, satellites, hoveredOffset) : []
            return (
              <button
                key={type}
                className={cn(
                  "flex w-full flex-col rounded px-2 py-1 text-left text-xs",
                  isActive ? "bg-muted" : "hover:bg-muted/50",
                )}
                onMouseEnter={() => setHighlightType(type)}
                onMouseLeave={() => setHighlightType(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn("size-3 shrink-0 rounded-sm border border-border", meta.activeCls)}
                  />
                  {meta.label}
                </div>
                {isActive && (
                  <div className="mt-1 pl-5">
                    <p className="whitespace-pre-line text-muted-foreground">{meta.detail}</p>
                    {lines.length > 0 && (
                      <div className="mt-1.5 max-h-36 overflow-y-auto rounded border border-border/50 bg-background/60 p-1.5 font-mono text-[10px] leading-4">
                        {lines.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
