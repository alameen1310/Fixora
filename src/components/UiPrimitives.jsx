import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CaretRight, CircleNotch, LockKey } from '@phosphor-icons/react'
import OverlayPortal from './OverlayPortal.jsx'
import './UiPrimitives.css'
import { useLanguage } from '../i18n/LanguageContext.jsx'

function translateChild(value, t) { return typeof value === 'string' ? t(value) : value }

export function Button({ as: Element = 'button', children, className = '', loading = false, type, variant = 'primary', wide = false, ...props }) {
  const { t } = useLanguage()
  const shared = {
    className: `ui-button ui-button--${variant}${wide ? ' ui-button--wide' : ''}${className ? ` ${className}` : ''}`,
    'aria-busy': loading || undefined,
    disabled: loading || props.disabled,
    ...props,
  }
  if (Element === Link) {
    return (
      <Link {...shared}>
        {loading ? <CircleNotch aria-hidden="true" className="ui-button__spinner" size={18} /> : null}
        <span className="ui-button__text">{translateChild(children, t)}</span>
      </Link>
    )
  }
  return (
    <Element {...shared} type={type || (Element === 'button' ? 'button' : undefined)}>
      {loading ? <CircleNotch aria-hidden="true" className="ui-button__spinner" size={18} /> : null}
      <span className="ui-button__text">{translateChild(children, t)}</span>
    </Element>
  )
}

export function TextLink({ as: Element = Link, children, className = '', to, href, ...props }) {
  const Component = to ? Link : (Element || 'a')
  return (
    <Component className={`ui-text-link ${className}`} href={href} to={to} {...props}>
      {children}
    </Component>
  )
}

