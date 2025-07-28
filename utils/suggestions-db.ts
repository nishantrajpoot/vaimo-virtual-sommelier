// @ts-nocheck
import type { Language } from "@/types/wine"

export interface SuggestionEntry {
  id: string
  query: string
  language: Language
  count: number
  lastUsed: Date
  relevanceScore: number
}

const STORAGE_KEY = "wine-sommelier-suggestions"
const MAX_SUGGESTIONS = 50
const MIN_RELEVANCE_SCORE = 0.3

// Wine-related keywords for relevance scoring
const WINE_KEYWORDS = [
  // English
  "wine",
  "red",
  "white",
  "rosé",
  "rose",
  "sparkling",
  "champagne",
  "bottle",
  "glass",
  "recommend",
  "suggestion",
  "pairing",
  "food",
  "dinner",
  "celebration",
  "party",
  "budget",
  "cheap",
  "expensive",
  "price",
  "under",
  "over",
  "euro",
  "€",
  "cabernet",
  "merlot",
  "chardonnay",
  "sauvignon",
  "pinot",
  "syrah",
  "shiraz",
  "bordeaux",
  "burgundy",
  "tuscany",
  "rioja",
  "prosecco",
  "cava",
  "meat",
  "fish",
  "cheese",
  "pasta",
  "chicken",
  "beef",
  "seafood",
  "dessert",

  // French
  "vin",
  "rouge",
  "blanc",
  "rosé",
  "effervescent",
  "bouteille",
  "verre",
  "recommandation",
  "conseil",
  "accord",
  "mets",
  "dîner",
  "fête",
  "célébration",
  "budget",
  "pas cher",
  "cher",
  "prix",
  "moins",
  "plus",
  "euro",
  "cabernet",
  "merlot",
  "chardonnay",
  "sauvignon",
  "pinot",
  "syrah",
  "bordeaux",
  "bourgogne",
  "toscane",
  "rioja",
  "prosecco",
  "viande",
  "poisson",
  "fromage",
  "pâtes",
  "poulet",
  "bœuf",
  "fruits de mer",

  // Dutch
  "wijn",
  "rood",
  "wit",
  "rosé",
  "mousserende",
  "fles",
  "glas",
  "aanbeveling",
  "advies",
  "combinatie",
  "eten",
  "diner",
  "feest",
  "viering",
  "budget",
  "goedkoop",
  "duur",
  "prijs",
  "onder",
  "boven",
  "euro",
  "cabernet",
  "merlot",
  "chardonnay",
  "sauvignon",
  "pinot",
  "syrah",
  "bordeaux",
  "bourgogne",
  "toscane",
  "rioja",
  "prosecco",
  "vlees",
  "vis",
  "kaas",
  "pasta",
  "kip",
  "rundvlees",
  "zeevruchten",
]

