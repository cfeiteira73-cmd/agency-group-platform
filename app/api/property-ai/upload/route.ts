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

function detectFileType(mime: string): 'photo' | 'video' | 'audio' | 'pdf' | 'drone' {
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  return 'photo' // default
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

    // Validate MIME type
    const mime = file.type || 'application/octet-stream'
    const isAllowed = ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))
    if (!isAllowed) {
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
        type:       detectFileType(mime),
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
