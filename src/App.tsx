import { TriangleAlertIcon } from "lucide-react"
import { EepromEditor } from "@/components/EepromEditor"

export function App() {
  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Satelite EEPROM Editor</h1>
        <p className="text-sm text-muted-foreground">
          View and edit the EEPROM of Ten-Haaft satellite dish controllers.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm dark:border-yellow-900/60 dark:bg-yellow-950/30">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
        <div className="text-yellow-800 dark:text-yellow-200">
          <span className="font-semibold">Experimental — use at your own risk.</span> <br/>
          This tool is based on reverse-engineered data. No guarantees are made about correctness, completeness,
          or compatibility.
        </div>
      </div>

      <main className="flex-1">
        <EepromEditor />
      </main>
    </div>
  )
}

export default App
