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
  }
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
