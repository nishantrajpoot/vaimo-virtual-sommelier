import { NextResponse } from 'next/server'
import data_EN from '@/data/data_EN.json'
import data_FR from '@/data/data_FR.json'
import data_NL from '@/data/data_NL.json'
import type { Wine, Language } from '@/types/wine'

/**
 * GET /api/wines?lang={en|fr|nl}
 * Returns the list of wines for the requested language.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const lang = (url.searchParams.get('lang') || 'fr') as Language
  let wines: Wine[] = []
  switch (lang) {
    case 'en':
      wines = data_EN as Wine[]
      break
    case 'nl':
      wines = data_NL as Wine[]
      break
    case 'fr':
    default:
      wines = data_FR as Wine[]
  }
  return NextResponse.json(wines)
}
