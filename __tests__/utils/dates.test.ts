import { describe, it, expect } from 'vitest'

// ─── Date utilities used in the portal ───────────────────────────────────────

/** Get Monday of the week containing the given date (ISO week starts Monday) */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon...6=Sat
  const diff = (day === 0 ? -6 : 1 - day) // adjust to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get Sunday of the week containing the given date */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/** Format date for pt-PT locale display */
function formatDatePT(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Format date and time for pt-PT locale */
function formatDateTimePT(dateStr: string, timeStr?: string): string {
  const datePart = formatDatePT(dateStr)
  return timeStr ? `${datePart} ${timeStr}` : datePart
}

/** Generate ICS date string from YYYY-MM-DD */
function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

/** Generate ICS datetime string from YYYY-MM-DD + HH:MM */
function toICSDateTime(dateStr: string, time: string): string {
  const d = toICSDate(dateStr)
  const [h, m] = time.split(':')
  return `${d}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`
}

/** Pad number to 2 digits */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Generate ICS end time (start + 1 hour, capped at 23) */
function toICSEndDateTime(dateStr: string, time: string): string {
  const d = toICSDate(dateStr)
  const [h, m] = time.split(':')
  const endH = Math.min(23, parseInt(h) + 1)
  return `${d}T${pad(endH)}${m.padStart(2, '0')}00`
}

/** Generate a complete ICS calendar from events */
interface ICSEvent {
  title: string
  date: string
  time?: string
  description?: string
}

function generateICS(events: ICSEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agency Group//Portal 2026//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  events.forEach((ev, i) => {
    const d = ev.date.replace(/-/g, '')
    const h = ev.time ? ev.time.split(':')[0] : '09'
    const m = ev.time ? ev.time.split(':')[1] : '00'
    const dtStart = ev.time ? `${d}T${h}${m}00` : d
    const dtEnd = ev.time ? `${d}T${pad(Math.min(23, parseInt(h) + 1))}${m}00` : d
    lines.push(
      'BEGIN:VEVENT',
      `UID:ag-test-${i}@agencygroup.pt`,
      `DTSTART${ev.time ? '' : ';VALUE=DATE'}:${dtStart}`,
      `DTEND${ev.time ? '' : ';VALUE=DATE'}:${dtEnd}`,
      `SUMMARY:${(ev.title || '').replace(/,/g, '\\,')}`,
      `DESCRIPTION:${(ev.description || 'Agency Group — AMI 22506').replace(/,/g, '\\,')}`,
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// ─── Week calculation tests ───────────────────────────────────────────────────

describe('Date utilities — Week calculation', () => {
  it('getWeekStart returns Monday for a Wednesday', () => {
    // Wednesday 2026-04-01 → Monday 2026-03-30
    const wed = new Date('2026-04-01T12:00:00Z')
    const monday = getWeekStart(wed)
    expect(monday.getDay()).toBe(1) // Monday = 1
  })

  it('getWeekStart returns same Monday for Monday input', () => {
    const mon = new Date('2026-03-30T00:00:00Z')
    const start = getWeekStart(mon)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(mon.getDate())
  })

  it('getWeekStart returns Monday for Sunday input', () => {
    // Sunday goes back 6 days to Monday
    const sun = new Date('2026-04-05T12:00:00Z')
    const monday = getWeekStart(sun)
    expect(monday.getDay()).toBe(1)
  })

  it('getWeekEnd returns Sunday', () => {
    const wed = new Date('2026-04-01T12:00:00Z')
    const sunday = getWeekEnd(wed)
    expect(sunday.getDay()).toBe(0) // Sunday = 0
  })

  it('week spans exactly 7 days (Monday to Sunday)', () => {
    const wed = new Date('2026-04-01')
    const start = getWeekStart(wed)
    const end = getWeekEnd(wed)
    const diffMs = end.getTime() - start.getTime()
    // Monday to Sunday = 7 days span
    expect(Math.round(diffMs / (1000 * 60 * 60 * 24))).toBe(7)
  })

  it('Saturday of a given week has same Monday start', () => {
    const sat = new Date('2026-04-04T12:00:00Z')
    const mon = new Date('2026-03-30T12:00:00Z')
    expect(getWeekStart(sat).toISOString().split('T')[0])
      .toBe(getWeekStart(mon).toISOString().split('T')[0])
  })
})

// ─── ICS format generation ────────────────────────────────────────────────────

describe('Date utilities — ICS format', () => {
  it('toICSDate strips hyphens from YYYY-MM-DD', () => {
    expect(toICSDate('2026-04-15')).toBe('20260415')
    expect(toICSDate('2026-12-31')).toBe('20261231')
    expect(toICSDate('2026-01-01')).toBe('20260101')
  })

  it('toICSDateTime formats correctly', () => {
    expect(toICSDateTime('2026-04-15', '10:30')).toBe('20260415T103000')
    expect(toICSDateTime('2026-12-01', '09:00')).toBe('20261201T090000')
  })

  it('toICSEndDateTime adds 1 hour', () => {
    expect(toICSEndDateTime('2026-04-15', '10:30')).toBe('20260415T113000')
    expect(toICSEndDateTime('2026-04-15', '14:00')).toBe('20260415T150000')
  })

  it('toICSEndDateTime caps at 23:xx', () => {
    expect(toICSEndDateTime('2026-04-15', '23:00')).toBe('20260415T230000')
  })

  it('generateICS includes BEGIN:VCALENDAR header', () => {
    const ics = generateICS([{ title: 'Test', date: '2026-04-15' }])
    expect(ics).toContain('BEGIN:VCALENDAR')
  })

  it('generateICS includes END:VCALENDAR footer', () => {
    const ics = generateICS([{ title: 'Test', date: '2026-04-15' }])
    expect(ics).toContain('END:VCALENDAR')
  })

  it('generateICS includes VERSION:2.0', () => {
    const ics = generateICS([])
    expect(ics).toContain('VERSION:2.0')
  })

  it('generateICS includes correct PRODID', () => {
    const ics = generateICS([])
    expect(ics).toContain('PRODID:-//Agency Group//Portal 2026//PT')
  })

  it('generateICS wraps event in BEGIN:VEVENT...END:VEVENT', () => {
    const ics = generateICS([{ title: 'Visita', date: '2026-04-15', time: '10:00' }])
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('generateICS sets VALUE=DATE for events without time', () => {
    const ics = generateICS([{ title: 'Aniversário', date: '2026-04-15' }])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260415')
    expect(ics).toContain('DTEND;VALUE=DATE:20260415')
  })

  it('generateICS sets datetime format for events with time', () => {
    const ics = generateICS([{ title: 'Visita', date: '2026-04-15', time: '14:30' }])
    expect(ics).toContain('DTSTART:20260415T143000')
    expect(ics).toContain('DTEND:20260415T153000')
  })

  it('generateICS escapes commas in title', () => {
    const ics = generateICS([{ title: 'Visita, Lisboa', date: '2026-04-15' }])
    expect(ics).toContain('SUMMARY:Visita\\, Lisboa')
  })

  it('generateICS generates multiple events', () => {
    const events: ICSEvent[] = [
      { title: 'Visita 1', date: '2026-04-15', time: '10:00' },
      { title: 'Visita 2', date: '2026-04-16', time: '14:00' },
      { title: 'Visita 3', date: '2026-04-17', time: '11:00' },
    ]
    const ics = generateICS(events)
    const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length
    expect(veventCount).toBe(3)
  })

  it('generateICS includes SUMMARY with event title', () => {
    const ics = generateICS([{ title: 'Reunião de Avaliação', date: '2026-05-01' }])
    expect(ics).toContain('SUMMARY:Reunião de Avaliação')
  })

  it('generateICS includes default description if none provided', () => {
    const ics = generateICS([{ title: 'Visita', date: '2026-04-15' }])
    expect(ics).toContain('DESCRIPTION:Agency Group — AMI 22506')
  })

  it('generateICS uses provided description', () => {
    const ics = generateICS([{ title: 'Visita', date: '2026-04-15', description: 'Cliente: João Silva' }])
    expect(ics).toContain('DESCRIPTION:Cliente: João Silva')
  })
})

// ─── Date formatting for PT locale ───────────────────────────────────────────

describe('Date utilities — PT locale formatting', () => {
  it('formatDatePT returns DD/MM/YYYY format', () => {
    const result = formatDatePT('2026-04-15')
    // pt-PT locale: 15/04/2026
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formatDatePT for empty string returns em dash', () => {
    expect(formatDatePT('')).toBe('—')
  })

  it('formatDateTimePT includes time when provided', () => {
    const result = formatDateTimePT('2026-04-15', '14:30')
    expect(result).toContain('14:30')
  })

  it('formatDateTimePT without time returns just date', () => {
    const result = formatDateTimePT('2026-04-15')
    expect(result).not.toContain('undefined')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('pad function pads single digit to 2 chars', () => {
    expect(pad(1)).toBe('01')
    expect(pad(9)).toBe('09')
  })

  it('pad function does not pad double digits', () => {
    expect(pad(10)).toBe('10')
    expect(pad(23)).toBe('23')
  })
})
