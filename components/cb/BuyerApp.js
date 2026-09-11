'use client'

import { useEffect, useState } from 'react'
import { api, inr, inrShort, prettyState } from '@/lib/cb/api'
import { Sidebar, TopBar, KpiCard, Panel, DataTable, StatusBadge, Fill, Timeline, CostBreakdown } from '@/components/cb/shared'
import {
  LayoutDashboard, FileText, Users, ReceiptText, Package, Truck, Boxes, CreditCard,
  Files, AlertTriangle, Building2, Bell, LifeBuoy, Settings, Plus, ArrowRight, ArrowLeft, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'demands', label: 'My Demands', icon: FileText },
  { key: 'pools', label: 'Demand Pools', icon: Users },
  { key: 'quotes', label: 'Quotes', icon: ReceiptText },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'shipments', label: 'Shipments', icon: Truck },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { key: 'suppliers', label: 'Suppliers', icon: Building2 },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'support', label: 'Support', icon: LifeBuoy },
  { key: 'settings', label: 'Company Settings', icon: Settings },
]

export default function BuyerApp({ user, onLogout, roleSwitcher }) {
  const [view, setView] = useState('overview')
  const [sel, setSel] = useState(null) // {type, id}

  const go = (v) => { setSel(null); setView(v) }

  return (
    <div className="flex h-screen bg-[#E6EDF3]/40">
      <Sidebar items={NAV} active={view} onNav={go} dark={false} footer="Indian MSMEs · Stronger together" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Your procurement" subtitle="Track your demands, pools and orders in one place." user={user} onLogout={onLogout} roleSwitcher={roleSwitcher}
          right={<button onClick={() => go('new')} className="flex items-center gap-1.5 rounded-lg bg-[#007F78] px-3.5 py-2 text-[13px] font-semibold text-white hover:brightness-110"><Plus className="h-4 w-4" /> New demand</button>} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <Overview go={go} openOrder={(id) => { setSel({ type: 'order', id }); setView('orderDetail') }} />}
          {view === 'new' && <NewDemand onDone={() => go('demands')} />}
          {view === 'demands' && <Demands go={go} />}
          {view === 'pools' && <Pools open={(id) => { setSel({ type: 'pool', id }); setView('poolDetail') }} />}
          {view === 'poolDetail' && <PoolDetail id={sel?.id} back={() => go('pools')} openQuotes={(id) => { setSel({ type: 'pool', id }); setView('quotes') }} />}
          {view === 'quotes' && <Quotes poolId={sel?.id} />}
          {view === 'orders' && <Orders open={(id) => { setSel({ type: 'order', id }); setView('orderDetail') }} />}
          {view === 'orderDetail' && <OrderDetail id={sel?.id} back={() => go('orders')} />}
          {view === 'shipments' && <Shipments />}
          {view === 'inventory' && <BuyerInventory />}
          {view === 'payments' && <SimpleList collection="/orders" title="Payments" cols={[['order_no', 'Order'], ['supplier', 'Supplier'], ['payment_status', 'Payment', true]]} />}
          {view === 'documents' && <Documents />}
          {view === 'disputes' && <SimpleList collection="/disputes" title="Disputes" cols={[['case_no', 'Case'], ['order_no', 'Order'], ['title', 'Issue'], ['status', 'Status', true]]} />}
          {view === 'suppliers' && <SimpleList collection="/sellers" title="Suppliers" cols={[['name', 'Company'], ['rating', 'Rating'], ['on_time', 'On-time %'], ['qc_pass', 'QC pass %']]} />}
          {view === 'notifications' && <Notifications role="BUYER" />}
          {(view === 'support' || view === 'settings') && <Stub title={NAV.find(n => n.key === view)?.label} />}
        </main>
      </div>
    </div>
  )
}

