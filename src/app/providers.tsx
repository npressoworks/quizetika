'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { isPostHogEnabled } from '@/lib/posthog-enabled'

function PostHogProviderInner({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY!
    posthog.init(apiKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: {
        dom_event_allowlist: ['click'],
        css_selector_allowlist: ['[data-analytics]'],
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!isPostHogEnabled()) {
    return <>{children}</>
  }

  return <PostHogProviderInner>{children}</PostHogProviderInner>
}
