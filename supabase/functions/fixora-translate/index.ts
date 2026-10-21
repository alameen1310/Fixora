import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const targets = new Set(['yo', 'ig', 'ha'])
const languages: Record<string, string> = { yo: 'Yorùbá', ig: 'Igbo', ha: 'Hausa' }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: corsHeaders })

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function maskPrivateValues(text: string) {
  const replacements: string[] = []
  const masked = text.replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d ()-]{7,}\d)/g, (match) => {
    const token = `FIXORA_PRIVATE_${replacements.length}_TOKEN`
    replacements.push(match)
    return token
  })
  return { masked, restore: (value: string) => value.replace(/FIXORA_PRIVATE_(\d+)_TOKEN/g, (token, index) => replacements[Number(index)] ?? token) }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!url || !serviceKey || !apiKey) return json(503, { error: 'Translation is not configured.' })

  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in to translate marketplace content.' })
  const authClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: userData, error: authError } = await authClient.auth.getUser()
  if (authError || !userData.user) return json(401, { error: 'Sign in to translate marketplace content.' })

  let body: { target?: string; items?: { id?: string; text?: string }[] }
  try { body = await request.json() } catch { return json(400, { error: 'Invalid request.' }) }
  if (!targets.has(body.target || '') || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 5) {
    return json(400, { error: 'Choose a supported language and send 1 to 5 text items.' })
  }
  const items = body.items.map((item) => ({ id: item?.id, text: item?.text?.trim() }))
  if (items.some((item) => typeof item.id !== 'string' || !/^[a-f0-9]{64}$/.test(item.id) || typeof item.text !== 'string' || item.text.length < 2 || item.text.length > 1600)) {
    return json(400, { error: 'Text must be between 2 and 1600 characters.' })
  }
  for (const item of items) {
    const normalized = item.text!.replace(/\s+/g, ' ').trim()
    const expectedKey = await sha256(`1\u0000auto\u0000${body.target}\u0000${normalized}`)
    if (expectedKey !== item.id) return json(400, { error: 'Translation cache key did not match the text.' })
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } })
  await db.rpc('prune_fixora_translation_cache')
  const now = new Date().toISOString()
  const maskedItems = items.map((item) => ({ ...item, ...maskPrivateValues(item.text!) }))
  const { data: cached } = await db.from('fixora_translation_cache').select('cache_key, translated_text').in('cache_key', items.map((item) => item.id!)).gt('expires_at', now)
  const maskedCache: Record<string, string> = Object.fromEntries((cached || []).map((item) => [item.cache_key, item.translated_text]))
  const translations: Record<string, string> = Object.fromEntries(maskedItems.filter(({ id }) => maskedCache[id!]).map(({ id, restore }) => [id!, restore(maskedCache[id!])]))
  const missing = items.filter((item) => !translations[item.id!])
  if (missing.length) {
    const { data: withinLimit, error: quotaError } = await db.rpc('consume_fixora_translation_quota', { p_user_id: userData.user.id })
    if (quotaError) return json(503, { error: 'Translation is temporarily unavailable.' })
    if (!withinLimit) return json(429, { error: 'Translation request limit reached. Try again in a minute.' })
    const masked = maskedItems.filter(({ id }) => missing.some((item) => item.id === id))
    const contents = masked.map(({ id, masked: text }) => `${id}\t${text}`).join('\n')
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 18_000)
    let response: Response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `Translate each tab-separated text item into natural ${languages[body.target!]}. Source language: infer it from each item. Keep the meaning, tone and Nigerian context faithful; do not add information. Preserve all proper names, Nigerian locations/addresses, currency, amounts, dates, URLs, and tokens beginning FIXORA_PRIVATE_ exactly. Return one JSON object mapping each supplied 64-character id to its translated string. No markdown.` }] },
          contents: [{ role: 'user', parts: [{ text: contents }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: Object.fromEntries(masked.map(({ id }) => [id, { type: 'STRING' }])), required: masked.map(({ id }) => id) } },
        }),
      })
    } catch {
      clearTimeout(timer)
      return json(503, { error: 'Translation is temporarily unavailable.' })
    } finally { clearTimeout(timer) }
    if (response.status === 429) return json(429, { error: 'Translation is temporarily busy. Try again shortly.' })
    if (!response.ok) return json(503, { error: 'Translation is temporarily unavailable.' })
    let raw: unknown
    try {
      const result = await response.json()
      raw = JSON.parse(result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    } catch { return json(503, { error: 'Translation returned an invalid result.' }) }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return json(503, { error: 'Translation returned an invalid result.' })
    const rows: { cache_key: string; translated_text: string; expires_at: string }[] = []
    for (const item of masked) {
      const translated = (raw as Record<string, unknown>)[item.id]
      if (typeof translated !== 'string' || translated.trim().length < 2 || translated.length > 1800) continue
      const safeTranslation = translated.trim()
      const restored = item.restore(safeTranslation)
      translations[item.id] = restored
      rows.push({ cache_key: item.id, translated_text: safeTranslation, expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() })
    }
    if (rows.length) await db.from('fixora_translation_cache').upsert(rows, { onConflict: 'cache_key' })
  }

  return json(200, { translations })
})
