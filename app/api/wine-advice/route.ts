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

Please analyze this query and recommend 7-8 specific wines from the available dataset. Consider:
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
  console.log('idSection-', idSection)
  /*
  if (idSection) {    
    const ids = idSection[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/"/g, "").trim())
      .filter((s) => s)
    const found = wines.filter((wine) => ids.includes(wine.id!))
    if (found.length > 0) {
      return found.slice(0, 4)
    }
  }*/

  if (idSection) {
    const ids = idSection[1]
      .split(/[,\s]+/)
      .map((s) => s.replace(/"/g, "").trim())
      .filter(Boolean)

      console.log('ids-', ids)
      // Create a quick ID → wine lookup map
    const wineMap = new Map(wines.map(w => [w.id, w]))

    // Map IDs to wines in the exact order given by the model
    const foundOrdered = ids
      .map(id => wineMap.get(id))
      .filter((wine): wine is Wine => Boolean(wine)) // remove undefined
      console.log('foundOrdered-', foundOrdered)
    if (foundOrdered.length > 0) return foundOrdered.slice(0, 8)
  }
  // 2) Fallback to name-based matching if no IDs found
/*  
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
*/

  // 2) Fallback: match wines by numbered titles like "1. Moet & Chandon | Champagne..."
  const titleRegex = /^\d+\.\s+(.*)$/gm;
  const titles: string[] = [];

  let match;
  while ((match = titleRegex.exec(response)) !== null) {
    titles.push(match[1].trim());
  }

  const matchedByTitle = titles
    .map(title =>
      wines.find(w => w.Product_name.toLowerCase() === title.toLowerCase())
    )
    .filter((wine): wine is Wine => Boolean(wine));

  if (matchedByTitle.length > 0) return matchedByTitle.slice(0, 8);

  // 3) Fallback to name-based substring matching (case-insensitive)
  const recsByName: Wine[] = [];
  const responseText = response.toLowerCase();
  for (const wine of wines) {
    if (recsByName.length >= 8) break;
    if (wine.Product_name && responseText.includes(wine.Product_name.toLowerCase())) {
      recsByName.push(wine);
    }
  }
  if (recsByName.length > 0) {
    return recsByName;
  }

  // 3) Fallback to category-based selection
  return getIntelligentFallback(wines)
}

function getSystemPrompt(language: Language, wines: Wine[]): string {
  // Provide a limited wine dataset sample as context (reduce token size)
  const wineDataSample = wines.slice(0, 300).map((wine) => ({
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
- Always recommend 7-8 specific wines from the available inventory
- Mention exact wine names from the dataset
- Explain why each wine fits the user's request
- Handle spelling variations and typos gracefully
- Consider price ranges, wine types, and occasions
- Provide food pairing suggestions when relevant
- Be enthusiastic but professional
- Take these points into consideration while recommending Food pairing options:
    Balance and Harmony: Successful food and wine pairings rely on balancing flavors to enhance both the dish and the wine.
    Acidity: Wines with marked acidity, like Sauvignon Blanc, can refresh and balance rich or creamy dishes.
    Tannins: Tannic red wines, such as Bordeaux, pair well with protein-rich meats, providing structure and depth.
    Sweetness: Slightly sweet wines, like Gewurztraminer, can contrast and balance spicy or exotic dishes.
    Intensity Matching: The intensity of the wine should match the intensity of the dish for a harmonious pairing.
    Contrast vs. Complementarity: Pairing can be based on contrasting flavors (e.g., sweet wine with salty cheese) or complementary flavors (e.g., mineral wine with seafood).
    Sauce Consideration: The sauce in a dish plays a crucial role in pairing, often more so than the main ingredient.
    Cuisine-Specific Pairings: Different cuisines have traditional pairings that enhance their unique flavors, such as Pinot Noir with beef bourguignon in French cuisine.
    Seasonal Adaptation: Wine choices should adapt to the season, with lighter wines in summer and fuller-bodied wines in winter.
    Avoiding Overpowering Wines: Avoid pairing overly powerful wines with delicate dishes to prevent overwhelming the flavors.
    Temperature of Service: Serving wine at the correct temperature is essential to maintain its balance and reveal its aromas.
    Experimentation and Personalization: Personal taste should guide pairing choices, encouraging experimentation to find preferred combinations.
    Global Pairing Examples: The guide provides specific wine pairings for various global cuisines, such as Riesling with sushi or Chianti with pizza.
    Avoiding Tannic Wines with Spicy Foods: Tannic wines can intensify the heat of spicy dishes, so it's better to choose aromatic whites or softer reds.
    Exploring Lesser-Known Wines: Encourages trying less common wines to discover new and exciting pairings.
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
- Recommandez toujours 7-8 vins spécifiques de l'inventaire disponible
- Mentionnez les noms exacts des vins du dataset
- Expliquez pourquoi chaque vin correspond à la demande
- Gérez les variations d'orthographe et fautes de frappe avec souplesse
- Considérez les gammes de prix, types de vins, et occasions
- Fournissez des suggestions d'accords mets-vins quand pertinent
- Soyez enthousiaste mais professionnel
- Tenez compte de ces points lorsque vous recommandez des options d'associations culinaires:
    Équilibre et Harmonie: Les accords mets et vins réussis reposent sur l'équilibre des saveurs pour sublimer à la fois le plat et le vin.
    Acidité: Les vins avec une acidité marquée, comme le Sauvignon Blanc, peuvent rafraîchir et équilibrer les plats riches ou crémeux.
    Tanins: Les vins rouges tanniques, tels que le Bordeaux, se marient bien avec les viandes riches en protéines, apportant structure et profondeur.
    Sucrosité: Les vins légèrement sucrés, comme le Gewurztraminer, peuvent créer un contraste et équilibrer les plats épicés ou exotiques.
    Correspondance d'Intensité: L'intensité du vin doit correspondre à celle du plat pour un accord harmonieux.
    Contraste vs. Complémentarité: Les accords peuvent être basés sur des saveurs contrastées (par exemple, vin sucré avec fromage salé) ou complémentaires (par exemple, vin minéral avec fruits de mer).
    Considération de la Sauce: La sauce d'un plat joue un rôle crucial dans l'accord, souvent plus que l'ingrédient principal.
    Accords Spécifiques à la Cuisine: Différentes cuisines ont des accords traditionnels qui rehaussent leurs saveurs uniques, comme le Pinot Noir avec le bœuf bourguignon dans la cuisine française.
    Adaptation Saisonnière: Les choix de vin doivent s'adapter à la saison, avec des vins plus légers en été et des vins plus corsés en hiver.
    Éviter les Vins Trop Puissants: Évitez d'associer des vins trop puissants avec des plats délicats pour ne pas écraser les saveurs.
    Température de Service: Servir le vin à la bonne température est essentiel pour maintenir son équilibre et révéler ses arômes.
    Expérimentation et Personnalisation: Le goût personnel doit guider les choix d'accords, encourageant l'expérimentation pour trouver des combinaisons préférées.
    Exemples d'Accords Globaux: Le guide propose des accords spécifiques pour diverses cuisines mondiales, comme le Riesling avec le sushi ou le Chianti avec la pizza.
    Éviter les Vins Tanniques avec les Plats Épicés: Les vins tanniques peuvent intensifier la chaleur des plats épicés, il est donc préférable de choisir des blancs aromatiques ou des rouges plus doux.
    Explorer les Vins Moins Connus: Encourage à essayer des vins moins courants pour découvrir de nouveaux accords passionnants.`,

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
- Beveel altijd 7-8 specifieke wijnen aan uit de beschikbare voorraad
- Noem exacte wijnnamen uit de dataset
- Leg uit waarom elke wijn past bij het verzoek
- Behandel spellingsvariaties en typefouten soepel
- Overweeg prijsklassen, wijntypes en gelegenheden
- Geef spijs-wijn combinatie suggesties wanneer relevant
- Wees enthousiast maar professioneel
- Houd bij het aanbevelen van opties voor foodpairing rekening met de volgende punten:
    Balans en Harmonie: Succesvolle voedsel- en wijncombinaties zijn gebaseerd op het balanceren van smaken om zowel het gerecht als de wijn te verbeteren.
    Zuurheid: Wijnen met een uitgesproken zuurgraad, zoals Sauvignon Blanc, kunnen rijke of romige gerechten verfrissen en in balans brengen.
    Tannines: Tanninerijke rode wijnen, zoals Bordeaux, passen goed bij eiwitrijke vleesgerechten en bieden structuur en diepte.
    Zoetheid: Lichtzoete wijnen, zoals Gewurztraminer, kunnen een interessant contrast en balans bieden bij pittige of exotische gerechten.
    Intensiteit Matching: De intensiteit van de wijn moet overeenkomen met die van het gerecht voor een harmonieuze combinatie.
    Contrast vs. Complementariteit: Combinaties kunnen gebaseerd zijn op contrasterende smaken (bijv. zoete wijn met zoute kaas) of complementaire smaken (bijv. minerale wijn met zeevruchten).
    Saus Overweging: De saus in een gerecht speelt een cruciale rol in de combinatie, vaak meer dan het hoofdingrediënt.
    Keukenspecifieke Combinaties: Verschillende keukens hebben traditionele combinaties die hun unieke smaken versterken, zoals Pinot Noir met boeuf bourguignon in de Franse keuken.
    Seizoensgebonden Aanpassing: Wijnkeuzes moeten zich aanpassen aan het seizoen, met lichtere wijnen in de zomer en vollere wijnen in de winter.
    Vermijden van Overweldigende Wijnen: Vermijd het combineren van te krachtige wijnen met delicate gerechten om te voorkomen dat de smaken worden overweldigd.
    Serveertemperatuur: Het serveren van wijn op de juiste temperatuur is essentieel om het evenwicht te behouden en de aroma's te onthullen.
    Experimenteren en Personaliseren: Persoonlijke smaak moet de keuze van combinaties leiden, waarbij experimenteren wordt aangemoedigd om favoriete combinaties te vinden.
    Wereldwijde Combinatievoorbeelden: De gids biedt specifieke wijncombinaties voor verschillende wereldkeukens, zoals Riesling met sushi of Chianti met pizza.
    Vermijden van Tanninerijke Wijnen met Pittig Voedsel: Tanninerijke wijnen kunnen de hitte van pittige gerechten versterken, dus het is beter om aromatische witte wijnen of zachtere rode wijnen te kiezen.
    Verkennen van Minder Bekende Wijnen: Moedigt aan om minder bekende wijnen te proberen om nieuwe en spannende combinaties te ontdekken.`,
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
