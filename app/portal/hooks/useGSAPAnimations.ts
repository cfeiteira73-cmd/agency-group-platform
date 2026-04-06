'use client'
import { useEffect, useRef } from 'react'

// Only import gsap on client side
let gsap: typeof import('gsap').gsap | null = null
if (typeof window !== 'undefined') {
  import('gsap').then(m => { gsap = m.gsap })
}

/** Stagger-in a group of elements (cards, rows, items) */
export function useStaggerIn(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string = '[data-stagger]',
  options?: { delay?: number; duration?: number; y?: number }
) {
  useEffect(() => {
    if (!gsap || !containerRef.current) return
    const els = containerRef.current.querySelectorAll(selector)
    if (!els.length) return
    gsap.fromTo(
      els,
      { opacity: 0, y: options?.y ?? 16 },
      {
        opacity: 1, y: 0,
        duration: options?.duration ?? 0.45,
        stagger: 0.06,
        delay: options?.delay ?? 0,
        ease: 'power2.out',
        clearProps: 'transform',
      }
    )
  }, [])
}

/** Fade + slide in a single element */
export function useFadeIn(
  ref: React.RefObject<HTMLElement | null>,
  options?: { delay?: number; duration?: number; y?: number }
) {
  useEffect(() => {
    if (!gsap || !ref.current) return
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: options?.y ?? 12 },
      {
        opacity: 1, y: 0,
        duration: options?.duration ?? 0.5,
        delay: options?.delay ?? 0,
        ease: 'power2.out',
        clearProps: 'transform',
      }
    )
  }, [])
}

/** Animate a number counting up from 0 to target */
export function useCountUp(
  ref: React.RefObject<HTMLElement | null>,
  target: number,
  options?: { delay?: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }
) {
  useEffect(() => {
    if (!gsap || !ref.current) return
    const obj = { val: 0 }
    const prefix = options?.prefix ?? ''
    const suffix = options?.suffix ?? ''
    const decimals = options?.decimals ?? 0
    gsap.to(obj, {
      val: target,
      duration: options?.duration ?? 1.2,
      delay: options?.delay ?? 0.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = prefix + obj.val.toFixed(decimals) + suffix
        }
      }
    })
  }, [target])
}

/** Subtle scale pulse for notification/alert elements */
export function usePulseAttention(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  useEffect(() => {
    if (!gsap || !ref.current || !active) return
    gsap.fromTo(
      ref.current,
      { scale: 1 },
      { scale: 1.03, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'transform' }
    )
  }, [active])
}
