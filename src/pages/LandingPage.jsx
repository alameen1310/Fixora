import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight as ArrowUpRightIcon, ArrowDown } from '@phosphor-icons/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import SiteHeader from '../components/SiteHeader.jsx'
import StepAccordion from '../components/StepAccordion.jsx'
import ProjectStoryCarousel from '../components/ProjectStoryCarousel.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import serviceCategories from '../data/serviceCategories.js'
import heroPhoto from '../assets/plumber-at-work.png'
import renovationPhoto from '../assets/kitchen-renovation.jpg'
import completedPhoto from '../assets/finished-kitchen.jpg'
import './LandingPage.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const revealText = 'A real problem becomes easier to solve when you can see the work, understand the skill, and compare what matters.'

function ServiceMarquee() {
  const repeatedServices = [...serviceCategories, ...serviceCategories]

  return (
    <div aria-label="Household service categories" className="service-marquee" role="region">
      <span className="service-marquee__label">For the work that makes a house a home</span>
      <div className="service-marquee__window">
        <div aria-hidden="true" className="service-marquee__track">
          {repeatedServices.map((service, index) => (
            <span className="service-marquee__item" key={`${service}-${index}`}>
              <span className="service-marquee__spark" />
              {service}
            </span>
          ))}
        </div>
        <div className="visually-hidden">{serviceCategories.join(', ')}</div>
      </div>
    </div>
  )
}

function StoryRevealText() {
  return (
    <p className="discovery-copy__reveal">
      {revealText.split(' ').map((word, index) => (
        <span data-reveal-word key={`${word}-${index}`}>
          {word}{' '}
        </span>
      ))}
    </p>
  )
}

function ArrowUpRight() {
  return <ArrowUpRightIcon aria-hidden="true" className="arrow-up-right" size={18} weight="regular" />
}

