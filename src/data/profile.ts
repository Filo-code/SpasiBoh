/**
 * Personalisation. This app has exactly one user, so instead of building a
 * profile system we keep the handful of personal facts here and let the
 * content reference them.
 */
export const PROFILE = {
  name: 'Микеле',
  nameLatin: 'Michele',
  country: 'Италия',
  countryItalian: 'Italia',
  city: 'Брешия',
  cityItalian: 'Brescia',
} as const

/** Phrases that mention the user by name — used by the "about me" quick drill. */
export const PERSONAL_PHRASE_IDS = ['conv-12', 'conv-16', 'conv-17', 'conv-18', 'conv-19']
