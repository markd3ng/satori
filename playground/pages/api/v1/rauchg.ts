import type { NextRequest } from 'next/server'
import React from 'react'
import satori from 'satori'

import { languageFontMap } from '../../../utils/font'
import { apis, getIconCode, loadEmoji } from '../../../utils/twemoji'

export const config = {
  runtime: 'experimental-edge',
}

type EmojiType = keyof typeof apis

type RauchgOptions = {
  width: number
  height: number
  debug: boolean
  embedFont: boolean
  emojiType: EmojiType
  fontFamily: string
  googleFonts: string[]
  title?: string
  contents?: string
  badgeText: string
  background: string
  panelBackground: string
  panelColor: string
  badgeBackground: string
  badgeColor: string
  fontSize: number
  badgeFontSize: number
  maxWidth: number
  lineHeight: number
  letterSpacing: string
  fontWeight: number
  logoLeft: number
  logoTop: number
  badgeSize: number
  badgeGap: number
  panelPaddingY: number
  panelPaddingX: number
  panelMarginX: number
}

const DEFAULTS: RauchgOptions = {
  width: 800,
  height: 400,
  debug: false,
  embedFont: true,
  emojiType: 'twemoji',
  fontFamily: 'Inter',
  googleFonts: [],
  title: undefined,
  contents: undefined,
  badgeText: 'rauchg.com',
  background: 'white',
  panelBackground: 'black',
  panelColor: 'white',
  badgeBackground: 'black',
  badgeColor: 'black',
  fontSize: 40,
  badgeFontSize: 20,
  maxWidth: 550,
  lineHeight: 1.4,
  letterSpacing: '-.02em',
  fontWeight: 700,
  logoLeft: 42,
  logoTop: 42,
  badgeSize: 24,
  badgeGap: 8,
  panelPaddingY: 20,
  panelPaddingX: 50,
  panelMarginX: 42,
}

const boolTrue = new Set(['1', 'true', 'yes', 'on'])
const boolFalse = new Set(['0', 'false', 'no', 'off'])

const baseFontCache = new Map<string, Promise<ArrayBuffer>>()
const googleFontCache = new Map<string, Promise<ArrayBuffer | null>>()

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  integer = true
): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(integer ? Math.round(value) : value, min, max)
  }
  if (typeof value !== 'string') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return clamp(integer ? Math.round(n) : n, min, max)
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (boolTrue.has(normalized)) return true
  if (boolFalse.has(normalized)) return false
  return fallback
}

function parseString(
  value: unknown,
  fallback: string | undefined,
  maxLen = 300
): string | undefined {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next) return fallback
  return next.slice(0, maxLen)
}

function parseColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next || next.length > 80) return fallback
  if (/[;{}<>]/.test(next)) return fallback
  return next
}

function parseDimensionLetterSpacing(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${clamp(value, -10, 10)}px`
  }
  if (typeof value !== 'string') return fallback
  const next = value.trim()
  if (!next || next.length > 20 || /[;{}<>]/.test(next)) return fallback
  return next
}

function parseFontList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 6)
  }

  if (typeof input !== 'string') return []

  return input
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function normalizeGoogleFamily(name: string): string {
  return name.replace(/\s+/g, '+')
}

function getCombinedText(title?: string, contents?: string): string {
  const lines = [title, contents].filter(Boolean)
  if (lines.length === 0) return 'Making the Web. Faster.'
  return lines.join('\n')
}

async function fetchPublicFont(
  origin: string,
  fileName: string
): Promise<ArrayBuffer> {
  const key = `${origin}/${fileName}`
  if (!baseFontCache.has(key)) {
    baseFontCache.set(
      key,
      fetch(`${origin}/${fileName}`).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${fileName}: ${res.status}`)
        }
        return res.arrayBuffer()
      })
    )
  }
  const cached = baseFontCache.get(key)
  if (!cached) {
    throw new Error(`Font cache missing for ${fileName}`)
  }
  return cached
}

