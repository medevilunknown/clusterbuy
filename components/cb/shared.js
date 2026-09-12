'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { statusCls, inr } from '@/lib/cb/api'
import { Bell, Search, LogOut, ChevronDown, Check, Boxes, User, Settings as SettingsIcon, Clock } from 'lucide-react'

// ---- Brand logo ----
export function Logo({ dark = false, sub = 'Stronger together. Better materials.' }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: dark ? '#007F78' : 'linear-gradient(135deg,#142D4E,#007F78)' }}>
        <Boxes className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <div className={cn('text-[17px] font-extrabold tracking-tight', dark ? 'text-white' : 'text-[#142D4E]')}>ClusterBuy</div>
        {sub && <div className={cn('text-[9px] font-medium uppercase tracking-wider', dark ? 'text-white/50' : 'text-slate-400')}>{sub}</div>}
      </div>
    </div>
  )
}

// ---- Status badge ----
export function StatusBadge({ status, className }) {
  if (!status) return null
  const label = status.length > 22 ? status.replace(/_/g, ' ') : status.replace(/_/g, ' ')
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize', statusCls(status), className)}>
      {label.toLowerCase()}
    </span>
  )
}

// ---- KPI card ----
export function KpiCard({ label, value, sub, icon: Icon, accent = '#007F78', onClick }) {
  return (
    <button onClick={onClick} className={cn('flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] transition', onClick && 'hover:border-slate-300 hover:shadow-md')}>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
        {Icon && <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: accent + '18', color: accent }}><Icon className="h-4 w-4" /></span>}
      </div>
      <div className="mt-2 text-[26px] font-bold leading-none text-[#142D4E]">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-slate-400">{sub}</div>}
    </button>
  )
}

