"use client"

import { Poppins } from 'next/font/google'

import { useState, useEffect } from 'react'
import { WineChatbot } from '@/components/wine-chatbot'
import { CartIndicator } from '@/components/cart-indicator'
import { Wine } from 'lucide-react'
import type { Language } from '@/types/wine'

// Load Poppins font for helper text
const poppins = Poppins({ weight: '600', subsets: ['latin'] })
export default function Home() {
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [hasTapped, setHasTapped] = useState(false)
  const [language, setLanguage] = useState<Language>('fr')

  let iconToolTipTitle: string = "Need help choosing?";
  let iconToolTipDescription: string = "Chat with our wine expert specially made for you! 🍷 ";

  // Listen for language changes from chatbot
  useEffect(() => {
    const handler = (e: CustomEvent<Language>) => setLanguage(e.detail)
    window.addEventListener('languageChange', handler as EventListener)
    return () => window.removeEventListener('languageChange', handler as EventListener)
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-auto">
      {/* Full-page screenshot as scrollable image */}
      <img
        src="/delhaize-bg.png"
        alt="Delhaize wine listings"
        className="block w-full transform scale-98 origin-center"
      />
      {/* Cart Indicator positioned top-right */}
      <div className="absolute top-4 right-4 z-20">
        <CartIndicator language={language} />
      </div>

      {/* Chatbot trigger with label */}
      {!isChatbotOpen && (
        <div className="fixed bottom-4 right-4 flex flex-col items-center z-20 pulse-wrapper">
          <div className="chat-tooltip">
            <p className="pulse-icon-title">{iconToolTipTitle}</p>
            <strong>{iconToolTipDescription}</strong>
            <div className="tooltip-arrow"></div>
          </div>
          <button
            onClick={() => {
              setIsChatbotOpen(true)
              setHasTapped(true)
            }}
            className={
              `w-14 h-14 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors flex items-center justify-center${
              !hasTapped ? ' animate-pulse-widget' : ''
              }`
            }
          >
            <Wine className="w-6 h-6" />
          </button>
          {/* <span
            className={
              `${poppins.className} mt-2 text-lg tracking-[0.3px] italic text-red-600 select-none bg-white bg-opacity-75 px-3 py-1 rounded text-center`
            }
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            Not sure what to pour?
          </span> */}
        </div>
      )}

      {/* Chatbot overlay */}
      <WineChatbot
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        onLanguageChange={setLanguage}
      />
    </div>
  )
}
