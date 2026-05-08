# update.eep — EEPROM Byte Map

Source: `update.eep` (Intel-HEX, 8503 bytes). Decoded payload: **2881 bytes** (`0x000` – `0xB40`), little-endian.

---

## Top-Level Layout

| Range | Size | Region |
|---|---|---|
| `0x000` – `0x025` | 38 B | Boot / header constants (magic, pointers) |
| `0x026` – `0x0A5` | 128 B | Reserved / device config |
| `0x0A6` – `0x0FF` | 90 B | Hardware-model name table (6 × 16 B strings) |
| `0x100` – `0x1F5` | 246 B | Zero-fill / unused |
| `0x1F6` – `0x1FF` | 10 B | Tail block of header (`FF FF FF 46 02 04 01 3A 02 E8`) |
| `0x200` – `0x36D` | 366 B | Lookup table — 183 × `0x03E7` (= 999) u16-LE entries |
| `0x36E` – `0x37A` | 13 B | Zero / separator (`… 99 AA 55`) |
| `0x37B` – `0x389` | 15 B | Build label, ASCII (`UEU/30MAR2009`) |
| `0x38A` – `0x3FF` | 118 B | Reserved + sat-count/marker (`0x10` = 16 active sats at `0x3FF`) |
| **`0x400` – `0xB3F`** | **1856 B** | **Satellite table — 29 records × 64 B** |
| `0xB40` | 1 B | Trailer (`0x55`) |

EOF record in the HEX file: `:00000001FF`

---

## Header Constants (`0x00` – `0x25`)

| Offset | Bytes | Meaning |
|---|---|---|
| `0x00` | `FF` | Pad |
| `0x01` – `0x02` | `3C 03` | u16-LE = `0x033C` (828) — likely a checksum/CRC seed or table size |
| `0x03` – `0x06` | `00 00 00 00` | Reserved |
| `0x07` – `0x08` | `08 04` | u16-LE `0x0408` (1032) — pointer |
| `0x09` – `0x0A` | `00 00` | — |
| `0x0B` – `0x0C` | `08 04` | Duplicate of `0x07`–`0x08` |
| `0x0D` – `0x14` | `FF…00` | Pad / zero |
| `0x15` | `00` | — |
| `0x16` – `0x1F` | `2D × 9 + 00` | ASCII filler `"---------"` (visible separator) |
| `0x20` – `0x29` | `00 × 10` | Zero |
| `0x2A` – `0x2B` | `4C 04` | u16-LE `0x044C` = **1100** — likely `freq_ref` (LO base frequency) |
| `0x2C` – `0x2D` | `00 00` | — |
| `0x2E` – `0x2F` | `DC 05` | `0x05DC` = **1500** |
| `0x30` – `0x31` | `62 07` | `0x0762` = **1890** |
| `0x32` – `0x37` | misc u16-LE | Motor / DiSEqC timings: `0x000A`, `0x000A`, `0x0C4E` |
| `0x38` – `0x80` | — | Servo / motor / system parameters (positions, limits, speeds) |
| `0x81` – `0xA5` | — | Reserved / zero |

> The sub-blocks `0x2A`–`0x80` are the **mechanical and tuner config** — motor end-stops, slew speed, LO frequency etc. They need a separate reverse-engineering pass. Leave untouched when re-flashing unless you know what you are changing.

---

## Hardware-Model Strings (`0x0A6` – `0x0FF`)

Six fixed-width 16-byte ASCII slots. Selects which UI/firmware variant is active.

| Slot | Offset | String |
|---|---|---|
| 0 | `0x0A6` | `Cosmo Vision` |
| 1 | `0x0B6` | `Caro Vision TWIN` |
| 2 | `0x0C6` | `Samy Vision` |
| 3 | `0x0D6` | `Oyster Vision 2+` |
| 4 | `0x0E6` | `Caro Vision 2+` |
| 5 | `0x0F6` | `Spare1` |

---

## Lookup Table (`0x200` – `0x36D`)

183 × 16-bit little-endian entries, every entry = `0x03E7` (= 999). Almost certainly a **default/sentinel table** — e.g. "channel-not-set" placeholders for 183 program slots, or per-degree azimuth markers. Edit only if you know what you are doing.

---

## Build Label (`0x37B` – `0x389`)

ASCII, NUL-padded. Current value: **`UEU/30MAR2009`** — internal version stamp written by the original Ten-Haaft tooling.

---

## Satellite Table (`0x400` – `0xB3F`)

Fixed array of **29 records, each 64 bytes** (16 named satellites + 13 `#UNDEFINED SAT` empty slots).

### Record Layout

Offsets are relative to the start of each 64 B record.

