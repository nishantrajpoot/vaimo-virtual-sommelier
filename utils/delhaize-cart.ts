import type { Wine } from "@/types/wine"

export interface CartItem {
  wine: Wine
  quantity: number
  addedAt: Date
}

const CART_STORAGE_KEY = "delhaize-cart-items"
const MAX_CART_ITEMS = 20

// Helper: parse price string like "13,99 €" to number
function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9,.-]/g, "").replace(",", ".")
  return parseFloat(cleaned) || 0
}

export class DelhaizeCart {
  private items: CartItem[] = []

  constructor() {
    // Only load from storage if we're in the browser
    if (typeof window !== "undefined") {
      this.loadFromStorage()
    }
  }

  private loadFromStorage(): void {
    // Check if we're in the browser environment
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return
    }

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        this.items = JSON.parse(stored).map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }))
      }
    } catch (error) {
      console.error("Error loading cart from storage:", error)
      this.items = []
    }
  }

  private saveToStorage(): void {
    // Check if we're in the browser environment
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return
    }

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items))
    } catch (error) {
      console.error("Error saving cart to storage:", error)
    }
  }

  addItem(wine: Wine, quantity = 1): boolean {
    // Use URL as unique identifier
    const id = wine.URL
    const existingIndex = this.items.findIndex((item) => item.wine.URL === id)

    if (existingIndex >= 0) {
      // Update quantity of existing item
      this.items[existingIndex].quantity += quantity
      this.items[existingIndex].addedAt = new Date()
    } else {
      // Add new item
      if (this.items.length >= MAX_CART_ITEMS) {
        return false // Cart is full
      }

      this.items.push({
        wine,
        quantity,
        addedAt: new Date(),
      })
    }

    this.saveToStorage()
    return true
  }

  removeItem(wineUrl: string): void {
    this.items = this.items.filter((item) => item.wine.URL !== wineUrl)
    this.saveToStorage()
  }

  updateQuantity(wineUrl: string, quantity: number): void {
    const index = this.items.findIndex((item) => item.wine.URL === wineUrl)
    if (index >= 0) {
      if (quantity <= 0) {
        this.removeItem(wineUrl)
      } else {
        this.items[index].quantity = quantity
        this.saveToStorage()
      }
    }
  }

  getItems(): CartItem[] {
    return [...this.items]
  }

  getItemCount(): number {
    return this.items.reduce((total, item) => total + item.quantity, 0)
  }

  getTotalPrice(): number {
    return this.items.reduce(
      (total, item) => total + parsePrice(item.wine.Price) * item.quantity,
      0,
    )
  }

  isInCart(wineUrl: string): boolean {
    return this.items.some((item) => item.wine.URL === wineUrl)
  }

  getItemQuantity(wineUrl: string): number {
    const item = this.items.find((item) => item.wine.URL === wineUrl)
    return item ? item.quantity : 0
  }

  clearCart(): void {
    this.items = []
    this.saveToStorage()
  }

  // Generate URL with cart items as query parameters for Delhaize
  generateDelhaizeCartUrl(): string {
    if (this.items.length === 0) {
      return "https://www.delhaize.be/fr/shop"
    }

    // Create a simplified cart data structure
    const cartData = this.items.map((item) => ({
      id: item.wine.URL,
      name: item.wine.Product_name,
      price: parsePrice(item.wine.Price),
      quantity: item.quantity,
      url: item.wine.URL,
    }))

    // Encode cart data as base64 for URL
    const encodedCart = btoa(JSON.stringify(cartData))

    // Return Delhaize URL with cart data (this would need to be implemented by Delhaize)
    // For now, we'll use a custom parameter that could be processed by a browser extension or script
    return `https://www.delhaize.be/fr/shop?sommelier_cart=${encodedCart}`
  }

  // Export cart data for external processing
  exportCartData(): string {
    return JSON.stringify(this.items, null, 2)
  }

  // Import cart data
  importCartData(data: string): boolean {
    try {
      const imported = JSON.parse(data)
      this.items = imported.map((item: any) => ({
        ...item,
        addedAt: new Date(item.addedAt),
      }))
      this.saveToStorage()
      return true
    } catch (error) {
      console.error("Error importing cart data:", error)
      return false
    }
  }
}

// Export singleton instance
export const delhaizeCart = new DelhaizeCart()
