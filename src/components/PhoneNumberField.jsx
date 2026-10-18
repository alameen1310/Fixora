import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min'

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
export const countryOptions = getCountries()
  .map((country) => ({ code: country, label: displayNames.of(country), callingCode: getCountryCallingCode(country) }))
  .sort((first, second) => first.label.localeCompare(second.label))

export function getE164Phone(value, country) {
  const parsed = parsePhoneNumberFromString(value.trim(), country)
  return parsed?.isValid() ? parsed.number : null
}

export default function PhoneNumberField({ country, error, onChange, onCountryChange, value }) {
  return (
    <div className={`auth-field${error ? ' has-error' : ''}`}>
      <label htmlFor="phone-number">Phone number</label>
      <div className="auth-phone-control">
        <select
          aria-label="Country calling code"
          autoComplete="tel-country-code"
          onChange={(event) => onCountryChange(event.target.value)}
          value={country}
        >
          {countryOptions.map(({ code, label, callingCode }) => (
            <option key={code} value={code}>{label} (+{callingCode})</option>
          ))}
        </select>
        <input
          aria-describedby={error ? 'phone-number-error' : undefined}
          aria-invalid={Boolean(error)}
          autoComplete="tel-national"
          id="phone-number"
          inputMode="tel"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter phone number"
          required
          type="tel"
          value={value}
        />
      </div>
      {error && <span className="auth-field__error" id="phone-number-error" role="alert">{error}</span>}
    </div>
  )
}
