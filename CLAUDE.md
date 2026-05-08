# Satelite EEPROM Editor — Claude Context

Web tool for viewing and editing the EEPROM of Ten-Haaft satellite dish controllers. The data format is **reverse-engineered** — field meanings are not fully confirmed. No backend; everything runs in the browser.

Live at: https://vanbassum.github.io/Satelite/

## Dev commands

```
pnpm dev          # Vite dev server
pnpm build        # tsc + vite build
pnpm typecheck    # type-check only (no emit)
pnpm lint
pnpm format
```

## Architecture

Single-page app. No router — page state (`"satellites" | "hex"`) is plain React state in `App.tsx`. File is loaded once into a `Uint8Array` buffer; edits to the satellite list are kept as derived React state and only serialized back to the buffer at download time.

```
App.tsx                 shell layout + all lifted state
  ├─ EepromEditor.tsx   satellite list / editor (props-only, no file I/O)
  └─ HexView.tsx        color-coded hex grid + legend sidebar
```

## Key files

| File | Role |
|---|---|
| `src/lib/eeprom.ts` | Data model: `parseEeprom`, `applyEeprom`, `buildByteMap` |
| `src/lib/intel-hex.ts` | Parse/serialize Intel HEX (`.eep` files) |
| `src/App.tsx` | Shell, `buf`/`satellites` state, upload/download, theme toggle |
| `src/components/EepromEditor.tsx` | Collapsible satellite+transponder list |
| `src/components/HexView.tsx` | Hex grid with per-field coloring and hover legend |
| `src/components/theme-provider.tsx` | Dark/light context; `D` key hotkey; persists to localStorage |
| `docs/eeprom-format.md` | Full byte-map reference for the `.eep` file |

## EEPROM structure

```
0x000–0x3FF   Header (boot constants, motor/LO config, model name table)
0x400–0xB3F   Satellite table — 29 records × 64 bytes
```

Each 64-byte record (`SAT_TABLE = 0x400`, `RECORD_SIZE = 64`, `SAT_COUNT = 29`):

```
+0x00  16 bytes  Name (ASCII, space-padded)
+0x10   1 byte   Flags (exact meaning TBD)
+0x11  10 bytes  Reserved A
+0x1B   8 bytes  Freq × 4 transponders (u16-LE, MHz)
+0x23   8 bytes  SRate × 4 transponders (u16-LE, kS/s)
+0x2B   4 bytes  Polarization × 4 (0=H 1=V 2=H+22kHz 3=V+22kHz)
+0x2F   8 bytes  Reserved B
+0x37   4 bytes  FEC/Mod × 4 (raw byte, nibble-packed, TBD)
+0x3B   5 bytes  Pad
```

## Data flow

1. **Upload** → `FileReader.readAsText` → `parseIntelHex()` → `Uint8Array` buffer → `parseEeprom()` → `SatelliteRecord[]`
2. **Edit** → `patchSat` / `patchTp` immutably update `satellites` state only
3. **Hex view** — reads `buf` directly; `buildByteMap()` annotates every byte with field type + label
4. **Download** → clone `buf` → `applyEeprom(cloned, satellites)` → `serializeIntelHex()` → blob download as `update.eep`

## Conventions

- **Always commit and push** after making changes
- `pnpm` only (pnpm-workspace.yaml present)
- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Tailwind 4 + shadcn/ui; path alias `@/` → `src/`
- Vite base path `/Satelite/` for GitHub Pages
- No CRC/checksum on the whole file — only per-line Intel HEX checksums are validated
- Empty satellite slots have name `" #UNDEFINED SAT "` with placeholder frequencies
- Hex color palette uses fixed HSL values (inline styles) — not Tailwind classes — because the colors are data-driven
