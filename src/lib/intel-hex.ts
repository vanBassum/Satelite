export function parseIntelHex(text: string): Uint8Array {
  const lines = text.split(/\r?\n/).filter(l => l.startsWith(":"))

  let maxAddr = 0
  for (const line of lines) {
    const count = parseInt(line.slice(1, 3), 16)
    const addr = parseInt(line.slice(3, 7), 16)
    const type = parseInt(line.slice(7, 9), 16)
    if (type === 0x00) maxAddr = Math.max(maxAddr, addr + count)
  }

  const buf = new Uint8Array(maxAddr).fill(0xff)
  for (const line of lines) {
    const count = parseInt(line.slice(1, 3), 16)
    const addr = parseInt(line.slice(3, 7), 16)
    const type = parseInt(line.slice(7, 9), 16)
    if (type === 0x00) {
      for (let i = 0; i < count; i++) {
        buf[addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16)
      }
    }
  }

  return buf
}

export function serializeIntelHex(buf: Uint8Array): string {
  const BYTES_PER_LINE = 16
  const lines: string[] = []

  for (let addr = 0; addr < buf.length; addr += BYTES_PER_LINE) {
    const end = Math.min(addr + BYTES_PER_LINE, buf.length)
    const count = end - addr
    let sum = count + ((addr >> 8) & 0xff) + (addr & 0xff)
    let dataHex = ""

    for (let i = addr; i < end; i++) {
      dataHex += buf[i].toString(16).padStart(2, "0").toUpperCase()
      sum += buf[i]
    }

    const checksum = ((~sum + 1) & 0xff).toString(16).padStart(2, "0").toUpperCase()
    const addrHex = addr.toString(16).padStart(4, "0").toUpperCase()
    const countHex = count.toString(16).padStart(2, "0").toUpperCase()

    lines.push(`:${countHex}${addrHex}00${dataHex}${checksum}`)
  }

  lines.push(":00000001FF")
  return lines.join("\r\n") + "\r\n"
}
