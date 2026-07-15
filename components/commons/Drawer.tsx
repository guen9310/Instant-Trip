"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/shared/utils";

function Drawer({ onOpenChange, ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const handleOpenChange = (open: boolean) => {
    if (open) (document.activeElement as HTMLElement)?.blur();
    onOpenChange?.(open);
  };
  return <DrawerPrimitive.Root onOpenChange={handleOpenChange} {...props} />;
}
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerClose = DrawerPrimitive.Close;

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  showHandle = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showHandle?: boolean;
}) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cn(
          "fixed z-50 inset-x-0 bottom-0 flex flex-col",
          "rounded-t-[20px] bg-background border-t border-border outline-none",
          className,
        )}
        {...props}
      >
        {showHandle && (
          <div aria-hidden className="flex justify-center pt-2 pb-3.5 shrink-0">
            <div className="w-9 h-1 rounded-full bg-border" />
          </div>
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1.5 px-4 py-4", className)} {...props} />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 px-4 pb-5", className)} {...props} />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn("font-bold text-[18px] text-text-primary tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-[13px] text-text-secondary", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
