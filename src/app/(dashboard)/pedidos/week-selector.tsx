'use client'

interface Props {
  weeks: string[]
  selected: string
  formatLabel: (w: string) => string
}

export function WeekSelector({ weeks, selected, formatLabel }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href)
    url.searchParams.set('week', e.target.value)
    window.location.href = url.toString()
  }

  return (
    <select
      name="week"
      defaultValue={selected}
      onChange={handleChange}
      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {weeks.length > 0
        ? weeks.map((w) => (
            <option key={w} value={w}>{formatLabel(w)}</option>
          ))
        : <option value={selected}>{formatLabel(selected)}</option>
      }
    </select>
  )
}
