export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

export const NIGERIAN_TERRITORIES = ['Federal Capital Territory']
export const NIGERIAN_STATE_OPTIONS = [
  ['Abia','NG-AB'],['Adamawa','NG-AD'],['Akwa Ibom','NG-AK'],['Anambra','NG-AN'],['Bauchi','NG-BA'],['Bayelsa','NG-BY'],['Benue','NG-BE'],['Borno','NG-BO'],['Cross River','NG-CR'],['Delta','NG-DE'],['Ebonyi','NG-EB'],['Edo','NG-ED'],['Ekiti','NG-EK'],['Enugu','NG-EN'],['Gombe','NG-GO'],['Imo','NG-IM'],['Jigawa','NG-JI'],['Kaduna','NG-KD'],['Kano','NG-KN'],['Katsina','NG-KT'],['Kebbi','NG-KE'],['Kogi','NG-KO'],['Kwara','NG-KW'],['Lagos','NG-LA'],['Nasarawa','NG-NA'],['Niger','NG-NI'],['Ogun','NG-OG'],['Ondo','NG-ON'],['Osun','NG-OS'],['Oyo','NG-OY'],['Plateau','NG-PL'],['Rivers','NG-RI'],['Sokoto','NG-SO'],['Taraba','NG-TA'],['Yobe','NG-YO'],['Zamfara','NG-ZA'],['Federal Capital Territory','NG-FC'],
].map(([name, code]) => ({ name, code }))

export function normalizeNigerianRegion(value) {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+state$/i, '')
  return [...NIGERIAN_STATES, ...NIGERIAN_TERRITORIES].find((region) => region.toLowerCase() === normalized) ?? null
}

export function stateCodeForRegion(value) {
  const region = normalizeNigerianRegion(value)
  return NIGERIAN_STATE_OPTIONS.find((state) => state.name === region)?.code ?? ''
}

export function regionForStateCode(code) {
  return NIGERIAN_STATE_OPTIONS.find((state) => state.code === code)?.name ?? ''
}
