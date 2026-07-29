import React, { useEffect, useRef, useCallback } from 'react'
import { useOfisStore } from '../../store/useOfisStore'

const TILE_SIZE = 40
const MAP_COLS = 30
const MAP_ROWS = 20

function düzZemin() {
  const grid: string[][] = []
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: string[] = []
    for (let c = 0; c < MAP_COLS; c++) {
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        row.push('duvar')
      } else if (r === 1 && c > 1 && c < MAP_COLS - 2 && c !== 10 && c !== 20) {
        row.push('koridor')
      } else {
        row.push('zemin')
      }
    }
    grid.push(row)
  }
  return grid
}

export function OfficeMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { kullanici, ekipler, ekipGruplari, kullaniciHareket } = useOfisStore()
  const gridRef = useRef(düzZemin())

  const ciz = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !kullanici) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = MAP_COLS * TILE_SIZE
    const h = MAP_ROWS * TILE_SIZE
    canvas.width = w
    canvas.height = h

    const grid = gridRef.current

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const x = c * TILE_SIZE
        const y = r * TILE_SIZE
        const tile = grid[r][c]

        if (tile === 'duvar') {
          ctx.fillStyle = '#4a5568'
        } else if (tile === 'koridor') {
          ctx.fillStyle = '#cbd5e0'
        } else {
          ctx.fillStyle = '#e2e8f0'
        }
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.strokeStyle = '#a0aec0'
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE)
      }
    }

    for (const ekip of ekipler) {
      const grp = ekipGruplari.find((g) => g.id === ekip.ekip_grubu_id)
      const ex = ekip.oda_konum_x
      const ey = ekip.oda_konum_y
      const ew = ekip.oda_genislik
      const eh = ekip.oda_yukseklik

      ctx.fillStyle = grp?.renk || '#4A90D9'
      ctx.globalAlpha = 0.2
      ctx.fillRect(ex, ey, ew, eh)
      ctx.globalAlpha = 1

      ctx.strokeStyle = grp?.renk || '#4A90D9'
      ctx.lineWidth = 2
      ctx.strokeRect(ex, ey, ew, eh)

      ctx.fillStyle = '#1a202c'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(ekip.ad, ex + 8, ey + 20)

      ctx.fillStyle = '#4a5568'
      ctx.font = '10px sans-serif'
      if (ekip.yonetici_adi) {
        ctx.fillText(`👤 ${ekip.yonetici_adi}`, ex + 8, ey + 36)
      }
      if (ekip.ai_model_adi) {
        ctx.fillText(`🤖 ${ekip.ai_model_adi}`, ex + 8, ey + 50)
      }
    }

    if (kullanici) {
      ctx.beginPath()
      ctx.arc(kullanici.konum_x, kullanici.konum_y, 12, 0, Math.PI * 2)
      ctx.fillStyle = '#4299e1'
      ctx.fill()
      ctx.strokeStyle = '#2b6cb0'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = 'white'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('👤', kullanici.konum_x, kullanici.konum_y + 4)
    }
  }, [kullanici, ekipler, ekipGruplari])

  useEffect(() => {
    ciz()
  }, [ciz])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const step = 10
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          kullaniciHareket(0, -step)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          kullaniciHareket(0, step)
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          kullaniciHareket(-step, 0)
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          kullaniciHareket(step, 0)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [kullaniciHareket])

  return (
    <div className="flex-1 overflow-auto bg-gray-800">
      <canvas
        ref={canvasRef}
        className="mx-auto"
        style={{ minWidth: MAP_COLS * TILE_SIZE, minHeight: MAP_ROWS * TILE_SIZE }}
      />
      <div className="absolute bottom-4 left-4 bg-gray-900/80 px-3 py-2 rounded text-xs text-gray-400">
        WASD / Ok tuşları ile hareket et
      </div>
    </div>
  )
}
