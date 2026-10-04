/**
 * The Hack screen and keyboard, as devices on the emulator's memory.
 *
 * There is nothing to the screen but 8192 words starting at 16384, one bit
 * a pixel, least significant bit leftmost. The keyboard is one word at
 * 24576 holding the code of the key that is down. Both are ordinary RAM, so
 * the emulator needs to know nothing about either: this reads the one and
 * writes the other.
 */
import { ADDR, type Emulator } from '@sm/emulator'

const WIDTH = 512
const HEIGHT = 256

/** The course's codes for the keys that are not their own character. */
const KEYS: Readonly<Record<string, number>> = {
  Enter: 128, Backspace: 129, ArrowLeft: 130, ArrowUp: 131, ArrowRight: 132,
  ArrowDown: 133, Home: 134, End: 135, PageUp: 136, PageDown: 137,
  Insert: 138, Delete: 139, Escape: 140,
}

function codeOf(event: KeyboardEvent): number | undefined {
  const named = KEYS[event.key]
  if (named !== undefined) return named
  if (event.key.length === 1) return event.key.charCodeAt(0)
  if (/^F([1-9]|1[0-2])$/.test(event.key)) return 140 + Number(event.key.slice(1))
  return undefined
}

export interface ScreenView {
  readonly element: HTMLElement
  draw(): void
}

export function screenView(emulator: Emulator): ScreenView {
  const canvas = el()
  canvas.width = WIDTH
  canvas.height = HEIGHT
  canvas.className = 'screen'
  canvas.tabIndex = 0
  const context = canvas.getContext('2d')
  const image = context?.createImageData(WIDTH, HEIGHT)

  canvas.addEventListener('keydown', (event) => {
    const code = codeOf(event)
    if (code === undefined) return
    event.preventDefault()
    emulator.memory.set(ADDR.KEYBOARD, code)
  })
  canvas.addEventListener('keyup', (event) => {
    event.preventDefault()
    emulator.memory.set(ADDR.KEYBOARD, 0)
  })
  // A key held while the focus goes elsewhere would otherwise stay down.
  canvas.addEventListener('blur', () => emulator.memory.set(ADDR.KEYBOARD, 0))

  function draw(): void {
    if (context === null || context === undefined || image === undefined) return
    const words = emulator.memory.slice(ADDR.SCREEN_BASE, ADDR.SCREEN_TOP + 1)
    const data = image.data
    let pixel = 0
    for (const word of words) {
      for (let bit = 0; bit < 16; bit++) {
        const on = ((word >> bit) & 1) === 1
        const v = on ? 0 : 255
        const at = pixel * 4
        data[at] = v
        data[at + 1] = v
        data[at + 2] = v
        data[at + 3] = 255
        pixel++
      }
    }
    context.putImageData(image, 0, 0)
  }

  draw()
  return { element: canvas, draw }
}

function el(): HTMLCanvasElement {
  return document.createElement('canvas')
}