export class SuggestionsDB {
  private suggestions: SuggestionEntry[] = []

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
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.suggestions = JSON.parse(stored).map((s: any) => ({
          ...s,
          lastUsed: new Date(s.lastUsed),
        }))
      }
    } catch (error) {
      console.error("Error loading suggestions from storage:", error)
      this.suggestions = []
    }
  }

  private saveToStorage(): void {
    // Check if we're in the browser environment
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.suggestions))
    } catch (error) {
      console.error("Error saving suggestions to storage:", error)
    }
  }

  private improveQuery(query: string, language: Language): string {
    let improved = query.trim()

    // Basic cleanup
    improved = improved.replace(/\s+/g, " ") // Multiple spaces to single space
    improved = improved.replace(/([.!?])\s*$/, "") // Remove trailing punctuation

    // Language-specific improvements
    switch (language) {
      case "en":
        improved = this.improveEnglishQuery(improved)
        break
      case "fr":
        improved = this.improveFrenchQuery(improved)
        break
      case "nl":
        improved = this.improveDutchQuery(improved)
        break
    }

    // Ensure proper capitalization
    improved = improved.charAt(0).toUpperCase() + improved.slice(1).toLowerCase()

    // Fix common wine terms capitalization
    improved = this.fixWineTermsCapitalization(improved)

    // Add question mark if it's clearly a question
    if (this.isQuestion(improved, language) && !improved.endsWith("?")) {
      improved += "?"
    }

    return improved
  }

  private improveEnglishQuery(query: string): string {
    let improved = query.toLowerCase()

    // Common replacements and improvements
    const replacements = [
      // Basic grammar fixes
      [/\bi need\b/g, "I need"],
      [/\bi want\b/g, "I would like"],
      [/\bi'm looking for\b/g, "I am looking for"],
      [/\bwhat's\b/g, "what is"],
      [/\bcan you\b/g, "could you"],
      [/\bgive me\b/g, "could you recommend"],
      [/\bshow me\b/g, "could you show me"],
      [/\btell me\b/g, "could you tell me"],

      // Wine-specific improvements
      [/\bred wine\b/g, "red wine"],
      [/\bwhite wine\b/g, "white wine"],
      [/\brose wine\b/g, "rosé wine"],
      [/\bsparkling wine\b/g, "sparkling wine"],
      [/\bcheap wine\b/g, "budget-friendly wine"],
      [/\bexpensive wine\b/g, "premium wine"],
      [/\bgood wine\b/g, "quality wine"],
      [/\bbest wine\b/g, "best wine recommendation"],

      // Question starters
      [/^what wine/g, "what wine would you recommend"],
      [/^which wine/g, "which wine would be best"],
      [/^recommend/g, "could you recommend"],
      [/^suggest/g, "could you suggest"],
      [/^find/g, "could you help me find"],

      // Price-related
      [/under (\d+)/g, "under €$1"],
      [/less than (\d+)/g, "less than €$1"],
      [/around (\d+)/g, "around €$1"],
      [/about (\d+)/g, "about €$1"],

      // Food pairing
      [/goes with/g, "pairs well with"],
      [/good with/g, "pairs well with"],
      [/match with/g, "pairs well with"],
    ]

    replacements.forEach(([pattern, replacement]) => {
      improved = improved.replace(pattern, replacement)
    })

    return improved
  }

  private improveFrenchQuery(query: string): string {
    let improved = query.toLowerCase()

    const replacements = [
      // Basic grammar fixes
      [/\bj'ai besoin\b/g, "j'ai besoin"],
      [/\bje veux\b/g, "je voudrais"],
      [/\bje cherche\b/g, "je recherche"],
      [/\bqu'est-ce que\b/g, "qu'est-ce que"],
      [/\bpouvez-vous\b/g, "pourriez-vous"],
      [/\bdonnez-moi\b/g, "pourriez-vous me recommander"],
      [/\bmontrez-moi\b/g, "pourriez-vous me montrer"],
      [/\bdites-moi\b/g, "pourriez-vous me dire"],

      // Wine-specific improvements
      [/\bvin rouge\b/g, "vin rouge"],
      [/\bvin blanc\b/g, "vin blanc"],
      [/\bvin rosé\b/g, "vin rosé"],
      [/\bvin effervescent\b/g, "vin effervescent"],
      [/\bvin pas cher\b/g, "vin économique"],
      [/\bvin cher\b/g, "vin premium"],
      [/\bbon vin\b/g, "vin de qualité"],
      [/\bmeilleur vin\b/g, "meilleure recommandation de vin"],

      // Question starters
      [/^quel vin/g, "quel vin me recommanderiez-vous"],
      [/^recommandez/g, "pourriez-vous recommander"],
      [/^suggérez/g, "pourriez-vous suggérer"],
      [/^trouvez/g, "pourriez-vous m'aider à trouver"],

      // Price-related
      [/moins de (\d+)/g, "moins de €$1"],
      [/sous (\d+)/g, "sous €$1"],
      [/environ (\d+)/g, "environ €$1"],
      [/autour de (\d+)/g, "autour de €$1"],

      // Food pairing
      [/va avec/g, "s'accorde bien avec"],
      [/bon avec/g, "s'accorde bien avec"],
      [/accompagne/g, "s'accorde bien avec"],
    ]

    replacements.forEach(([pattern, replacement]) => {
      improved = improved.replace(pattern, replacement)
    })

    return improved
  }

  private improveDutchQuery(query: string): string {
    let improved = query.toLowerCase()

    const replacements = [
      // Basic grammar fixes
      [/\bik heb nodig\b/g, "ik heb nodig"],
      [/\bik wil\b/g, "ik zou graag willen"],
      [/\bik zoek\b/g, "ik ben op zoek naar"],
      [/\bwat is\b/g, "wat is"],
      [/\bkunt u\b/g, "zou u kunnen"],
      [/\bgeef me\b/g, "zou u mij kunnen aanbevelen"],
      [/\blaat me zien\b/g, "zou u mij kunnen laten zien"],
      [/\bvertel me\b/g, "zou u mij kunnen vertellen"],

      // Wine-specific improvements
      [/\brode wijn\b/g, "rode wijn"],
      [/\bwitte wijn\b/g, "witte wijn"],
      [/\brosé wijn\b/g, "rosé wijn"],
      [/\bmousserende wijn\b/g, "mousserende wijn"],
      [/\bgoedkope wijn\b/g, "budgetvriendelijke wijn"],
      [/\bdure wijn\b/g, "premium wijn"],
      [/\bgoede wijn\b/g, "kwaliteitswijn"],
      [/\bbeste wijn\b/g, "beste wijnaanbeveling"],

      // Question starters
      [/^welke wijn/g, "welke wijn zou u aanbevelen"],
      [/^beveel aan/g, "zou u kunnen aanbevelen"],
      [/^stel voor/g, "zou u kunnen voorstellen"],
      [/^vind/g, "zou u mij kunnen helpen vinden"],

      // Price-related
      [/onder (\d+)/g, "onder €$1"],
      [/minder dan (\d+)/g, "minder dan €$1"],
      [/rond (\d+)/g, "rond €$1"],
      [/ongeveer (\d+)/g, "ongeveer €$1"],

      // Food pairing
      [/gaat goed met/g, "past goed bij"],
      [/past bij/g, "past goed bij"],
      [/combineert met/g, "past goed bij"],
    ]

    replacements.forEach(([pattern, replacement]) => {
      improved = improved.replace(pattern, replacement)
    })

    return improved
  }

  private fixWineTermsCapitalization(query: string): string {
    const wineTerms = [
      "Chardonnay",
      "Sauvignon Blanc",
      "Cabernet Sauvignon",
      "Merlot",
      "Pinot Noir",
      "Syrah",
      "Shiraz",
      "Bordeaux",
      "Burgundy",
      "Champagne",
      "Prosecco",
      "Rioja",
      "Chianti",
      "Delhaize",
    ]

    let improved = query
    wineTerms.forEach((term) => {
      const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, "gi")
      improved = improved.replace(regex, term)
    })

    return improved
  }

  private isQuestion(query: string, language: Language): boolean {
    const questionWords = {
      en: ["what", "which", "how", "where", "when", "why", "who", "can", "could", "would", "should", "do", "does"],
      fr: [
        "quel",
        "quelle",
        "quels",
        "quelles",
        "comment",
        "où",
        "quand",
        "pourquoi",
        "qui",
        "que",
        "qu'est-ce",
        "pouvez",
        "pourriez",
      ],
      nl: ["wat", "welke", "hoe", "waar", "wanneer", "waarom", "wie", "kan", "kunt", "zou", "moet", "doet", "doen"],
    }

    const words = questionWords[language] || questionWords.en
    const firstWord = query.split(" ")[0].toLowerCase()

    return words.includes(firstWord)
  }

  private calculateRelevanceScore(query: string): number {
    const lowerQuery = query.toLowerCase()
    let score = 0
    let matchedKeywords = 0

    // Check for wine-related keywords
    for (const keyword of WINE_KEYWORDS) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        matchedKeywords++
        // Give higher score for more specific wine terms
        if (
          ["cabernet", "merlot", "chardonnay", "sauvignon", "pinot", "syrah", "champagne", "bordeaux"].includes(
            keyword.toLowerCase(),
          )
        ) {
          score += 0.3
        } else if (
          ["wine", "vin", "wijn", "recommend", "recommandation", "aanbeveling"].includes(keyword.toLowerCase())
        ) {
          score += 0.2
        } else {
          score += 0.1
        }
      }
    }

    // Bonus for question format
    if (
      lowerQuery.includes("?") ||
      lowerQuery.startsWith("what") ||
      lowerQuery.startsWith("which") ||
      lowerQuery.startsWith("quel") ||
      lowerQuery.startsWith("welke")
    ) {
      score += 0.2
    }

    // Penalty for very short or very long queries
    if (query.length < 10) score *= 0.5
    if (query.length > 100) score *= 0.7

    // Normalize score
    return Math.min(score, 1.0)
  }

  addQuery(query: string, language: Language): void {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 5) return // Skip very short queries

    // Improve the query before storing
    const improvedQuery = this.improveQuery(trimmedQuery, language)
    const relevanceScore = this.calculateRelevanceScore(improvedQuery)

    if (relevanceScore < MIN_RELEVANCE_SCORE) return // Skip irrelevant queries

    // Check if improved query already exists
    const existingIndex = this.suggestions.findIndex(
      (s) => s.query.toLowerCase() === improvedQuery.toLowerCase() && s.language === language,
    )

    if (existingIndex >= 0) {
      // Update existing suggestion
      this.suggestions[existingIndex].count++
      this.suggestions[existingIndex].lastUsed = new Date()
      this.suggestions[existingIndex].relevanceScore = Math.max(
        this.suggestions[existingIndex].relevanceScore,
        relevanceScore,
      )
    } else {
      // Add new suggestion with improved query
      const newSuggestion: SuggestionEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        query: improvedQuery, // Store the improved version
        language,
        count: 1,
        lastUsed: new Date(),
        relevanceScore,
      }
      this.suggestions.push(newSuggestion)
    }

    // Keep only top suggestions
    this.suggestions.sort((a, b) => {
      const scoreA =
        a.relevanceScore *
        Math.log(a.count + 1) *
        (1 / Math.max(1, (Date.now() - a.lastUsed.getTime()) / (1000 * 60 * 60 * 24)))
      const scoreB =
        b.relevanceScore *
        Math.log(b.count + 1) *
        (1 / Math.max(1, (Date.now() - b.lastUsed.getTime()) / (1000 * 60 * 60 * 24)))
      return scoreB - scoreA
    })

    if (this.suggestions.length > MAX_SUGGESTIONS) {
      this.suggestions = this.suggestions.slice(0, MAX_SUGGESTIONS)
    }

    this.saveToStorage()
  }

  getTopSuggestions(language: Language, count = 6): string[] {
    const languageSuggestions = this.suggestions.filter((s) => s.language === language)

    // Sort by combined score (relevance * frequency * recency)
    const sorted = languageSuggestions.sort((a, b) => {
      const now = Date.now()
      const daysSinceA = (now - a.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      const daysSinceB = (now - b.lastUsed.getTime()) / (1000 * 60 * 60 * 24)

      const scoreA = a.relevanceScore * Math.log(a.count + 1) * (1 / Math.max(1, daysSinceA))
      const scoreB = b.relevanceScore * Math.log(b.count + 1) * (1 / Math.max(1, daysSinceB))

      return scoreB - scoreA
    })

    return sorted.slice(0, count).map((s) => s.query)
  }

  clearAll(): void {
    this.suggestions = []
    this.saveToStorage()
  }

  // Get fallback suggestions if no stored suggestions exist
  getFallbackSuggestions(language: Language): string[] {
    const fallbacks = {
      en: [
        "I need a red wine under €15",
        "What wine pairs well with seafood?",
        "Could you recommend a Champagne for celebration?",
        "I'm looking for a budget-friendly white wine for dinner",
        "What would be the best wine for a romantic evening?",
        "Which wine pairs well with cheese?",
      ],
      fr: [
        "J'ai besoin d'un vin rouge sous €15",
        "Quel vin s'accorde bien avec les fruits de mer?",
        "Pourriez-vous recommander un Champagne pour fêter?",
        "Je recherche un vin blanc économique pour le dîner",
        "Quel serait le meilleur vin pour une soirée romantique?",
        "Quel vin s'accorde bien avec le fromage?",
      ],
      nl: [
        "Ik heb een rode wijn onder €15 nodig",
        "Welke wijn past goed bij zeevruchten?",
        "Zou u een Champagne kunnen aanbevelen voor een feest?",
        "Ik ben op zoek naar een budgetvriendelijke witte wijn voor het diner",
        "Wat zou de beste wijn zijn voor een romantische avond?",
        "Welke wijn past goed bij kaas?",
      ],
    }
    return fallbacks[language]
  }
}

// Export singleton instance
export const suggestionsDB = new SuggestionsDB()
