import { Translate } from '@phosphor-icons/react'
import { useLanguage } from './LanguageContext.jsx'
import './language-selector.css'

export default function LanguageSelector({ compact = false }) {
  const { language, languages, setLanguage, t } = useLanguage()
  const selected = languages.find(({ code }) => code === language)
  return <label className={`language-selector${compact ? ' language-selector--compact' : ''}`}>
    <span className="language-selector__label"><Translate aria-hidden="true" size={18} />{t('App language')}</span>
    <select aria-label={t('App language')} onChange={(event) => { void setLanguage(event.target.value) }} value={language}>
      {languages.map(({ code, nativeName }) => <option key={code} value={code}>{nativeName}</option>)}
    </select>
    {compact && selected ? <span className="language-selector__current">{selected.nativeName}</span> : null}
  </label>
}

