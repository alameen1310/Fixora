import { useState } from 'react'
import { useLanguage } from './LanguageContext.jsx'
import { translateInterface } from './catalog.js'
import './translated-text.css'

export default function TranslatedText({ as: Tag = 'span', children, className }) {
  const original = typeof children === 'string' ? children : ''
  const { language, t } = useLanguage()
  const [showOriginal, setShowOriginal] = useState(false)

  // Static catalogue translations work offline; dynamic AI translation stays hidden
  // until the Supabase function, migration, and provider key are deployed.
  const catalogueResult = language !== 'en' ? translateInterface(language, original) : original
  const displayed = showOriginal ? original : catalogueResult
  const wasTranslated = catalogueResult !== original
  return <Tag className={className}>
    {displayed}
    {wasTranslated && <button aria-label={showOriginal ? t('Show translation') : t('Show original')} className="translated-text__toggle" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowOriginal((value) => !value) }} type="button">{showOriginal ? t('Show translation') : t('Original')}</button>}
  </Tag>
}