// ---- Panel / Card ----
export function Panel({ title, subtitle, action, children, className, noPad }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h3 className="text-[15px] font-bold text-[#142D4E]">{title}</h3>}
            {subtitle && <p className="text-[12px] text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPad ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

// ---- Data table ----
export function DataTable({ columns, rows, onRow, empty = 'No records' }) {
  if (!rows || rows.length === 0) return <div className="py-10 text-center text-sm text-slate-400">{empty}</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            {columns.map((c, i) => <th key={i} className={cn('px-3 py-2.5 font-semibold', c.right && 'text-right')}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} onClick={() => onRow && onRow(row)} className={cn('border-b border-slate-50 text-slate-700', onRow && 'cursor-pointer hover:bg-slate-50')}>
              {columns.map((c, ci) => (
                <td key={ci} className={cn('px-3 py-3', c.right && 'text-right')}>
                  {c.cell ? c.cell(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- Progress fill ----
export function Fill({ pct, color = '#007F78', className }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  )
}

// ---- Vertical timeline ----
export function Timeline({ steps }) {
  return (
    <ol className="relative ml-1">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2 text-white',
              s.done ? 'border-[#007F78] bg-[#007F78]' : 'border-slate-300 bg-white')}>
              {s.done && <Check className="h-3 w-3" />}
            </span>
            {i < steps.length - 1 && <span className={cn('mt-1 w-0.5 flex-1', s.done ? 'bg-[#007F78]' : 'bg-slate-200')} />}
          </div>
          <div className="pb-1">
            <div className={cn('text-[13px] font-medium', s.done ? 'text-[#142D4E]' : 'text-slate-400')}>{s.step ? s.step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : s.label}</div>
            {s.at && s.done && <div className="text-[11px] text-slate-400">Done</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---- Cost breakdown ----
export function CostBreakdown({ cost, quantityKg }) {
  if (!cost) return null
  const rows = [
    ['Material', cost.material], ['Supplier → hub logistics', cost.in_hub],
    ['Warehouse handling', cost.handling], ['Inspection', cost.inspection],
    ['Hub → buyer logistics', cost.to_buyer], ['Platform fee', cost.platform_fee], ['GST', cost.gst],
  ]
  return (
    <div className="text-[13px]">
      {rows.map(([l, v], i) => (
        <div key={i} className="flex items-center justify-between border-b border-slate-50 py-2">
          <span className="text-slate-500">{l}</span>
          <span className="font-medium text-slate-700">{inr(v)}/kg</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between rounded-lg bg-[#142D4E] px-3 py-2.5 text-white">
        <span className="font-semibold">Landed cost</span>
        <span className="text-[15px] font-bold">{inr(cost.total)}/kg</span>
      </div>
      {quantityKg && (
        <div className="mt-2 flex items-center justify-between text-slate-500">
          <span>Total for {quantityKg.toLocaleString('en-IN')} kg</span>
          <span className="font-bold text-[#142D4E]">{inr(cost.total * quantityKg)}</span>
        </div>
      )}
    </div>
  )
}

// ---- App shell (sidebar + topbar) ----
export function Sidebar({ items, active, onNav, dark = true, footer }) {
  return (
    <aside className={cn('flex w-60 flex-shrink-0 flex-col border-r', dark ? 'border-white/5 bg-[#142D4E]' : 'border-slate-200 bg-white')}>
      <div className={cn('px-4 py-4', dark ? 'border-b border-white/5' : 'border-b border-slate-100')}>
        <Logo dark={dark} sub={null} />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {items.map((it) => {
          const Icon = it.icon
          const on = active === it.key
          return (
            <button key={it.key} onClick={() => onNav(it.key)}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition',
                dark
                  ? on ? 'bg-[#007F78] text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  : on ? 'bg-[#007F78]/10 text-[#007F78]' : 'text-slate-600 hover:bg-slate-50')}>
              {Icon && <Icon className="h-[17px] w-[17px]" />}
              <span>{it.label}</span>
              {it.badge != null && <span className="ml-auto rounded-full bg-[#F59E0B] px-1.5 text-[10px] font-bold text-white">{it.badge}</span>}
            </button>
          )
        })}
      </nav>
      {footer && <div className={cn('px-4 py-3 text-[11px]', dark ? 'border-t border-white/5 text-white/50' : 'border-t border-slate-100 text-slate-400')}>{footer}</div>}
    </aside>
  )
}

export function TopBar({ title, subtitle, user, onLogout, right, roleSwitcher, onSearch, onNavigate }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-[20px] font-bold text-[#142D4E]">{title}</h1>
        {subtitle && <p className="truncate text-[12.5px] text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
          <Search className="h-4 w-4 text-slate-400" />
          <input onChange={(e) => onSearch && onSearch(e.target.value)} placeholder="Search orders, pools, lots..." className="w-52 bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
        </div>
        {right}
        <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F59E0B]" />
        </button>
        <div className="relative">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg border border-slate-200 py-1 pl-1 pr-2 hover:bg-slate-50">
            {user?.picture
              ? <img src={user.picture} alt="" className="h-7 w-7 rounded-md object-cover" />
              : <span className="grid h-7 w-7 place-items-center rounded-md bg-[#142D4E] text-[11px] font-bold text-white">{(user?.name || 'U').slice(0, 2).toUpperCase()}</span>}
            <span className="hidden text-[13px] font-medium text-slate-700 sm:block">{user?.name?.split(' ')[0] || 'User'}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {open && (
            <div className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <div className="text-[13px] font-semibold text-slate-700">{user?.name}</div>
                <div className="truncate text-[11px] text-slate-400">{user?.email}</div>
              </div>
              {onNavigate && (
                <div className="border-b border-slate-100 py-1">
                  <button onClick={() => { setOpen(false); onNavigate('profile') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50"><User className="h-4 w-4" /> My profile</button>
                  <button onClick={() => { setOpen(false); onNavigate('settings') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50"><SettingsIcon className="h-4 w-4" /> Settings</button>
                </div>
              )}
              {roleSwitcher}
              <button onClick={onLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


// ---------------------------------------------------------------------------
// Stable form primitives (defined at module scope so they never remount and
// never lose focus while typing).
// ---------------------------------------------------------------------------
export function TextField({ label, value, onChange, type = 'text', hint, required, className, ...rest }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 flex items-center gap-1 text-[12.5px] font-medium text-slate-600">{label}{required && <span className="text-[#F59E0B]">*</span>}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-[#007F78] focus:ring-2 focus:ring-[#007F78]/15"
        {...rest}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

export function SelectField({ label, value, onChange, options = [], required, className }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 flex items-center gap-1 text-[12.5px] font-medium text-slate-600">{label}{required && <span className="text-[#F59E0B]">*</span>}</span>}
      <div className="relative">
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-[13px] text-slate-800 outline-none transition focus:border-[#007F78] focus:ring-2 focus:ring-[#007F78]/15">
          {options.map((o) => { const val = typeof o === 'string' ? o : o.value; const lab = typeof o === 'string' ? o : o.label; return <option key={val} value={val}>{lab}</option> })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  )
}

export function TextAreaField({ label, value, onChange, maxLength, rows = 3, required, hint, className, ...rest }) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="mb-1 flex items-center gap-1 text-[12.5px] font-medium text-slate-600">{label}{required && <span className="text-[#F59E0B]">*</span>}</span>}
      <div className="relative">
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} maxLength={maxLength}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-[#007F78] focus:ring-2 focus:ring-[#007F78]/15" {...rest} />
        {maxLength && <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-300">{(value || '').length}/{maxLength}</span>}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}

export function Chip({ children, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition',
        active ? 'border-[#007F78] bg-[#007F78]/8 text-[#007F78]' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition', checked ? 'bg-[#007F78]' : 'bg-slate-300')}>
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

// ---- Live countdown timer (MM:SS or HH:MM:SS from a total second count) ----
export function Countdown({ endsAt, onExpire, className, compact }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((endsAt - Date.now()) / 1000)))
  const firedRef = useRef(false)
  useEffect(() => {
    firedRef.current = false
    setLeft(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)))
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setLeft(s)
      if (s <= 0 && !firedRef.current) { firedRef.current = true; onExpire && onExpire(); clearInterval(t) }
    }, 1000)
    return () => clearInterval(t)
  }, [endsAt, onExpire])
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60
  const pad = (n) => String(n).padStart(2, '0')
  const label = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  const urgent = left <= 60
  if (compact) return <span className={cn('font-mono font-bold tabular-nums', urgent ? 'text-red-500' : '', className)}>{left <= 0 ? 'Closed' : label}</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono tabular-nums', urgent && left > 0 && 'animate-pulse text-red-400', className)}>
      <Clock className="h-4 w-4" />{left <= 0 ? 'Closed' : label}
    </span>
  )
}

// ---- Section heading ----
export function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon && <span className="mt-0.5 grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#007F78]/10 text-[#007F78]"><Icon className="h-5 w-5" /></span>}
      <div>
        <div className="text-[17px] font-bold text-[#142D4E]">{title}</div>
        {subtitle && <div className="text-[13px] text-slate-400">{subtitle}</div>}
      </div>
    </div>
  )
}
