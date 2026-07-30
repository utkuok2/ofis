import React from 'react'
import { useOfisStore } from '../../store/useOfisStore'
import type { AktifPanel } from '../../types'

const panelItems: { key: AktifPanel; label: string; icon: string }[] = [
  { key: 'harita', label: 'Ofis Haritası', icon: '🏢' },
  { key: 'yonetim', label: 'Yönetim', icon: '⚙️' },
  { key: 'sohbet', label: 'Sohbet', icon: '💬' },
]

export function Header() {
  const { aktifPanel, setAktifPanel, kullanici } = useOfisStore()

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 select-none">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">Ofis</span>
        <button
          onClick={() => {
            if (confirm('Veritabanı sıfırlansın mı? Tüm veriler silinecek ve sayfa yenilenecek.')) {
              localStorage.clear()
              indexedDB.deleteDatabase('ofis')
              window.location.reload()
            }
          }}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
          title="Veritabanını Sıfırla"
        >
          ↺
        </button>
        <span className="text-xs text-gray-400">AI Çalışma Alanı</span>
      </div>
      <div className="flex gap-1">
        {panelItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setAktifPanel(item.key)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              aktifPanel === item.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span>👤 {kullanici?.ad || 'Ben'}</span>
      </div>
    </div>
  )
}
