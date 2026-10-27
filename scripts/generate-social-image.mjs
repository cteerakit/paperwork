import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'

GlobalFonts.registerFromPath('public/fonts/NotoSans-Regular.ttf', 'Noto')
GlobalFonts.registerFromPath('public/fonts/NotoSans-Bold.ttf', 'Noto Bold')
const canvas = createCanvas(1200, 630)
const c = canvas.getContext('2d')
c.fillStyle = '#f6f5ff'
c.fillRect(0, 0, 1200, 630)
c.fillStyle = '#6366f1'
c.fillRect(0, 0, 1200, 10)
function rect(x, y, w, h, r, color) {
  c.fillStyle = color
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fill()
}
function text(value, x, y, size, color, bold = false) {
  c.font = `${size}px "${bold ? 'Noto Bold' : 'Noto'}"`
  c.fillStyle = color
  c.fillText(value, x, y)
}
rect(68, 65, 30, 40, 5, '#6366f1')
rect(77, 73, 30, 40, 5, '#a5b4fc')
text('Paperwork', 124, 104, 34, '#282443', true)
text('Everyday', 68, 234, 70, '#211e37', true)
text('PDF tools.', 68, 321, 70, '#4f46e5', true)
text('Merge, split, sign, and more.', 71, 388, 27, '#625c77')
rect(70, 453, 157, 43, 21, '#e6e3ff')
text('No sign-up', 90, 482, 21, '#4f46e5', true)
text('Your files stay on your device.', 71, 551, 23, '#625c77')
c.save()
c.translate(876, 305)
c.rotate(-0.14)
rect(-119, -173, 250, 332, 19, '#c7c3f7')
c.restore()
c.save()
c.translate(907, 312)
c.rotate(0.09)
c.shadowColor = '#312e8130'
c.shadowBlur = 35
c.shadowOffsetY = 16
rect(-120, -166, 250, 332, 19, '#ffffff')
c.shadowColor = 'transparent'
rect(-88, -125, 70, 31, 8, '#eeecff')
text('PDF', -75, -103, 19, '#6366f1', true)
for (let i = 0; i < 4; i++) rect(-87, -58 + i * 28, i === 3 ? 112 : 176, 8, 4, '#e5e3ef')
c.strokeStyle = '#6366f1'
c.lineWidth = 4
c.lineCap = 'round'
c.beginPath()
c.moveTo(-70, 102)
c.bezierCurveTo(0, 20, -40, 145, 12, 90)
c.bezierCurveTo(40, 60, 20, 125, 82, 85)
c.stroke()
c.restore()
rect(990, 420, 90, 90, 26, '#4f46e5')
c.strokeStyle = '#ffffff'
c.lineWidth = 7
c.beginPath()
c.moveTo(1015, 465)
c.lineTo(1031, 481)
c.lineTo(1058, 450)
c.stroke()
writeFileSync('public/og.png', canvas.toBuffer('image/png'))
