'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: {
        dom_event_allowlist: ['click'], // clickイベントのみを対象にする（changeやsubmitは無視）
        css_selector_allowlist: ['[data-analytics]'], // data-analytics 属性がある要素だけを収集対象にする
      }
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
