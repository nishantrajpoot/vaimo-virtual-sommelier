"use client"
import { useState } from "react"
import { ShoppingCart, X, Trash2, ExternalLink, List, Copy } from "lucide-react"
import type { Language } from "@/types/wine"
import { getTranslation } from "@/utils/translations"
import { delhaizeCart } from "@/utils/delhaize-cart"
import { useCart } from "@/hooks/use-cart"

interface CartIndicatorProps {
  language: Language
}

export function CartIndicator({ language }: CartIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const { cartItems, itemCount, isLoaded, updateCartDisplay } = useCart()

  const handleRemoveItem = (wineId: string) => {
    delhaizeCart.removeItem(wineId)
    updateCartDisplay()
  }

  const handleClearCart = () => {
    delhaizeCart.clearCart()
    updateCartDisplay()
  }

  const handleGoToDelhaize = () => {
    // Open general Delhaize wine section
    window.open("https://www.delhaize.be/fr/shop/Vins-and-bulles", "_blank", "noopener,noreferrer")
  }

  const generateShoppingList = () => {
    const listText = cartItems
      .map(
        (item, index) =>
          `${index + 1}. ${item.wine.Product_name} (${item.wine.Price}) x${item.quantity}\n   ${item.wine.URL}`,
      )
      .join("\n\n")

    return `🍷 WINE SHOPPING LIST 🍷\n\n${listText}\n\nTotal: €${delhaizeCart.getTotalPrice().toFixed(2)}`
  }

  const copyShoppingList = async () => {
    try {
      await navigator.clipboard.writeText(generateShoppingList())
      alert(getTranslation(language, "listCopied"))
    } catch (err) {
      console.error("Failed to copy shopping list:", err)
    }
  }

  // Don't render until loaded and only if there are items
  if (!isLoaded || itemCount === 0) return null

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center z-40"
      >
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          )}
        </div>
      </button>

      {/* Cart Popup */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-green-600 text-white">
              <h3 className="font-semibold">{getTranslation(language, "cartTitle")}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShoppingList(!showShoppingList)}
                  className="hover:bg-green-700 p-1 rounded"
                  title={getTranslation(language, "toggleShoppingList")}
                >
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="hover:bg-green-700 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cart Items or Shopping List */}
            <div className="flex-1 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{getTranslation(language, "emptyCart")}</p>
              ) : showShoppingList ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{getTranslation(language, "shoppingList")}</h4>
                    <button
                      onClick={copyShoppingList}
                      className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    >
                      <Copy className="w-3 h-3" />
                      {getTranslation(language, "copy")}
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-3">
                    {cartItems.map((item, index) => (
                      <div key={item.wine.URL} className="border-b border-gray-200 pb-2 last:border-b-0">
                        <div className="font-medium">
                          {index + 1}. {item.wine.Product_name}
                        </div>
                        <div className="text-gray-600">
                          {item.wine.Price} × {item.quantity} = €{(
                            parseFloat(
                              item.wine.Price.replace(/[^0-9,.-]/g, "").replace(",", "."),
                            ) * item.quantity
                          ).toFixed(2)}
                        </div>
                        <a
                          href={item.wine.URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs break-all"
                        >
                          {item.wine.URL}
                        </a>
                      </div>
                    ))}
                    <div className="font-bold text-green-600 pt-2 border-t border-gray-300">
                      {getTranslation(language, "total")}: €{delhaizeCart.getTotalPrice().toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.wine.URL} className="flex gap-3 p-3 border border-gray-200 rounded-lg">
                      <img
                        src={item.wine.image_URL || "/placeholder.svg"}
                        alt={item.wine.Product_name}
                        className="w-12 h-15 object-cover rounded"
                        crossOrigin="anonymous"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-2">{item.wine.Product_name}</h4>
                        <div className="text-xs text-gray-600 mt-1">
                          {item.wine.Price} × {item.quantity} = €{(
                            parseFloat(item.wine.Price.replace(/[^0-9,.-]/g, "").replace(",", ".")) * item.quantity
                          ).toFixed(2)}
                        </div>
                        <a
                          href={item.wine.URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {getTranslation(language, "viewOnDelhaize")}
                        </a>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.wine.URL)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3">
                <div className="flex justify-between items-center font-semibold">
                  <span>{getTranslation(language, "total")}:</span>
                  <span>€{delhaizeCart.getTotalPrice().toFixed(2)}</span>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                  <p className="text-yellow-800 font-medium mb-1">{getTranslation(language, "cartNotice")}</p>
                  <p className="text-yellow-700 text-xs">{getTranslation(language, "cartInstructions")}</p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleGoToDelhaize}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {getTranslation(language, "goToDelhaize")}
                    <ExternalLink className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleClearCart}
                    className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    {getTranslation(language, "clearCart")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
