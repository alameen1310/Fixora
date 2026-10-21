import assert from 'node:assert/strict'
import test from 'node:test'
import { LANGUAGES, translateInterface } from './catalog.js'

test('Fixora exposes English, Yoruba, Igbo, and Hausa in their native names', () => {
  assert.deepEqual(LANGUAGES.map(({ code }) => code), ['en', 'yo', 'ig', 'ha'])
  assert.deepEqual(LANGUAGES.map(({ nativeName }) => nativeName), ['English', 'Yorùbá', 'Asụsụ Igbo', 'Hausa'])
})

test('core navigation and onboarding labels have built-in translations for all three local languages', () => {
  for (const code of ['yo', 'ig', 'ha']) {
    for (const phrase of ['Home', 'Discover', 'Activity', 'Messages', 'App language', 'Contact details', 'Save and continue']) {
      assert.notEqual(translateInterface(code, phrase), phrase, `${code} is missing: ${phrase}`)
    }
  }
})

test('English and unknown phrases safely fall back to the original text', () => {
  assert.equal(translateInterface('en', 'Home'), 'Home')
  assert.equal(translateInterface('ha', 'A phrase without a catalogue entry'), 'A phrase without a catalogue entry')
})
