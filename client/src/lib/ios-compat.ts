// iOS-specific compatibility utilities
// Handles quirks and limitations of iOS Safari

/**
 * Detect if running on iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

/**
 * Detect if running on Safari (iOS or macOS)
 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

/**
 * Detect if running on iOS Safari specifically
 */
export function isIOSSafari(): boolean {
  return isIOS() && isSafari()
}

/**
 * Get iOS version as [major, minor, patch] or null if not iOS
 */
export function getIOSVersion(): [number, number, number] | null {
  if (!isIOS()) return null

  const match = navigator.userAgent.match(/OS (\d+)_(\d+)(?:_(\d+))?/)
  if (!match) return null

  return [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3] || '0', 10)
  ]
}

/**
 * iOS requires a user gesture to create an AudioContext
 * This helper ensures we're in a valid user gesture context
 */
let audioContextUnlocked = false
let audioContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

/**
 * Unlock AudioContext with a user gesture
 * Call this from a click/touch handler
 */
export async function unlockAudioContext(): Promise<void> {
  if (audioContextUnlocked) return

  const ctx = getAudioContext()

  // iOS Safari requires playing a silent buffer to unlock
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  // Create and play a silent buffer
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)

  audioContextUnlocked = true
  console.log('[iOS] AudioContext unlocked')
}

/**
 * Check if AudioContext is unlocked (ready for use)
 */
export function isAudioContextUnlocked(): boolean {
  return audioContextUnlocked
}

/**
 * iOS Safari has memory pressure issues
 * This returns an estimate of memory availability
 */
export function getIOSMemoryPressure(): 'low' | 'medium' | 'high' | 'unknown' {
  if (!isIOS()) return 'unknown'

  // Use performance.memory if available (non-standard)
  const perf = performance as any
  if (perf.memory) {
    const usedMB = perf.memory.usedJSHeapSize / (1024 * 1024)
    const limitMB = perf.memory.jsHeapSizeLimit / (1024 * 1024)
    const ratio = usedMB / limitMB

    if (ratio < 0.5) return 'low'
    if (ratio < 0.75) return 'medium'
    return 'high'
  }

  // Fall back to device memory estimate
  const deviceMemory = (navigator as any).deviceMemory || 4
  if (deviceMemory >= 6) return 'low'
  if (deviceMemory >= 4) return 'medium'
  return 'high'
}

/**
 * iOS Safari has issues with large Blob operations
 * This helper safely reads a Blob in chunks
 */
export async function safeReadBlob(blob: Blob, chunkSize: number = 4 * 1024 * 1024): Promise<ArrayBuffer> {
  // For small blobs or non-iOS, just read directly
  if (!isIOS() || blob.size < chunkSize) {
    return blob.arrayBuffer()
  }

  // For large blobs on iOS, read in chunks
  const chunks: ArrayBuffer[] = []
  let offset = 0

  while (offset < blob.size) {
    const slice = blob.slice(offset, Math.min(offset + chunkSize, blob.size))
    const chunk = await slice.arrayBuffer()
    chunks.push(chunk)
    offset += chunkSize

    // Yield to the event loop to prevent UI freezing
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  // Combine chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), pos)
    pos += chunk.byteLength
  }

  return result.buffer
}

/**
 * iOS Safari has a maximum WebGL texture size
 * This can affect ML model loading
 */
export function getIOSMaxTextureSize(): number {
  if (!isIOS()) return 16384 // Assume high for non-iOS

  // Get iOS version to estimate
  const version = getIOSVersion()
  if (!version) return 4096 // Conservative fallback

  // Newer iOS versions support larger textures
  if (version[0] >= 15) return 8192
  if (version[0] >= 12) return 4096
  return 2048
}

/**
 * Force garbage collection hint on iOS
 * This is a best-effort approach since we can't force GC
 */
export function requestIOSGarbageCollection(): void {
  if (!isIOS()) return

  // Clear any cached audio contexts if they're not in use
  if (audioContext && audioContext.state === 'closed') {
    audioContext = null
  }

  // Request animation frame to yield to GC
  requestAnimationFrame(() => {
    // Create and immediately discard a large array to trigger GC heuristics
    // @ts-ignore
    const _ = new Array(1000000)
  })
}

/**
 * Check if WebGPU is available on this iOS device
 * iOS Safari doesn't support WebGPU as of iOS 17
 */
export async function hasIOSWebGPU(): Promise<boolean> {
  if (!isIOS()) return false

  // As of iOS 17, WebGPU is not available in Safari
  // It's only available in Safari Technology Preview
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return false
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}
