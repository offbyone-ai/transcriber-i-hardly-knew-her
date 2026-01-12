// Export utilities for transcriptions
// Uses dynamic imports for heavy libraries (jspdf, docx) to reduce initial bundle size
import type { Recording, Transcription, TranscriptionSegment } from '@shared/types'

// Lazy-loaded exports for heavy dependencies
let jsPDFModule: typeof import('jspdf') | null = null
let docxModule: typeof import('docx') | null = null

async function getJsPDF() {
  if (!jsPDFModule) {
    jsPDFModule = await import('jspdf')
  }
  return jsPDFModule.jsPDF
}

async function getDocx() {
  if (!docxModule) {
    docxModule = await import('docx')
  }
  return docxModule
}

// Helper to format time as HH:MM:SS,mmm (SRT format)
function formatTimeSRT(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

// Helper to format time as HH:MM:SS.mmm (VTT format)
function formatTimeVTT(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

// Helper to format time as MM:SS
function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

// Helper to trigger file download
function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Get base filename from recording
function getBaseFilename(recording: Recording): string {
  return recording.title || `recording-${new Date(recording.createdAt).toISOString().split('T')[0]}`
}

/**
 * Export transcription as plain text
 */
export function exportToTxt(transcription: Transcription, recording: Recording): void {
  const filename = getBaseFilename(recording)
  const lines: string[] = []

  // Header
  lines.push(`Transcription: ${recording.title || 'Untitled Recording'}`)
  lines.push(`Date: ${new Date(recording.createdAt).toLocaleDateString()}`)
  lines.push(`Duration: ${formatTimeShort(recording.duration)}`)
  lines.push(`Language: ${transcription.language}`)
  lines.push(`Model: ${transcription.modelUsed}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Full text
  lines.push(transcription.text)

  // Segments with timestamps (if available)
  if (transcription.segments && transcription.segments.length > 0) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('Segments:')
    lines.push('')

    for (const segment of transcription.segments) {
      lines.push(`[${formatTimeShort(segment.start)} - ${formatTimeShort(segment.end)}] ${segment.text}`)
    }
  }

  downloadFile(lines.join('\n'), `${filename}.txt`, 'text/plain')
}

/**
 * Export transcription as Markdown
 */
export function exportToMarkdown(transcription: Transcription, recording: Recording): void {
  const filename = getBaseFilename(recording)
  const lines: string[] = []

  // Header
  lines.push(`# ${recording.title || 'Untitled Recording'}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(recording.createdAt).toLocaleDateString()}  `)
  lines.push(`**Duration:** ${formatTimeShort(recording.duration)}  `)
  lines.push(`**Language:** ${transcription.language}  `)
  lines.push(`**Model:** ${transcription.modelUsed}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Full text
  lines.push('## Transcript')
  lines.push('')
  lines.push(transcription.text)

  // Segments with timestamps (if available)
  if (transcription.segments && transcription.segments.length > 0) {
    lines.push('')
    lines.push('## Segments')
    lines.push('')
    lines.push('| Time | Text |')
    lines.push('|------|------|')

    for (const segment of transcription.segments) {
      // Escape pipe characters in text
      const escapedText = segment.text.replace(/\|/g, '\\|')
      lines.push(`| ${formatTimeShort(segment.start)} - ${formatTimeShort(segment.end)} | ${escapedText} |`)
    }
  }

  downloadFile(lines.join('\n'), `${filename}.md`, 'text/markdown')
}

/**
 * Export transcription as SRT subtitle file
 */
export function exportToSRT(transcription: Transcription, recording: Recording): void {
  const filename = getBaseFilename(recording)
  const lines: string[] = []

  // Use segments if available, otherwise create a single segment
  const segments: TranscriptionSegment[] = transcription.segments && transcription.segments.length > 0
    ? transcription.segments
    : [{ start: 0, end: recording.duration || 0, text: transcription.text }]

  segments.forEach((segment, index) => {
    // Sequence number (1-based)
    lines.push(String(index + 1))

    // Timestamps
    lines.push(`${formatTimeSRT(segment.start)} --> ${formatTimeSRT(segment.end)}`)

    // Text
    lines.push(segment.text.trim())

    // Blank line between entries
    lines.push('')
  })

  downloadFile(lines.join('\n'), `${filename}.srt`, 'text/srt')
}

/**
 * Export transcription as WebVTT subtitle file
 */
export function exportToVTT(transcription: Transcription, recording: Recording): void {
  const filename = getBaseFilename(recording)
  const lines: string[] = []

  // VTT header
  lines.push('WEBVTT')
  lines.push('')

  // Use segments if available, otherwise create a single segment
  const segments: TranscriptionSegment[] = transcription.segments && transcription.segments.length > 0
    ? transcription.segments
    : [{ start: 0, end: recording.duration || 0, text: transcription.text }]

  segments.forEach((segment, index) => {
    // Optional cue identifier
    lines.push(String(index + 1))

    // Timestamps
    lines.push(`${formatTimeVTT(segment.start)} --> ${formatTimeVTT(segment.end)}`)

    // Text
    lines.push(segment.text.trim())

    // Blank line between entries
    lines.push('')
  })

  downloadFile(lines.join('\n'), `${filename}.vtt`, 'text/vtt')
}

/**
 * Export transcription as PDF
 * Uses dynamic import to load jspdf only when needed
 */
export async function exportToPDF(transcription: Transcription, recording: Recording): Promise<void> {
  const filename = getBaseFilename(recording)
  const jsPDF = await getJsPDF()
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const maxWidth = pageWidth - margin * 2
  let y = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(recording.title || 'Untitled Recording', margin, y)
  y += 10

  // Metadata
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Date: ${new Date(recording.createdAt).toLocaleDateString()}`, margin, y)
  y += 5
  doc.text(`Duration: ${formatTimeShort(recording.duration)}`, margin, y)
  y += 5
  doc.text(`Language: ${transcription.language}`, margin, y)
  y += 5
  doc.text(`Model: ${transcription.modelUsed}`, margin, y)
  y += 10

  // Divider
  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // Transcript header
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text('Transcript', margin, y)
  y += 8

  // Full text with word wrap
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  const textLines = doc.splitTextToSize(transcription.text, maxWidth)

  for (const line of textLines) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 20
    }
    doc.text(line, margin, y)
    y += 6
  }

  // Segments (if available)
  if (transcription.segments && transcription.segments.length > 0) {
    y += 10

    // Check for page break
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Segments', margin, y)
    y += 8

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    for (const segment of transcription.segments) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage()
        y = 20
      }

      // Timestamp
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100)
      doc.text(`[${formatTimeShort(segment.start)} - ${formatTimeShort(segment.end)}]`, margin, y)

      // Text
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0)
      const segmentLines = doc.splitTextToSize(segment.text, maxWidth - 50)
      doc.text(segmentLines, margin + 50, y)
      y += Math.max(segmentLines.length * 5, 6) + 2
    }
  }

  doc.save(`${filename}.pdf`)
}