export default function LandingPage() {
  const pageRef = useRef(null)

  useGSAP(() => {
    const media = gsap.matchMedia()

    media.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        desktop: '(min-width: 1024px)',
      },
      ({ conditions }) => {
        if (conditions.reduceMotion) return

        gsap.from('[data-hero-enter]', {
          autoAlpha: 0,
          y: 24,
          duration: 0.85,
          stagger: 0.12,
          ease: 'power2.out',
          clearProps: 'all',
        })

        gsap.utils.toArray('[data-scroll-reveal]').forEach((element) => {
          gsap.from(element, {
            autoAlpha: 0,
            y: 28,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: element,
              start: 'top 82%',
              once: true,
            },
          })
        })

        const words = gsap.utils.toArray('[data-reveal-word]')
        gsap.fromTo(
          words,
          { opacity: 0.22 },
          {
            opacity: 1,
            ease: 'none',
            stagger: 0.035,
            scrollTrigger: {
              trigger: '.discovery-copy__reveal',
              start: 'top 76%',
              end: 'bottom 48%',
              scrub: 0.6,
            },
          },
        )

        if (conditions.desktop) {
          const discovery = pageRef.current.querySelector('.discovery-section')
          const intro = pageRef.current.querySelector('.discovery-intro')

          ScrollTrigger.create({
            trigger: discovery,
            start: 'top top+=112',
            end: 'bottom bottom',
            pin: intro,
            pinSpacing: false,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          })
        }
      },
    )

    return () => media.revert()
  }, { scope: pageRef })

  return (
    <div className="landing-page" id="top" ref={pageRef}>
      <SiteHeader />
      <main className="landing-main">
        <section aria-labelledby="hero-title" className="hero-section">
          <div className="hero-content">
            <div className="hero-copy">
              <span className="eyebrow hero-eyebrow" data-hero-enter>
                Household help, seen differently
              </span>
              <h1 data-hero-enter id="hero-title">
                <span>Your next home</span>
                <span>fix starts here.</span>
              </h1>
              <p className="hero-description" data-hero-enter>
                Find the right help through real projects, useful details, and the people behind the work.
              </p>
              <div className="hero-actions" data-hero-enter>
                <Link className="button button--primary" to="/signup/customer">
                  Find a professional <ArrowUpRight />
                </Link>
                <Link className="button button--tonal" to="/signup/provider">
                  Offer your services <ArrowUpRight />
                </Link>
              </div>
              <div className="hero-note" data-hero-enter>
                <span>Real needs. Demonstrated skill. A clearer way to choose.</span>
              </div>
            </div>

            <div className="hero-visual" data-hero-enter>
              <div className="hero-photo-wrap">
                <img
                  alt="Plumber working on exposed residential bathroom pipes"
                  className="hero-photo"
                  fetchPriority="high"
                  src={heroPhoto}
                />
                <div className="hero-photo-shade" />
                <div className="hero-photo-caption">
                  <span>Good work is worth seeing.</span>
                  <span className="hero-photo-caption__sub">Photography shown is illustrative.</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-bottomline">
            <span>Fixora connects household needs with skilled professionals.</span>
            <a href="#how-it-works">See how it works <ArrowDown aria-hidden="true" size={16} /></a>
          </div>
        </section>

        <ServiceMarquee />

        <section aria-labelledby="how-title" className="how-section" id="how-it-works">
          <div className="section-shell">
            <div className="how-heading" data-scroll-reveal>
              <div>
                <span className="eyebrow eyebrow--light">A better path to the right help</span>
                <h2 id="how-title">From “what’s that?” to “that’s handled.”</h2>
              </div>
              <p>
                Fixora brings the request, the professional’s work, and the decision into one clear journey.
              </p>
            </div>
            <StepAccordion />
          </div>
        </section>

        <section aria-labelledby="discovery-title" className="discovery-section" id="discovery">
          <div className="discovery-shell">
            <div className="discovery-intro">
              <span className="eyebrow">See the work behind the service</span>
              <h2 id="discovery-title">A more visual way to find your fix.</h2>
              <StoryRevealText />
              <a className="text-link" href="#for-customers">
                Discover why the details matter <ArrowUpRight />
              </a>
            </div>
            <div className="discovery-gallery" data-scroll-reveal>
              <div className="discovery-gallery__heading">
                <span>Problems, projects, people.</span>
                <span>Illustrative examples</span>
              </div>
              <ProjectStoryCarousel />
            </div>
          </div>
        </section>

        <section aria-labelledby="audience-title" className="audience-section">
          <div className="audience-heading" data-scroll-reveal>
            <span className="eyebrow">Built for both sides of the job</span>
            <h2 id="audience-title">Better choices for homes.<br />More visibility for skilled work.</h2>
          </div>

          <div className="audience-grid">
            <article className="audience-block audience-block--customer" id="for-customers" data-scroll-reveal>
              <div className="audience-block__text">
                <span className="audience-block__index">For your home</span>
                <h3>Choose with more to go on.</h3>
                <p>
                  Explore relevant experience, finished projects, and reviews to make a more informed choice for the work ahead.
                </p>
                <a className="button button--light" href="#how-it-works">
                  See the customer journey <ArrowUpRight />
                </a>
              </div>
              <div className="audience-block__visual audience-block__visual--customer">
                <img alt="Kitchen renovation underway with protected work surfaces" loading="lazy" src={renovationPhoto} />
                <span>Start with what needs fixing.</span>
              </div>
            </article>

            <article className="audience-block audience-block--professional" id="for-professionals" data-scroll-reveal>
              <div className="audience-block__visual audience-block__visual--professional">
                <img alt="Bright, completed kitchen with light cabinets and a central island" loading="lazy" src={completedPhoto} />
                <span>Show the result of your craft.</span>
              </div>
              <div className="audience-block__text">
                <span className="audience-block__index">For your craft</span>
                <h3>Let the work open doors.</h3>
                <p>
                  Put your skills, service area, and completed projects where people can find them and understand what you do.
                </p>
                <a className="button button--outline-light" href="#discovery">
                  See how work gets discovered <ArrowUpRight />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="closing-title" className="closing-section" data-scroll-reveal>
          <div className="closing-section__orb" aria-hidden="true" />
          <div className="closing-section__inner">
            <span className="eyebrow">A clearer connection starts here</span>
            <h2 id="closing-title">Good work deserves to be found.</h2>
            <p>Fixora is taking shape around the people who need a hand and the people who know how to help.</p>
            <div className="closing-section__actions">
              <Link className="button button--primary" to="/signup/customer">Find a professional <ArrowUpRight /></Link>
              <Link className="button button--outline" to="/signup/provider">Offer your services <ArrowUpRight /></Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
