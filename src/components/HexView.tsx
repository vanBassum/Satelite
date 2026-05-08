import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { buildByteMap, type ByteAnnotation, type FieldType } from "@/lib/eeprom"

const FIELD_META: Record<FieldType, { label: string; cls: string; activeCls: string }> = {
  header:    { label: "Header",       cls: "bg-slate-100 dark:bg-slate-800",         activeCls: "bg-slate-200 dark:bg-slate-700" },
  name:      { label: "Name",         cls: "bg-blue-100 dark:bg-blue-900/60",        activeCls: "bg-blue-200 dark:bg-blue-800" },
  flags:     { label: "Flags",        cls: "bg-violet-100 dark:bg-violet-900/60",    activeCls: "bg-violet-200 dark:bg-violet-800" },
  reservedA: { label: "Reserved A",   cls: "bg-slate-50 dark:bg-slate-800/50",       activeCls: "bg-slate-200 dark:bg-slate-700" },
  freq:      { label: "Frequency",    cls: "bg-green-100 dark:bg-green-900/60",      activeCls: "bg-green-200 dark:bg-green-800" },
  srate:     { label: "Symbol Rate",  cls: "bg-yellow-100 dark:bg-yellow-900/60",    activeCls: "bg-yellow-200 dark:bg-yellow-800" },
  pol:       { label: "Polarization", cls: "bg-rose-100 dark:bg-rose-900/60",        activeCls: "bg-rose-200 dark:bg-rose-800" },
  reservedB: { label: "Reserved B",   cls: "bg-slate-50 dark:bg-slate-800/50",       activeCls: "bg-slate-200 dark:bg-slate-700" },
  fecmod:    { label: "FEC / Mod",    cls: "bg-cyan-100 dark:bg-cyan-900/60",        activeCls: "bg-cyan-200 dark:bg-cyan-800" },
  pad:       { label: "Pad",          cls: "bg-neutral-100 dark:bg-neutral-800",     activeCls: "bg-neutral-200 dark:bg-neutral-700" },
  unknown:   { label: "Unknown",      cls: "bg-background",                          activeCls: "bg-muted" },
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
                  className={cn("size-3 shrink-0 rounded-sm border border-border", meta.activeCls)}
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
