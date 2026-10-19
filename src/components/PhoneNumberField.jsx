import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min'

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
export const countryOptions = getCountries()
  .map((country) => ({ code: country, label: displayNames.of(country), callingCode: getCountryCallingCode(country) }))
  .sort((first, second) => first.label.localeCompare(second.label))

export function getE164Phone(value, country) {
  if (!value) return null
  const parsed = parsePhoneNumberFromString(value.trim(), country)
  return parsed?.isValid() ? parsed.number : null
}

export default function PhoneNumberField({
  country,
  error,
  hint = 'Kept private. Not verified at signup.',
  id = 'phone-number',
  onBlur,
  onChange,
  onCountryChange,
  value,
}) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`auth-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>Phone number</label>
      <div className="auth-phone-control">
        <select
          aria-label="Country calling code"
          autoComplete="tel-country-code"
          onChange={(event) => onCountryChange(event.target.value)}
          value={country}
        >
          {countryOptions.map(({ code, label, callingCode }) => (
            <option key={code} value={code}>
              {label} (+{callingCode})
            </option>
          ))}
        </select>
        <input
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          autoComplete="tel-national"
          id={id}
          inputMode="tel"
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0801 234 5678"
          required
          type="tel"
          value={value}
        />
      </div>
      {hint && <span className="auth-field__hint" id={hintId}>{hint}</span>}
      {error && <span className="auth-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}
