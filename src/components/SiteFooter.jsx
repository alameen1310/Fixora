import './SiteFooter.css'
import { useLanguage } from '../i18n/LanguageContext.jsx'

export default function SiteFooter() {
  const { t } = useLanguage()
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a className="footer-wordmark" href="#top">
            <span aria-hidden="true" className="footer-mark">f.</span>
            fixora
          </a>
          <p>{t('Find the skill behind the fix.')}</p>
        </div>
        <nav aria-label="Footer navigation" className="site-footer__links">
          <a href="#discovery">{t('Discover')}</a>
          <a href="#how-it-works">{t('How it works')}</a>
          <a href="#for-customers">{t('For customers')}</a>
          <a href="#for-professionals">{t('For professionals')}</a>
        </nav>
        <a className="footer-back-top" href="#top">
          {t('Back to top')} <span aria-hidden="true">↑</span>
        </a>
      </div>
      <div className="site-footer__bottom">
        <span>{t('Fixora is a product concept in progress.')}</span>
        <span>{t('Photography is illustrative. No listings or profiles shown are live.')}</span>
      </div>
    </footer>
  )
}
