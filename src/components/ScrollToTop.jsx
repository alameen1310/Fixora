import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

function scrollToPosition(top) {
  window.scrollTo({ behavior: 'instant', left: 0, top })
}

export default function ScrollToTop() {
  const { hash, key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousLocation = useRef(null)
  const scrollPositions = useRef(new Map())

  useLayoutEffect(() => {
    const previous = previousLocation.current

    if (previous) {
      scrollPositions.current.set(previous.key, window.scrollY)
    }

    if (!previous || previous.pathname !== pathname) {
      if (hash) {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)))
        if (target) target.scrollIntoView()
        else scrollToPosition(0)
      } else if (navigationType === 'POP' && scrollPositions.current.has(key)) {
        scrollToPosition(scrollPositions.current.get(key))
      } else {
        scrollToPosition(0)
      }
    }

    previousLocation.current = { key, pathname }
  }, [hash, key, navigationType, pathname])

  return null
}
