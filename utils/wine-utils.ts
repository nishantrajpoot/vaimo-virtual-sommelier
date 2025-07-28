// @ts-nocheck
import type { Wine, WineColor, PriceRange } from "@/types/wine"

export const categorizeWineByName = (productName: string): WineColor => {
  const name = productName.toLowerCase()
  const category = ""
  const color = ""

  // Check explicit color field first
  if (color.includes("rouge") || color.includes("red")) return "red"
  if (color.includes("blanc") || color.includes("white")) return "white"
  if (color.includes("rosé") || color.includes("rose")) return "rose"
  if (color.includes("mousseux") || color.includes("sparkling") || color.includes("champagne")) return "sparkling"

  // Check category
  if (category.includes("rouge") || category.includes("red")) return "red"
  if (category.includes("blanc") || category.includes("white")) return "white"
  if (category.includes("rosé") || category.includes("rose")) return "rose"
  if (category.includes("mousseux") || category.includes("sparkling") || category.includes("champagne"))
    return "sparkling"

  // Fallback to name analysis
  if (
    name.includes("champagne") ||
    name.includes("mousseux") ||
    name.includes("bulles") ||
    name.includes("brut") ||
    name.includes("demi-sec") ||
    name.includes("effervescent") ||
    name.includes("prosecco") ||
    name.includes("cava")
  ) {
    return "sparkling"
  }

  if (name.includes("rosé") || name.includes("rose") || name.includes("gris")) {
    return "rose"
  }

  if (
    name.includes("rouge") ||
    name.includes("red") ||
    name.includes("cabernet") ||
    name.includes("merlot") ||
    name.includes("syrah") ||
    name.includes("shiraz") ||
    name.includes("pinotage") ||
    name.includes("pinot noir") ||
    name.includes("bourgueil") ||
    name.includes("saint-estèphe") ||
    name.includes("saint-émilion") ||
    name.includes("margaux") ||
    name.includes("haut-médoc") ||
    name.includes("pessac-léognan")
  ) {
    return "red"
  }

  // Default to white
  return "white"
}

export const getPriceRange = (price: number): PriceRange => {
  if (price <= 10) return "budget"
  if (price <= 25) return "mid"
  if (price <= 50) return "premium"
  return "luxury"
}

export const filterWinesByPreferences = (
  wines: Wine[],
  color?: WineColor,
  priceRange?: PriceRange,
  searchTerm?: string,
): Wine[] => {
  return wines.filter((wine) => {
    const wineColor = categorizeWineByName(wine.productName)
    const winePriceRange = getPriceRange(wine.price)

    if (color && wineColor !== color) return false
    if (priceRange && winePriceRange !== priceRange) return false
    if (searchTerm && !wine.productName.toLowerCase().includes(searchTerm.toLowerCase())) return false

    return true
  })
}

export const getWineRecommendations = (
  wines: Wine[],
  preferences: {
    color?: WineColor
    priceRange?: PriceRange
    occasion?: string
    food?: string
  },
  limit = 3,
): Wine[] => {
  let filtered = wines

  if (preferences.color) {
    filtered = filterWinesByPreferences(filtered, preferences.color)
  }

  if (preferences.priceRange) {
    filtered = filterWinesByPreferences(filtered, undefined, preferences.priceRange)
  }

  // Sort by price and rating (using price as a proxy for quality)
  filtered.sort((a, b) => {
    if (preferences.priceRange === "budget") return a.price - b.price
    if (preferences.priceRange === "luxury") return b.price - a.price
    return Math.abs(a.price - 15) - Math.abs(b.price - 15) // Mid-range preference
  })

  return filtered.slice(0, limit)
}

export const getFoodPairingSuggestions = (wineColor: WineColor): string[] => {
  const pairings = {
    red: [
      "Grilled red meats (beef, lamb)",
      "Aged cheeses (cheddar, gouda)",
      "Pasta with tomato-based sauces",
      "Dark chocolate desserts",
      "Roasted vegetables",
    ],
    white: [
      "Seafood and fish dishes",
      "Poultry (chicken, turkey)",
      "Creamy pasta dishes",
      "Fresh salads",
      "Soft cheeses (brie, camembert)",
    ],
    rose: [
      "Light appetizers and charcuterie",
      "Grilled salmon or tuna",
      "Mediterranean cuisine",
      "Fresh fruit desserts",
      "Goat cheese salads",
    ],
    sparkling: [
      "Oysters and shellfish",
      "Fried foods and appetizers",
      "Celebration cakes",
      "Sushi and sashimi",
      "Nuts and olives",
    ],
  }

  return pairings[wineColor] || []
}
