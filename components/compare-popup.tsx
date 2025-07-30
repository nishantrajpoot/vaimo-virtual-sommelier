"use client"

import React, { useEffect, useState } from "react"
import type { Wine, Language, ChatMessage } from "@/types/wine"
import { X, ShoppingCart } from "lucide-react"
import { getTranslation } from "@/utils/translations"
import { WinePopup } from "./wine-popup"
import { delhaizeCart } from "@/utils/delhaize-cart"

interface ComparePopupProps {
  wines: Wine[]
  language: Language
  // Recommendation comments aligned by index
  recommendationComments?: string[]
  isOpen: boolean
  onClose: () => void
}


export function ComparePopup({ wines, language, recommendationComments, isOpen, onClose }: ComparePopupProps) {
  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const [selectedWine, setSelectedWine] = useState<Wine | null>(null)
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 bg-red-600 text-white rounded-t-lg">
          <h3 className="text-lg font-semibold">{getTranslation(language, 'compare')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-red-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border p-2 whitespace-nowrap">Sr.</th>
                <th className="border p-2 whitespace-nowrap">Name</th>
                <th className="border p-2 whitespace-nowrap">{getTranslation(language, 'price')}</th>
                <th className="border p-2 whitespace-nowrap">{getTranslation(language, 'volume')}</th>
                <th className="border p-2 whitespace-nowrap">Alcohol %</th>
                <th className="border p-2 whitespace-nowrap">{getTranslation(language, 'color')}</th>
                <th className="border p-2 whitespace-nowrap">Origin</th>
                <th className="border p-2 whitespace-nowrap">Vintage</th>
                <th className="border p-2 whitespace-nowrap">Promo</th>
                <th className="border p-2 whitespace-nowrap">Recommendation</th>
                <th className="border p-2 whitespace-nowrap">{getTranslation(language, 'foodPairing').replace(/:$/, '')}</th>
                <th className="border p-2 whitespace-nowrap">Details</th>
                <th className="border p-2 whitespace-nowrap text-center">
                  <ShoppingCart className="w-4 h-4 mx-auto text-gray-700" />
                </th>
              </tr>
            </thead>
            <tbody>
              {wines.map((wine, idx) => (
              <tr key={wine.id} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2 text-sm text-center">{idx + 1}</td>
                <td className="border p-2 text-sm">{wine.Product_name}</td>
                <td className="border p-2 text-sm whitespace-nowrap">{wine.Price}</td>
                <td className="border p-2 text-sm whitespace-nowrap">
                  {(() => {
                    const volRaw = wine.Volume?.toLowerCase().replace(/\s/g, '') || ''
                    // Handle centiliters
                    const clMatch = volRaw.match(/(\d+)cl$/)
                    if (clMatch) {
                      const clVal = parseInt(clMatch[1], 10)
                      if (clVal > 99) {
                        const lVal = clVal / 100
                        return `${Number.isInteger(lVal) ? lVal : lVal}l`
                      }
                      return `${clVal}cl`
                    }
                    // Handle liters
                    const lMatch = volRaw.match(/([0-9.,]+)l$/)
                    if (lMatch) {
                      const lVal = parseFloat(lMatch[1].replace(',', '.'))
                      return `${Number.isInteger(lVal) ? lVal : lVal}l`
                    }
                    return wine.Volume
                  })()}
                </td>
                <td className="border p-2 text-sm whitespace-nowrap">
                  {wine.Alcohol_percentage ? `${wine.Alcohol_percentage}%` : ''}
                </td>
                <td className="border p-2 text-sm">{wine.Color}</td>
                <td className="border p-2 text-sm">
                  {wine.country_origin}
                </td>
                <td className="border p-2 text-sm whitespace-nowrap">{wine.Vintage}</td>
                <td className="border p-2 text-sm text-center">
                  {wine.promotion && wine.promotion !== 'null' && wine.promotion !== '' && wine.promotion !== '0' ? (
                    <span className="text-red-600 font-semibold">{wine.promotion}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border p-2 text-sm">
                  {recommendationComments && recommendationComments[idx]
                    ? recommendationComments[idx]
                    : '-'}
                </td>
                <td className="border p-2 text-sm pr-4 text-right">{(wine.food_pairing || []).join(', ')}</td>
                <td className="border p-2 text-sm text-center">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setSelectedWine(wine)}
                  >
                    {getTranslation(language, 'viewProduct')}
                  </button>
                </td>
                <td className="border p-2 text-sm text-center">
                  <button
                    className="text-green-600 hover:text-green-800"
                    onClick={() => {
                      delhaizeCart.addItem(wine)
                      window.dispatchEvent(new Event('storage'))
                    }}
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </button>
                </td>
              </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
     </div>
      {/* Details Popup */}
      <WinePopup
        wine={selectedWine!}
        language={language}
        isOpen={!!selectedWine}
        onClose={() => setSelectedWine(null)}
      />
    </>
  )
}
