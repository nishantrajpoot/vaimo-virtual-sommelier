import { NextResponse } from 'next/server'
import type { Language } from '@/types/wine'

/**
 * GET /api/scrape-wines?lang={en|fr|nl}
 * Demonstrates server-side fetch with browser-like headers.
 * Returns raw HTML string for further processing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const lang = (url.searchParams.get('lang') || 'fr') as Language
  const endpoints: Record<Language, string> = {
    fr: 'https://www.delhaize.be/fr/shop/Vins-and-bulles/c/v2WIN?q=%3Arelevance&sort=relevance',
    en: 'https://www.delhaize.be/en/shop/Wines-and-sparkling/c/v2WIN?q=%3Arelevance&sort=relevance',
    nl: 'https://www.delhaize.be/nl/shop/Wijnen-en-bubbels/c/v2WIN?q=%3Arelevance&sort=relevance',
  }
  const target = endpoints[lang]
  try {
    const resp = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language':
          lang === 'fr'
            ? 'fr-BE,fr;q=0.9,en;q=0.8'
            : lang === 'nl'
            ? 'nl-BE,nl;q=0.9,en;q=0.8'
            : 'en-BE,en;q=0.9,fr;q=0.8',
        'Referer': 'https://www.delhaize.be/',
        'Connection': 'keep-alive',
      },
    })
    const html = await resp.text()
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: 'Failed to scrape content' }, { status: 500 })
  }
}
