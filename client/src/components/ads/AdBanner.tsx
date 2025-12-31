import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/auth-client'

type AdPlacement = 'transcription' | 'recording'

interface AdBannerProps {
  placement: AdPlacement
  className?: string
}

/**
 * AdBanner component for displaying ads to free-tier users.
 * 
 * Currently shows ads to all users. When premium tiers are implemented,
 * add a `isPremium` check to hide ads for paying users.
 * 
 * ## Setup Instructions for Ad Networks:
 * 
 * ### Option 1: Carbon Ads (Recommended for dev/tech audience)
 * 1. Apply at https://www.carbonads.net/
 * 2. Once approved, you'll get a script like:
 *    <script async src="//cdn.carbonads.com/carbon.js?serve=XXXXX&placement=yoursitecom" id="_carbonads_js"></script>
 * 3. Replace the placeholder div below with this script
 * 
 * ### Option 2: EthicalAds (Privacy-focused, great for open source)
 * 1. Apply at https://www.ethicalads.io/
 * 2. Add their script to your head:
 *    <script async src="https://media.ethicalads.io/media/client/ethicalads.min.js"></script>
 * 3. Replace placeholder with:
 *    <div data-ea-publisher="your-publisher-id" data-ea-type="image"></div>
 * 
 * ### Option 3: BuySellAds
 * 1. Apply at https://www.buysellads.com/
 * 2. Follow their integration guide for native ads
 * 
 * ## Future Premium Implementation:
 * When you add paid tiers, update the `shouldShowAds` logic:
 * ```
 * const shouldShowAds = session?.user && !session.user.isPremium
 * ```
 */
export function AdBanner({ placement, className = '' }: AdBannerProps) {
  const { data: session } = useSession()
  const adContainerRef = useRef<HTMLDivElement>(null)

  // TODO: When premium tiers are added, check user.isPremium here
  // For now, show ads to all authenticated users
  const shouldShowAds = !!session?.user

  useEffect(() => {
    if (!shouldShowAds || !adContainerRef.current) return

    // Ad network scripts typically need to re-initialize when the component mounts
    // This is where you'd call any ad network refresh functions
    // Example for Carbon: window._carbonads?.refresh()
    
  }, [shouldShowAds, placement])

  if (!shouldShowAds) {
    return null
  }

  return (
    <div 
      ref={adContainerRef}
      className={`ad-banner ad-banner--${placement} ${className}`}
      data-ad-placement={placement}
    >
      {/* 
        Buy Me a Coffee button - replace with ad network code when approved.
        
        To switch to Carbon Ads or EthicalAds later, replace the content below
        with your ad network's script/embed code.
      */}
      <div className="w-full max-w-182 mx-auto flex justify-center">
        <a 
          href="https://www.buymeacoffee.com/keonik" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-full transition-colors shadow-sm hover:shadow-md"
        >
          <span className="text-lg">☕</span>
          <span>Support your developer</span>
        </a>
      </div>
    </div>
  )
}

export default AdBanner
