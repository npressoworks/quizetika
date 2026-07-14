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
  children,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        "min-h-9 px-3 font-medium data-active:font-bold group-data-horizontal/tabs:after:bottom-[1px] group-data-horizontal/tabs:after:h-[3px]",
        className
      )}
      {...props}
    >
      {/*
       * ラベルと下線インジケータの間隔は、呼び出し側が TabsTrigger 自体の
       * padding（例: py-3）を上書きしても潰れないよう、内側要素の margin で確保する。
       */}
      <span className="mb-2 flex items-center gap-2">{children}</span>
    </TabsTrigger>
  )
}

export { Tabs, UnderlineTabsList, UnderlineTabsTrigger, TabsContent }
