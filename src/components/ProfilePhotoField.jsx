import { useEffect, useState } from 'react'
import { Camera, Trash } from '@phosphor-icons/react'
import { Avatar } from './UiPrimitives.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import { getProfilePhotoUrl } from '../lib/profilePhotos.js'
import { preparePostPhoto } from '../lib/postImages.js'
import './ProfilePhotoField.css'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_INPUT_BYTES = 12 * 1024 * 1024

export default function ProfilePhotoField({ name = 'Profile photo', size = 76, showSkip = false }) {
  const { user, profile, setProfile } = useAuth()
  const [path, setPath] = useState(profile?.avatar_path ?? null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    setPath(profile?.avatar_path ?? null)
  }, [profile?.avatar_path])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function upload(file) {
    setError('')
    if (!ACCEPTED_TYPES.has(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return }
    if (file.size > MAX_INPUT_BYTES) { setError('Choose an image smaller than 12 MB.'); return }
    setBusy(true)
    setProgress(0)
    let uploadedPath = null
    try {
      const prepared = await preparePostPhoto(file)
      const nextPreview = URL.createObjectURL(prepared)
      setPreview((previous) => { if (previous) URL.revokeObjectURL(previous); return nextPreview })
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) throw sessionError || new Error('Sign in again to upload a photo.')
      const extension = 'jpg'
      uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`
      await uploadWithProgress(uploadedPath, prepared, sessionData.session.access_token, setProgress)
      const { data: saved, error: saveError } = await supabase.from('profiles').update({ avatar_path: uploadedPath }).eq('id', user.id).select('avatar_path').single()
      if (saveError || !saved) throw saveError || new Error('The profile photo could not be saved.')
      const oldPath = path
      setPath(saved.avatar_path)
      setProfile((current) => current ? { ...current, avatar_path: saved.avatar_path } : current)
      if (oldPath && oldPath !== uploadedPath) await supabase.storage.from('profile-photos').remove([oldPath])
    } catch (problem) {
      if (uploadedPath) await supabase.storage.from('profile-photos').remove([uploadedPath])
      setError(problem.message || 'The photo could not be uploaded. Try again.')
      setPreview((previous) => { if (previous) URL.revokeObjectURL(previous); return null })
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  async function removePhoto() {
    if (!path || busy) return
    setBusy(true); setError('')
    try {
      const { data: saved, error: saveError } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id).select('avatar_path').single()
      if (saveError || !saved) throw saveError || new Error('The photo reference could not be removed.')
      const oldPath = path
      setPath(null)
      setProfile((current) => current ? { ...current, avatar_path: null } : current)
      const { error: storageError } = await supabase.storage.from('profile-photos').remove([oldPath])
      if (storageError) setError('Your profile was updated, but the old image could not be removed yet.')
    } catch (problem) { setError(problem.message || 'The photo could not be removed. Try again.') }
    finally { setBusy(false) }
  }

  if (showSkip && skipped && !path) return <div className="profile-photo-field__skipped"><span>You can add a profile photo later from Profile.</span><button onClick={() => setSkipped(false)} type="button">Add one now</button></div>
  const src = preview || getProfilePhotoUrl(path)
  return <div className="profile-photo-field" aria-busy={busy}>
    <Avatar name={name} size={size} src={src} />
    <div className="profile-photo-field__controls">
      <label className="profile-photo-field__button">
        <Camera aria-hidden="true" size={17} />{path ? 'Change photo' : 'Add a photo'}
        <input accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} type="file" />
      </label>
      {path && <button className="profile-photo-field__remove" disabled={busy} onClick={() => void removePhoto()} type="button"><Trash aria-hidden="true" size={16} />Remove</button>}
      <small>Optional · JPG, PNG or WebP · up to 12 MB</small>
      {showSkip && !path && !busy && <button className="profile-photo-field__skip" onClick={() => setSkipped(true)} type="button">Skip for now</button>}
      {busy && <div aria-live="polite" className="profile-photo-field__progress"><span style={{ width: `${progress}%` }} /><small>Uploading photo · {progress}%</small></div>}
      {error && <small className="profile-photo-field__error" role="alert">{error}</small>}
    </div>
  </div>
}

function uploadWithProgress(path, file, accessToken, onProgress) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return Promise.reject(new Error('Photo uploads are not configured.'))
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${url}/storage/v1/object/profile-photos/${encodedPath}`)
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    request.setRequestHeader('apikey', key)
    request.setRequestHeader('Content-Type', file.type)
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(readUploadError(request.responseText, request.status)))
    request.onerror = () => reject(new Error('Network error while uploading the photo.'))
    request.onabort = () => reject(new Error('Photo upload was cancelled.'))
    request.send(file)
  })
}

function readUploadError(response, status) {
  try { return JSON.parse(response)?.message || `Photo upload failed (${status}).` } catch { return `Photo upload failed (${status}).` }
}
