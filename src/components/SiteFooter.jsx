import './SiteFooter.css'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <a className="footer-wordmark" href="#top">
            <span aria-hidden="true" className="footer-mark">f.</span>
            fixora
          </a>
          <p>Find the skill behind the fix.</p>
        </div>
        <nav aria-label="Footer navigation" className="site-footer__links">
          <a href="#discovery">Discover</a>
          <a href="#how-it-works">How it works</a>
          <a href="#for-customers">For customers</a>
          <a href="#for-professionals">For professionals</a>
        </nav>
        <a className="footer-back-top" href="#top">
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </div>
      <div className="site-footer__bottom">
        <span>Fixora is a product concept in progress.</span>
        <span>Photography is illustrative. No listings or profiles shown are live.</span>
      </div>
    </footer>
  )
}
