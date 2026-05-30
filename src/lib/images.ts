import sharp from 'sharp'


export interface PreparedImage {
  buffer: Buffer
  mediaType: 'image/jpeg'
}

export async function resizeForAnalysis(input: Buffer): Promise<PreparedImage> {
  const img = sharp(input, { failOn: 'none' })
  const meta = await img.metadata()
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0)
  const pipeline = longest > 1280 ? img.resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }) : img
  const buffer = await pipeline
    .rotate() // respeita EXIF
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return { buffer, mediaType: 'image/jpeg' }
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return (mimeType ?? '').toLowerCase().includes('pdf')
}

export function isImageMime(mimeType: string | null | undefined): boolean {
  return (mimeType ?? '').toLowerCase().startsWith('image/')
}
