import { useCallback, useRef, useState } from "react"
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { parseIntelHex, serializeIntelHex } from "@/lib/intel-hex"
import { applyEeprom, parseEeprom, type SatelliteRecord, type Transponder } from "@/lib/eeprom"

const field =
  "rounded border border-input bg-background px-2 py-1 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"

export function EepromEditor() {
  const [buf, setBuf] = useState<Uint8Array | null>(null)
  const [satellites, setSatellites] = useState<SatelliteRecord[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadBuffer = useCallback((raw: Uint8Array) => {
    setBuf(raw)
    setSatellites(parseEeprom(raw))
    setExpanded(null)
  }, [])

  function handleUpload(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        loadBuffer(parseIntelHex(e.target!.result as string))
        setStatus(`Loaded: ${file.name}`)
      } catch {
        setStatus("Failed to parse file.")
      }
    }
    reader.onerror = () => setStatus("Failed to read file.")
    reader.readAsText(file)
  }

  function handleDownload() {
    if (!buf) return
    const cloned = new Uint8Array(buf)
    applyEeprom(cloned, satellites)
    const blob = new Blob([serializeIntelHex(cloned)], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "update.eep"
    a.click()
    URL.revokeObjectURL(url)
  }

  function patchSat(idx: number, patch: Partial<SatelliteRecord>) {
    setSatellites(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function patchTp(satIdx: number, tpIdx: number, patch: Partial<Transponder>) {
    setSatellites(prev =>
      prev.map((s, i) => {
        if (i !== satIdx) return s
        return {
          ...s,
          transponders: s.transponders.map((tp, ti) =>
            ti === tpIdx ? { ...tp, ...patch } : tp,
          ),
        }
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <UploadIcon />
          Upload .eep
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".eep,.hex"
          className="sr-only"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <Button size="sm" disabled={!buf} onClick={handleDownload}>
          <DownloadIcon />
          Download
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>

      {satellites.length > 0 && (
        <div className="divide-y rounded-lg border">
          {satellites.map((sat, i) => (
            <SatRow
              key={i}
              sat={sat}
              isExpanded={expanded === i}
              onToggle={() => setExpanded(prev => (prev === i ? null : i))}
              onPatchSat={patch => patchSat(i, patch)}
              onPatchTp={(ti, patch) => patchTp(i, ti, patch)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SatRowProps {
  sat: SatelliteRecord
  isExpanded: boolean
  onToggle: () => void
  onPatchSat: (patch: Partial<SatelliteRecord>) => void
  onPatchTp: (tpIdx: number, patch: Partial<Transponder>) => void
}

function SatRow({ sat, isExpanded, onToggle, onPatchSat, onPatchTp }: SatRowProps) {
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
                onChange={e => onPatchSat({ name: e.target.value })}
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
                  if (!isNaN(v)) onPatchSat({ flags: v & 0xff })
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
                  <TpRow key={ti} index={ti} tp={tp} onChange={patch => onPatchTp(ti, patch)} />
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