async function fetchGoogleFont(
  text: string,
  family: string
): Promise<ArrayBuffer | null> {
  const key = `${family}::${text}`
  if (!googleFontCache.has(key)) {
    googleFontCache.set(
      key,
      (async () => {
        const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(
          text
        )}`
        const css = await (
          await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
            },
          })
        ).text()

        const resource = css.match(
          /src: url\((.+)\) format\('(opentype|truetype)'\)/
        )
        if (!resource) return null

        const res = await fetch(resource[1])
        if (!res.ok) return null
        return res.arrayBuffer()
      })()
    )
  }

  const cached = googleFontCache.get(key)
  if (!cached) {
    throw new Error(`Google font cache missing for ${family}`)
  }
  return cached
}

async function buildFonts(
  origin: string,
  text: string,
  options: RauchgOptions
) {
  const interRegular = await fetchPublicFont(
    origin,
    'inter-latin-ext-400-normal.woff'
  )
  const interBold = await fetchPublicFont(
    origin,
    'inter-latin-ext-700-normal.woff'
  )

  const fonts: Array<{
    name: string
    data: ArrayBuffer
    weight?: number
    style?: 'normal' | 'italic'
    lang?: string
  }> = [
    { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
    { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
  ]

  const externalFamilies = options.googleFonts.map(normalizeGoogleFamily)
  const externalData = await Promise.all(
    externalFamilies.map(async (family) => ({
      family,
      data: await fetchGoogleFont(text, family),
    }))
  )

  for (const item of externalData) {
    if (item.data) {
      fonts.push({
        name: item.family,
        data: item.data,
        weight: 400,
        style: 'normal',
      })
    }
  }

  return fonts
}

async function loadAdditionalAsset(
  emojiType: EmojiType,
  code: string,
  text: string
) {
  if (code === 'emoji') {
    return `data:image/svg+xml;base64,${btoa(
      await loadEmoji(emojiType, getIconCode(text))
    )}`
  }

  const codes = code.split('|')
  const names = codes
    .map(
      (langCode) => languageFontMap[langCode as keyof typeof languageFontMap]
    )
    .filter(Boolean)

  if (names.length === 0) return []

  const flatNames = names.flat().map(normalizeGoogleFamily)

  const loaded = await Promise.all(
    flatNames.map(async (family) => ({
      family,
      data: await fetchGoogleFont(text, family),
    }))
  )

  return loaded
    .filter(
      (item): item is { family: string; data: ArrayBuffer } => !!item.data
    )
    .map((item) => ({
      name: item.family,
      data: item.data,
      weight: 400,
      style: 'normal' as const,
    }))
}

function getFromAny(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key]
    }
  }
  return undefined
}

function parseOptions(source: Record<string, unknown>): RauchgOptions {
  const fontsValue = getFromAny(source, ['fonts', 'font', 'fontFamily'])
  const fontList = parseFontList(fontsValue)
  const primaryFont = fontList[0]
    ? normalizeGoogleFamily(fontList[0])
    : DEFAULTS.fontFamily

  return {
    width: parseNumber(source.width, DEFAULTS.width, 100, 2000),
    height: parseNumber(source.height, DEFAULTS.height, 100, 2000),
    debug: parseBoolean(source.debug, DEFAULTS.debug),
    embedFont: parseBoolean(
      getFromAny(source, ['embedFont', 'fontEmbed']),
      DEFAULTS.embedFont
    ),
    emojiType:
      (parseString(source.emojiType, DEFAULTS.emojiType, 20) as EmojiType) in
      apis
        ? (parseString(source.emojiType, DEFAULTS.emojiType, 20) as EmojiType)
        : DEFAULTS.emojiType,
    fontFamily:
      parseString(source.fontFamily, primaryFont, 80) || DEFAULTS.fontFamily,
    googleFonts: fontList,
    title: parseString(source.title, DEFAULTS.title, 200),
    contents: parseString(
      getFromAny(source, ['contents', 'content', 'description']),
      DEFAULTS.contents,
      500
    ),
    badgeText:
      parseString(
        getFromAny(source, ['badgeText', 'logoText', 'site']),
        DEFAULTS.badgeText,
        80
      ) || DEFAULTS.badgeText,
    background: parseColor(source.background, DEFAULTS.background),
    panelBackground: parseColor(
      getFromAny(source, ['panelBackground', 'contentBackground']),
      DEFAULTS.panelBackground
    ),
    panelColor: parseColor(
      getFromAny(source, ['panelColor', 'textColor', 'color']),
      DEFAULTS.panelColor
    ),
    badgeBackground: parseColor(
      getFromAny(source, ['badgeBackground', 'logoBackground']),
      DEFAULTS.badgeBackground
    ),
    badgeColor: parseColor(
      getFromAny(source, ['badgeColor', 'logoColor']),
      DEFAULTS.badgeColor
    ),
    fontSize: parseNumber(source.fontSize, DEFAULTS.fontSize, 16, 160),
    badgeFontSize: parseNumber(
      source.badgeFontSize,
      DEFAULTS.badgeFontSize,
      10,
      64
    ),
    maxWidth: parseNumber(source.maxWidth, DEFAULTS.maxWidth, 200, 2000),
    lineHeight: parseNumber(
      source.lineHeight,
      DEFAULTS.lineHeight,
      1,
      3,
      false
    ),
    letterSpacing: parseDimensionLetterSpacing(
      source.letterSpacing,
      DEFAULTS.letterSpacing
    ),
    fontWeight: parseNumber(source.fontWeight, DEFAULTS.fontWeight, 100, 900),
    logoLeft: parseNumber(source.logoLeft, DEFAULTS.logoLeft, 0, 500),
    logoTop: parseNumber(source.logoTop, DEFAULTS.logoTop, 0, 500),
    badgeSize: parseNumber(source.badgeSize, DEFAULTS.badgeSize, 8, 120),
    badgeGap: parseNumber(source.badgeGap, DEFAULTS.badgeGap, 0, 80),
    panelPaddingY: parseNumber(
      source.panelPaddingY,
      DEFAULTS.panelPaddingY,
      0,
      200
    ),
    panelPaddingX: parseNumber(
      source.panelPaddingX,
      DEFAULTS.panelPaddingX,
      0,
      300
    ),
    panelMarginX: parseNumber(
      source.panelMarginX,
      DEFAULTS.panelMarginX,
      0,
      300
    ),
  }
}

function toObjectFromQuery(req: NextRequest): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const params = req.nextUrl.searchParams

  for (const key of new Set(params.keys())) {
    const all = params.getAll(key)
    out[key] = all.length > 1 ? all : all[0]
  }

  return out
}

async function toObjectFromBody(
  req: NextRequest
): Promise<Record<string, unknown>> {
  try {
    const json = await req.json()
    if (json && typeof json === 'object') {
      return json as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function createRauchgElement(opts: RauchgOptions) {
  const contentText = getCombinedText(opts.title, opts.contents)

  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        height: '100%',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        letterSpacing: opts.letterSpacing,
        fontWeight: opts.fontWeight,
        background: opts.background,
        fontFamily: `${opts.fontFamily}, Inter, sans-serif`,
      },
    },
    React.createElement(
      'div',
      {
        style: {
          left: opts.logoLeft,
          top: opts.logoTop,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
        },
      },
      React.createElement('span', {
        style: {
          width: opts.badgeSize,
          height: opts.badgeSize,
          background: opts.badgeBackground,
        },
      }),
      React.createElement(
        'span',
        {
          style: {
            marginLeft: opts.badgeGap,
            fontSize: opts.badgeFontSize,
            color: opts.badgeColor,
          },
        },
        opts.badgeText
      )
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          padding: `${opts.panelPaddingY}px ${opts.panelPaddingX}px`,
          margin: `0 ${opts.panelMarginX}px`,
          fontSize: opts.fontSize,
          width: 'auto',
          maxWidth: opts.maxWidth,
          textAlign: 'center',
          backgroundColor: opts.panelBackground,
          color: opts.panelColor,
          lineHeight: opts.lineHeight,
          whiteSpace: 'pre-wrap',
        },
      },
      contentText
    )
  )
}

export default async function handler(req: NextRequest) {
  if (req.nextUrl.pathname !== '/api/v1/rauchg') return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET, POST',
      },
    })
  }

  try {
    const queryInput = toObjectFromQuery(req)
    const bodyInput = req.method === 'POST' ? await toObjectFromBody(req) : {}
    const merged = {
      ...bodyInput,
      ...queryInput,
    }

    const options = parseOptions(merged)
    const contentText = getCombinedText(options.title, options.contents)
    const origin = req.nextUrl.origin

    const fonts = await buildFonts(
      origin,
      `${options.badgeText} ${contentText}`,
      options
    )

    const svg = await satori(createRauchgElement(options), {
      width: options.width,
      height: options.height,
      debug: options.debug,
      embedFont: options.embedFont,
      fonts,
      loadAdditionalAsset: (code: string, text: string) =>
        loadAdditionalAsset(options.emojiType, code, text),
    })

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control':
          'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: 'Failed to generate image',
        message,
      }),

      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
