export interface Wine {
  // Unique UUID assigned via data scripts
  id: string
  Product_name: string
  Price: string
  Price_per_liter: string
  Wine_Varieties: string
  vegetarian: string
  vegan: string
  food_pairing: string[]
  image_URL: string
  URL: string
  country_origin: string
  Wine_Description: string
  promotion: string
  Alcohol_percentage: string
  Volume: string
  Type_of_Cap: string
  Type_of_wine: string
  Color: string
  Type_of_Box: string
  Vintage: string | null
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  // For recommendation messages, attach the specific wines
  recommendations?: Wine[]
}

export type Language = "en" | "fr" | "nl"
export type WineColor = "red" | "white" | "rose" | "sparkling"
export type PriceRange = "budget" | "mid" | "premium" | "luxury"
