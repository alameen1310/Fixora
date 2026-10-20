import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import AuthLayout from './AuthLayout.jsx'
import SignupForm from './SignupForm.jsx'
import { SegmentedControl } from './UiPrimitives.jsx'
import './SignupExperience.css'

gsap.registerPlugin(useGSAP)

const experiences = {
  customer: {
    audienceLabel: 'For your home',
    title: 'Find help for the work ahead.',
    introduction: 'Create an account to explore skilled professionals on Fixora.',
  },
  provider: {
    audienceLabel: 'For your craft',
    title: 'Make your skills easier to find.',
    introduction: 'Create your professional account to list your services and reach customers in your area.',
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

    })

    return () => motion.revert()
  }, { scope: pageRef })

  return (
    <AuthLayout wide>
      <main className="signup-layout" ref={pageRef}>
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

      </main>
    </AuthLayout>
  )
}