/**
 * Export transcription as DOCX
 * Uses dynamic import to load docx only when needed
 */
export async function exportToDOCX(transcription: Transcription, recording: Recording): Promise<void> {
  const filename = getBaseFilename(recording)
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await getDocx()

  const children: InstanceType<typeof Paragraph>[] = []

  // Title
  children.push(
    new Paragraph({
      text: recording.title || 'Untitled Recording',
      heading: HeadingLevel.HEADING_1,
    })
  )

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Date: ', bold: true }),
        new TextRun(new Date(recording.createdAt).toLocaleDateString()),
      ],
    })
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Duration: ', bold: true }),
        new TextRun(formatTimeShort(recording.duration)),
      ],
    })
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Language: ', bold: true }),
        new TextRun(transcription.language),
      ],
    })
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Model: ', bold: true }),
        new TextRun(transcription.modelUsed),
      ],
    })
  )

  // Spacer
  children.push(new Paragraph({ text: '' }))

  // Transcript header
  children.push(
    new Paragraph({
      text: 'Transcript',
      heading: HeadingLevel.HEADING_2,
    })
  )

  // Full text
  children.push(
    new Paragraph({
      text: transcription.text,
    })
  )

  // Segments (if available)
  if (transcription.segments && transcription.segments.length > 0) {
    children.push(new Paragraph({ text: '' }))
    children.push(
      new Paragraph({
        text: 'Segments',
        heading: HeadingLevel.HEADING_2,
      })
    )

    for (const segment of transcription.segments) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${formatTimeShort(segment.start)} - ${formatTimeShort(segment.end)}] `,
              bold: true,
              color: '666666',
            }),
            new TextRun(segment.text),
          ],
        })
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  downloadFile(blob, `${filename}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

// Export format type for UI
export type ExportFormat = 'txt' | 'md' | 'srt' | 'vtt' | 'pdf' | 'docx'

export const EXPORT_FORMATS: { id: ExportFormat; label: string; description: string }[] = [
  { id: 'txt', label: 'Plain Text (.txt)', description: 'Simple text with timestamps' },
  { id: 'md', label: 'Markdown (.md)', description: 'Formatted document' },
  { id: 'srt', label: 'SRT Subtitles (.srt)', description: 'For video editing' },
  { id: 'vtt', label: 'WebVTT (.vtt)', description: 'Web video subtitles' },
  { id: 'pdf', label: 'PDF Document (.pdf)', description: 'Printable document' },
  { id: 'docx', label: 'Word Document (.docx)', description: 'Microsoft Word format' },
]

/**
 * Export transcription in the specified format
 */
export async function exportTranscription(
  format: ExportFormat,
  transcription: Transcription,
  recording: Recording
): Promise<void> {
  switch (format) {
    case 'txt':
      exportToTxt(transcription, recording)
      break
    case 'md':
      exportToMarkdown(transcription, recording)
      break
    case 'srt':
      exportToSRT(transcription, recording)
      break
    case 'vtt':
      exportToVTT(transcription, recording)
      break
    case 'pdf':
      await exportToPDF(transcription, recording)
      break
    case 'docx':
      await exportToDOCX(transcription, recording)
      break
  }
}
