/**
 * Device detection utilities for transcription mode selection
 */

import { isTauriIOS, isTauriApp, isNativeMobile } from './platform'

// WebGPU types - these are available in modern browsers but not in TS lib by default
declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<GPUAdapter | null>
    }
  }
  interface GPUAdapter {
    requestAdapterInfo?(): Promise<GPUAdapterInfo>
  }
  interface GPUAdapterInfo {
    vendor?: string
    device?: string
    description?: string
  }
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function hasSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined'
}

export function getDeviceMemoryGB(): number {
  if (typeof navigator === 'undefined') return 4
  // @ts-expect-error - deviceMemory is non-standard
  return navigator.deviceMemory || 4
}

/**
 * Check if WebGPU is available for GPU-accelerated transcription
 */
export async function hasWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!navigator.gpu) return false
  
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

/**
 * Get WebGPU device info for display
 */
export async function getWebGPUInfo(): Promise<{
  available: boolean
  adapterName?: string
  vendor?: string
}> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { available: false }
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      return { available: false }
    }
    
    // Get adapter info if available
    const info = await adapter.requestAdapterInfo?.() || {}
    
    return {
      available: true,
      adapterName: info.device || info.description || 'GPU',
      vendor: info.vendor || undefined,
    }
  } catch {
    return { available: false }
  }
}

/**
 * Check if local transcription is likely to work
 * Note: We're more permissive now - it might work even without SharedArrayBuffer
 * in some browsers using a fallback approach
 */
export function canUseLocalTranscription(): boolean {
  // Tauri iOS app: WKWebView doesn't support WebGPU, use server transcription
  if (isTauriIOS()) {
    return false
  }

  // Tauri desktop: allow local transcription
  if (isTauriApp() && !isNativeMobile()) {
    return true
  }

  // On desktop browser, always allow it - transformers.js has fallbacks
  if (!isMobileDevice()) {
    return true
  }

  // On mobile browser, check for WebGPU synchronously using the navigator.gpu existence
  // This is a quick check - full WebGPU availability is async
  // If WebGPU is present, there's a good chance local will work well
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    return true
  }

  // No WebGPU on mobile = risky due to memory constraints
  return false
}

/**
 * Async version that fully validates WebGPU adapter availability
 */
export async function canUseLocalTranscriptionAsync(): Promise<{
  canUse: boolean
  reason: string
  hasGPU: boolean
}> {
  // Tauri iOS: WKWebView doesn't support WebGPU
  if (isTauriIOS()) {
    return {
      canUse: false,
      reason: 'iOS app uses server transcription for best performance',
      hasGPU: false,
    }
  }

  // Tauri desktop: allow local transcription
  if (isTauriApp() && !isNativeMobile()) {
    const gpuAvailable = await hasWebGPU()
    return {
      canUse: true,
      reason: gpuAvailable
        ? 'Desktop app with GPU acceleration'
        : 'Desktop app with CPU/WASM fallback',
      hasGPU: gpuAvailable,
    }
  }

  const isMobile = isMobileDevice()

  if (!isMobile) {
    const gpuAvailable = await hasWebGPU()
    return {
      canUse: true,
      reason: gpuAvailable
        ? 'Desktop with GPU acceleration'
        : 'Desktop with CPU/WASM fallback',
      hasGPU: gpuAvailable,
    }
  }

  // Mobile browser - require WebGPU for good experience
  const gpuAvailable = await hasWebGPU()
  if (gpuAvailable) {
    return {
      canUse: true,
      reason: 'Mobile with GPU acceleration',
      hasGPU: true,
    }
  }

  return {
    canUse: false,
    reason: 'Mobile without GPU - memory constraints likely',
    hasGPU: false,
  }
}

export type TranscriptionMode = 'local' | 'server' | 'browser-speech'

export type TranscriptionRecommendation = {
  recommended: TranscriptionMode
  available: TranscriptionMode[]
  reason: string
}

export async function getTranscriptionRecommendation(
  serverAvailable: boolean = false
): Promise<TranscriptionRecommendation> {
  const isMobile = isMobileDevice()
  const hasWasmSupport = hasSharedArrayBuffer()
  const gpuAvailable = await hasWebGPU()

  const available: TranscriptionMode[] = ['browser-speech']

  // Tauri iOS: server transcription only (WKWebView doesn't support WebGPU)
  if (isTauriIOS()) {
    if (serverAvailable) {
      available.push('server')
      return {
        recommended: 'server',
        available,
        reason: 'Server transcription for iOS app',
      }
    }
    return {
      recommended: 'browser-speech',
      available,
      reason: 'Using browser speech recognition (server not available)',
    }
  }

  // Tauri desktop: allow local transcription
  if (isTauriApp() && !isNativeMobile()) {
    available.push('local')
    if (serverAvailable) available.push('server')
    return {
      recommended: 'local',
      available,
      reason: gpuAvailable
        ? 'Desktop app with GPU acceleration'
        : 'Desktop app with CPU/WASM fallback',
    }
  }

  // Check if local transcription is viable for web
  // Desktop: always available
  // Mobile: only if WebGPU is available
  if (!isMobile || gpuAvailable) {
    available.push('local')
  }

  // Check if server is available
  if (serverAvailable) {
    available.push('server')
  }

  // Determine recommendation for web
  if (isMobile) {
    if (gpuAvailable) {
      // Mobile with WebGPU - local is viable!
      return {
        recommended: 'local',
        available,
        reason: 'GPU-accelerated local transcription available',
      }
    }
    
    if (serverAvailable) {
      return {
        recommended: 'server',
        available,
        reason: 'Server transcription recommended for mobile devices',
      }
    }
    return {
      recommended: 'browser-speech',
      available,
      reason: 'Using browser speech recognition (Whisper may be unstable on mobile)',
    }
  }
  
  // Desktop with WebGPU - best experience
  if (gpuAvailable) {
    return {
      recommended: 'local',
      available,
      reason: 'GPU-accelerated local transcription for maximum privacy',
    }
  }
  
  if (!hasWasmSupport) {
    // Still allow local, but note it may be slower
    if (serverAvailable) {
      return {
        recommended: 'server',
        available,
        reason: 'Server transcription may be faster on your browser',
      }
    }
    return {
      recommended: 'local',
      available,
      reason: 'Local AI transcription (may be slower without full browser support)',
    }
  }
  
  // Desktop with full support - prefer local for privacy
  return {
    recommended: 'local',
    available,
    reason: 'Local AI transcription for maximum privacy',
  }
}
