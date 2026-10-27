import { createCanvas } from "@napi-rs/canvas"
import { writeFile } from "node:fs/promises"

// Keep the existing favicon artwork inside the maskable icon's safe area.
for (const [file, size] of [
  ["pwa-192.png", 192],
  ["pwa-512.png", 512],
  ["pwa-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#f6f5ff"
  ctx.fillRect(0, 0, size, size)
  ctx.translate(size * 0.18, size * 0.18)
  ctx.scale(size * 0.02, size * 0.02)
  ctx.fillStyle = "#6366f1"
  ctx.beginPath()
  ctx.roundRect(5, 3, 18, 24, 3)
  ctx.fill()
  ctx.fillStyle = "#a5b4fc"
  ctx.strokeStyle = "#4f46e5"
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(9, 6, 18, 24, 3)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.8
  ctx.lineCap = "round"
  ctx.beginPath()
  for (const [y, end] of [[13, 23], [17, 23], [21, 19]]) {
    ctx.moveTo(13, y)
    ctx.lineTo(end, y)
  }
  ctx.stroke()
  await writeFile(new URL(`../public/${file}`, import.meta.url), canvas.toBuffer("image/png"))
}
