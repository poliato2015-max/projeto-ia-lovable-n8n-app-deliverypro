import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type LayoutProps = ComponentPropsWithoutRef<"div">;

const sharedClasses = "mx-auto w-full px-6 lg:px-12";

export function PublicLayout({ className, ...props }: LayoutProps) {
  return <div className={cn(sharedClasses, "max-w-[1600px]", className)} {...props} />;
}

export function AdminLayout({ className, ...props }: LayoutProps) {
  return <div className={cn(sharedClasses, "max-w-[1400px]", className)} {...props} />;
}