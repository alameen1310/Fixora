import { Link } from 'react-router-dom'
import { CaretRight, CircleNotch, LockKey, X } from '@phosphor-icons/react'
import './UiPrimitives.css'

export function Button({ as: Element = 'button', children, className = '', loading = false, type, variant = 'primary', wide = false, ...props }) {
  const shared = {
    className: `ui-button ui-button--${variant}${wide ? ' ui-button--wide' : ''}${className ? ` ${className}` : ''}`,
    'aria-busy': loading || undefined,
    disabled: loading || props.disabled,
    ...props,
  }
  if (Element === Link) return <Link {...shared}>{loading ? <CircleNotch aria-hidden="true" className="ui-button__spinner" size={18} /> : null}{children}</Link>
  return <Element {...shared} type={type || (Element === 'button' ? 'button' : undefined)}>{loading ? <CircleNotch aria-hidden="true" className="ui-button__spinner" size={18} /> : null}{children}</Element>
}

export function IconButton({ children, className = '', label, ...props }) {
  return <button aria-label={label} className={`ui-icon-button ${className}`} type="button" {...props}>{children}</button>
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

export function ListGroup({ children, className = '' }) {
  return <div className={`ui-list-group ${className}`}>{children}</div>
}

export function ListRow({ children, className = '', icon: Icon, onClick, to, value, destructive = false }) {
  const content = <>{Icon ? <span className="ui-list-row__icon"><Icon aria-hidden="true" size={19} /></span> : null}<span className="ui-list-row__label">{children}</span>{value ? <span className="ui-list-row__value">{value}</span> : null}{to ? <CaretRight aria-hidden="true" className="ui-list-row__chevron" size={19} /> : null}</>
  const classes = `ui-list-row${destructive ? ' ui-list-row--destructive' : ''}${className ? ` ${className}` : ''}`
  if (to) return <Link className={classes} to={to}>{content}</Link>
  return <button className={classes} onClick={onClick} type="button">{content}</button>
}

export function PrivacyValue({ children }) {
  return <span className="ui-private"><LockKey aria-hidden="true" size={14} weight="fill" />{children}</span>
}

export function InputField({ error, hint, label, id, ...props }) {
  const errorId = error ? `${id}-error` : undefined
  return <label className={`ui-field${error ? ' ui-field--error' : ''}`} htmlFor={id}><span>{label}</span><input aria-describedby={errorId} aria-invalid={Boolean(error)} id={id} {...props} />{hint ? <small>{hint}</small> : null}{error ? <small id={errorId} role="alert">{error}</small> : null}</label>
}

export function SelectField({ children, error, label, id, ...props }) {
  return <label className={`ui-field${error ? ' ui-field--error' : ''}`} htmlFor={id}><span>{label}</span><select aria-invalid={Boolean(error)} id={id} {...props}>{children}</select>{error ? <small role="alert">{error}</small> : null}</label>
}

export function SegmentedControl({ label, options, value, onChange }) {
  return <div aria-label={label} className="ui-segmented-control" role="group">{options.map((option) => <button aria-pressed={option.value === value} className={option.value === value ? 'is-selected' : ''} key={option.value} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}</div>
}

export function Chip({ children, selected = false, ...props }) {
  return <button aria-pressed={selected} className={`ui-chip${selected ? ' is-selected' : ''}`} type="button" {...props}>{children}</button>
}

export function Avatar({ name = '' }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'F'
  const colorIndex = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 4
  return <span aria-label={name || 'Fixora account'} className={`ui-avatar ui-avatar--${colorIndex}`}>{initials}</span>
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`ui-skeleton ${className}`} />
}

export function EmptyState({ action, icon: Icon, message, title }) {
  return <section className="ui-empty-state">{Icon ? <span className="ui-empty-state__icon"><Icon aria-hidden="true" size={24} /></span> : null}<h2>{title}</h2><p>{message}</p>{action}</section>
}

export function ActionSheet({ busy = false, cancelLabel = 'Cancel', confirmLabel, description, onCancel, onConfirm, open, title }) {
  if (!open) return null
  return (
    <div aria-modal="true" className="ui-sheet-backdrop" role="dialog">
      <section aria-labelledby="ui-sheet-title" className="ui-action-sheet">
        <button aria-label="Close" className="ui-action-sheet__close" disabled={busy} onClick={onCancel} type="button"><X aria-hidden="true" size={18} /></button>
        <h2 id="ui-sheet-title">{title}</h2>
        <p>{description}</p>
        <Button loading={busy} onClick={onConfirm} variant="destructive" wide>{confirmLabel}</Button>
        <Button disabled={busy} onClick={onCancel} variant="secondary" wide>{cancelLabel}</Button>
      </section>
    </div>
  )
}
