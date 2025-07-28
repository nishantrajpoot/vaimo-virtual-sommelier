// @ts-nocheck
"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, X, Wine, RotateCcw } from "lucide-react"
import type { ChatMessage, Language, Wine as WineType } from "@/types/wine"
import { getTranslation } from "@/utils/translations"
import { WineCard } from "./wine-card"
import { ComparePopup } from "./compare-popup"
import { suggestionsDB } from "@/utils/suggestions-db"
import data_NL from "@/data/data_NL.json"
import data_EN from "@/data/data_EN.json"
import data_FR from "@/data/data_FR.json"

interface WineChatbotProps {
  isOpen: boolean
  onClose: () => void
  onLanguageChange?: (language: Language) => void
}

const wineData = {
  nl: data_NL as WineType[],
  en: data_EN as WineType[],
  fr: data_FR as WineType[],
}

export function WineChatbot({ isOpen, onClose, onLanguageChange }: WineChatbotProps) {
  const [language, setLanguage] = useState<Language>("fr")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  // For "Show more" pagination
  const [lastQuery, setLastQuery] = useState<string>("")
  const [shownIds, setShownIds] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // State no longer holds recommendations globally; each message carries its own list
  // const [currentRecommendations, setCurrentRecommendations] = useState<WineType[]>([])
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([])
  const [lastRecs, setLastRecs] = useState<WineType[]>([])
  // Comments per recommendation
  const [recComments, setRecComments] = useState<string[]>([])
  // Client-side flag
  const [isClient, setIsClient] = useState(false)

  // Mark when running in client to allow localStorage usage
  useEffect(() => {
    setIsClient(true)
  }, [])
  // Control compare modal
  const [showCompare, setShowCompare] = useState<boolean>(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Show more recommendations: paginate through prefetched list
  const handleShowMore = () => {
    // Determine next batch based on already shown IDs
    const start = shownIds.length
    const nextBatch = lastRecs.slice(start, start + 4)
    if (nextBatch.length === 0) return
    // Render next batch of wine cards
    const recMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "WINE_RECOMMENDATIONS",
      timestamp: new Date(),
      recommendations: nextBatch,
      startIndex: start,
    }
    setMessages((prev) => [...prev, recMsg])
    // Update shown IDs
    setShownIds((prev) => [...prev, ...nextBatch.map((w) => w.id)])
    // Add SHOW_MORE if more remain
    if (start + nextBatch.length < lastRecs.length) {
      const showMoreMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "SHOW_MORE",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, showMoreMsg])
    }
  }

  // Only scroll to bottom for user messages, not assistant responses
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === "user") {
        scrollToBottom()
      }
    }
  }, [messages])

  // Prefetch and cache responses for fallback suggestion queries
  useEffect(() => {
    if (!isClient || messages.length !== 1) return
    const fallbacks = suggestionsDB.getFallbackSuggestions(language)
    fallbacks.forEach(async (suggestion) => {
      const key = `sommelier_cache_${suggestion.toLowerCase()}`
      if (typeof localStorage === 'undefined' || localStorage.getItem(key)) return
      try {
        const res = await fetch('/api/wine-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: suggestion,
            language,
            wines: wineData[language],
            history: [],
            excludeIds: [],
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        const { message: assistantText, recommendations } = data as { message: string; recommendations: WineType[] }
        localStorage.setItem(key, JSON.stringify({ assistantText, recommendations }))
      } catch {
        // Ignore caching errors
      }
    })
  }, [isClient, language, messages.length])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeChat()
    }
  }, [isOpen])

  // Update greeting message when language changes
  useEffect(() => {
    if (messages.length > 0) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === "greeting" ? { ...message, content: getTranslation(language, "greeting") } : message,
        ),
      )
    }
    // Update suggestions when language changes
    updateSuggestions()
  }, [language])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const updateSuggestions = () => {
    // Load dynamic suggestions for current language
    const topSuggestions = suggestionsDB.getTopSuggestions(language, 6)
    const fallbackSuggestions = suggestionsDB.getFallbackSuggestions(language)

    // Always ensure we have exactly 6 suggestions
    let finalSuggestions: string[] = []

    if (topSuggestions.length >= 6) {
      finalSuggestions = topSuggestions.slice(0, 6)
    } else {
      // Combine stored suggestions with fallbacks to get exactly 6
      finalSuggestions = [...topSuggestions]
      const needed = 6 - topSuggestions.length
      const availableFallbacks = fallbackSuggestions.filter(
        (fallback) => !topSuggestions.some((stored) => stored.toLowerCase().trim() === fallback.toLowerCase().trim()),
      )
      finalSuggestions.push(...availableFallbacks.slice(0, needed))
    }

    // If still not enough, pad with remaining fallbacks
    if (finalSuggestions.length < 6) {
      const remaining = 6 - finalSuggestions.length
      const allFallbacks = suggestionsDB.getFallbackSuggestions(language)
      for (let i = 0; i < remaining && i < allFallbacks.length; i++) {
        if (!finalSuggestions.includes(allFallbacks[i])) {
          finalSuggestions.push(allFallbacks[i])
        }
      }
    }

    setDynamicSuggestions(finalSuggestions.slice(0, 6))
  }

  const initializeChat = () => {
    // Add greeting message when chatbot opens
    const greetingMessage: ChatMessage = {
      id: "greeting",
      role: "assistant",
      content: getTranslation(language, "greeting"),
      timestamp: new Date(),
    }
    setMessages([greetingMessage])
    setShowSuggestions(true)
    updateSuggestions()
  }

  const clearChat = () => {
    setMessages([])
    // reset shown IDs and query
    setLastQuery("")
    setShownIds([])
    setShowSuggestions(true)
    setInput("")
    initializeChat()
  }

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage)
    // Notify parent component about language change
    onLanguageChange?.(newLanguage)

    // Emit custom event for other components
    window.dispatchEvent(new CustomEvent("languageChange", { detail: newLanguage }))

    // Reset suggestions when language changes
    if (messages.length === 1) {
      setShowSuggestions(true)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    setShowSuggestions(false)
    // Auto-submit the suggestion
    setTimeout(() => {
      const form = document.querySelector("form")
      if (form) {
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
      }
    }, 100)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userQuery = input.trim()
    setShowSuggestions(false) // Hide suggestions after first message

    // Add query to suggestions database
    suggestionsDB.addQuery(userQuery, language)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    // Initialize pagination state
    setLastQuery(userQuery)
    setShownIds([])
    setInput("")
    setIsLoading(true)

    try {
      // Call AI-powered recommendation API
      const response = await fetch("/api/wine-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          language,
          wines: wineData[language] as WineType[],
          history: messages,
          excludeIds: shownIds,
        }),
      })
      if (!response.ok) {
        throw new Error("Failed to get wine advice")
      }
      const result = await response.json()
      console.log('result', result)
      console.log('shownIds', shownIds)
      // AI message
      // Clean out the RECOMMENDED_IDS line and any URLs before displaying
      // Clean AI message text
      let cleanText = result.message
        //.replace(/\s*RECOMMENDED_IDS:?\s*\[[^\]]*\]\s*/i, '')
        .replace(/https?:\/\/\S+/g, '')
        // Unwrap bold markdown (remove **)
        .replace(/\*\*(.*?)\*\*/g, '$1')
        // Remove leading AI summary like "Here are 16 wines:" if present
        .replace(/\bHere are\s*\d+\s*wines\b:?[\s]*/i, '')
        .trim()
      // Fallback header if empty
      if (!cleanText) {
        cleanText = getTranslation(language, 'recommendations')
      }
      // Parse numbered comment lines
      const commentLines = cleanText
        .split(/\r?\n/)
        .filter((l) => /^\s*\d+\./.test(l))
        .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
      // Store comments aligned with recs
      setRecComments(commentLines)
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: cleanText,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      // Recommendations and food pairing based on recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        console.log('inside recommendations', result.recommendations)
        // Ensure we have up to 16 recommendations by padding if needed
        const recs = result.recommendations as WineType[]
        // Build full list for pagination, aiming for 16, preferring same-color wines
        const fullRecs = [...recs]
        console.log('fullRecs-1', fullRecs)
        if (fullRecs.length < 16) {
          const lowerQuery = userQuery.toLowerCase()
          let colorKey: string | null = null
          if (lowerQuery.includes("red")) colorKey = "red"
          else if (lowerQuery.includes("white")) colorKey = "white"
          else if (lowerQuery.includes("ros")) colorKey = "rose"
          else if (lowerQuery.includes("sparkling") || lowerQuery.includes("bubbl")) colorKey = "sparkling"
          // Filter candidates by color if specified, otherwise all
          const remaining = (wineData[language] as WineType[]).filter(
            (w) => !fullRecs.find((r) => r.id === w.id)
              && (colorKey ? w.Color?.toLowerCase() === colorKey : true)
          )
          for (const w of remaining) {
            if (fullRecs.length >= 16) break
            fullRecs.push(w)
          }
        }
        setLastRecs(fullRecs)
        // Derive food pairings from recommended wines
        const allPairs = recs.flatMap((w) => w.food_pairing || [])
        const uniquePairs = Array.from(new Set(allPairs)).slice(0, 4)
        if (uniquePairs.length > 0) {
          const pairingMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            role: "assistant",
            content: `FOOD_SUGGESTIONS:${uniquePairs.join("|")}`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, pairingMessage])
        }
        console.log('fullRecs', allPairs)
        // Show first 4 recommendation cards (from padded full list)
        const initialRecs = fullRecs.slice(0, 4)
        const recommendationsMessage: ChatMessage = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: "WINE_RECOMMENDATIONS",
          timestamp: new Date(),
          recommendations: initialRecs,
          startIndex: 0,
        }
        setMessages((prev) => [...prev, recommendationsMessage])
        // Record shown IDs
        setShownIds(initialRecs.map((w) => w.id))
        // Add "Show more" button if more available in fullRec list
        if (fullRecs.length > initialRecs.length) {
          const showMoreMessage: ChatMessage = {
            id: (Date.now() + 4).toString(),
            role: "assistant",
            content: "SHOW_MORE",
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, showMoreMessage])
        }
        // Cache this response for identical future queries
        if (isClient) {
          try {
            localStorage.setItem(
              `sommelier_cache_${userQuery.toLowerCase()}`,
              JSON.stringify({ assistantText: cleanText, recommendations: fullRecs })
            )
          } catch {}
        }
      }
    } catch (error) {
      console.error("Error getting wine advice:", error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const renderMessage = (message: ChatMessage) => {
    if (message.content === "WINE_RECOMMENDATIONS") {
      const recs = message.recommendations || []
      const offset = message.startIndex || 0
      return (
        <div className="space-y-3">
          <h4 className="font-bold text-gray-900">{getTranslation(language, "recommendations")}</h4>
          {recs.map((wine, idx) => (
            <div key={wine.id} className="space-y-1">
              <div className="text-xs font-semibold text-gray-700">{offset + idx + 1}.</div>
              <WineCard wine={wine} language={language} />
            </div>
          ))}
        </div>
      )
    }
    // Food pairing suggestions bubble
    if (message.content.startsWith("FOOD_SUGGESTIONS:")) {
      const suggestions = message.content.replace("FOOD_SUGGESTIONS:", "").split("|")
      return (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">{getTranslation(language, "foodPairing")}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      )
    }
    if (message.content === "SHOW_MORE") {
      return (
        <div className="flex justify-center space-x-2">
          <button
            onClick={handleShowMore}
            className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg px-3 py-1"
          >
            {getTranslation(language, "showMore")}
          </button>
          <button
            onClick={() => setShowCompare(true)}
            className="text-xs bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg px-3 py-1"
          >
            {getTranslation(language, "compare") || 'Compare'}
          </button>
        </div>
      )
    }

    if (message.content.startsWith("FOOD_PAIRINGS:")) {
      const pairings = message.content.replace("FOOD_PAIRINGS:", "").split("|")

      return (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">{getTranslation(language, "foodPairing")}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {pairings.map((pairing, index) => (
              <li key={index}>{pairing}</li>
            ))}
          </ul>
        </div>
      )
    }

    return (
      <div className={`whitespace-pre-wrap text-sm ${message.role === "user" ? "text-white" : "text-gray-700"}`}>
        {message.content}
      </div>
    )
  }

  // State to trigger one-time bounce-in animation on open
  const [justOpened, setJustOpened] = useState(false)
  // Listen for open state to trigger animation
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isOpen) {
      setJustOpened(true)
      // Remove flag after animation duration
      timer = setTimeout(() => setJustOpened(false), 500)
    }
    return () => clearTimeout(timer)
  }, [isOpen])
  // Always render to allow smooth open/close animation
  // Control visibility via scale + opacity with transitions
  const baseClasses =
    'transform fixed bottom-4 right-4 w-96 h-[600px] z-50 transition-transform transition-opacity duration-300 ease-in-out origin-bottom-right'
  const openClasses = 'scale-100 opacity-100'
  const closedClasses = 'scale-95 opacity-0 pointer-events-none'
  let wrapperClass = isOpen
    ? `${baseClasses} ${openClasses}`
    : `${baseClasses} ${closedClasses}`
  // Apply one-time bounce-in on open
  if (justOpened && isOpen) {
    wrapperClass += ' animate-bounce-in'
  }
  return (
    <>  {/* Wrapper fragment for smooth animation and compare popup */}
      <div className={wrapperClass}>
      <div className="absolute inset-0 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-red-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5" />
          <h3 className="font-semibold">{getTranslation(language, "title")}</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Chat Button */}
          <button
            onClick={clearChat}
            className="hover:bg-red-700 p-1 rounded"
            title={getTranslation(language, "clearChat")}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="text-xs bg-red-700 text-white border border-red-500 rounded px-1 py-0.5"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="nl">NL</option>
          </select>

          <button onClick={onClose} className="hover:bg-red-700 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === "user" ? "bg-red-600 text-white font-medium" : "bg-gray-100 text-gray-900"
              }`}
            >
              {renderMessage(message)}
            </div>
          </div>
        ))}

        {/* Dynamic Suggestion Prompts - Always show exactly 6 */}
        {showSuggestions && messages.length === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">{getTranslation(language, "suggestionsTitle")}</p>
            <div className="grid grid-cols-1 gap-2">
              {dynamicSuggestions.map((suggestion, index) => (
                <button
                  key={`${language}-${index}-${suggestion}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-2 transition-colors text-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={getTranslation(language, "placeholder")}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
      </div> {/* inner content wrapper */}
    </div> {/* animated wrapper */}
      {/* Compare Wines Popup */}
      {/* Pass the last assistant free-text to compare popup */}
      {/* Pass full AI assistant text to compare popup */}
      {/* Pass full AI recommendation text to compare popup */}
      {showCompare && (
        <ComparePopup
          wines={lastRecs}
          language={language}
          recommendationText={
            messages
              .slice()
              .reverse()
              .find(
                (m) => m.role === 'assistant' && m.content && m.content !== 'SHOW_MORE'
              )?.content || ''
          }
          isOpen={showCompare}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  )
}