function Overview({ go, openOrder }) {
  const [demands, setDemands] = useState([])
  const [pools, setPools] = useState([])
  useEffect(() => {
    api('/demands').then(setDemands).catch(() => {})
    api('/pools').then(setPools).catch(() => {})
  }, [])
  const pool = pools[0]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Open requirements" value={demands.filter(d => ['Draft', 'Submitted', 'Matching'].includes(d.status)).length} icon={FileText} />
        <KpiCard label="Active pools" value={pools.filter(p => p.status === 'Pooling' || p.status === 'Supplier bidding').length} icon={Users} accent="#142D4E" onClick={() => go('pools')} />
        <KpiCard label="Quotes received" value={demands.reduce((a, d) => a + (d.quotes || 0), 0)} icon={ReceiptText} accent="#F59E0B" onClick={() => go('quotes')} />
        <KpiCard label="Orders in progress" value={demands.filter(d => ['Order confirmed', 'In transit', 'At warehouse'].includes(d.status)).length} icon={Package} onClick={() => go('orders')} />
        <KpiCard label="Goods ready" value={1} sub="for pickup" icon={Truck} accent="#142D4E" />
        <KpiCard label="Monthly spend" value={inrShort(4350000)} icon={CreditCard} accent="#F59E0B" />
        <KpiCard label="Est. savings" value={inrShort(612000)} sub="through pooling" icon={CheckCircle2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Recent demands" action={<button onClick={() => go('demands')} className="text-[13px] font-semibold text-[#007F78]">View all</button>} noPad>
          <DataTable
            columns={[
              { header: 'Material', key: 'material', cell: r => <span className="font-medium text-[#142D4E]">{r.material} {r.grade}</span> },
              { header: 'Qty', cell: r => `${r.quantity} ${r.unit}` },
              { header: 'Required', key: 'required_date' },
              { header: 'Pool', key: 'pool_no' },
              { header: 'Quotes', cell: r => r.quotes || 0 },
              { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
            ]}
            rows={demands.slice(0, 6)}
          />
        </Panel>

        {pool && (
          <Panel title="Active pool">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[15px] font-bold text-[#142D4E]">{pool.material} {pool.grade}</div>
                <div className="text-[12px] text-slate-400">{pool.cluster}</div>
              </div>
              <StatusBadge status={pool.status} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-[13px] text-slate-500">Pool total</span>
              <span className="text-[15px] font-bold text-[#142D4E]">{pool.pooled_qty} / {pool.target_qty} t</span>
            </div>
            <Fill pct={pool.fill_pct} className="mt-2" />
            <div className="mt-1 text-right text-[12px] font-semibold text-[#007F78]">{pool.fill_pct}% filled</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div><div className="text-slate-400">Your quantity</div><div className="font-semibold text-[#142D4E]">{pool.your_qty} t</div></div>
              <div><div className="text-slate-400">Participants</div><div className="font-semibold text-[#142D4E]">{pool.participants} MSMEs</div></div>
              <div><div className="text-slate-400">Projected cost</div><div className="font-semibold text-[#142D4E]">{inr(pool.est_pooled)}/kg</div></div>
              <div><div className="text-slate-400">Pooled savings</div><div className="font-semibold text-[#007F78]">{inr(pool.est_individual - pool.est_pooled)}/kg</div></div>
            </div>
            <button onClick={() => go('pools')} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#142D4E] py-2.5 text-[13px] font-semibold text-white">View pool <ArrowRight className="h-4 w-4" /></button>
          </Panel>
        )}
      </div>
    </div>
  )
}

const STEPS = ['Material', 'Requirement', 'Specification', 'Delivery', 'Commercial', 'Review']
function NewDemand({ onDone }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ material: 'PP Grade X', grade: 'X', quantity: 5, unit: 'tonnes', required_date: '2025-09-30', cluster: 'Peenya, Bengaluru', delivery_pref: 'Pickup at hub', target_price: 80 })
  const [done, setDone] = useState(null)
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))
  const submit = async () => {
    try { const d = await api('/demands', { method: 'POST', body: JSON.stringify(f) }); setDone(d); toast.success(`Demand ${d.demand_no} submitted`) } catch (e) { toast.error(e.message) }
  }
  if (done) return (
    <div className="mx-auto max-w-xl">
      <Panel>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
          <div className="mt-3 text-[13px] uppercase tracking-wide text-slate-400">Demand submitted</div>
          <div className="text-[26px] font-bold text-[#142D4E]">{done.demand_no}</div>
          <StatusBadge status="Matching" className="mt-2" />
          <p className="mt-3 max-w-sm text-[13px] text-slate-500">We&apos;re matching your requirement with similar demand from nearby MSMEs to build a pool.</p>
          <button onClick={onDone} className="mt-5 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Go to my demands</button>
        </div>
      </Panel>
    </div>
  )
  const Input = ({ label, k, type = 'text', ...p }) => (
    <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">{label}</span>
      <input type={type} value={f[k] ?? ''} onChange={e => set(k, type === 'number' ? Number(e.target.value) : e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#007F78]" {...p} /></label>
  )
  return (
    <div className="mx-auto max-w-2xl">
      <Panel title="Submit your material demand" subtitle="Share your requirement and we&apos;ll pool it with other buyers.">
        <div className="mb-5 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 items-center gap-1.5">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${i <= step ? 'bg-[#007F78] text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
              {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 ${i < step ? 'bg-[#007F78]' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>
        <div className="mb-1 text-[15px] font-bold text-[#142D4E]">{STEPS[step]}</div>
        <div className="grid grid-cols-2 gap-4 py-3">
          {step === 0 && <><Input label="Material" k="material" /><Input label="Grade" k="grade" /><Input label="Brand preference" k="brand" /><Input label="Application / use case" k="application" /></>}
          {step === 1 && <><Input label="Quantity" k="quantity" type="number" /><Input label="Unit" k="unit" /><Input label="Minimum acceptable qty" k="min_qty" type="number" /><Input label="Required-by date" k="required_date" type="date" /></>}
          {step === 2 && <><Input label="Specification" k="spec" /><Input label="Tolerance" k="tolerance" /><Input label="Certification required" k="cert" /><Input label="Packaging requirement" k="packaging" /></>}
          {step === 3 && <><Input label="Cluster" k="cluster" /><Input label="Delivery address" k="address" /><Input label="Pincode" k="pincode" />
            <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">Delivery preference</span>
              <select value={f.delivery_pref} onChange={e => set('delivery_pref', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#007F78]">
                <option>Pickup at hub</option><option>Deliver to factory</option><option>Direct supplier delivery</option></select></label></>}
          {step === 4 && <><Input label="Target price (/kg)" k="target_price" type="number" /><Input label="Max landed cost (/kg)" k="max_cost" type="number" /><Input label="Payment terms" k="payment_terms" /><Input label="GST requirements" k="gst" /></>}
          {step === 5 && (
            <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px]">
              {[['Material', `${f.material} ${f.grade}`], ['Quantity', `${f.quantity} ${f.unit}`], ['Required by', f.required_date], ['Cluster', f.cluster], ['Delivery', f.delivery_pref], ['Target price', inr(f.target_price) + '/kg']].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-slate-100 py-1.5 last:border-0"><span className="text-slate-500">{l}</span><span className="font-medium text-[#142D4E]">{v}</span></div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-between">
          <button disabled={step === 0} onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Back</button>
          {step < STEPS.length - 1
            ? <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1.5 rounded-lg bg-[#142D4E] px-5 py-2 text-[13px] font-semibold text-white">Next <ArrowRight className="h-4 w-4" /></button>
            : <button onClick={submit} className="rounded-lg bg-[#007F78] px-6 py-2 text-[13px] font-semibold text-white">Submit demand</button>}
        </div>
      </Panel>
    </div>
  )
}

function Demands({ go }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/demands').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="My demands" action={<button onClick={() => go('new')} className="flex items-center gap-1.5 rounded-lg bg-[#007F78] px-3 py-1.5 text-[12px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> New</button>} noPad>
      <DataTable rows={rows} columns={[
        { header: 'Demand', cell: r => <span className="font-semibold text-[#142D4E]">{r.demand_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` },
        { header: 'Qty', cell: r => `${r.quantity} ${r.unit}` },
        { header: 'Required', key: 'required_date' },
        { header: 'Pool', key: 'pool_no' },
        { header: 'Quotes', cell: r => r.quotes || 0 },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function Pools({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/pools').then(setRows).catch(() => {}) }, [])
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map(p => (
        <Panel key={p.id}>
          <div className="flex items-start justify-between">
            <div><div className="text-[16px] font-bold text-[#142D4E]">{p.material} {p.grade}</div>
              <div className="text-[12px] text-slate-400">{p.pool_no} · {p.cluster}</div></div>
            <StatusBadge status={p.status} />
          </div>
          <div className="mt-3 flex items-end justify-between text-[13px]"><span className="text-slate-500">{p.pooled_qty} / {p.target_qty} tonnes</span><span className="font-bold text-[#007F78]">{p.fill_pct}%</span></div>
          <Fill pct={p.fill_pct} className="mt-1.5" />
          <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500"><span>{p.participants} participating MSMEs</span><span>Closes {p.closing_date}</span></div>
          <button onClick={() => open(p.id)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#142D4E] py-2 text-[13px] font-semibold text-white">View pool <ArrowRight className="h-4 w-4" /></button>
        </Panel>
      ))}
    </div>
  )
}

function PoolDetail({ id, back, openQuotes }) {
  const [p, setP] = useState(null)
  useEffect(() => { if (id) api(`/pools/${id}`).then(setP).catch(() => {}) }, [id])
  if (!p) return <Stub title="Loading pool..." />
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to pools</button>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div><div className="text-[22px] font-bold text-[#142D4E]">{p.material} {p.grade}</div>
              <div className="text-[13px] text-slate-400">{p.target_qty} tonne pool · {p.cluster} · {p.pool_no}</div></div>
            <StatusBadge status={p.status} />
          </div>
          <div className="mt-5 flex items-end justify-between"><span className="text-[14px] text-slate-500">Total pooled</span><span className="text-[18px] font-bold text-[#142D4E]">{p.pooled_qty} / {p.target_qty} t</span></div>
          <Fill pct={p.fill_pct} className="mt-2 h-3" />
          <div className="mt-1.5 text-right text-[13px] font-semibold text-[#007F78]">{p.fill_pct}% filled</div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[['Your quantity', `${p.your_qty} t`], ['Participants', `${p.participants} MSMEs`], ['Closing', p.closing_date], ['Auction', p.auction_date]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-[11px] text-slate-400">{l}</div><div className="text-[14px] font-semibold text-[#142D4E]">{v}</div></div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[11px] text-slate-500">Individual buying</div><div className="text-[16px] font-bold text-slate-500 line-through">{inr(p.est_individual)}/kg</div></div>
              <div><div className="text-[11px] text-slate-500">Pooled landed cost</div><div className="text-[16px] font-bold text-[#142D4E]">{inr(p.est_pooled)}/kg</div></div>
              <div><div className="text-[11px] text-slate-500">Your savings</div><div className="text-[16px] font-bold text-[#007F78]">{inr(p.est_individual - p.est_pooled)}/kg</div></div>
            </div>
          </div>
          <button onClick={() => openQuotes(p.id)} className="mt-4 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Compare supplier quotes</button>
        </Panel>
        <Panel title="Pool progress"><Timeline steps={p.timeline || []} /></Panel>
      </div>
    </div>
  )
}

function Quotes({ poolId }) {
  const [rows, setRows] = useState([])
  const [pool, setPool] = useState(null)
  useEffect(() => {
    api('/pools').then(ps => { const p = poolId ? ps.find(x => x.id === poolId) : ps[0]; setPool(p); if (p) api(`/quotes/${p.id}`).then(setRows).catch(() => {}) }).catch(() => {})
  }, [poolId])
  const best = rows.length ? Math.min(...rows.map(r => r.landed_cost)) : 0
  const fastest = rows.length ? Math.min(...rows.map(r => r.lead_time)) : 0
  return (
    <Panel title={`Quote comparison ${pool ? '— ' + pool.material + ' ' + pool.grade : ''}`} noPad>
      <DataTable rows={rows} columns={[
        { header: 'Supplier', cell: r => <div className="font-semibold text-[#142D4E]">{r.supplier}{r.landed_cost === best && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Recommended</span>}</div> },
        { header: 'Material', cell: r => inr(r.material_price), right: true },
        { header: 'Freight', cell: r => inr(r.freight), right: true },
        { header: 'Handling', cell: r => inr(r.handling), right: true },
        { header: 'Fee', cell: r => inr(r.platform_fee), right: true },
        { header: 'Landed cost', cell: r => <span className={`font-bold ${r.landed_cost === best ? 'text-[#007F78]' : 'text-[#142D4E]'}`}>{inr(r.landed_cost)}/kg</span>, right: true },
        { header: 'Lead time', cell: r => <span className={r.lead_time === fastest ? 'font-semibold text-[#007F78]' : ''}>{r.lead_time}d</span> },
        { header: 'MOQ', cell: r => `${r.moq}t` },
        { header: 'Terms', key: 'payment_terms' },
        { header: 'Rating', cell: r => `★ ${r.rating}` },
        { header: '', cell: r => <button onClick={() => toast.success(`Selected ${r.supplier}`)} className="rounded-lg bg-[#142D4E] px-3 py-1.5 text-[12px] font-semibold text-white">Select</button>, right: true },
      ]} />
    </Panel>
  )
}

function Orders({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/orders').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Orders" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Order', cell: r => <span className="font-semibold text-[#142D4E]">{r.order_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` },
        { header: 'Qty', cell: r => `${r.quantity} t` },
        { header: 'Supplier', key: 'supplier' },
        { header: 'Warehouse', key: 'warehouse' },
        { header: 'Payment', cell: r => <StatusBadge status={r.payment_status} /> },
        { header: 'Status', cell: r => <StatusBadge status={r.state} /> },
      ]} />
    </Panel>
  )
}

function OrderDetail({ id, back }) {
  const [o, setO] = useState(null)
  const load = () => api(`/orders/${id}`).then(setO).catch(() => {})
  useEffect(() => { if (id) load() }, [id])
  if (!o) return <Stub title="Loading order..." />
  const canConfirm = ['DELIVERED'].includes(o.state)
  const confirmDelivery = async () => {
    try { await api(`/orders/${o.id}/advance`, { method: 'POST', body: JSON.stringify({ target: 'ACCEPTED' }) }); toast.success('Delivery confirmed — supplier settlement now eligible'); load() } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to orders</button>
      <div className="flex items-center justify-between">
        <div><div className="text-[22px] font-bold text-[#142D4E]">Order {o.order_no}</div>
          <div className="text-[13px] text-slate-400">{o.material} {o.grade} · {o.quantity} tonnes · {o.supplier}</div></div>
        <StatusBadge status={o.state} />
      </div>
      {canConfirm && (
        <div className="flex items-center justify-between rounded-xl border border-[#007F78]/30 bg-[#007F78]/5 px-5 py-4">
          <div><div className="text-[11px] font-bold uppercase tracking-wide text-[#007F78]">Next action</div><div className="text-[15px] font-semibold text-[#142D4E]">Confirm delivery received</div></div>
          <button onClick={confirmDelivery} className="rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Confirm delivery</button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Order timeline" className="lg:col-span-1"><Timeline steps={(o.timeline || []).slice(-8)} /></Panel>
        <Panel title="Landed cost breakdown" className="lg:col-span-1"><CostBreakdown cost={o.cost} quantityKg={o.quantity * 1000} /></Panel>
        <div className="space-y-4">
          <Panel title="Order info">
            <div className="space-y-2 text-[13px]">
              {[['Supplier', o.supplier], ['Warehouse', o.warehouse], ['Payment', null], ['QC', o.lot?.status || '—']].map(([l, v]) => (
                <div key={l} className="flex justify-between"><span className="text-slate-400">{l}</span>{v ? <span className="font-medium text-[#142D4E]">{v}</span> : <StatusBadge status={o.payment_status} />}</div>
              ))}
            </div>
          </Panel>
          <Panel title="Documents" noPad>
            <div className="divide-y divide-slate-50">
              {(o.documents || []).map((d, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 text-[13px]"><span className="text-slate-600">{d.type}</span><StatusBadge status={d.status} /></div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Shipments() {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/shipments?direction=outbound').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Shipments to you" noPad>
      <DataTable rows={rows} columns={[
        { header: 'Shipment', cell: r => <span className="font-semibold text-[#142D4E]">{r.shipment_no}</span> },
        { header: 'Order', key: 'order_no' }, { header: 'Material', key: 'material' },
        { header: 'Qty', cell: r => `${r.quantity} t` }, { header: 'Vehicle', key: 'vehicle' },
        { header: 'ETA', key: 'eta' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function BuyerInventory() {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/inventory').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Your allocated inventory" noPad>
      <DataTable rows={rows.filter(r => r.buyer_allocation)} columns={[
        { header: 'Lot', cell: r => <span className="font-semibold text-[#142D4E]">{r.lot_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` }, { header: 'Qty', cell: r => `${r.allocated_qty} t` },
        { header: 'Warehouse', key: 'warehouse' }, { header: 'Zone', key: 'zone' },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function Documents() {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/orders').then(os => setRows(os.flatMap(o => (o.documents || []).map(d => ({ ...d, order_no: o.order_no }))))).catch(() => {}) }, [])
  return (
    <Panel title="Documents" noPad>
      <DataTable rows={rows} columns={[
        { header: 'Document', key: 'type' }, { header: 'Order', key: 'order_no' },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', cell: () => <button className="text-[12px] font-semibold text-[#007F78]">Download</button>, right: true },
      ]} />
    </Panel>
  )
}

export function Notifications({ role }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api(`/notifications?role=${role}`).then(setRows).catch(() => {}) }, [role])
  return (
    <Panel title="Notifications" noPad>
      <div className="divide-y divide-slate-50">
        {rows.map(n => (
          <div key={n.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#F59E0B]" />
            <div className="flex-1"><div className="text-[13.5px] text-slate-700">{n.title}</div>{n.order && <div className="text-[11px] text-slate-400">{n.order}</div>}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No notifications</div>}
      </div>
    </Panel>
  )
}

export function SimpleList({ collection, title, cols }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api(collection).then(setRows).catch(() => {}) }, [collection])
  return (
    <Panel title={title} noPad>
      <DataTable rows={rows} columns={cols.map(([key, header, badge]) => ({ header, cell: badge ? (r => <StatusBadge status={r[key]} />) : (r => r[key]) }))} />
    </Panel>
  )
}

export function Stub({ title }) {
  return <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-white text-center">
    <div><div className="text-[15px] font-semibold text-[#142D4E]">{title}</div><div className="mt-1 text-[13px] text-slate-400">Module available in the connected demo.</div></div>
  </div>
}
