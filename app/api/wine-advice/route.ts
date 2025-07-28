// @ts-nocheck
import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Language, Wine } from "@/types/wine"

// Helper to parse price strings like "13,99 €" -> 13.99
function parsePrice(priceStr: string): number {
  const num = priceStr.replace(/[^0-9,.-]/g, '').replace(',', '.')
  return parseFloat(num) || 0
}

export async function POST(request: NextRequest) {
  try {
    const { message, language, wines, excludeIds, history } = await request.json()
    // Initialize candidate set, applying exclusion of already shown IDs and price constraints
    let candidates: Wine[] = wines
    // Exclude previously shown
    if (Array.isArray(excludeIds) && excludeIds.length > 0) {
      candidates = candidates.filter((w) => !excludeIds.includes(w.id))
    }
    // Apply price filters if requested
    const text = message.toLowerCase()
    let priceMatch
    if ((priceMatch = text.match(/(?:above|over|greater than)\s*(\d+)/i))) {
      const threshold = parseFloat(priceMatch[1])
      candidates = candidates.filter((w) => parsePrice(w.Price) > threshold)
    } else if ((priceMatch = text.match(/(?:under|less than|below)\s*(\d+)/i))) {
      const threshold = parseFloat(priceMatch[1])
      candidates = candidates.filter((w) => parsePrice(w.Price) < threshold)
    }
    // Interpret generic 'expensive' or 'premium'
    else if (/\b(expensive|premium|high[- ]end|luxury)\b/i.test(text)) {
      // Compute 75th percentile price
      const prices = candidates.map((w) => parsePrice(w.Price)).sort((a, b) => a - b)
      if (prices.length > 0) {
        const idx = Math.floor(prices.length * 0.75)
        const threshold = prices[idx]
        candidates = candidates.filter((w) => parsePrice(w.Price) >= threshold)
      }
    }
    // 'candidates' already excludes shown IDs and price constraints
    const dataset = candidates

    // Generate AI response with filtered candidate dataset
    // Include conversation history so AI retains context
    let systemPrompt = getSystemPrompt(language, dataset)
    if (Array.isArray(history) && history.length > 0) {
      const convo = history
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join("\n")
      systemPrompt += `\n\nConversation history:\n${convo}`
    }
    let userPrompt = `User query: "${message}"

Please analyze this query and recommend 3-4 specific wines from the available dataset. Consider:
- Wine preferences (color, type, grape variety)
- Budget constraints 
- Food pairings mentioned
- Occasion or context
- Handle typos and variations intelligently (e.g., "red-wine" = "red wine")
- When recommending wines, take into account the "food_pairing", "color", "type", "grape_variety", "price", "volume", "promotion", "country_origin", "Vegetarian", "Vegan" fields of the dataset
- In the context of food pairings suggestions, take into account the "food_pairing" field of the dataset

Respond with wine advice and explain your recommendations.`
    // Instruct AI to exclude already recommended wines
    if (Array.isArray(excludeIds) && excludeIds.length > 0) {
      userPrompt += `\n\nExclude these wine IDs from recommendations: ${JSON.stringify(excludeIds)}`
    }

    try {
      // Check if API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.warn("OpenAI API key not found, using fallback response")
        const fallbackRecs = getSimpleFallback(message, wines)
        return NextResponse.json({
          message: generateFallbackResponse(message, wines, language),
          recommendations: fallbackRecs,
        })
      }

      const { text } = await generateText({
        // Use high-performance GPT-4 model
        model: openai("gpt-4o"),
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 500,
      })

      // Extract wine recommendations from GPT response
      const recommendations = extractRecommendationsFromResponse(text, dataset)
      const recs = recommendations.length > 0 ? recommendations : getSimpleFallback(message, dataset)
      return NextResponse.json({
        message: text,
        recommendations: recs,
      })
    } catch (error) {
      console.error("AI service error:", error)
      // Fallback to non-AI response if API fails
      const fallbackRecs = getSimpleFallback(message, wines)
      return NextResponse.json({
        message: generateFallbackResponse(message, wines, language),
        recommendations: fallbackRecs,
      })
    }
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Simple fallback: pick wines based on basic keyword match in message
 */
function getSimpleFallback(message: string, wines: Wine[]): Wine[] {
  const lower = message.toLowerCase()
  let filtered: Wine[] = []
  if (lower.includes("red")) {
    filtered = wines.filter((w) => w.Color?.toLowerCase() === "red")
  } else if (lower.includes("white")) {
    filtered = wines.filter((w) => w.Color?.toLowerCase() === "white")
  } else if (lower.includes("ros") || lower.includes("rose")) {
    filtered = wines.filter((w) => w.Color?.toLowerCase() === "rose")
  } else if (lower.includes("sparkling") || lower.includes("bubbl")) {
    filtered = wines.filter((w) => w.Color?.toLowerCase() === "sparkling")
  }
  if (filtered.length >= 3) {
    return filtered.slice(0, 3)
  }
  // default first 3
  return wines.slice(0, 3)
}

/**
 * Extract up to 4 wine recommendations by matching their UUIDs in the AI response.
 */
function extractRecommendationsFromResponse(response: string, wines: Wine[]): Wine[] {
  // 1) Try to parse explicit ID list
  const idSection = response.match(/RECOMMENDED_IDS:?\s*\[([^\]]+)\]/i)
  if (idSection) {    
    const ids = idSection[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/"/g, "").trim())
      .filter((s) => s)
    const found = wines.filter((wine) => ids.includes(wine.id!))
    if (found.length > 0) {
      return found.slice(0, 4)
    }
  }
  // 2) Fallback to name-based matching if no IDs found
  const recsByName: Wine[] = []
  const responseText = response.toLowerCase()
  for (const wine of wines) {
    if (recsByName.length >= 4) break
    if (wine.Product_name && responseText.includes(wine.Product_name.toLowerCase())) {
      recsByName.push(wine)
    }
  }
  if (recsByName.length > 0) {
    return recsByName
  }
  // 3) Fallback to category-based selection
  return getIntelligentFallback(wines)
}

function getSystemPrompt(language: Language, wines: Wine[]): string {
  // Provide a limited wine dataset sample as context (reduce token size)
  const wineDataSample = wines.slice(0, 20).map((wine) => ({
    id: wine.id,
    name: wine.Product_name,
    price: wine.Price,
    volume: wine.Volume,
    discount: wine.promotion,
    link: wine.URL,
  }))

  const prompts = {
    en: `You are a professional wine sommelier for Delhaize with access to their complete wine inventory.

WINE DATASET SAMPLE:
${JSON.stringify(wineDataSample, null, 2)}

Your capabilities:
- Intelligently interpret user queries, including typos and variations
- Handle queries like "red-wine", "red wine", "rouge vin", etc. as the same request
- Recommend specific wines from the Delhaize inventory
   - Provide expert wine advice and food pairings
   - When the user mentions price constraints (e.g., "expensive", "under 20"), parse the Price field (e.g., "13,99 €") into a numeric value and filter accordingly
   - Consider budget, occasion, and preferences, using the Price field as numeric

Guidelines:
- Always recommend 3-4 specific wines from the available inventory
- Mention exact wine names from the dataset
- Explain why each wine fits the user's request
- Handle spelling variations and typos gracefully
- Consider price ranges, wine types, and occasions
- Provide food pairing suggestions when relevant
- Be enthusiastic but professional   
`,

    fr: `Vous êtes un sommelier professionnel pour Delhaize avec accès à leur inventaire complet de vins.

ÉCHANTILLON DE DONNÉES VINS:
${JSON.stringify(wineDataSample, null, 2)}

Vos capacités:
- Interpréter intelligemment les requêtes utilisateur, y compris les fautes de frappe et variations
- Gérer les requêtes comme "vin-rouge", "vin rouge", "red wine", etc. comme la même demande
- Recommander des vins spécifiques de l'inventaire Delhaize
- Fournir des conseils d'expert et accords mets-vins
- Considérer le budget, l'occasion, et les préférences

Directives:
- Recommandez toujours 3-4 vins spécifiques de l'inventaire disponible
- Mentionnez les noms exacts des vins du dataset
- Expliquez pourquoi chaque vin correspond à la demande
- Gérez les variations d'orthographe et fautes de frappe avec souplesse
- Considérez les gammes de prix, types de vins, et occasions
- Fournissez des suggestions d'accords mets-vins quand pertinent
- Soyez enthousiaste mais professionnel`,

    nl: `U bent een professionele wijn sommelier voor Delhaize met toegang tot hun complete wijnvoorraad.

WIJN DATASET VOORBEELD:
${JSON.stringify(wineDataSample, null, 2)}

Uw mogelijkheden:
- Intelligent interpreteren van gebruikersverzoeken, inclusief typefouten en variaties
- Verzoeken zoals "rode-wijn", "rode wijn", "red wine", etc. als hetzelfde verzoek behandelen
- Specifieke wijnen aanbevelen uit de Delhaize voorraad
- Deskundig wijnadvies en spijs-wijn combinaties geven
- Budget, gelegenheid en voorkeuren overwegen

Richtlijnen:
- Beveel altijd 3-4 specifieke wijnen aan uit de beschikbare voorraad
- Noem exacte wijnnamen uit de dataset
- Leg uit waarom elke wijn past bij het verzoek
- Behandel spellingsvariaties en typefouten soepel
- Overweeg prijsklassen, wijntypes en gelegenheden
- Geef spijs-wijn combinatie suggesties wanneer relevant
- Wees enthousiast maar professioneel`,
  }

  return prompts[language]
}

function getIntelligentFallback(wines: Wine[]): Wine[] {
  // Return a diverse selection across different categories and price points
  const categories = {
    red: wines.filter(
      (w) =>
        w.Product_name.toLowerCase().includes("rouge") ||
        w.Product_name.toLowerCase().includes("red") ||
        w.Product_name.toLowerCase().includes("merlot") ||
        w.Product_name.toLowerCase().includes("cabernet") ||
        w.Product_name.toLowerCase().includes("syrah"),
    ),
    white: wines.filter(
      (w) =>
        w.Product_name.toLowerCase().includes("blanc") ||
        w.Product_name.toLowerCase().includes("white") ||
        w.Product_name.toLowerCase().includes("chardonnay") ||
        w.Product_name.toLowerCase().includes("sauvignon"),
    ),
    sparkling: wines.filter(
      (w) =>
        w.Product_name.toLowerCase().includes("champagne") ||
        w.Product_name.toLowerCase().includes("mousseux") ||
        w.Product_name.toLowerCase().includes("brut"),
    ),
    rose: wines.filter(
      (w) =>
        w.Product_name.toLowerCase().includes("rosé") ||
        w.Product_name.toLowerCase().includes("rose") ||
        w.Product_name.toLowerCase().includes("gris"),
    ),
  }

  const recommendations: Wine[] = []

  // Add one from each category if available
  if (categories.red.length > 0) recommendations.push(categories.red[0])
  if (categories.white.length > 0) recommendations.push(categories.white[0])
  if (categories.sparkling.length > 0) recommendations.push(categories.sparkling[0])
  if (categories.rose.length > 0) recommendations.push(categories.rose[0])

  // Fill remaining slots with diverse price points
  while (recommendations.length < 4 && recommendations.length < wines.length) {
    const remaining = wines.filter((w) => !recommendations.includes(w))
    if (remaining.length > 0) {
      recommendations.push(remaining[0])
    } else {
      break
    }
  }

  return recommendations.slice(0, 4)
}

function getAskForPreferencesMessage(language: Language): string {
  const messages = {
    en: "I'd be happy to help you find the perfect wine! To give you the best recommendations, could you tell me:\n\n• What color wine do you prefer? (Red, White, Rosé, or Sparkling)\n• What's your budget range? (Budget: €0-10, Mid-range: €10-25, Premium: €25-50, Luxury: €50+)\n• What's the occasion or what food will you be pairing it with?",
    fr: "Je serais ravi de vous aider à trouver le vin parfait ! Pour vous donner les meilleures recommandations, pourriez-vous me dire :\n\n• Quelle couleur de vin préférez-vous ? (Rouge, Blanc, Rosé, ou Effervescent)\n• Quelle est votre gamme de budget ? (Économique : €0-10, Milieu de gamme : €10-25, Premium : €25-50, Luxe : €50+)\n• Quelle est l'occasion ou avec quels plats l'accompagnerez-vous ?",
    nl: "Ik help u graag de perfecte wijn te vinden! Om u de beste aanbevelingen te geven, kunt u me vertellen:\n\n• Welke wijnkleur heeft uw voorkeur? (Rood, Wit, Rosé, of Mousserende)\n• Wat is uw budgetbereik? (Budget: €0-10, Middensegment: €10-25, Premium: €25-50, Luxe: €50+)\n• Wat is de gelegenheid of bij welk eten wilt u de wijn combineren?",
  }

  return messages[language]
}

function generateFallbackResponse(message: string, wines: Wine[], language: Language): string {
  const responses = {
    en: "Based on your preferences, here are some excellent wine options from our Delhaize selection. These wines would be perfect for your needs!",
    fr: "Basé sur vos préférences, voici d'excellentes options de vin de notre sélection Delhaize. Ces vins seraient parfaits pour vos besoins !",
    nl: "Op basis van uw voorkeuren zijn hier enkele uitstekende wijnopties uit onze Delhaize selectie. Deze wijnen zouden perfect zijn voor uw behoeften!",
  }

  return responses[language]
}
