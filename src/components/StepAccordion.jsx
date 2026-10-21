import { useState } from 'react'
import './StepAccordion.css'
import { useLanguage } from '../i18n/LanguageContext.jsx'

const steps = [
  {
    title: 'Start with the real job',
    description:
      'Share what needs attention, or browse work that helps you recognize the right kind of service.',
    detail: 'A clear problem makes a better starting point.',
  },
  {
    title: 'Look at the work',
    description:
      'Compare relevant skills, completed projects, service areas, and reviews before you decide who to contact.',
    detail: 'See more than a name and a phone number.',
  },
  {
    title: 'Connect with confidence',
    description:
      'Choose a professional who fits the job and move forward with a shared understanding of what needs doing.',
    detail: 'A good match starts with clear expectations.',
  },
]

export default function StepAccordion() {
  const { t } = useLanguage()
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className="step-accordion" aria-label="How Fixora is intended to work">
      {steps.map((step, index) => {
        const isActive = activeStep === index
        const panelId = `step-panel-${index + 1}`

        return (
      <article className={`step-panel${isActive ? ' is-active' : ''}`} key={step.title}>
            <button
              aria-controls={panelId}
              aria-expanded={isActive}
              className="step-panel__trigger"
              onClick={() => setActiveStep(index)}
              type="button"
            >
              <span className="step-panel__number">0{index + 1}</span>
              <span className="step-panel__title">{t(step.title)}</span>
              <span aria-hidden="true" className="step-panel__toggle">
                {isActive ? '−' : '+'}
              </span>
            </button>
            <div className="step-panel__body" hidden={!isActive} id={panelId}>
              <p>{t(step.description)}</p>
              <span>{t(step.detail)}</span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
