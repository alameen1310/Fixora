import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SignupForm from './SignupForm.jsx'
import PwaControls from './PwaControls.jsx'
import kitchenWork from '../assets/kitchen-renovation.jpg'
import finishedKitchen from '../assets/finished-kitchen.jpg'
import plumberAtWork from '../assets/plumber-at-work.png'
import './SignupExperience.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const experiences = {
  customer: {
    audienceLabel: 'For your home',
    title: 'Find help for the work ahead.',
    introduction:
      'Create an account to explore skilled professionals through the problems they solve and the projects they share.',
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
    introduction:
      'Create a professional presence, showcase the work you do, and find household projects that fit your skills.',
    primaryImage: plumberAtWork,
    primaryAlt: 'Plumber working on exposed residential bathroom pipes',
    detailImage: finishedKitchen,
    detailAlt: 'Finished kitchen project with a central island and light cabinetry',
    storyTitle: 'Let the work speak clearly.',
    storyCopy: 'Projects and useful details can help customers understand what you do.',
  },
}

function HouseMark() {
  return (
    <svg aria-hidden="true" className="signup-brand__mark" fill="none" viewBox="0 0 40 40">
      <path d="M6.5 18.25 20 7l13.5 11.25V33H6.5V18.25Z" />
      <path d="M15.5 33V22.5h9V33M6.5 18.25 20 7l13.5 11.25" />
      <path d="m27.5 11.5 4.25-3.25v7" />
    </svg>
  )
}

export default function SignupExperience({ audience }) {
  const pageRef = useRef(null)
  const experience = experiences[audience]

  useGSAP(() => {
    const motion = gsap.matchMedia()

    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } })

      entrance.from('[data-signup-enter]', {
        autoAlpha: 0,
        y: 20,
        duration: 0.65,
        stagger: 0.08,
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

      gsap.fromTo(
        '.signup-visual__detail',
        { autoAlpha: 0.4, x: 20, y: 16, scale: 0.9 },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: '.signup-visual',
            start: 'top 85%',
            end: 'top 42%',
            scrub: 0.45,
          },
        },
      )
    })

    return () => motion.revert()
  }, { scope: pageRef })

  return (
    <div className="signup-page" ref={pageRef}>
      <header className="signup-header">
        <Link aria-label="Fixora home" className="signup-brand" to="/">
          <HouseMark />
          <span>fixora</span>
        </Link>
        <div className="signup-header__actions">
          <PwaControls />
          <Link aria-label="Return to the Fixora home page" className="signup-header__back" to="/">
            <span aria-hidden="true">←</span> Back to Fixora
          </Link>
        </div>
      </header>

      <main className="signup-layout">
        <section aria-labelledby="signup-title" className="signup-form-column">
          <div className="signup-intro" data-signup-enter>
            <span className="signup-eyebrow">{experience.audienceLabel}</span>
            <h1 id="signup-title">{experience.title}</h1>
            <p>{experience.introduction}</p>
            <p className="signup-switch">
              {audience === 'customer'
                ? 'Want to offer your services instead?'
                : 'Looking for help at home?'}{' '}
              <Link to={audience === 'customer' ? '/signup/provider' : '/signup/customer'}>
                Sign up as a {audience === 'customer' ? 'professional' : 'customer'}
              </Link>
            </p>
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
        <span>Fixora is a product concept in progress.</span>
        <Link to="/">Return to the home page</Link>
      </footer>
    </div>
  )
}
