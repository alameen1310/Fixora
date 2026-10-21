import { useRef, useState } from 'react'
import { Camera, Image, Trash, UploadSimple } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from './ToastProvider.jsx'
import { Avatar } from './UiPrimitives.jsx'
import { avatarBucket, avatarUrl } from '../lib/avatarImages.js'
import { supabase } from '../lib/supabase.js'
import './AvatarUploader.css'

const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_OUTPUT_BYTES = 200 * 1024

export default function AvatarUploader({ name, path, provider = false, onSaved }) {
  const { user, setProfile } = useAuth()
  const { showToast } = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const drag = useRef(null)
  const libraryRef = useRef(null)
  const cameraRef = useRef(null)

  function choose(next) {
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPG, PNG or WebP image.'); return }
    if (next.size > MAX_SOURCE_BYTES) { setError('Choose a photo smaller than 10 MB.'); return }
    if (preview) URL.revokeObjectURL(preview)
    setError(''); setFile(next); setPreview(URL.createObjectURL(next)); setZoom(1); setPosition({ x: 50, y: 50 })
  }

  function moveCrop(event) {
    if (!drag.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    setPosition((current) => ({
      x: Math.min(100, Math.max(0, current.x + (event.clientX - drag.current.x) / bounds.width * 100)),
      y: Math.min(100, Math.max(0, current.y + (event.clientY - drag.current.y) / bounds.height * 100)),
    }))
    drag.current = { x: event.clientX, y: event.clientY }
  }

  async function makeCrop(source) {
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(source))
    const side = Math.min(bitmap.width, bitmap.height) / zoom
    const centerX = side / 2 + (bitmap.width - side) * position.x / 100
    const centerY = side / 2 + (bitmap.height - side) * position.y / 100
    const x = Math.min(bitmap.width - side, Math.max(0, centerX - side / 2))
    const y = Math.min(bitmap.height - side, Math.max(0, centerY - side / 2))
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, x, y, side, side, 0, 0, 512, 512)
    bitmap.close?.()
    let quality = 0.88
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    while (blob && blob.size > MAX_OUTPUT_BYTES && quality > 0.48) {
      quality -= 0.1
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    }
    if (!blob || blob.size > MAX_OUTPUT_BYTES) throw new Error('The photo could not be compressed below 200 KB.')
    return new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  async function removePreviousPhoto(previousPath) {
    if (!previousPath) return null
    const bucket = avatarBucket(previousPath)
    const { data: backup, error: downloadError } = await supabase.storage.from(bucket).download(previousPath)
    if (downloadError) throw downloadError
    const { error: removeError } = await supabase.storage.from(bucket).remove([previousPath])
    if (removeError) throw removeError
    return backup
  }

  async function restorePreviousPhoto(previousPath, backup) {
    if (!previousPath || !backup) return
    const { error: restoreError } = await supabase.storage.from(avatarBucket(previousPath)).upload(previousPath, backup, {
      contentType: backup.type || 'image/jpeg',
      upsert: true,
    })
    if (restoreError) console.error('[avatar-restore]', { userId: user.id, code: restoreError.code, message: restoreError.message })
  }

  async function save() {
    if (!file || !user?.id || busy) return
    setBusy(true); setError('')
    let nextPath = ''
    let oldPhotoBackup = null
    let profileSaved = false
    let providerSaved = false
    try {
      const prepared = await makeCrop(file)
      nextPath = `${user.id}/avatar-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(nextPath, prepared, { contentType: 'image/jpeg', upsert: false })
      if (uploadError) throw uploadError
      oldPhotoBackup = await removePreviousPhoto(path)
      const { error: profileError } = await supabase.from('profiles').update({ avatar_path: nextPath }).eq('id', user.id)
      if (profileError) throw profileError
      profileSaved = true
      if (provider) {
        const { error: providerError } = await supabase.from('provider_profiles').update({ avatar_path: nextPath }).eq('profile_id', user.id)
        if (providerError) throw providerError
        providerSaved = true
      }
      setProfile((current) => ({ ...current, avatar_path: nextPath }))
      onSaved?.(nextPath)
      setFile(null); URL.revokeObjectURL(preview); setPreview('')
      showToast({ type: 'success', message: 'Profile photo saved.' })
    } catch (uploadError) {
      if (profileSaved) await supabase.from('profiles').update({ avatar_path: path || null }).eq('id', user.id)
      if (providerSaved) await supabase.from('provider_profiles').update({ avatar_path: path || null }).eq('profile_id', user.id)
      await restorePreviousPhoto(path, oldPhotoBackup)
      if (nextPath) await supabase.storage.from('avatars').remove([nextPath]).catch(() => {})
      console.error('[avatar-upload]', { userId: user.id, code: uploadError?.code, message: uploadError?.message })
      setError(uploadError?.message || 'The profile photo could not be saved. Try again.')
    } finally { setBusy(false) }
  }

  async function removePhoto() {
    if (!path || busy) return
    setBusy(true); setError('')
    let backup = null
    let profileCleared = false
    try {
      backup = await removePreviousPhoto(path)
      const { error: profileError } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id)
      if (profileError) throw profileError
      profileCleared = true
      if (provider) {
        const { error: providerError } = await supabase.from('provider_profiles').update({ avatar_path: null }).eq('profile_id', user.id)
        if (providerError) throw providerError
      }
      setProfile((current) => ({ ...current, avatar_path: null }))
      onSaved?.(null)
      showToast({ type: 'success', message: 'Profile photo removed.' })
    } catch (removeError) {
      if (profileCleared) await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id)
      await restorePreviousPhoto(path, backup)
      console.error('[avatar-remove]', { userId: user.id, code: removeError?.code, message: removeError?.message })
      setError('The profile photo could not be removed. Try again.')
    } finally { setBusy(false) }
  }

  return <section className="avatar-uploader" aria-label="Profile photo">
    <div className="avatar-uploader__row"><Avatar name={name} size={72} src={preview || avatarUrl(path)} /><div><strong>Profile photo</strong><p>JPG, PNG or WebP. Saved as a square image, up to 200 KB.</p></div></div>
    {preview && <div aria-label="Adjust photo crop" className="avatar-uploader__crop" onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={moveCrop} onPointerUp={() => { drag.current = null }}><img alt="Photo crop preview" src={preview} style={{ objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${zoom})` }} /><span>Drag to reposition</span></div>}
    {preview && <label className="avatar-uploader__zoom">Zoom <input aria-label="Zoom photo crop" max="2" min="1" onChange={(event) => setZoom(Number(event.target.value))} step="0.05" type="range" value={zoom} /></label>}
    <input accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} ref={libraryRef} type="file" />
    <input accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => { choose(event.target.files?.[0]); event.target.value = '' }} ref={cameraRef} type="file" />
    <div className="avatar-uploader__actions"><button disabled={busy} onClick={() => libraryRef.current?.click()} type="button"><Image size={17} />Choose photo</button><button disabled={busy} onClick={() => cameraRef.current?.click()} type="button"><Camera size={17} />Take photo</button>{preview ? <button className="is-primary" disabled={busy} onClick={() => void save()} type="button"><UploadSimple size={17} />{busy ? 'Saving…' : 'Save photo'}</button> : path ? <button className="is-danger" disabled={busy} onClick={() => void removePhoto()} type="button"><Trash size={17} />Remove photo</button> : null}</div>
    {busy && <div aria-live="polite" className="avatar-uploader__progress" role="status">Preparing and uploading photo…</div>}
    {error && <p className="avatar-uploader__error" role="alert">{error}</p>}
  </section>
}
