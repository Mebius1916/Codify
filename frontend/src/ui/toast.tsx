import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'

import { cn } from '../utils/cn'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-[68px] left-1/2 -translate-x-1/2 z-[60] flex max-h-screen w-auto flex-col gap-2 outline-none',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(
      'group pointer-events-auto relative flex w-fit items-center justify-between gap-2 overflow-hidden rounded-lg border border-[#2A2F4C] bg-[#0f1119]/90 px-3 py-2 text-[#E5E7EB] shadow-xl backdrop-blur-sm will-change-transform data-[state=open]:animate-[toastIn_180ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[toastOut_140ms_ease-in]',
      className,
    )}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold leading-5 font-['Inter']", className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs leading-5 font-['Inter']", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'rounded-md p-1 text-current/60 transition-colors hover:bg-white/10 hover:text-current focus:outline-none focus:ring-1 focus:ring-white/30',
      className,
    )}
    {...props}
  />
))
ToastClose.displayName = ToastPrimitives.Close.displayName

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose }
