import React from 'react'
import { useOfisStore } from '../../store/useOfisStore'

export function BildirimToast() {
  const { bildirimler, bildirimKaldir } = useOfisStore()

  if (bildirimler.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {bildirimler.map((b) => (
        <div
          key={b.id}
          onClick={() => bildirimKaldir(b.id)}
          className={`px-4 py-2 rounded shadow-lg text-sm cursor-pointer transition-all ${
            b.tur === 'basarili'
              ? 'bg-green-700 text-white'
              : b.tur === 'hata'
              ? 'bg-red-700 text-white'
              : 'bg-blue-700 text-white'
          }`}
        >
          {b.mesaj}
        </div>
      ))}
    </div>
  )
}
