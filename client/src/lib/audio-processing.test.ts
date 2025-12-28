import { describe, it, expect } from 'vitest'
import { calculateDuration } from './audio-processing'

describe('audio-processing', () => {
  describe('calculateDuration', () => {
    it('should calculate duration correctly at 16kHz', () => {
      const samples = 16000 // 1 second worth of samples at 16kHz
      const duration = calculateDuration(samples, 16000)
      expect(duration).toBe(1)
    })

    it('should calculate duration correctly at 44.1kHz', () => {
      const samples = 44100 // 1 second worth of samples at 44.1kHz
      const duration = calculateDuration(samples, 44100)
      expect(duration).toBe(1)
    })

    it('should handle zero samples', () => {
      const duration = calculateDuration(0, 16000)
      expect(duration).toBe(0)
    })
  })

  describe('convertAudioForWhisper', () => {
    // Note: convertAudioForWhisper requires browser APIs (AudioContext, OfflineAudioContext)
    // These tests would need to run in a browser environment or with proper mocks
    // For now, we're testing the core functionality (calculateDuration) which is pure logic
    
    it('should be defined', async () => {
      const { convertAudioForWhisper } = await import('./audio-processing')
      expect(convertAudioForWhisper).toBeDefined()
      expect(typeof convertAudioForWhisper).toBe('function')
    })
  })
})
