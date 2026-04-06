'use client'
import type { CSSProperties } from 'react'

interface SkeletonProps {
  darkMode?: boolean
}

// Base shimmer line
function SkLine({ w = '100%', h = 14, r = 6, style }: { w?: string | number; h?: number; r?: number; style?: CSSProperties }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }}
    />
  )
}

// KPI Card skeleton — matches kpi-card layout
export function SkeletonKPI({ darkMode }: SkeletonProps) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(14,14,13,.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <SkLine w={80} h={10} r={4} />
        <SkLine w={40} h={18} r={4} />
      </div>
      <SkLine w={120} h={32} r={6} style={{ marginBottom: 8 }} />
      <SkLine w={100} h={10} r={4} />
    </div>
  )
}

// Card skeleton — generic p-card layout
export function SkeletonCard({ darkMode, lines = 3 }: SkeletonProps & { lines?: number }) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 1px 3px rgba(14,14,13,.06)',
    }}>
      <SkLine w="60%" h={14} r={6} style={{ marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkLine key={i} w={i === lines - 1 ? '70%' : '100%'} h={11} r={4} style={{ marginBottom: i < lines - 1 ? 8 : 0 }} />
      ))}
    </div>
  )
}

// List row skeleton
export function SkeletonListRow({ darkMode }: SkeletonProps) {
  const border = darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.06)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: `1px solid ${border}`,
    }}>
      <SkLine w={36} h={36} r={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <SkLine w="50%" h={12} r={4} style={{ marginBottom: 6 }} />
        <SkLine w="35%" h={10} r={4} />
      </div>
      <SkLine w={60} h={22} r={4} />
    </div>
  )
}

// List skeleton — multiple rows
export function SkeletonList({ darkMode, rows = 5 }: SkeletonProps & { rows?: number }) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(14,14,13,.06)',
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListRow key={i} darkMode={darkMode} />
      ))}
    </div>
  )
}

// Table skeleton
export function SkeletonTable({ darkMode, rows = 5, cols = 4 }: SkeletonProps & { rows?: number; cols?: number }) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  const rowBorder = darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.06)'
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(14,14,13,.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 16, padding: '12px 20px',
        borderBottom: `1px solid ${border}`,
        background: darkMode ? 'rgba(240,237,228,.03)' : 'rgba(14,14,13,.02)',
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkLine key={i} w="60%" h={10} r={4} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16, padding: '12px 20px',
          borderBottom: r < rows - 1 ? `1px solid ${rowBorder}` : 'none',
        }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkLine key={c} w={c === 0 ? '80%' : '55%'} h={11} r={4} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Chart skeleton
export function SkeletonChart({ darkMode, height = 200 }: SkeletonProps & { height?: number }) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  const barColor = darkMode ? 'rgba(240,237,228,.05)' : 'rgba(14,14,13,.05)'
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: 24,
      boxShadow: '0 1px 3px rgba(14,14,13,.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <SkLine w={120} h={14} r={6} />
        <SkLine w={80} h={26} r={4} />
      </div>
      {/* Chart area */}
      <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative' }}>
        {/* Y-axis lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <div key={pct} style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: `${pct * 100}%`,
            height: 1,
            background: darkMode ? 'rgba(240,237,228,.04)' : 'rgba(14,14,13,.04)',
          }} />
        ))}
        {/* Bars */}
        {[0.4, 0.65, 0.5, 0.8, 0.6, 0.75, 0.55, 0.9, 0.7, 0.85, 0.5, 0.65].map((h, i) => (
          <div key={i} className="skeleton" style={{
            flex: 1,
            height: `${h * 100}%`,
            borderRadius: '4px 4px 0 0',
            background: barColor,
          }} />
        ))}
      </div>
    </div>
  )
}

// KPI Grid skeleton — 4 KPI cards
export function SkeletonKPIGrid({ darkMode }: SkeletonProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
    }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonKPI key={i} darkMode={darkMode} />
      ))}
    </div>
  )
}

// Dashboard skeleton — full page
export function SkeletonDashboard({ darkMode }: SkeletonProps) {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <SkLine w={240} h={32} r={6} style={{ marginBottom: 8 }} />
          <SkLine w={160} h={12} r={4} />
        </div>
        <SkLine w={100} h={36} r={6} />
      </div>
      {/* KPI Grid */}
      <SkeletonKPIGrid darkMode={darkMode} />
      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <SkeletonList darkMode={darkMode} rows={4} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonCard darkMode={darkMode} lines={4} />
          <SkeletonCard darkMode={darkMode} lines={3} />
        </div>
      </div>
    </div>
  )
}

// CRM skeleton
export function SkeletonCRM({ darkMode }: SkeletonProps) {
  const bg = darkMode ? '#0f1e16' : '#ffffff'
  const border = darkMode ? 'rgba(201,169,110,.11)' : 'rgba(14,14,13,.08)'
  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* List panel */}
      <div style={{
        width: 280, borderRight: `1px solid ${border}`,
        background: bg,
      }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${border}` }}>
          <SkLine w="100%" h={36} r={8} />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonListRow key={i} darkMode={darkMode} />
        ))}
      </div>
      {/* Detail panel */}
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <SkLine w={64} h={64} r={32} />
          <div>
            <SkLine w={180} h={20} r={6} style={{ marginBottom: 8 }} />
            <SkLine w={120} h={12} r={4} />
          </div>
        </div>
        <SkeletonTable darkMode={darkMode} rows={3} cols={3} />
        <SkeletonChart darkMode={darkMode} height={160} />
      </div>
    </div>
  )
}
