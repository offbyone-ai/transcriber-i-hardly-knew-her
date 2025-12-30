import Dexie, { type EntityTable } from 'dexie'
import type { Subject, Recording, Transcription, WhisperModel } from '@shared/types'

// Extend types for Dexie
type DexieSubject = Omit<Subject, 'audioBlob'>
type DexieRecording = Omit<Recording, 'audioBlob'> & { audioBlob: Blob }
type DexieTranscription = Transcription

// Model storage type
type ModelData = {
  name: WhisperModel
  data: ArrayBuffer
  downloadedAt: Date
}

class TranscriberDB extends Dexie {
  subjects!: EntityTable<DexieSubject, 'id'>
  recordings!: EntityTable<DexieRecording, 'id'>
  transcriptions!: EntityTable<DexieTranscription, 'id'>
  models!: EntityTable<ModelData, 'name'>

  constructor() {
    super('TranscriberDB')
    
    this.version(1).stores({
      subjects: 'id, userId, name, createdAt',
      recordings: 'id, subjectId, userId, createdAt, title',
      transcriptions: 'id, recordingId, userId',
    })

    // Version 2: Add models table
    this.version(2).stores({
      subjects: 'id, userId, name, createdAt',
      recordings: 'id, subjectId, userId, createdAt, title',
      transcriptions: 'id, recordingId, userId',
      models: 'name, downloadedAt',
    })
    
    // Version 3: Add source and originalFileName fields to recordings
    this.version(3).stores({
      subjects: 'id, userId, name, createdAt',
      recordings: 'id, subjectId, userId, createdAt, title, source',
      transcriptions: 'id, recordingId, userId',
      models: 'name, downloadedAt',
    }).upgrade(tx => {
      // Migrate existing recordings to have source='recording'
      return tx.table('recordings').toCollection().modify(recording => {
        if (!recording.source) {
          recording.source = 'recording'
        }
      })
    })
    
    // Version 4: Fix duration for existing recordings
    this.version(4).stores({
      subjects: 'id, userId, name, createdAt',
      recordings: 'id, subjectId, userId, createdAt, title, source',
      transcriptions: 'id, recordingId, userId',
      models: 'name, downloadedAt',
    }).upgrade(async tx => {
      // Get all recordings with missing or zero duration
      const recordings = await tx.table('recordings').toArray()
      const recordingsToFix = recordings.filter(r => !r.duration || r.duration === 0)
      
      console.log(`[DB Migration v4] Found ${recordingsToFix.length} recordings to fix duration`)
      
      // Fix each recording's duration by reading audio metadata
      for (const recording of recordingsToFix) {
        try {
          const duration = await getAudioDuration(recording.audioBlob)
          await tx.table('recordings').update(recording.id, { duration })
          console.log(`[DB Migration v4] Fixed duration for recording ${recording.id}: ${duration}s`)
        } catch (error) {
          console.error(`[DB Migration v4] Failed to fix duration for recording ${recording.id}:`, error)
        }
      }
    })
  }
}

// Helper function to get audio duration from blob
function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(blob)
    let resolved = false
    
    // Timeout after 5 seconds to prevent hanging
    const timeout = setTimeout(() => {
      if (!resolved) {
        URL.revokeObjectURL(url)
        resolved = true
        reject(new Error('Timeout waiting for audio metadata'))
      }
    }, 5000)
    
    audio.addEventListener('loadedmetadata', () => {
      if (resolved) return
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolved = true
      
      if (isFinite(audio.duration) && audio.duration > 0) {
        resolve(audio.duration)
      } else {
        reject(new Error(`Invalid audio duration: ${audio.duration}`))
      }
    })
    
    audio.addEventListener('error', () => {
      if (resolved) return
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolved = true
      reject(new Error(`Failed to load audio metadata: ${audio.error?.message || 'Unknown error'}`))
    })
    
    audio.src = url
  })
}

export const db = new TranscriberDB()

// Helper functions
export async function addSubject(subject: Subject) {
  return await db.subjects.add(subject)
}

export async function getSubjectsByUserId(userId: string) {
  return await db.subjects
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('createdAt')
}

export async function addRecording(recording: Recording) {
  return await db.recordings.add(recording)
}

export async function getRecordingsBySubjectId(subjectId: string) {
  return await db.recordings
    .where('subjectId')
    .equals(subjectId)
    .reverse()
    .sortBy('createdAt')
}

export async function addTranscription(transcription: Transcription) {
  return await db.transcriptions.add(transcription)
}

export async function getTranscriptionByRecordingId(recordingId: string) {
  return await db.transcriptions
    .where('recordingId')
    .equals(recordingId)
    .first()
}

export async function deleteSubject(subjectId: string) {
  // Delete all recordings and transcriptions for this subject
  const recordings = await db.recordings.where('subjectId').equals(subjectId).toArray()
  
  for (const recording of recordings) {
    await db.transcriptions.where('recordingId').equals(recording.id).delete()
  }
  
  await db.recordings.where('subjectId').equals(subjectId).delete()
  return await db.subjects.delete(subjectId)
}

export async function deleteRecording(recordingId: string) {
  await db.transcriptions.where('recordingId').equals(recordingId).delete()
  return await db.recordings.delete(recordingId)
}

export async function updateRecordingSubject(recordingId: string, newSubjectId: string | undefined) {
  return await db.recordings.update(recordingId, { subjectId: newSubjectId })
}

export async function updateRecordingTitle(recordingId: string, newTitle: string | undefined) {
  return await db.recordings.update(recordingId, { title: newTitle })
}

// Model management functions
export async function saveModel(name: WhisperModel, data: ArrayBuffer) {
  return await db.models.put({
    name,
    data,
    downloadedAt: new Date(),
  })
}

export async function getModel(name: WhisperModel) {
  return await db.models.get(name)
}

export async function getDownloadedModels() {
  return await db.models.toArray()
}

export async function deleteModel(name: WhisperModel) {
  return await db.models.delete(name)
}

// Fix duration for a specific recording
export async function fixRecordingDuration(recordingId: string): Promise<number> {
  const recording = await db.recordings.get(recordingId)
  if (!recording) {
    throw new Error('Recording not found')
  }
  
  const duration = await getAudioDuration(recording.audioBlob)
  await db.recordings.update(recordingId, { duration })
  return duration
}

// Fix duration for all recordings with 0 or missing duration
export async function fixAllRecordingDurations(): Promise<number> {
  const recordings = await db.recordings.toArray()
  const recordingsToFix = recordings.filter(r => !r.duration || r.duration === 0)
  
  console.log(`[Fix Durations] Found ${recordingsToFix.length} recordings to fix`)
  
  let fixed = 0
  for (const recording of recordingsToFix) {
    try {
      const duration = await getAudioDuration(recording.audioBlob)
      await db.recordings.update(recording.id, { duration })
      console.log(`[Fix Durations] Fixed recording ${recording.id}: ${duration}s`)
      fixed++
    } catch (error) {
      console.error(`[Fix Durations] Failed to fix recording ${recording.id}:`, error)
    }
  }
  
  console.log(`[Fix Durations] Successfully fixed ${fixed}/${recordingsToFix.length} recordings`)
  return fixed
}
