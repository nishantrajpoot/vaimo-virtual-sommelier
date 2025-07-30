// @ts-nocheck
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Wine, Language } from "@/types/wine"

export interface WineQuery {
  message: string
  language: Language
  wines: Wine[]
}

export interface WineResponse {
  message: string
  recommendations?: Wine[]
  foodPairings?: string[]
  needsMoreInfo?: boolean
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// @ts-nocheck
// Suppress type incompatibilities with AI SDK
export async function getWineAdvice(query: WineQuery): Promise<WineResponse> {
  
// to add randomness in data
  /*const { message, language, wines } = query*/

  const { message, language } = query
  const wines = shuffle(query.wines)


  // Generate AI response with full wine dataset
  const systemPrompt = getSystemPrompt(language, wines)
  let userPrompt = `User query: "${message}"

Available wines dataset:
${JSON.stringify(wines, null, 2)}

Please analyze this query intelligently and recommend 7-8 specific wines from the dataset. Handle typos and variations (like "red-wine" vs "red wine") gracefully. Consider wine preferences, budget, food pairings, and occasion.`
  // Exclude any wine IDs already recommended
  if ((query as any).excludeIds?.length > 0) {
    userPrompt += `\n\nExclude these wine IDs: ${JSON.stringify((query as any).excludeIds)}`
  }

  try {
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not found, using fallback response")
      return {
        message: generateFallbackResponse(message, wines, language),
        recommendations: wines.slice(0, 3),
      }
    }

    const { text } = await generateText({
      // Use GPT-4 model for higher quality
      model: openai("gpt-4o"),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 500,
    })

    // Extract wine recommendations from GPT response
    const recommendations = extractRecommendationsFromResponse(text, wines)

    return {
      message: text,
      recommendations: recommendations.length > 0 ? recommendations : wines.slice(0, 8),
    }
  } catch (error) {
    console.error("AI service error:", error)
    // Fallback to non-AI response if API fails
    return {
      message: generateFallbackResponse(message, wines, language),
      recommendations: wines.slice(0, 8),
    }
  }
}

/**
 * Extract up to 8 wine recommendations by matching their UUIDs in the AI response.
 */
