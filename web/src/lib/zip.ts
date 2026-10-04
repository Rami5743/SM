/**
 * A zip file, written by hand.
 *
 * Only what is needed to hand someone a folder: entries stored without
 * compression, no directory entries, no extra fields. That is forty lines
 * and no dependency, where a library would be a megabyte to save bytes
 * nobody is counting.
 */
const TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Bytes): number {
  let c = 0xffffffff
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

type Bytes = Uint8Array<ArrayBuffer>

interface Chunk {
  readonly name: Bytes
  readonly data: Bytes
  readonly crc: number
  offset: number
}

function u16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff]
}

function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

export function zip(files: Readonly<Record<string, string>>): Blob {
  const encoder = new TextEncoder()
  const chunks: Chunk[] = Object.entries(files).map(([name, text]) => {
    const data = encoder.encode(text) as Bytes
    return { name: encoder.encode(name) as Bytes, data, crc: crc32(data), offset: 0 }
  })

  const parts: BlobPart[] = []
  let at = 0
  for (const chunk of chunks) {
    chunk.offset = at
    // Local file header: no compression, no time, sizes known in advance.
    const header = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(chunk.crc), ...u32(chunk.data.length), ...u32(chunk.data.length),
      ...u16(chunk.name.length), ...u16(0),
    ])
    parts.push(header, chunk.name, chunk.data)
    at += header.length + chunk.name.length + chunk.data.length
  }

  const start = at
  for (const chunk of chunks) {
    const entry = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(chunk.crc), ...u32(chunk.data.length), ...u32(chunk.data.length),
      ...u16(chunk.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(chunk.offset),
    ])
    parts.push(entry, chunk.name)
    at += entry.length + chunk.name.length
  }

  parts.push(new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(chunks.length), ...u16(chunks.length),
    ...u32(at - start), ...u32(start), ...u16(0),
  ]))

  return new Blob(parts, { type: 'application/zip' })
}

/** Hand the reader a file. */
export function download(name: string, content: Blob | string): void {
  const blob = typeof content === 'string'
    ? new Blob([content], { type: 'text/plain;charset=utf-8' })
    : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
