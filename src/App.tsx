import { useRef, startTransition } from "react"
import { BinaryIcon, DownloadIcon, ListIcon, MoonIcon, SunIcon, TriangleAlertIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { EepromEditor } from "@/components/EepromEditor"
import { HexView } from "@/components/HexView"
import { parseIntelHex, serializeIntelHex } from "@/lib/intel-hex"
import { applyEeprom } from "@/lib/eeprom"
import { useEepromStore } from "@/lib/store"
import { useState } from "react"

type Page = "satellites" | "hex"

export function App() {
  const { buf, satellites, load } = useEepromStore()
  const [page, setPage] = useState<Page>("satellites")
  const fileRef = useRef<HTMLInputElement>(null)

  function handleUpload(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        load(parseIntelHex(e.target!.result as string))
      } catch {
        // ignore — nothing loads
      }
    }
    reader.readAsText(file)
  }

  function handleDownload() {
    if (!buf) return
    const clone = new Uint8Array(buf)
    applyEeprom(clone, satellites)
    const blob = new Blob([serializeIntelHex(clone)], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "update.eep"
    a.click()
    URL.revokeObjectURL(url)
  }

  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-52 shrink-0 flex-col border-r">
        <div className="border-b px-3 py-2">
          <h1 className="text-sm font-semibold tracking-tight">Satelite EEPROM Editor</h1>
        </div>

        <div className="relative border-b">
          <div className="flex items-center gap-0.5 px-2 py-1.5">
            <Button variant="ghost" size="icon-sm" title="GitHub repository" asChild>
              <a href="https://github.com/vanBassum/Satelite" target="_blank" rel="noreferrer" aria-label="GitHub repository">
                <GitHubIcon className="size-3.5" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Upload .eep file"
              aria-label="Upload .eep file"
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon className="size-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Download .eep file"
                  aria-label="Download .eep file"
                  disabled={!buf}
                >
                  <DownloadIcon className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Experimental software</AlertDialogTitle>
                  <AlertDialogDescription>
                    This tool is based on reverse-engineered data and is provided for experimentation only.
                    The generated file may be incorrect or damage your device. Use at your own risk.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDownload}>Download anyway</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Toggle dark / light theme"
              aria-label="Toggle theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
            >
              {isDark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
            </Button>
          </div>

          {!buf && (
            <div className="absolute left-full top-0 z-20 ml-2 mt-1">
              <div className="absolute -left-1.5 top-2.5 size-3 rotate-45 border-b border-l border-border bg-popover" />
              <div className="w-44 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                Press <UploadIcon className="mb-0.5 inline size-3" /> to upload a{" "}
                <span className="font-medium">.eep</span> file and get started.
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".eep,.hex"
          className="sr-only"
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          <NavButton
            icon={<ListIcon className="size-3.5" />}
            active={page === "satellites"}
            disabled={!buf}
            onClick={() => startTransition(() => setPage("satellites"))}
          >
            Satellites
          </NavButton>
          <NavButton
            icon={<BinaryIcon className="size-3.5" />}
            active={page === "hex"}
            disabled={!buf}
            onClick={() => startTransition(() => setPage("hex"))}
          >
            Hex View
          </NavButton>
        </nav>

        <div className="flex items-start gap-2 border-t p-3 text-xs text-muted-foreground">
          <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
          <span>Experimental. Reverse-engineered data. Use at your own risk.</span>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {!buf ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">No file loaded</p>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <UploadIcon className="mr-2 size-3.5" />
              Upload .eep file
            </Button>
          </div>
        ) : page === "satellites" ? (
          <EepromEditor />
        ) : (
          <HexView />
        )}
      </main>
    </div>
  )
}

export default App

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function NavButton({
  icon,
  active,
  disabled,
  onClick,
  children,
}: {
  icon: React.ReactNode
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm transition-colors",
        active
          ? "bg-muted font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {children}
    </button>
  )
}
