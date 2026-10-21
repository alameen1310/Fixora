import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from './LanguageContext.jsx'
import { translateDynamicText } from './dynamicTranslation.js'
import { translateInterface } from './catalog.js'
import './translated-text.css'

export default function TranslatedText({ as: Tag = 'span', children, className }) {
  const original = typeof children === 'string' ? children : ''
  const { language, t } = useLanguage()
  const { user } = useAuth()
  const [translation, setTranslation] = useState(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [translating, setTranslating] = useState(false)

  // Before an AI result exists, translate matching catalogue phrases when possible.
  const catalogueResult = language !== 'en' ? translateInterface(language, original) : original
  const displayed = showOriginal ? original : translation || catalogueResult
  const wasTranslated = Boolean(translation || catalogueResult !== original)
  async function acceptAndTranslate() {
    try { localStorage.setItem('fixora.ai-translation-consent', '1') } catch { /* The current choice still applies. */ }
    setConsentOpen(false)
    setTranslating(true)
    const result = await translateDynamicText(original, language)
    setTranslation(result)
    setTranslating(false)
  }
  return <Tag className={className}>
    {displayed}
    {wasTranslated && <button aria-label={showOriginal ? t('Show translation') : t('Show original')} className="translated-text__toggle" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowOriginal((value) => !value) }} type="button">{showOriginal ? t('Show translation') : t('Original')}</button>}
    {!wasTranslated && !showOriginal && language !== 'en' && user?.id && catalogueResult === original && <button className="translated-text__toggle" disabled={translating} onClick={(event) => { event.preventDefault(); event.stopPropagation(); try { if (localStorage.getItem('fixora.ai-translation-consent') === '1') void acceptAndTranslate(); else setConsentOpen(true) } catch { setConsentOpen(true) } }} type="button">{translating ? t('Translating…') : t('Translate')}</button>}
    {consentOpen && <span aria-label={t('AI translation privacy notice')} className="translated-text__consent" onClick={(event) => event.stopPropagation()} role="dialog"><span>{t('AI translation uses Google Gemini. The text may be processed to improve Google products under its free-tier terms. Translate only public marketplace text; names, phone numbers, emails and links are masked where detected.')}</span><button onClick={() => { setConsentOpen(false) }} type="button">{t('Cancel')}</button><button onClick={() => void acceptAndTranslate()} type="button">{t('Allow and translate')}</button></span>}
  </Tag>
}
