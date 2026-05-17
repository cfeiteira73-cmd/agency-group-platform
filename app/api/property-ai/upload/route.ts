// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// POST /api/property-ai/upload — server-side multipart file upload to Supabase Storage
// Returns: { files: Array<{ file_id, url, type, mime_type, size_bytes, name }> }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'
export const maxDuration = 30

const BUCKET = 'property-media'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB per file
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf']
const ALLOWED_MIME_EXACT = [
  'application/pdf',
  // Word documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // ZIP archives (often contain photo galleries from agencies)
  'application/zip',
  'application/x-zip-compressed',
  // NOTE: application/octet-stream intentionally excluded — too permissive.
  // ZIP files sent as octet-stream are accepted via the ALLOWED_EXTENSIONS fallback below.
]

// Extension-based fallback when MIME is wrong (common in Windows)
const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'tiff', 'bmp', // photos
  'mp4', 'mov', 'avi', 'mkv', 'webm',    // videos
  'mp3', 'wav', 'm4a', 'ogg', 'aac',     // audio
  'pdf',                                   // PDFs
  'doc', 'docx',                          // Word
  'ppt', 'pptx',                          // PowerPoint
  'zip',                                   // ZIP archives
])

function isAllowedFile(mime: string, filename: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p))) return true
  if (ALLOWED_MIME_EXACT.includes(mime)) return true
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXTENSIONS.has(ext)
}

function detectFileType(mime: string, filename?: string): 'photo' | 'video' | 'audio' | 'pdf' | 'drone' {
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  // Extension fallback
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (['doc', 'docx', 'ppt', 'pptx', 'zip'].includes(ext)) return 'pdf' // treat docs as pdf pipeline
  if (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tiff'].includes(ext)) return 'photo'
  return 'pdf' // default for unknown — will be OCR-processed
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const submissionId = (formData.get('submission_id') as string) ?? crypto.randomUUID()
  const fileEntries = formData.getAll('file') as File[]

  if (!fileEntries || fileEntries.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const results: Array<{
    file_id: string
    url: string
    type: string
    mime_type: string
    size_bytes: number
    name: string
  }> = []

  const errors: string[] = []

  for (const file of fileEntries) {
    if (!(file instanceof File)) continue

    // Validate MIME type (with extension fallback — browsers often mis-report DOCX/ZIP)
    const mime = file.type || 'application/octet-stream'
    if (!isAllowedFile(mime, file.name)) {
      errors.push(`Skipped ${file.name}: unsupported type ${mime}`)
      continue
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`Skipped ${file.name}: exceeds 50MB limit`)
      continue
    }

    const fileId = crypto.randomUUID()
    const ext = file.name.split('.').pop() ?? 'bin'
    const storagePath = `${submissionId}/${fileId}.${ext}`

    try {
      const buffer = await file.arrayBuffer()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadError } = await (supabaseAdmin as any)
        .storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        })

      if (uploadError) {
        errors.push(`Upload failed for ${file.name}: ${uploadError.message}`)
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: urlData } = (supabaseAdmin as any)
        .storage
        .from(BUCKET)
        .getPublicUrl(storagePath)

      const publicUrl: string = urlData?.publicUrl ?? ''

      if (!publicUrl) {
        errors.push(`Could not get public URL for ${file.name}`)
        continue
      }

      results.push({
        file_id:    fileId,
        url:        publicUrl,
        type:       detectFileType(mime, file.name),
        mime_type:  mime,
        size_bytes: file.size,
        name:       file.name,
      })
    } catch (err) {
      errors.push(`Exception uploading ${file.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  logger.info('[property-ai/upload] files processed', {
    submission_id: submissionId,
    uploaded: results.length,
    skipped: errors.length,
  })

  return NextResponse.json({
    submission_id: submissionId,
    files: results,
    errors: errors.length > 0 ? errors : undefined,
  })
}
