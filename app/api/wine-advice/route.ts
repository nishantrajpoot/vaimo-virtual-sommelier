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
        maxTokens: 1000,
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

  // Helper: normalize and strip accents, punctuation, extra whitespace
  function normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")                      // decompose accents
      .replace(/[\u0300-\u036f]/g, "")      // strip accents
      .replace(/[^\w\s]/g, "")              // remove punctuation
      .replace(/\s+/g, " ")                 // collapse whitespace
      .trim();
  }

  const matchedByTitle = titles
    .map(title => {
      const normTitle = normalize(title);
      return wines.find(w => normalize(w.Product_name).startsWith(normTitle));
    })
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

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = array.slice(); // make a copy to avoid mutating original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  

  // Provide a limited wine dataset sample as context (reduce token size)
  const wineDataSample = shuffleArray(wines).slice(0, 328).map((wine) => ({
    id: wine.id,
    name: wine.Product_name,
    price: wine.Price,
    volume: wine.Volume,
    discount: wine.promotion,
    color: wine.Color
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
    Food Pairing Concept: Food pairing is more than just matching a dish with wine; it's about achieving a balance that enhances flavors and textures.
    Wine Selection: Choosing the right wine involves considering the intensity of the dish and whether to complement or contrast flavors.
    Fundamentals of Pairing: Successful pairings balance acidity, tannins, and sweetness to enhance the dish and wine's aromatic richness.
    Acidity in Wine: Wines with marked acidity, like Sauvignon Blanc, can refresh and balance rich or fatty dishes.
    Tannins in Wine: Tannins provide structure and pair well with protein-rich meats, such as a Bordeaux with red meat.
    Sweetness in Wine: Slightly sweet wines can contrast with spicy or exotic dishes, like Gewurztraminer with Thai curry.
    Golden Rules of Pairing: Successful pairings require balancing intensity, contrasts, and complements, considering sauces and accompaniments.
    Intensity Matching: Light dishes pair with delicate wines, while rich dishes need robust wines for balance.
    Contrast vs. Complement: Using contrast or mirror pairings can highlight flavors, like a sweet wine with salty cheese.
    Importance of Sauce: The sauce can be as crucial as the main ingredient in determining the wine pairing.
    French Cuisine Pairings: Classic pairings include Pinot Noir with beef bourguignon and Sancerre with goat cheese.
    Italian Cuisine Pairings: Italian dishes like carbonara pair well with Verdicchio, while pizza Margherita suits Chianti Classico.
    Asian Cuisine Pairings: Riesling or Sancerre complements sushi, while Gewurztraminer balances spicy Thai curry.
    Mediterranean Cuisine Pairings: Wines like Rioja or Albariño pair well with paella, while Assyrtiko suits Greek salad.
    American Cuisine Pairings: Zinfandel or Malbec pairs with gourmet burgers, while Chardonnay complements mac & cheese.
    Middle Eastern Cuisine Pairings: Wines like Côtes-du-Rhône complement couscous, while Muscat enhances baklava.
    African Cuisine Pairings: Sauvignon Blanc pairs with chicken yassa, while Grenache suits peanut stew (mafé).
    Common Pairing Mistakes: Avoid overpowering light dishes with strong wines and pairing tannic wines with spicy foods.
    Seasonal Wine Selection: Choose refreshing wines in summer and robust wines in winter to match seasonal dishes.
    Experimentation and Personalization: Personal taste is key; experiment with different wines and take notes to refine preferences.
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
    Concept de l'accord mets et vins : L'accord mets et vins est plus qu'un simple mariage entre un plat et un vin ; il s'agit d'atteindre un équilibre qui rehausse les saveurs et les textures.
    Sélection du vin : Choisir le bon vin implique de considérer l'intensité du plat et de décider s'il faut compléter ou contraster les saveurs.
    Fondamentaux de l'accord : Les accords réussis équilibrent l'acidité, les tanins et la sucrosité pour enrichir la richesse aromatique du plat et du vin.
    Acidité dans le vin : Les vins à forte acidité, comme le Sauvignon Blanc, peuvent rafraîchir et équilibrer les plats riches ou gras.
    Tanins dans le vin : Les tanins apportent de la structure et se marient bien avec les viandes riches en protéines, comme un Bordeaux avec de la viande rouge.
    Sucrosité dans le vin : Les vins légèrement sucrés peuvent contraster avec des plats épicés ou exotiques, comme le Gewurztraminer avec un curry thaï.
    Règles d'or de l'accord : Les accords réussis nécessitent un équilibre entre intensité, contrastes et complémentarités, en tenant compte des sauces et des accompagnements.
    Accord d'intensité : Les plats légers se marient avec des vins délicats, tandis que les plats riches nécessitent des vins robustes pour l'équilibre.
    Contraste vs Complément : Utiliser le contraste ou les accords en miroir peut mettre en valeur les saveurs, comme un vin sucré avec un fromage salé.
    Importance de la sauce : La sauce peut être aussi cruciale que l'ingrédient principal pour déterminer l'accord vin.
    Accords de la cuisine française : Les accords classiques incluent le Pinot Noir avec le bœuf bourguignon et le Sancerre avec le fromage de chèvre.
    Accords de la cuisine italienne : Les plats italiens comme la carbonara se marient bien avec le Verdicchio, tandis que la pizza Margherita convient au Chianti Classico.
    Accords de la cuisine asiatique : Le Riesling ou le Sancerre complètent les sushis, tandis que le Gewurztraminer équilibre le curry thaï épicé.
    Accords de la cuisine méditerranéenne : Les vins comme le Rioja ou l'Albariño se marient bien avec la paella, tandis que l'Assyrtiko convient à la salade grecque.
    Accords de la cuisine américaine : Le Zinfandel ou le Malbec s'accordent avec les burgers gourmets, tandis que le Chardonnay complète le mac & cheese.
    Accords de la cuisine du Moyen-Orient : Les vins comme le Côtes-du-Rhône complètent le couscous, tandis que le Muscat sublime la baklava.
    Accords de la cuisine africaine : Le Sauvignon Blanc se marie avec le poulet yassa, tandis que le Grenache convient au mafé.
    Erreurs courantes d'accord : Évitez d'écraser les plats légers avec des vins puissants et de marier des vins tanniques avec des plats épicés.
    Sélection de vin saisonnière : Choisissez des vins rafraîchissants en été et des vins robustes en hiver pour s'accorder avec les plats de saison.
    Expérimentation et personnalisation : Le goût personnel est essentiel ; expérimentez avec différents vins et prenez des notes pour affiner vos préférences.`,

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
    Concept van voedselcombinaties: Voedselcombinaties zijn meer dan alleen het matchen van een gerecht met wijn; het gaat om het bereiken van een balans die smaken en texturen versterkt.
    Wijnselectie: Het kiezen van de juiste wijn houdt in dat je rekening houdt met de intensiteit van het gerecht en of je smaken wilt aanvullen of contrasteren.
    Basisprincipes van combineren: Succesvolle combinaties balanceren zuurgraad, tannines en zoetheid om de aromatische rijkdom van het gerecht en de wijn te versterken.
    Zuur in wijn: Wijnen met een uitgesproken zuurgraad, zoals Sauvignon Blanc, kunnen rijke of vette gerechten verfrissen en in balans brengen.
    Tannines in wijn: Tannines bieden structuur en passen goed bij eiwitrijke vleessoorten, zoals een Bordeaux met rood vlees.
    Zoetheid in wijn: Lichtzoete wijnen kunnen contrasteren met pittige of exotische gerechten, zoals Gewurztraminer met Thaise curry.
    Gouden regels van combineren: Succesvolle combinaties vereisen een balans tussen intensiteit, contrasten en aanvullingen, rekening houdend met sauzen en bijgerechten.
    Intensiteit matchen: Lichte gerechten passen bij delicate wijnen, terwijl rijke gerechten robuuste wijnen nodig hebben voor balans.
    Contrast vs. Aanvulling: Het gebruik van contrast of spiegelcombinaties kan smaken benadrukken, zoals een zoete wijn met een zoute kaas.
    Belang van saus: De saus kan net zo cruciaal zijn als het hoofdingrediënt bij het bepalen van de wijncombinatie.
    Franse keukencombinaties: Klassieke combinaties zijn onder andere Pinot Noir met boeuf bourguignon en Sancerre met geitenkaas.
    Italiaanse keukencombinaties: Italiaanse gerechten zoals carbonara passen goed bij Verdicchio, terwijl pizza Margherita bij Chianti Classico past.
    Aziatische keukencombinaties: Riesling of Sancerre complementeert sushi, terwijl Gewurztraminer Thaise curry in balans brengt.
    Mediterrane keukencombinaties: Wijnen zoals Rioja of Albariño passen goed bij paella, terwijl Assyrtiko bij Griekse salade past.
    Amerikaanse keukencombinaties: Zinfandel of Malbec past bij gourmetburgers, terwijl Chardonnay goed bij mac & cheese past.
    Midden-Oosterse keukencombinaties: Wijnen zoals Côtes-du-Rhône passen bij couscous, terwijl Muscat baklava versterkt.
    Afrikaanse keukencombinaties: Sauvignon Blanc past bij kip yassa, terwijl Grenache goed bij mafé past.
    Veelgemaakte combinatiefouten: Vermijd het overweldigen van lichte gerechten met sterke wijnen en het combineren van tanninerijke wijnen met pittige gerechten.
    Seizoensgebonden wijnselectie: Kies verfrissende wijnen in de zomer en robuuste wijnen in de winter om bij seizoensgerechten te passen.
    Experimenteren en personaliseren: Persoonlijke smaak is essentieel; experimenteer met verschillende wijnen en maak aantekeningen om je voorkeuren te verfijnen.`,
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
