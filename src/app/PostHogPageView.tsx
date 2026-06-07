'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { isPostHogEnabled } from '@/lib/posthog-enabled'

export function PostHogPageView() {
  if (!isPostHogEnabled()) {
    return null
  }

  return <PostHogPageViewTracker />
}

function PostHogPageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (!pathname || !posthog) return

    let url = window.origin + pathname
    const search = searchParams.toString()
    if (search) {
      url = `${url}?${search}`
    }
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, posthog])

  return null
}
