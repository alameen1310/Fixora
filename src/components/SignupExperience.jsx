import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowLeft } from '@phosphor-icons/react'
import SignupForm from './SignupForm.jsx'
import { Logo, SegmentedControl } from './UiPrimitives.jsx'
import kitchenWork from '../assets/kitchen-renovation.jpg'
import finishedKitchen from '../assets/finished-kitchen.jpg'
import plumberAtWork from '../assets/plumber-at-work.png'
import './SignupExperience.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const experiences = {
  customer: {
    audienceLabel: 'For your home',
    title: 'Find help for the work ahead.',
    introduction: 'Create an account to explore skilled professionals on Fixora.',
    primaryImage: kitchenWork,
    primaryAlt: 'Kitchen renovation underway with protected work surfaces',
    detailImage: finishedKitchen,
    detailAlt: 'Finished kitchen with a central island and light cabinetry',
    storyTitle: 'Start with what needs attention.',
    storyCopy: 'A clear picture of the work helps you discover the right kind of skill.',
  },
  provider: {
    audienceLabel: 'For your craft',
    title: 'Make your skills easier to find.',
    introduction: 'Create your professional account to list your services and reach customers in your area.',
    primaryImage: plumberAtWork,
    primaryAlt: 'Plumber working on residential bathroom pipes',
    detailImage: finishedKitchen,
    detailAlt: 'Finished kitchen project with light cabinetry',
    storyTitle: 'Let the work speak clearly.',
    storyCopy: 'Projects and useful details help customers understand what you do.',
  },
}

export default function SignupExperience({ audience }) {
  const pageRef = useRef(null)
  const navigate = useNavigate()
  const experience = experiences[audience]

  useGSAP(() => {
    const motion = gsap.matchMedia()

    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } })

      entrance.from('[data-signup-enter]', {
        autoAlpha: 0,
        y: 12,
        duration: 0.48,
        stagger: 0.06,
        clearProps: 'all',
      })

      gsap.fromTo(
        '.signup-visual__primary',
        { autoAlpha: 0.65, scale: 0.9 },
        {
          autoAlpha: 1,
          scale: 1,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: '.signup-visual',
            start: 'top 88%',
            end: 'top 44%',
            scrub: 0.5,
          },
        },
      )
    })

    return () => motion.revert()
  }, { scope: pageRef })

  return (
    <div className="signup-page" ref={pageRef}>
      <header className="signup-header">
        <Link aria-label="Back to Fixora home page" className="signup-header__back" to="/">
          <ArrowLeft aria-hidden="true" size={20} weight="bold" />
          <span>Home</span>
        </Link>
        <Logo className="signup-brand" to="/" />
        <div aria-hidden="true" className="signup-header__spacer" />
      </header>

      <main className="signup-layout">
        <section aria-labelledby="signup-title" className="signup-form-column">
          <div className="signup-intro" data-signup-enter>
            <span className="signup-eyebrow">{experience.audienceLabel}</span>
            <h1 id="signup-title">{experience.title}</h1>
            <p>{experience.introduction}</p>

            <div className="signup-account-switch">
              <SegmentedControl
                label="Choose account type"
                onChange={(val) => navigate(`/signup/${val}`)}
                options={[
                  { value: 'customer', label: 'Customer' },
                  { value: 'provider', label: 'Professional' },
                ]}
                value={audience}
              />
            </div>
          </div>
          <SignupForm audience={audience} />
        </section>

        <aside aria-label="How Fixora makes work discoverable" className="signup-story">
          <div className="signup-visual" data-signup-enter>
            <img
              alt={experience.primaryAlt}
              className="signup-visual__primary"
              src={experience.primaryImage}
            />
            <figure className="signup-visual__detail">
              <img alt={experience.detailAlt} src={experience.detailImage} />
              <figcaption>Illustrative project photo</figcaption>
            </figure>
          </div>
          <div className="signup-story__copy" data-signup-enter>
            <span className="signup-story__label">Problems, projects, people</span>
            <h2>{experience.storyTitle}</h2>
            <p>{experience.storyCopy}</p>
            <span className="signup-story__disclaimer">Example imagery only. No real profiles or listings are shown.</span>
          </div>
        </aside>
      </main>

      <footer className="signup-footer">
        <span>Fixora · Household services marketplace</span>
        <Link to="/">Return to home</Link>
      </footer>
    </div>
  )
}
