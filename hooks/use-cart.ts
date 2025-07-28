"use client"
import { useState, useEffect } from "react"
import { delhaizeCart, type CartItem } from "@/utils/delhaize-cart"

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [itemCount, setItemCount] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const updateCartDisplay = () => {
    if (typeof window !== "undefined") {
      const items = delhaizeCart.getItems()
      const count = delhaizeCart.getItemCount()
      setCartItems(items)
      setItemCount(count)
    }
  }

  useEffect(() => {
    // Initial load
    updateCartDisplay()
    setIsLoaded(true)

    // Listen for storage changes to update cart across tabs
    const handleStorageChange = () => {
      updateCartDisplay()
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange)

      // Also update every few seconds to catch changes from the same tab
      const interval = setInterval(updateCartDisplay, 2000)

      return () => {
        window.removeEventListener("storage", handleStorageChange)
        clearInterval(interval)
      }
    }
  }, [])

  return {
    cartItems,
    itemCount,
    isLoaded,
    updateCartDisplay,
  }
}
