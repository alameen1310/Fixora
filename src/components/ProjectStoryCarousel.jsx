import { useState } from 'react'
import plumberPhoto from '../assets/plumber-at-work.png'
import renovationPhoto from '../assets/kitchen-renovation.jpg'
import completedPhoto from '../assets/african-kitchen.jpg'
import './ProjectStoryCarousel.css'

const stories = [
  {
    type: 'An open household request',
    title: 'A kitchen repair, still in progress',
    description:
      'A renovation has paused while the remaining repair is understood and the next professional is found.',
    image: renovationPhoto,
    alt: 'Cluttered kitchen under renovation with blue painted wall section',
  },
  {
    type: 'A completed project',
    title: 'A kitchen ready for everyday life',
    description:
      'A finished space makes the quality of the work easier to see and gives a professional a project to showcase.',
    image: completedPhoto,
    alt: 'Modern finished kitchen with stainless steel appliances and open drawers.',

  },
  {
    type: 'A professional at work',
    title: 'Skill is visible in the details',
    description:
      'Photos of real work can help explain the task, the materials, and the care taken to solve it.',
    image: plumberPhoto,
    alt: 'Plumber working on exposed residential bathroom pipes',
  },
]

export default function ProjectStoryCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const visibleStories = [stories[activeIndex], stories[(activeIndex + 1) % stories.length]]

  function showStory(index) {
    setActiveIndex((index + stories.length) % stories.length)
  }

  return (
    <div
      aria-label="Illustrative Fixora project stories"
      aria-roledescription="carousel"
      className="story-carousel"
      role="region"
    >
      {visibleStories.map((story, index) => (
        <article
          aria-label={`${story.type}, story ${index + 1} of 2`}
          aria-roledescription="slide"
          className={`story-card story-card--${index + 1}`}
          data-story-card
          key={story.title}
        >
          <img alt={story.alt} className="story-card__image" src={story.image} />
          <div className="story-card__shade" />
          <div className="story-card__copy">
            <span className="story-card__type">{story.type}</span>
            <h3>{story.title}</h3>
            <p>{story.description}</p>
            <span className="story-card__note">{story.note}</span>
          </div>
        </article>
      ))}

      <span aria-live="polite" className="visually-hidden">
        Showing {visibleStories[0].title} and {visibleStories[1].title}.
      </span>

      <div aria-label="Project story controls" className="story-carousel__controls">
        <button
          aria-label="Previous project story pair"
          className="story-carousel__arrow"
          onClick={() => showStory(activeIndex - 1)}
          type="button"
        >
          <span aria-hidden="true">←</span>
        </button>
        <div aria-label={`Story pair ${activeIndex + 1} of ${stories.length}`} className="story-carousel__dots">
          {stories.map((story, index) => (
            <button
              aria-current={index === activeIndex ? 'true' : undefined}
              aria-label={`Show story pair starting with ${story.title}`}
              className={index === activeIndex ? 'is-active' : ''}
              key={story.title}
              onClick={() => showStory(index)}
              type="button"
            />
          ))}
        </div>
        <button
          aria-label="Next project story pair"
          className="story-carousel__arrow"
          onClick={() => showStory(activeIndex + 1)}
          type="button"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}
