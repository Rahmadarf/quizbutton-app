import { useEffect, useRef, useState } from 'react'

export function useWakeLock(enabled: boolean): { supported: boolean; active: boolean } {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false)
      return
    }

    let cancelled = false

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release()
          return
        }
        sentinelRef.current = sentinel
        setActive(true)
        sentinel.addEventListener('release', () => {
          if (!cancelled) {
            setActive(false)
          }
        })
      } catch {
        // Fails gracefully if tab is not active, low battery, or blocked by iframe Permissions-Policy
        if (!cancelled) {
          setActive(false)
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestLock()
      }
    }

    void requestLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      const current = sentinelRef.current
      sentinelRef.current = null
      if (current && !current.released) {
        void current.release().catch(() => {})
      }
      setActive(false)
    }
  }, [enabled, supported])

  return { supported, active }
}
