'use client'
import { useEffect, type RefObject } from 'react'
import gsap from 'gsap'

/** Stagger-in a group of elements (cards, rows, items) */
export function useStaggerIn(
  containerRef: RefObject<HTMLElement | null>,
  selector: string = '[data-stagger]',
  options?: { delay?: number; duration?: number; y?: number }
) {
  useEffect(() => {
    if (!containerRef.current) return
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Fade + slide in a single element */
export function useFadeIn(
  ref: RefObject<HTMLElement | null>,
  options?: { delay?: number; duration?: number; y?: number }
) {
  useEffect(() => {
    if (!ref.current) return
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Animate a number counting up from 0 to target */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  target: number,
  options?: { delay?: number; duration?: number; prefix?: string; suffix?: string; decimals?: number }
) {
  useEffect(() => {
    if (!ref.current) return
    const obj = { val: 0 }
    const el = ref.current
    gsap.to(obj, {
      val: target,
      duration: options?.duration ?? 1.2,
      delay: options?.delay ?? 0.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (el) {
          el.textContent = (options?.prefix ?? '') + obj.val.toFixed(options?.decimals ?? 0) + (options?.suffix ?? '')
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
}

/** Subtle scale pulse for notification/alert elements */
export function usePulseAttention(
  ref: RefObject<HTMLElement | null>,
  active: boolean
) {
  useEffect(() => {
    if (!ref.current || !active) return
    gsap.fromTo(
      ref.current,
      { scale: 1 },
      { scale: 1.03, duration: 0.3, yoyo: true, repeat: 1, ease: 'power1.inOut', clearProps: 'transform' }
    )
  }, [active])
}
