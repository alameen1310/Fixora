import { supabase } from './supabase.js'

const MAX_EDGE = 1600
const TARGET_BYTES = 300 * 1024

export function getPostImageUrl(path) {
  if (!path || !supabase) return null
  return supabase.storage.from('problem-post-photos').getPublicUrl(path).data.publicUrl
}

export function logPostStep(step, { postId = null, error } = {}) {
  console.error('[post-step]', {
    step,
    postId,
    code: error?.code ?? error?.statusCode ?? error?.status ?? null,
    message: error?.message ?? String(error ?? 'Unknown error'),
  })
}

export function describePhotoError(error) {
  const message = error?.message || 'Unknown upload error'
  const code = error?.code || error?.statusCode || error?.status
  const detail = code ? `${message} (${code})` : message
  return detail.length > 180 ? `${detail.slice(0, 177)}…` : detail
}

async function decodeFile(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function preparePostPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose a supported image file.')
  let image
  try { image = await decodeFile(file) } catch { throw new Error('This photo could not be opened. Choose another image.') }
  const width = image.width || image.naturalWidth
  const height = image.height || image.naturalHeight
  if (!width || !height) throw new Error('This photo could not be opened. Choose another image.')
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Photo processing is unavailable on this device.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close?.()
  let quality = 0.82
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  while (blob && blob.size > TARGET_BYTES && quality > 0.48) {
    quality -= 0.08
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  }
  if (!blob || blob.size > 1024 * 1024) throw new Error('This photo is too large to upload. Choose a smaller image.')
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' })
}