export function IconButton({ children, className = '', label, ...props }) {
  return (
    <button aria-label={label} className={`ui-icon-button ${className}`} type="button" {...props}>
      {children}
    </button>
  )
}

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`ui-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function Logo({ className = '', to = '/' }) {
  return (
    <Link aria-label="Fixora home" className={`fixora-logo ${className}`} to={to}>
      <svg aria-hidden="true" className="fixora-logo__mark" fill="none" viewBox="0 0 40 40">
        <path d="M6.5 18.25 20 7l13.5 11.25V33H6.5V18.25Z" />
        <path d="M15.5 33V22.5h9V33M6.5 18.25 20 7l13.5 11.25" />
        <path d="m27.5 11.5 4.25-3.25v7" />
      </svg>
      <span>fixora</span>
    </Link>
  )
}

export function AuthHeader({ className = '', backTo = '/', backLabel = 'Back to Fixora home' }) {
  return (
    <header className={`ui-auth-header${className ? ` ${className}` : ''}`}>
      <Link aria-label={backLabel} className="ui-auth-header__back" to={backTo}>
        <ArrowLeft aria-hidden="true" size={22} weight="bold" />
      </Link>
      <Logo className="ui-auth-header__brand" />
      <span aria-hidden="true" className="ui-auth-header__spacer" />
    </header>
  )
}

export function ListGroup({ children, className = '' }) {
  return <div className={`ui-list-group ${className}`}>{children}</div>
}

export function ListRow({ children, className = '', icon: Icon, onClick, to, value, destructive = false, disabled = false }) {
  const content = (
    <>
      {Icon ? (
        <span className="ui-list-row__icon">
          <Icon aria-hidden="true" size={19} />
        </span>
      ) : null}
      <span className="ui-list-row__label">{children}</span>
      {value ? <span className="ui-list-row__value">{value}</span> : null}
      {to ? <CaretRight aria-hidden="true" className="ui-list-row__chevron" size={18} /> : null}
    </>
  )
  const classes = `ui-list-row${destructive ? ' ui-list-row--destructive' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`
  if (to && !disabled) return <Link className={classes} to={to}>{content}</Link>
  return <button className={classes} disabled={disabled} onClick={onClick} type="button">{content}</button>
}

export function PrivacyValue({ children }) {
  return (
    <span className="ui-private">
      <LockKey aria-hidden="true" size={14} weight="fill" />
      {children}
    </span>
  )
}

export function InputField({ error, hint, label, id, ...props }) {
  const { t } = useLanguage()
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <label className={`ui-field${error ? ' ui-field--error' : ''}`} htmlFor={id}>
      <span className="ui-field__label">{t(label)}</span>
      <input
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={Boolean(error)}
        id={id}
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : undefined}
      />
      {hint ? <small className="ui-field__hint" id={hintId}>{hint}</small> : null}
      {error ? <small className="ui-field__error" id={errorId} role="alert">{error}</small> : null}
    </label>
  )
}

export function TextareaField({ error, hint, label, id, ...props }) {
  const { t } = useLanguage()
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  return <label className={`ui-field${error ? ' ui-field--error' : ''}`} htmlFor={id}>
    <span className="ui-field__label">{t(label)}</span>
    <textarea aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined} aria-invalid={Boolean(error)} id={id} {...props} placeholder={props.placeholder ? t(props.placeholder) : undefined} />
    {hint && <small className="ui-field__hint" id={hintId}>{hint}</small>}
    {error && <small className="ui-field__error" id={errorId} role="alert">{error}</small>}
  </label>
}

export function SelectField({ children, error, hint, label, id, ...props }) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <label className={`ui-field${error ? ' ui-field--error' : ''}`} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <select
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        aria-invalid={Boolean(error)}
        id={id}
        {...props}
      >
        {children}
      </select>
      {hint ? <small className="ui-field__hint" id={hintId}>{hint}</small> : null}
      {error ? <small className="ui-field__error" id={errorId} role="alert">{error}</small> : null}
    </label>
  )
}

export function SegmentedControl({ label, options, value, onChange }) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const thumbStyle = {
    width: `calc((100% - 8px - ${(options.length - 1) * 4}px) / ${options.length})`,
    transform: `translateX(calc(${selectedIndex * 100}% + ${selectedIndex * 4}px))`,
  }
  return (
    <div aria-label={label} className="ui-segmented-control" role="group" style={{ '--segmented-count': options.length }}>
      <span aria-hidden="true" className="ui-segmented-control__thumb" style={thumbStyle} />
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={option.value === value ? 'is-selected' : ''}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ children, selected = false, ...props }) {
  const { t } = useLanguage()
  return (
    <button aria-pressed={selected} className={`ui-chip${selected ? ' is-selected' : ''}`} type="button" {...props}>
      {translateChild(children, t)}
    </button>
  )
}

export function Avatar({ name = '', size = 44, src = '', presence = false, className = '' }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = (words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 2).map((word) => word[0]).join('')).toUpperCase() || 'F'
  const colorIndex = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 4
  const sizeStyle = size !== 44 ? { width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` } : undefined
  return (
    <span
      aria-label={name || 'Fixora account'}
      className={`ui-avatar ui-avatar--${colorIndex}${className ? ` ${className}` : ''}${src ? ' has-photo' : ''}`}
      style={sizeStyle}
    >
      {src && <img alt="" loading="lazy" onError={(event) => event.currentTarget.remove()} src={src} />}
      <span aria-hidden={Boolean(src)}>{initials}</span>
      {presence && <i aria-label="Online" className="ui-avatar__presence" />}
    </span>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  const { t } = useLanguage()
  return <span className={`ui-badge ui-badge--${tone}`}>{translateChild(children, t)}</span>
}

export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`} />
}

export function EmptyState({ action, icon: Icon, message, title }) {
  return (
    <section className="ui-empty-state">
      <div className="ui-empty-state__visual" aria-hidden="true">
        <span className="ui-empty-state__shape ui-empty-state__shape--bg" />
        <span className="ui-empty-state__shape ui-empty-state__shape--mid" />
        {Icon ? (
          <span className="ui-empty-state__icon">
            <Icon aria-hidden="true" size={26} weight="duotone" />
          </span>
        ) : null}
      </div>
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
      {action ? <div className="ui-empty-state__action">{action}</div> : null}
    </section>
  )
}

export function ActionSheet({ busy = false, cancelLabel = 'Cancel', confirmLabel, description, onCancel, onConfirm, open, title }) {
  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        onCancel?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null
  return (
    <OverlayPortal>
    <div aria-modal="true" className="ui-sheet-backdrop" data-dismissable-keep-open onClick={(event) => event.target === event.currentTarget && !busy && onCancel?.()} role="dialog">
      <section aria-labelledby="ui-sheet-title" className="ui-action-sheet">
        <h2 id="ui-sheet-title">{title}</h2>
        {description && <p>{description}</p>}
        <div className="ui-action-sheet__actions">
          <Button loading={busy} onClick={onConfirm} variant="destructive" wide>
            {confirmLabel}
          </Button>
          <Button disabled={busy} onClick={onCancel} variant="secondary" wide>
            {cancelLabel}
          </Button>
        </div>
      </section>
    </div>
    </OverlayPortal>
  )
}
