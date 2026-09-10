// =============================================================================
// Agency Group — Property Media Upload API
// POST /api/properties/upload
//
// Accepts multipart/form-data with field "file" (image or video).
// Uploads to Supabase Storage bucket "property-media".
// Returns { url, path, type }.
//
// Auth: portal session required (isPortalAuth).
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'property-media'
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif',
])
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm',
])

function ext(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/avif': 'avif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  }
  return map[mime] ?? 'bin'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth guard
  const portalAuth = await isPortalAuth(request)
  if (!portalAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse multipart
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Field "file" is required' }, { status: 400 })
  }

  const mime = file.type
  const isImage = ALLOWED_IMAGE_TYPES.has(mime)
  const isVideo = ALLOWED_VIDEO_TYPES.has(mime)

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: `Tipo não suportado: ${mime}. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.` },
      { status: 415 },
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Ficheiro demasiado grande (máx. 50 MB). Tamanho: ${(file.size / 1024 / 1024).toFixed(1)} MB` },
      { status: 413 },
    )
  }

  // Build storage path
  const folder = isVideo ? 'videos' : 'photos'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const filename = `${folder}/${timestamp}-${random}.${ext(mime)}`

  // Upload to Supabase Storage
  const buffer = await file.arrayBuffer()

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType:    mime,
      cacheControl:   '3600',
      upsert:         false,
    })

  if (error) {
    console.error('[upload] Supabase storage error:', error)
    return NextResponse.json(
      { error: `Erro no upload: ${error.message}` },
      { status: 500 },
    )
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(data.path)

  return NextResponse.json({
    url:  urlData.publicUrl,
    path: data.path,
    type: isVideo ? 'video' : 'photo',
    mime,
    size: file.size,
  })
}
