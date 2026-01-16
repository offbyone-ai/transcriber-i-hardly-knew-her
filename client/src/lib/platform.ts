// Platform detection utilities for Tauri native apps vs web

/**
 * Check if running in a Tauri native app
 */
export function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Check if running in Tauri on iOS
 */
export function isTauriIOS(): boolean {
  if (!isTauriApp()) return false
  // Check navigator.platform for iOS devices
  const platform = navigator.platform?.toLowerCase() || ''
  return platform.includes('iphone') || platform.includes('ipad')
}

/**
 * Check if running in Tauri on Android
 */
export function isTauriAndroid(): boolean {
  if (!isTauriApp()) return false
  return /android/i.test(navigator.userAgent)
}

/**
 * Check if running in Tauri on desktop (macOS, Windows, Linux)
 */
export function isTauriDesktop(): boolean {
  return isTauriApp() && !isTauriIOS() && !isTauriAndroid()
}

/**
 * Get the current platform
 */
export type Platform = 'web' | 'ios' | 'android' | 'desktop'

export function getPlatform(): Platform {
  if (!isTauriApp()) return 'web'
  if (isTauriIOS()) return 'ios'
  if (isTauriAndroid()) return 'android'
  return 'desktop'
}

/**
 * Check if running in a native mobile app (iOS or Android)
 */
export function isNativeMobile(): boolean {
  return isTauriIOS() || isTauriAndroid()
}

/**
 * Check if running on the web (not in Tauri)
 */
export function isWeb(): boolean {
  return !isTauriApp()
}
