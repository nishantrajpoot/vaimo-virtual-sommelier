"use client"
import { useState, useEffect } from "react"
import ReactDOM from "react-dom"
import { X, ExternalLink, Euro, ShoppingCart, Plus, Check } from "lucide-react"
import type { Wine, Language } from "@/types/wine"
import { getTranslation } from "@/utils/translations"
import { delhaizeCart } from "@/utils/delhaize-cart"
import { ChevronDown, ChevronUp } from "lucide-react";

interface WinePopupProps {
  wine: Wine
  language: Language
  isOpen: boolean
  onClose: () => void
}

export function WinePopup({ wine, language, isOpen, onClose }: WinePopupProps) {
  const [isAddedToCart, setIsAddedToCart] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isClient, setIsClient] = useState(false)
  // track mount to avoid SSR portal issues
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Initialize client-side state when popup opens
  useEffect(() => {
    setMounted(true)
    if (!isOpen || !wine) return
    setIsClient(true)
    if (typeof window !== "undefined") {
      setIsAddedToCart(delhaizeCart.isInCart(wine.URL))
      setQuantity(delhaizeCart.getItemQuantity(wine.URL) || 1)
    }
  }, [isOpen, wine])

  const handleAddToCart = () => {
    if (typeof window === "undefined") return

    const success = delhaizeCart.addItem(wine, quantity)
    if (success) {
      setIsAddedToCart(true)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= 10) {
      setQuantity(newQuantity)
      if (isAddedToCart && typeof window !== "undefined") {
        delhaizeCart.updateQuantity(wine.URL, newQuantity)
      }
    }
  }

  const handleRemoveFromCart = () => {
    if (typeof window === "undefined") return

    delhaizeCart.removeItem(wine.URL)
    setIsAddedToCart(false)
    setQuantity(1)
  }

  const handleGoToWinePage = () => {
    // Open the specific wine page on Delhaize
    if (wine.URL) {
      window.open(wine.URL, "_blank", "noopener,noreferrer")
    } else {
      // Fallback to general Delhaize wine section
      window.open("https://www.delhaize.be/fr/shop/Vins-and-bulles", "_blank", "noopener,noreferrer")
    }
  }

  const handleGoToDelhaizeWithCart = () => {
    // Open Delhaize with cart data
    const cartUrl = delhaizeCart.generateDelhaizeCartUrl()
    window.open(cartUrl, "_blank", "noopener,noreferrer")
  }

  if (!isOpen || !mounted) return null
  // Render modal in portal so positioning is relative to viewport, not chatbot container
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
      {/* Bounce-in animation for popup */}
      <div className="animate-bounce-in bg-white rounded-lg shadow-xl max-w-md w-auto max-h-[85vh] overflow-y-auto wine-popup">
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-gray-200 rounded-t-lg red-title-strip">
          <h3 className="font-semibold text-sm wine-title">{wine.Product_name}</h3>
          <button onClick={onClose} className="hover:bg-red-700 p-1 rounded close-popup">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Wine Image */}
          <div className="flex justify-center mb-4 wine-image">
            <div className="circle-bg"></div>
            <img
              src={wine.image_URL || "/placeholder.svg?height=160&width=128"}
              alt={wine.Product_name}
              className="w-32 h-40 object-cover rounded-lg shadow-sm thumbnail"
              crossOrigin="anonymous"
            />
          </div>
          {/* Wine Name */}
          {/* <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">{wine.Product_name}</h2> */}

          {/* Wine Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-center text-base font-semibold text-gray-800 gap-4 wine-price">
              {wine.Price && (
                <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-md price-value">
                  {wine.Price}
                </span>
                {/* <span className="text-gray-500 text-xs label">Price</span> */}
                </div>
              )}
            </div>
            {/* Description */}
            {wine.Wine_Description && (
              <div className="">

                <div className="relative text-xs text-gray-700 mt-1">
                  <div className={`${showFullDesc ? '' : 'line-clamp-1'}`}>
                    {wine.Wine_Description}
                  </div>

                  {/* Toggle Button */}
                  {wine.Wine_Description.length > 100 && ( // Optional: only show toggle if text is long
                    <button
                      onClick={() => setShowFullDesc(!showFullDesc)}
                      className="mt-1 text-red-600 hover:underline focus:outline-none"
                    >
                      {showFullDesc ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* Additional Wine Details */}
            {wine.Volume && (
              <div className="flex items-center">
                <span className="text-gray-600 text-xs">Volume</span>
                <span className="ml-2 flex-1 text-right font-medium text-xs">
                  {wine.Volume}
                </span>
              </div>
            )}
            {wine.Price_per_liter && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-xs">Price per liter:</span>
                <span className="font-medium text-xs">{wine.Price_per_liter}</span>
              </div>
            )}
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center justify-between w-full mt-4 py-2 text-gray-800 font-semibold rounded-md transition text-sm"
            >
              More Details
              {open ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>

            {open && (
              <div className="mt-4 space-y-2 text-sm px-2 more-details">

              {wine.Wine_Varieties && (
                <div className="flex items-center">
                  <span className="text-gray-600 text-xs">Varieties:</span>
                  <span className="ml-2 flex-1 text-right font-medium text-xs">
                    {wine.Wine_Varieties}
                  </span>
                </div>
              )}

               {wine.Alcohol_percentage && (
              <div className="flex items-center">
                <span className="text-gray-600 text-xs">Alcohol %</span>
                <span className="ml-2 flex-1 text-right font-medium text-xs">
                  {wine.Alcohol_percentage}
                </span>
              </div>
            )}

                {wine.food_pairing && wine.food_pairing.length > 0 && (
                  <div className="flex items-start justify-between">
                    <span className="text-gray-600 text-xs">{getTranslation(language, "foodPairing")}</span>
                    <span className="font-medium text-xs text-gray-700 text-right">
                      {wine.food_pairing.join(', ')}
                    </span>
                  </div>
                )}

                {wine.country_origin && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Origin:</span>
                    <span className="font-medium text-xs">{wine.country_origin}</span>
                  </div>
                )}
                {wine.Type_of_wine && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Type:</span>
                    <span className="font-medium text-xs">{wine.Type_of_wine}</span>
                  </div>
                )}
                {wine.Color && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Color:</span>
                    <span className="font-medium text-xs">{wine.Color}</span>
                  </div>
                )}
                {wine.Vintage && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">Vintage:</span>
                    <span className="font-medium text-xs">{wine.Vintage}</span>
                  </div>
                )}
                {wine.promotion && wine.promotion !== "null" && wine.promotion !== "" && wine.promotion !== "0" && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-xs">{getTranslation(language, "discount")}:</span>
                <span className="font-bold text-red-600 text-xs">{wine.promotion}</span>
              </div>
            )}
              </div>
            )}
          </div>
          {/* Quantity Selector */}
          <div className="flex items-center justify-center mb-4 rounded-lg quantity-selector">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
                className="w-8 h-8 rounded disabled:cursor-not-allowed flex items-center justify-center deduct"
              >
                -
              </button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <button
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= 10}
                className="w-8 h-8 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center add"
              >
                +
              </button>
            </div>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-700 text-sm">{getTranslation(language, "addedToCart")}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 flex gap-4 action-buttons">
            {!isAddedToCart ? (
              <button
                onClick={handleAddToCart}
                className="w-full flex items-center justify-center text-white bg-red-600 p-3 rounded hover:bg-red-600 transition-colors text-sm add-to-cart-btn"
              >
                <ShoppingCart className="w-5 h-5" />
              </button>
            ) : (
              <div className="space-y-2">
                <div className="w-full flex items-center justify-center gap-2 bg-green-100 text-green-700 px-4 py-3 rounded border border-green-300">
                  <Check className="w-4 h-4" />
                  {getTranslation(language, "inCart")} ({delhaizeCart.getItemQuantity(wine.URL)})
                </div>
                <button
                  onClick={handleRemoveFromCart}
                  className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  {getTranslation(language, "removeFromCart")}
                </button>
              </div>
            )}

            {/* Direct wine page button */}
            <button
              onClick={handleGoToWinePage}
              className="w-full flex items-center justify-center gap-2 bg-transparent text-white px-4 py-3 rounded hover:bg-transparent transition-colors font-medium text-sm go-to-wine"
            >
              <ExternalLink className="w-4 h-4" />
              {getTranslation(language, "viewOnDelhaize")}
            </button>

            {/* Cart-based shopping button */}
            {delhaizeCart.getItemCount() > 0 && (
              <button
                onClick={handleGoToDelhaizeWithCart}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                {getTranslation(language, "shopWithCart")} ({delhaizeCart.getItemCount()})
              </button>
            )}

            {/* <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {getTranslation(language, "close")}
            </button> */}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
