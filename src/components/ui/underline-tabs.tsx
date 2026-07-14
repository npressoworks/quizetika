"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/**
 * X（旧Twitter）風の下線タブ。共有 `tabs.tsx` の `line` バリアントを
 * ベースに、太めの下線インジケータとタブ行下のディバイダーを既定で適用する。
 */
function UnderlineTabsList({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsList>, "variant">) {
  return (
    <TabsList
      variant="line"
      className={cn("w-full justify-start border-b border-border", className)}
      {...props}
    />
  )
}

function UnderlineTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "min-h-9 gap-2 px-3 font-medium data-active:font-bold group-data-horizontal/tabs:after:bottom-[1px] group-data-horizontal/tabs:after:h-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, UnderlineTabsList, UnderlineTabsTrigger, TabsContent }
