'use client'

import { useEffect } from 'react'

export default function HomeCursor() {
  useEffect(() => {
    const dot = document.getElementById('cDot')
    const ring = document.getElementById('cRing')
    if (!dot || !ring) return

    let mx=0,my=0,dx=0,dy=0,rx=0,ry=0,rafId=0
    const onMove = (e:MouseEvent) => { mx=e.clientX; my=e.clientY }
    window.addEventListener('mousemove', onMove)

    const loop = () => {
      dx+=(mx-dx)*0.22; dy+=(my-dy)*0.22
      rx+=(mx-rx)*0.08; ry+=(my-ry)*0.08
      dot.style.transform=`translate(calc(${dx}px - 50%), calc(${dy}px - 50%))`
      ring.style.transform=`translate(calc(${rx}px - 50%), calc(${ry}px - 50%))`
      rafId=requestAnimationFrame(loop)
    }
    rafId=requestAnimationFrame(loop)

    document.querySelectorAll('a,button,[data-hover],.zc,.imc').forEach(el => {
      el.addEventListener('mouseenter',()=>document.body.classList.add('hovering'))
      el.addEventListener('mouseleave',()=>document.body.classList.remove('hovering'))
    })
    document.querySelectorAll('input,textarea,select').forEach(el => {
      el.addEventListener('focus',()=>document.body.classList.add('hovering'))
      el.addEventListener('blur',()=>document.body.classList.remove('hovering'))
    })
    document.querySelectorAll('.hl,.market-section,.mq,.ag-section,.test-section,.cred-section,.nhr-section,.cpcv-section').forEach(el => {
      el.addEventListener('mouseenter',()=>document.body.classList.add('on-dark'))
      el.addEventListener('mouseleave',()=>document.body.classList.remove('on-dark'))
    })

    const cTxt = document.getElementById('cTxt')
    document.querySelectorAll('.zc').forEach(el => {
      const nome = el.querySelector('.zc-nm')?.textContent || ''
      el.addEventListener('mouseenter', () => {
        if (cTxt) cTxt.textContent = nome
        document.body.classList.add('on-zone')
        document.body.classList.remove('hovering', 'on-dark')
      })
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('on-zone')
      })
    })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <>
      <div id="cur">
        <div className="c-dot" id="cDot"></div>
        <div className="c-ring" id="cRing"><span className="c-txt" id="cTxt"></span></div>
      </div>
      <div id="pgb"></div>
    </>
  )
}