| Offset | Size | Field | Encoding | Notes |
|---|---|---|---|---|
| `+0x00` | 16 B | `name` | ASCII, space-padded | e.g. `" Astra 1 "` |
| `+0x10` | 1 B | `flags` | bit-field | `0xC0` Astra 1, `0x1A` Astra 2, `0x82` HotBird, `0x00` empty — bit meaning TBD; bit 7 ≈ "in use" |
| `+0x11` | 10 B | `reserved_a` | usually zero | Possibly orbital position / DiSEqC port; empty slots: `00 00 00 00 00 CC 29 00 00 00` |
| `+0x1B` | 8 B | `freq[4]` | 4 × u16-LE | Transponder frequency in **MHz** |
| `+0x23` | 8 B | `srate[4]` | 4 × u16-LE | Symbol rate in **kS/s** (e.g. `0x6B6C` = 27500, `0x55F0` = 22000, `0x7530` = 30000, `0x6478` = 25720) |
| `+0x2B` | 4 B | `pol[4]` | 1 byte each | Polarization / band: `0x00` = H, `0x01` = V (LNB tone bit may be in a higher nibble) |
| `+0x2F` | 8 B | `reserved_b` | zero | Likely PIDs or NID/TID for a default reference TP |
| `+0x37` | 4 B | `fec_mod[4]` | 1 byte each | FEC / modulation, nibble-packed: `0x12` = ?/2-of-3, `0x13` = ?/3-of-4, `0x15` = ?/5-of-6 (high nibble = mod, low nibble = FEC code — to be confirmed) |
| `+0x3B` | 5 B | `pad` | zero | Record padding to 64 B |

### Verified Examples

**Astra 1 @ `0x400`**
```
name    = " Astra 1 "
flags   = 0xC0
freqs   = 10744, 11244, 11107, 12552 MHz   (real Astra 1, 19.2°E)
srates  = 22000, 22000, 22000, 22000 kS/s
pol     = H, H, V, V
fec_mod = 0x15 0x15 0x15 0x15
```

**Astra 2 @ `0x440`**
```
name         = " Astra 2 "
flags        = 0x1A
reserved_a[0]= 0x01
freqs        = 11265, 11553, 12207, 11345 MHz   (real Astra 2, 28.2°E)
srates       = 27500, 22000, 27500, 27500 kS/s
pol          = V, H, V, V
fec_mod      = 0x12 0x15 0x15 0x15
```

**HotBird @ `0x4C0`**
```
name    = " HotBird "
flags   = 0x82
freqs   = 11008, 12596, 11008, 11137 MHz   (real HotBird, 13.0°E)
srates  = 27500, 27500, 27500, 27500 kS/s
pol     = V, V, V, H
fec_mod = 0x12 0x13 0x12 0x13
```

### All Record Start Offsets

| Offset | Satellite | Offset | Satellite |
|---|---|---|---|
| `0x400` | Astra 1 | `0x740` | Eutelsat 33 |
| `0x440` | Astra 2 | `0x780` | Hellas Sat 2 |
| `0x480` | Astra 3 | `0x7C0` | Türksat |
| `0x4C0` | HotBird | `0x800` | #UNDEFINED SAT (slot 16) |
| `0x500` | Eutelsat 5 West | `0x840` | #UNDEFINED SAT (slot 17) |
| `0x540` | Thor/Intel 10-02 | `0x880` | #UNDEFINED SAT (slot 18) |
| `0x580` | Astra 4 | `0x8C0` | #UNDEFINED SAT (slot 19) |
| `0x5C0` | Eutelsat 16 | `0x900` | #UNDEFINED SAT (slot 20) |
| `0x600` | Eutelsat 7 | `0x940` | #UNDEFINED SAT (slot 21) |
| `0x640` | Amos | `0x980` | #UNDEFINED SAT (slot 22) |
| `0x680` | Hispasat | `0x9C0` | #UNDEFINED SAT (slot 23) |
| `0x6C0` | Telstar 12 | `0xA00` | #UNDEFINED SAT (slot 24) |
| `0x700` | Eutelsat 9 | `0xA40` | #UNDEFINED SAT (slot 25) |
| | | `0xA80` | #UNDEFINED SAT (slot 26) |
| | | `0xAC0` | #UNDEFINED SAT (slot 27) |
| | | `0xB00` | #UNDEFINED SAT (slot 28) |

Empty slots share the same template:
```
" #UNDEFINED SAT "  00 ... 00 CC 29 00 00 00 00 00 00 ... 00 00 ... 98 3A 00 ...
```
Where `0x29CC` = 10700 and `0x3A98` = 15000 are placeholder Ku band-edge frequencies.

---

## Trailer

`0xB40` = `0x55` — single byte end marker. The rest of the original chip is `0xFF`. The HEX file closes with `:00000001FF` (Intel-HEX EOF record).

---

## What's Still TBD

1. **`flags` byte at `+0x10`** — exact bit meaning per satellite (visible / skip / locked / favourite).
2. **`reserved_a` (10 B)** — orbital position is almost certainly encoded here (BCD or u16-LE in tenths of a degree). Need a known satellite with non-zero bytes to pin it down.
3. **`pol` byte** — confirm whether bit 0 = V/H, bit 1 = 22 kHz tone, bit 2 = LNB band-select.
4. **`fec_mod` byte** — high vs low nibble split (mod vs FEC code) needs cross-checking against a transponder with a known FEC rate.
5. **Header config `0x2A`–`0x80`** — motor / LO / DiSEqC parameters; not needed for satellite-frequency edits but must be left untouched when re-flashing.
6. **Checksum/CRC** — the `0x033C` at offset `0x01` may need recalculation after edits. The Intel-HEX file has per-line checksums already validated; no global CRC has been confirmed yet.
