import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // lunes
  const end = endOfWeek(date, { weekStartsOn: 1 })     // domingo
  return { start, end }
}

export function formatWeekLabel(weekStart: Date | string): string {
  const d = typeof weekStart === 'string' ? parseISO(weekStart) : weekStart
  const end = endOfWeek(d, { weekStartsOn: 1 })
  return `${format(d, 'dd MMM', { locale: es })} – ${format(end, 'dd MMM yyyy', { locale: es })}`
}

export function formatDateEs(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "dd/MMM/yyyy HH:mm", { locale: es })
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Genera semanas disponibles (últimas N semanas)
export function getAvailableWeeks(count = 12): Array<{ start: string; end: string; label: string }> {
  const weeks: Array<{ start: string; end: string; label: string }> = []
  const today = new Date()

  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const { start, end } = getWeekRange(d)
    weeks.push({
      start: toISODateString(start),
      end: toISODateString(end),
      label: formatWeekLabel(start),
    })
  }

  return weeks
}