function extractRecommendationsFromResponse(response: string, wines: Wine[]): Wine[] {
  // 1) Parse explicit ID list from response
  
  /*
  const idSection = response.match(/RECOMMENDED_IDS:?\s*\[([^\]]+)\]/i)
  if (idSection) {
    const ids = idSection[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/"/g, "").trim())
      .filter(Boolean)
    const found = wines.filter((wine) => ids.includes(wine.id!))
    if (found.length > 0) return found.slice(0, 8)
  }
  */

  const idSection = response.match(/RECOMMENDED_IDS:?\s*\[([^\]]+)\]/i)
  if (idSection) {
    const ids = idSection[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/"/g, "").trim())
      .filter(Boolean)

      // Create a quick ID → wine lookup map
    const wineMap = new Map(wines.map(w => [w.id, w]))

    // Map IDs to wines in the exact order given by the model
    const foundOrdered = ids
      .map(id => wineMap.get(id))
      .filter((wine): wine is Wine => Boolean(wine)) // remove undefined
    if (foundOrdered.length > 0) return foundOrdered.slice(0, 8)
  }

  
  // 2) Fallback to exact name matching from numbered list in response
  const lines = response.split(/\r?\n/);
  const numbered = lines.filter((l) => /^\s*\d+\./.test(l)); // only numbered lines
  
  // Create a map of normalized product names for fast lookup
  const nameMap = new Map(
    wines.map((w) => [w.Product_name.trim().toLowerCase(), w])
  );
  
  const exactMatches: Wine[] = [];
  
  for (const line of numbered) {
    if (exactMatches.length >= 8) break;
  
    // Remove leading number and trim
    const fullLine = line.replace(/^\s*\d+\.\s*/, '').trim().toLowerCase();
  
    // Match full line to full product name (case-insensitive)
    const wine = nameMap.get(fullLine);
  
    if (wine) {
      exactMatches.push(wine);
    }
  }
  
  if (exactMatches.length > 0) {
    return exactMatches;
  }
  
  // Optional fallback logic (optional but good to keep)
  const recsByName: Wine[] = [];
  const responseText = response.toLowerCase();
  
  const winesByNameLength = [...wines].sort(
    (a, b) => (b.Product_name?.length || 0) - (a.Product_name?.length || 0)
  );
  
  for (const wine of winesByNameLength) {
    if (recsByName.length >= 8) break;
  
    const name = wine.Product_name?.toLowerCase();
    if (name && responseText.includes(name)) {
      recsByName.push(wine);
    }
  }
  if (recsByName.length > 0) {
    return recsByName
  }
  // 3) Fallback to category-based selection
  return getIntelligentFallback(wines)
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

function generateFallbackResponse(message: string, wines: Wine[], language: Language): string {
  const responses = {
    en: {
      greeting: "I'd be happy to help you find the perfect wine!",
      foundWines:
        wines.length > 0
          ? `I found ${wines.length} excellent options for you:`
          : "Let me suggest some wines from our selection:",
      wineDetails: wines.length > 0 ? wines.map((wine) => `• ${wine.Product_name} - €${wine.Price}`).join("\n") : "",
      closing: "These wines are available at Delhaize and would be perfect for your needs!",
    },
    fr: {
      greeting: "Je serais ravi de vous aider à trouver le vin parfait !",
      foundWines:
        wines.length > 0
          ? `J'ai trouvé ${wines.length} excellentes options pour vous :`
          : "Permettez-moi de vous suggérer quelques vins de notre sélection :",
      wineDetails: wines.length > 0 ? wines.map((wine) => `• ${wine.Product_name} - €${wine.Price}`).join("\n") : "",
      closing: "Ces vins sont disponibles chez Delhaize et seraient parfaits pour vos besoins !",
    },
    nl: {
      greeting: "Ik help u graag de perfecte wijn te vinden!",
      foundWines:
        wines.length > 0
          ? `Ik heb ${wines.length} uitstekende opties voor u gevonden:`
          : "Laat me enkele wijnen uit onze selectie voorstellen:",
      wineDetails: wines.length > 0 ? wines.map((wine) => `• ${wine.Product_name} - €${wine.Price}`).join("\n") : "",
      closing: "Deze wijnen zijn verkrijgbaar bij Delhaize en zouden perfect zijn voor uw behoeften!",
    },
  }

  const resp = responses[language]

  let response = resp.greeting

  response += `.\n\n${resp.foundWines}`

  if (resp.wineDetails) {
    response += `\n\n${resp.wineDetails}`
  }

  response += `\n\n${resp.closing}`

  return response
}

function getSystemPrompt(language: Language, wines: Wine[]): string {
  // Provide the full wine dataset as context
  const wineDataSample = wines.map((wine) => ({
    id: wine.id,
    name: wine.Product_name,
    price: wine.Price,
    volume: wine.Volume,
    color: wine.Color,
    type: wine.Type_of_wine,
    discount: wine.promotion
  }))

  const prompts = {
    en: `You are a professional wine sommelier for Delhaize with access to their complete wine inventory. 

Your capabilities:
- Intelligently interpret user queries, including typos and variations
- Handle queries like "red-wine", "red wine", "rouge vin", etc. as the same request  
- Recommend specific wines from the Delhaize inventory
   - Provide expert wine advice and food pairings
   - When user mentions price constraints (e.g. "expensive", "under 20"), parse the Price field (e.g. "13,99 €") as a numeric value and filter accordingly.  
   - Treat words like "expensive", "premium", "high-end", or "luxury" as request for top 25% by price
   - Consider budget, occasion, and preferences, converting Price field to numbers for price-based filtering

Guidelines:
- Always recommend 7-8 specific wines from the available inventory
- Mention exact wine names from the dataset
- Explain why each wine fits the user's request
- Handle spelling variations and typos gracefully
- Consider price ranges, wine types, and occasions
   - Provide food pairing suggestions when relevant
   - Be enthusiastic but professional
   - After listing 7-8 wines, append exactly:
     RECOMMENDED_IDS: ["<id1>", "<id2>", ...]
     where each <id> matches the 'id' field in the wine data
`,

    fr: `Vous êtes un sommelier professionnel pour Delhaize avec accès à leur inventaire complet de vins.

Vos capacités:
- Interpréter intelligemment les requêtes utilisateur, y compris les fautes de frappe et variations
- Gérer les requêtes comme "vin-rouge", "vin rouge", "red wine", etc. comme la même demande
- Recommander des vins spécifiques de l'inventaire Delhaize
- Fournir des conseils d'expert et accords mets-vins
- Considérer le budget, l'occasion, et les préférences

Directives:
- Recommandez toujours 7-8 vins spécifiques de l'inventaire disponible
- Mentionnez les noms exacts des vins du dataset
- Expliquez pourquoi chaque vin correspond à la demande
- Gérez les variations d'orthographe et fautes de frappe avec souplesse
- Considérez les gammes de prix, types de vins, et occasions
- Fournissez des suggestions d'accords mets-vins quand pertinent
- Soyez enthousiaste mais professionnel`,

    nl: `U bent een professionele wijn sommelier voor Delhaize met toegang tot hun complete wijnvoorraad.

Uw mogelijkheden:
- Intelligent interpreteren van gebruikersverzoeken, inclusief typefouten en variaties
- Verzoeken zoals "rode-wijn", "rode wijn", "red wine", etc. als hetzelfde verzoek behandelen
- Specifieke wijnen aanbevelen uit de Delhaize voorraad
- Deskundig wijnadvies en spijs-wijn combinaties geven
- Budget, gelegenheid en voorkeuren overwegen

Richtlijnen:
- Beveel altijd 7-8 specifieke wijnen aan uit de beschikbare voorraad
- Noem exacte wijnnamen uit de dataset
- Leg uit waarom elke wijn past bij het verzoek
- Behandel spellingsvariaties en typefouten soepel
- Overweeg prijsklassen, wijntypes en gelegenheden
- Geef spijs-wijn combinatie suggesties wanneer relevant
- Wees enthousiast maar professioneel`,
  }

  return prompts[language]
}

function getAskForPreferencesMessage(language: Language): string {
  const messages = {
    en: "I'd be happy to help you find the perfect wine! To give you the best recommendations, could you tell me:\n\n• What color wine do you prefer? (Red, White, Rosé, or Sparkling)\n• What's your budget range? (Budget: €0-10, Mid-range: €10-25, Premium: €25-50, Luxury: €50+)\n• What's the occasion or what food will you be pairing it with?",
    fr: "Je serais ravi de vous aider à trouver le vin parfait ! Pour vous donner les meilleures recommandations, pourriez-vous me dire :\n\n• Quelle couleur de vin préférez-vous ? (Rouge, Blanc, Rosé, ou Effervescent)\n• Quelle est votre gamme de budget ? (Économique : €0-10, Milieu de gamme : €10-25, Premium : €25-50, Luxe : €50+)\n• Quelle est l'occasion ou avec quels plats l'accompagnerez-vous ?",
    nl: "Ik help u graag de perfecte wijn te vinden! Om u de beste aanbevelingen te geven, kunt u me vertellen:\n\n• Welke wijnkleur heeft uw voorkeur? (Rood, Wit, Rosé, of Mousserende)\n• Wat is uw budgetbereik? (Budget: €0-10, Middensegment: €10-25, Premium: €25-50, Luxe: €50+)\n• Wat is de gelegenheid of bij welk eten wilt u de wijn combineren?",
  }

  return messages[language]
}

function getFallbackMessage(language: Language, recommendations: Wine[]): string {
  const messages = {
    en: `Based on your preferences, here are some excellent wine options from our selection:`,
    fr: `Basé sur vos préférences, voici d'excellentes options de vin de notre sélection :`,
    nl: `Op basis van uw voorkeuren zijn hier enkele uitstekende wijnopties uit onze selectie:`,
  }

  return messages[language]
}
