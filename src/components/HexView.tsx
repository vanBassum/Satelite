import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { buildByteMap, type ByteAnnotation, type FieldType } from "@/lib/eeprom"

const FIELD_META: Record<FieldType, { label: string; color: string; activeColor: string }> = {
  header:    { label: "Header",       color: "#f3f4f6", activeColor: "#d1d5db" },
  name:      { label: "Name",         color: "#dbeafe", activeColor: "#93c5fd" },
  flags:     { label: "Flags",        color: "#ede9fe", activeColor: "#c4b5fd" },
  reservedA: { label: "Reserved A",   color: "#f1f5f9", activeColor: "#cbd5e1" },
  freq:      { label: "Frequency",    color: "#dcfce7", activeColor: "#86efac" },
  srate:     { label: "Symbol Rate",  color: "#fef9c3", activeColor: "#fde047" },
  pol:       { label: "Polarization", color: "#ffe4e6", activeColor: "#fda4af" },
  reservedB: { label: "Reserved B",   color: "#f8fafc", activeColor: "#e2e8f0" },
  fecmod:    { label: "FEC / Mod",    color: "#cffafe", activeColor: "#67e8f9" },
  pad:       { label: "Pad",          color: "#fafafa", activeColor: "#d4d4d4" },
  unknown:   { label: "Unknown",      color: "#ffffff", activeColor: "#f3f4f6" },
}

const LEGEND_TYPES: FieldType[] = [
  "name", "flags", "freq", "srate", "pol", "fecmod",
  "reservedA", "reservedB", "pad", "header", "unknown",
]

const ROW_SIZE = 16

export function HexView({ buf }: { buf: Uint8Array }) {
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

  function byteStyle(offset: number): React.CSSProperties {
    const { type } = byteMap[offset]
    const meta = FIELD_META[type]
    const isActive = activeType !== null && type === activeType
    const isExact = offset === hoveredOffset
    return {
      backgroundColor: isActive ? meta.activeColor : meta.color,
      outline: isExact ? "1px solid #9ca3af" : undefined,
      outlineOffset: "-1px",
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Hex grid */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-5">
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
                    className={cn("w-[1.6rem] cursor-default text-center", ci === 8 && "ml-2")}
                    style={byteStyle(off)}
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

      {/* Right legend panel */}
      <aside className="flex w-48 shrink-0 flex-col overflow-hidden border-l">
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
            return (
              <button
                key={type}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs",
                  isActive ? "bg-muted" : "hover:bg-muted/50",
                )}
                onMouseEnter={() => setHighlightType(type)}
                onMouseLeave={() => setHighlightType(null)}
              >
                <span
                  className="size-3 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: meta.activeColor }}
                />
                {meta.label}
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
