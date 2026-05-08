import { useState } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { type Transponder } from "@/lib/eeprom"
import { useEepromStore } from "@/lib/store"

const field =
  "rounded border border-input bg-background px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"

export function EepromEditor() {
  const count = useEepromStore(s => s.satellites.length)
  const [expanded, setExpanded] = useState<number | null>(null)

  if (count === 0) return null

  return (
    <div className="p-6">
      <div className="divide-y rounded-lg border">
        {Array.from({ length: count }, (_, i) => (
          <SatRow
            key={i}
            index={i}
            isExpanded={expanded === i}
            onToggle={() => setExpanded(prev => (prev === i ? null : i))}
          />
        ))}
      </div>
    </div>
  )
}

function SatRow({ index, isExpanded, onToggle }: { index: number; isExpanded: boolean; onToggle: () => void }) {
  const sat = useEepromStore(s => s.satellites[index])
  const patchSat = useEepromStore(s => s.patchSat)
  const patchTp = useEepromStore(s => s.patchTp)
  const isDefined = !sat.name.includes("#UNDEFINED")

  return (
    <div>
      <button
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className={cn("flex-1 font-mono text-sm", !isDefined && "text-muted-foreground")}>
          {sat.name || <em className="not-italic text-muted-foreground">unnamed</em>}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          flags 0x{sat.flags.toString(16).padStart(2, "0").toUpperCase()}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/20 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Name</span>
              <input
                className={cn(field, "w-44")}
                maxLength={16}
                value={sat.name}
                onChange={e => patchSat(index, { name: e.target.value })}
                onClick={e => e.stopPropagation()}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Flags</span>
              <input
                className={cn(field, "w-20")}
                value={"0x" + sat.flags.toString(16).padStart(2, "0").toUpperCase()}
                onChange={e => {
                  const v = parseInt(e.target.value.replace(/^0x/i, ""), 16)
                  if (!isNaN(v)) patchSat(index, { flags: v & 0xff })
                }}
                onClick={e => e.stopPropagation()}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">TP</th>
                  <th className="pb-2 pr-4 text-left font-medium">Freq (MHz)</th>
                  <th className="pb-2 pr-4 text-left font-medium">SRate (kS/s)</th>
                  <th className="pb-2 pr-4 text-left font-medium">Pol</th>
                  <th className="pb-2 text-left font-medium">FEC/Mod (raw)</th>
                </tr>
              </thead>
              <tbody>
                {sat.transponders.map((tp, ti) => (
                  <TpRow key={ti} index={ti} tp={tp} onChange={patch => patchTp(index, ti, patch)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TpRow({
  index,
  tp,
  onChange,
}: {
  index: number
  tp: Transponder
  onChange: (patch: Partial<Transponder>) => void
}) {
  const clamp = (v: number) => Math.max(0, Math.min(65535, v))

  return (
    <tr className="border-t border-border/40">
      <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground">{index + 1}</td>
      <td className="py-1.5 pr-4">
        <input
          type="number"
          className={cn(field, "w-24")}
          value={tp.freq}
          min={0}
          max={65535}
          onChange={e => onChange({ freq: clamp(parseInt(e.target.value) || 0) })}
        />
      </td>
      <td className="py-1.5 pr-4">
        <input
          type="number"
          className={cn(field, "w-24")}
          value={tp.srate}
          min={0}
          max={65535}
          onChange={e => onChange({ srate: clamp(parseInt(e.target.value) || 0) })}
        />
      </td>
      <td className="py-1.5 pr-4">
        <select
          className={cn(field, "cursor-pointer")}
          value={tp.pol}
          onChange={e => onChange({ pol: parseInt(e.target.value) })}
        >
          <option value={0}>H</option>
          <option value={1}>V</option>
          <option value={2}>H + 22 kHz</option>
          <option value={3}>V + 22 kHz</option>
        </select>
      </td>
      <td className="py-1.5">
        <input
          className={cn(field, "w-20")}
          value={"0x" + tp.fecMod.toString(16).padStart(2, "0").toUpperCase()}
          onChange={e => {
            const v = parseInt(e.target.value.replace(/^0x/i, ""), 16)
            if (!isNaN(v)) onChange({ fecMod: v & 0xff })
          }}
        />
      </td>
    </tr>
  )
}
