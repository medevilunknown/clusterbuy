'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { api, inr } from '@/lib/cb/api'
import { Sidebar, TopBar, KpiCard, Panel, DataTable, StatusBadge, Fill } from '@/components/cb/shared'
import { CompanySettings, ProfilePage } from '@/components/cb/settings'
import { SimpleList, Stub } from '@/components/cb/BuyerApp'
import {
  LayoutDashboard, Truck, ClipboardCheck, Warehouse, Boxes, ShieldCheck, Split, Layers,
  TruckIcon, MapPin, Undo2, AlertTriangle, Files, BarChart3, ArrowLeft, ArrowRight, CheckCircle2, XCircle, PackageCheck,
} from 'lucide-react'
import { toast } from 'sonner'

const LiveMap = dynamic(() => import('@/components/cb/LiveMap'), { ssr: false, loading: () => <div className="grid h-full min-h-[220px] place-items-center rounded-xl bg-slate-50 text-[12px] text-slate-400">Loading map…</div> })

const NAV = [
  { key: 'overview', label: 'Operations Overview', icon: LayoutDashboard },
  { key: 'inbound', label: 'Inbound Shipments', icon: Truck },
  { key: 'receiving', label: 'Receiving', icon: ClipboardCheck },
  { key: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'quality', label: 'Quality', icon: ShieldCheck },
  { key: 'allocation', label: 'Allocation', icon: Split },
  { key: 'consolidation', label: 'Consolidation', icon: Layers },
  { key: 'outbound', label: 'Outbound Shipments', icon: TruckIcon },
  { key: 'tracking', label: 'Delivery Tracking', icon: MapPin },
  { key: 'returns', label: 'Returns', icon: Undo2 },
  { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
]

export default function OpsApp({ user, onLogout, roleSwitcher }) {
  const [view, setView] = useState('overview')
  const [sel, setSel] = useState(null)
  const [wh, setWh] = useState('WH01')
  const go = (v) => { setSel(null); setView(v) }
  return (
    <div className="flex h-screen bg-[#E6EDF3]/40">
      <Sidebar items={NAV} active={view} onNav={go} dark footer="Peenya Hub · Operator" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Operations overview" subtitle="What is arriving, where does it go, has it passed QC, where is it delivered?" user={user} onLogout={onLogout} roleSwitcher={roleSwitcher} onNavigate={go}
          right={<select value={wh} onChange={e => setWh(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 outline-none"><option value="WH01">Peenya — WH01</option><option value="WH02">Bommasandra — WH02</option><option value="WH03">Bhiwandi — WH03</option></select>} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <Overview wh={wh} go={go} openInbound={(id) => { setSel(id); setView('inboundDetail') }} />}
          {view === 'inbound' && <Inbound open={(id) => { setSel(id); setView('inboundDetail') }} />}
          {view === 'inboundDetail' && <InboundDetail id={sel} back={() => go('inbound')} />}
          {view === 'receiving' && <Inbound open={(id) => { setSel(id); setView('inboundDetail') }} />}
          {view === 'warehouse' && <WarehouseMap wh={wh} />}
          {view === 'inventory' && <Inventory />}
          {view === 'quality' && <Quality open={(lotId) => { setSel(lotId); setView('qualityDetail') }} />}
          {view === 'qualityDetail' && <QualityDetail lotId={sel} back={() => go('quality')} />}
          {view === 'allocation' && <Allocation />}
          {view === 'consolidation' && <Consolidation />}
          {view === 'outbound' && <Outbound />}
          {view === 'tracking' && <Tracking />}
          {(view === 'returns' || view === 'documents' || view === 'reports') && <Stub title={NAV.find(n => n.key === view)?.label} />}
          {view === 'disputes' && <SimpleList collection="/disputes" title="Disputes" cols={[['case_no', 'Case'], ['order_no', 'Order'], ['title', 'Issue'], ['status', 'Status', true]]} />}
          {view === 'profile' && <ProfilePage user={user} roleLabel="Warehouse Operator" />}
          {view === 'settings' && <CompanySettings role="DEFAULT" companyName="Peenya Hub · Operations" cluster="Peenya, Bengaluru" />}
        </main>
      </div>
    </div>
  )
}

function Overview({ wh, go, openInbound }) {
  const [inv, setInv] = useState([]); const [orders, setOrders] = useState([]); const [ships, setShips] = useState([]); const [w, setW] = useState(null); const [tab, setTab] = useState('Inbound')
  useEffect(() => {
    api('/inventory').then(setInv).catch(() => {}); api('/orders').then(setOrders).catch(() => {})
    api('/shipments').then(setShips).catch(() => {}); api(`/warehouses/${wh}`).then(setW).catch(() => {})
  }, [wh])
  const whInv = inv.filter(l => l.warehouse === wh)
  const totalStock = whInv.reduce((a, l) => a + (l.received_qty || l.original_qty || 0), 0)
  const cap = w?.capacity || 40
  const zoneColor = (s) => ({ Allocated: 'bg-emerald-50 border-emerald-200 text-emerald-700', Available: 'bg-blue-50 border-blue-200 text-blue-700', 'Quality Hold': 'bg-red-50 border-red-200 text-red-700', Free: 'bg-slate-50 border-slate-200 text-slate-500', Reserved: 'bg-amber-50 border-amber-200 text-amber-700' }[s] || 'bg-slate-50')
  const inbound = ships.filter(s => s.direction === 'inbound')
  const outbound = ships.filter(s => s.direction === 'outbound')
  const holds = whInv.filter(l => l.status === 'Quality hold').length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Active buyers" value={10} icon={LayoutDashboard} />
        <KpiCard label="Active sellers" value={6} icon={Truck} accent="#142D4E" />
        <KpiCard label="Warehouse stock" value={`${totalStock} / ${cap} t`} sub={`${Math.round(totalStock / cap * 100)}% used`} icon={Boxes} accent="#F59E0B" />
        <KpiCard label="Shipments today" value={`${inbound.length} in · ${outbound.length} out`} icon={TruckIcon} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Warehouse inventory" action={<button onClick={() => go('inventory')} className="text-[13px] font-semibold text-[#007F78]">View all</button>} noPad>
          <DataTable rows={whInv.slice(0, 6)} onRow={() => go('inventory')} columns={[
            { header: 'Material & lot', cell: r => <div><span className="font-semibold text-[#142D4E]">{r.material}</span> · {r.lot_no}</div> },
            { header: 'Seller', key: 'supplier' }, { header: 'Buyer', cell: r => r.buyer_allocation || <span className="italic text-slate-400">Unassigned</span> },
            { header: 'Zone', key: 'zone' }, { header: 'Qty', cell: r => `${r.received_qty || r.original_qty} t` },
            { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
          ]} />
        </Panel>

        <Panel title={`Warehouse ${wh}`} subtitle={w?.city}>
          <div className="grid grid-cols-2 gap-2">
            {(w?.zones || []).map(z => (
              <div key={z.zone} className={`rounded-lg border p-3 text-center ${zoneColor(z.state)}`}>
                <div className="text-[15px] font-bold">{z.zone}</div><div className="text-[12px]">{z.used} t</div><div className="text-[10px] font-medium">{z.state}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-[#142D4E]">{(w?.capacity || 0) - (w?.used || 0)} t</div><div className="text-slate-400">Free</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-[#142D4E]">1/2</div><div className="text-slate-400">Bays busy</div></div>
            <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-red-600">{holds}</div><div className="text-slate-400">On hold</div></div>
          </div>
          {holds > 0 && <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600"><AlertTriangle className="h-4 w-4" /> Quarantine stock cannot be dispatched</div>}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Buyer &amp; seller orders" action={<button onClick={() => go('outbound')} className="text-[13px] font-semibold text-[#007F78]">View all</button>} noPad>
          <DataTable rows={orders.slice(0, 5)} columns={[
            { header: 'Order', cell: r => <span className="font-semibold text-[#142D4E]">{r.order_no}</span> },
            { header: 'Buyer', key: 'buyer' }, { header: 'Seller', key: 'supplier' }, { header: 'Qty', cell: r => `${r.quantity} t` },
            { header: 'Payment', cell: r => <StatusBadge status={r.payment_status} /> },
            { header: 'Status', cell: r => <StatusBadge status={r.state} /> },
          ]} />
        </Panel>
        <Panel title="Logistics" noPad>
          <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
            {['Inbound', 'Outbound'].map(t => <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-[13px] font-semibold ${tab === t ? 'border-b-2 border-[#007F78] text-[#007F78]' : 'text-slate-400'}`}>{t}</button>)}
          </div>
          <div className="divide-y divide-slate-50">
            {(tab === 'Inbound' ? inbound : outbound).slice(0, 4).map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><Truck className="h-4 w-4" /></span>
                  <div><div className="text-[13px] font-semibold text-[#142D4E]">{s.shipment_no} · {s.from} → {s.to}</div><div className="text-[11px] text-slate-400">{s.quantity} t · {s.vehicle}</div></div></div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 font-bold text-red-600"><AlertTriangle className="h-5 w-5" /> Needs attention</div>
        <div className="flex items-center gap-2 text-[13px]"><span className="grid h-6 w-6 place-items-center rounded-full bg-red-100 text-[11px] font-bold text-red-600">{holds}</span> quality hold</div>
        <div className="flex items-center gap-2 text-[13px]"><span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-600">2</span> overdue pickups</div>
        <div className="flex items-center gap-2 text-[13px]"><span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-600">1</span> delayed inbound</div>
        <button onClick={() => go('quality')} className="ml-auto text-[13px] font-semibold text-[#007F78]">View issues</button>
      </div>
    </div>
  )
}

function Inbound({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/shipments?direction=inbound').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Inbound shipments" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Shipment', cell: r => <span className="font-semibold text-[#142D4E]">{r.shipment_no}</span> },
        { header: 'Supplier', key: 'from' }, { header: 'To', key: 'to' }, { header: 'Material', key: 'material' },
        { header: 'Qty', cell: r => `${r.quantity} t` }, { header: 'Vehicle', key: 'vehicle' }, { header: 'ETA', key: 'eta' },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function InboundDetail({ id, back }) {
  const [s, setS] = useState(null); const [received, setReceived] = useState('')
  const load = () => api(`/shipments/${id}`).then(x => { setS(x); setReceived(String(x.quantity)) }).catch(() => {})
  useEffect(() => { if (id) load() }, [id])
  if (!s) return <Stub title="Loading shipment..." />
  const done = s.status === 'Delivered'
  const receive = async () => {
    try { await api(`/inbound/${s.id}/receive`, { method: 'POST', body: JSON.stringify({ received_qty: Number(received) }) }); toast.success('Goods received — QC inspection task created'); load() } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to inbound</button>
      <div className="flex items-center justify-between">
        <div><div className="text-[22px] font-bold text-[#142D4E]">Shipment {s.shipment_no}</div><div className="text-[13px] text-slate-400">{s.from} · {s.vehicle} · ETA {s.eta}</div></div>
        <StatusBadge status={s.status} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Receiving details">
          <div className="grid grid-cols-2 gap-4">
            {[['Gross weight (t)', s.quantity + 0.5], ['Tare weight (t)', 0.5], ['Expected (t)', s.quantity]].map(([l, v]) => (
              <label key={l} className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">{l}</span><input defaultValue={v} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none" readOnly /></label>
            ))}
            <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">Net received (t)</span><input value={received} onChange={e => setReceived(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-bold outline-none focus:border-[#007F78]" /></label>
          </div>
          {!done
            ? <button onClick={receive} className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white"><PackageCheck className="h-4 w-4" /> Mark received &amp; create QC task</button>
            : <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Received. QC inspection task created for this lot.</div>}
        </Panel>
        <Panel title="Discrepancy check">
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-slate-400">Expected</span><span className="font-medium">{s.quantity} t</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Received</span><span className="font-medium">{received} t</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-400">Discrepancy</span><span className={`font-bold ${Number(received) < s.quantity ? 'text-red-600' : 'text-emerald-600'}`}>{(Number(received) - s.quantity).toFixed(1)} t</span></div>
          </div>
          <div className="mt-4 grid h-24 place-items-center rounded-lg border border-dashed border-slate-300 text-[12px] text-slate-400">Upload unloading photos</div>
        </Panel>
      </div>
    </div>
  )
}

function WarehouseMap({ wh }) {
  const [w, setW] = useState(null); const [zone, setZone] = useState(null); const [inv, setInv] = useState([])
  useEffect(() => { api(`/warehouses/${wh}`).then(setW).catch(() => {}); api('/inventory').then(setInv).catch(() => {}) }, [wh])
  const zoneColor = (s) => ({ Allocated: 'bg-emerald-50 border-emerald-300', Available: 'bg-blue-50 border-blue-300', 'Quality Hold': 'bg-red-50 border-red-300', Free: 'bg-white border-slate-200', Reserved: 'bg-amber-50 border-amber-300' }[s] || 'bg-white')
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel className="lg:col-span-2" title={`Warehouse ${wh} zone layout`}>
        <div className="grid grid-cols-3 gap-3">
          {(w?.zones || []).map(z => (
            <button key={z.zone} onClick={() => setZone(z)} className={`rounded-xl border-2 p-5 text-center transition hover:shadow ${zoneColor(z.state)} ${zone?.zone === z.zone ? 'ring-2 ring-[#007F78]' : ''}`}>
              <div className="text-[18px] font-bold text-[#142D4E]">{z.zone}</div><div className="text-[14px] text-slate-600">{z.used} t</div><div className="mt-1 text-[11px] font-semibold text-slate-500">{z.state}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-[#142D4E]">{(w?.capacity || 0) - (w?.used || 0)} t</div><div className="text-slate-400">Free</div></div>
          <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-[#142D4E]">{w?.used || 0} t</div><div className="text-slate-400">Occupied</div></div>
          <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-amber-600">5 t</div><div className="text-slate-400">Reserved</div></div>
          <div className="rounded-lg bg-slate-50 p-2"><div className="font-bold text-red-600">5 t</div><div className="text-slate-400">Quarantine</div></div>
        </div>
      </Panel>
      <Panel title={zone ? `Zone ${zone.zone}` : 'Select a zone'}>
        {zone ? (
          <div className="space-y-2 text-[13px]">
            {[['Capacity', `${zone.capacity} t`], ['Used', `${zone.used} t`], ['State', zone.state]].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-400">{l}</span><span className="font-medium text-[#142D4E]">{v}</span></div>
            ))}
            <div className="pt-2 text-[12px] font-semibold text-slate-500">Lots in this zone</div>
            {inv.filter(l => l.zone === zone.zone).map(l => (
              <div key={l.id} className="rounded-lg border border-slate-100 p-2"><div className="font-semibold text-[#142D4E]">{l.lot_no} · {l.material}</div><div className="text-[11px] text-slate-400">{l.supplier} → {l.buyer_allocation || 'Unassigned'}</div></div>
            ))}
          </div>
        ) : <div className="py-10 text-center text-[13px] text-slate-400">Click a zone to view lots, supplier, buyer and inspection status.</div>}
      </Panel>
    </div>
  )
}

function Inventory() {
  const [rows, setRows] = useState([]); const [f, setF] = useState('All')
  useEffect(() => { api('/inventory').then(setRows).catch(() => {}) }, [])
  const filtered = f === 'All' ? rows : rows.filter(r => r.status === f)
  return (
    <Panel title="Warehouse inventory" action={
      <select value={f} onChange={e => setF(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] outline-none">
        {['All', 'Available', 'Allocated', 'QC pending', 'Quality hold', 'Dispatched'].map(s => <option key={s}>{s}</option>)}</select>} noPad>
      <DataTable rows={filtered} columns={[
        { header: 'Lot', cell: r => <span className="font-semibold text-[#142D4E]">{r.lot_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` }, { header: 'Seller', key: 'supplier' },
        { header: 'Recv', cell: r => `${r.received_qty} t` }, { header: 'Avail', cell: r => `${r.available_qty} t` },
        { header: 'Alloc', cell: r => `${r.allocated_qty} t` }, { header: 'Buyer', cell: r => r.buyer_allocation || '—' },
        { header: 'Zone', key: 'zone' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function Quality({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/inspections').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Quality inspections" noPad>
      <DataTable rows={rows} onRow={r => open(r.lot_id)} columns={[
        { header: 'Lot', cell: r => <span className="font-semibold text-[#142D4E]">{r.lot_no}</span> },
        { header: 'Order', key: 'order_no' }, { header: 'Material', key: 'material' }, { header: 'Supplier', key: 'supplier' },
        { header: 'Warehouse', key: 'warehouse' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', cell: r => <span className="text-[12px] font-semibold text-[#007F78]">{r.status === 'Pending' ? 'Inspect' : 'View'}</span>, right: true },
      ]} />
    </Panel>
  )
}

function QualityDetail({ lotId, back }) {
  const [insp, setInsp] = useState(null)
  const load = () => api('/inspections').then(rows => setInsp(rows.find(r => r.lot_id === lotId))).catch(() => {})
  useEffect(() => { if (lotId) load() }, [lotId])
  if (!insp) return <Stub title="Loading inspection..." />
  const decided = insp.decision != null
  const decide = async (decision) => {
    try { await api(`/quality/${lotId}/decision`, { method: 'POST', body: JSON.stringify({ decision }) })
      toast[decision === 'PASS' ? 'success' : 'error'](decision === 'PASS' ? 'QC passed — lot now available in inventory' : 'QC failed — lot quarantined, dispute created, settlement on hold'); load()
    } catch (e) { toast.error(e.message) }
  }
  const CHECK = ['Material grade', 'Weight', 'Packaging', 'Color', 'Moisture', 'Batch number', 'Certificate match', 'Contamination', 'Visual defects']
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to quality</button>
      <div className="flex items-center justify-between">
        <div><div className="text-[22px] font-bold text-[#142D4E]">Inspection — {insp.lot_no}</div><div className="text-[13px] text-slate-400">{insp.material} · {insp.supplier} · {insp.warehouse}</div></div>
        <StatusBadge status={insp.status} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Inspection checklist" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {CHECK.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px]">
                <span className={`grid h-5 w-5 place-items-center rounded ${decided && insp.decision === 'PASS' ? 'bg-[#007F78] text-white' : 'border border-slate-300'}`}>{decided && insp.decision === 'PASS' && <CheckCircle2 className="h-3.5 w-3.5" />}</span>
                <span className="text-slate-600">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid h-24 place-items-center rounded-lg border border-dashed border-slate-300 text-[12px] text-slate-400">Upload photos / COA / lab reports</div>
        </Panel>
        <Panel title="Decision">
          {decided ? (
            <div className={`rounded-lg p-4 text-center ${insp.decision === 'PASS' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <div className="text-[15px] font-bold">{insp.decision}</div><div className="mt-1 text-[12px]">{insp.decision === 'PASS' ? 'Lot released to inventory' : 'Lot quarantined & dispute created'}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <button onClick={() => decide('PASS')} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#007F78] py-2.5 text-[13px] font-semibold text-white"><CheckCircle2 className="h-4 w-4" /> Pass</button>
              <button onClick={() => decide('PARTIAL')} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2.5 text-[13px] font-semibold text-white">Partial pass</button>
              <button onClick={() => decide('FAIL')} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 py-2.5 text-[13px] font-semibold text-white"><XCircle className="h-4 w-4" /> Fail</button>
              <button onClick={() => decide('QUARANTINE')} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 text-[13px] font-semibold text-slate-600">Quarantine</button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Allocation() {
  const [rows, setRows] = useState([])
  const load = () => api('/inventory').then(setRows).catch(() => {})
  useEffect(() => { load() }, [])
  const allocate = async (lot) => {
    const order = await api(`/orders`).then(os => os.find(o => o.lot_id === lot.id)).catch(() => null)
    if (!order) return toast.error('No order linked')
    try { await api(`/orders/${order.id}/advance`, { method: 'POST', body: JSON.stringify({ target: 'ALLOCATED' }) }); toast.success(`Lot ${lot.lot_no} allocated — outbound shipment can now be created`); load() } catch (e) { toast.error(e.message) }
  }
  return (
    <Panel title="Inventory allocation" subtitle="Split, FIFO, manual or order-priority allocation" noPad>
      <DataTable rows={rows.filter(r => ['Available', 'QC pending'].includes(r.status))} columns={[
        { header: 'Lot', cell: r => <span className="font-semibold text-[#142D4E]">{r.lot_no}</span> },
        { header: 'Material', key: 'material' }, { header: 'Received', cell: r => `${r.received_qty} t` },
        { header: 'Available', cell: r => `${r.available_qty} t` }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', cell: r => r.status === 'Available' ? <button onClick={() => allocate(r)} className="rounded-lg bg-[#142D4E] px-3 py-1.5 text-[12px] font-semibold text-white">Allocate</button> : <span className="text-[11px] text-slate-400">Awaiting QC</span>, right: true },
      ]} />
    </Panel>
  )
}

function Consolidation() {
  return (
    <Panel title="Consolidation — pooled procurement">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[13px] font-semibold text-slate-500">Inbound seller lots</div>
          {[['Supplier A', 20], ['Supplier B', 20]].map(([s, q]) => (
            <div key={s} className="mb-2 flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[13px]"><span>{s}</span><span className="font-bold text-[#142D4E]">{q} t</span></div>
          ))}
          <div className="mt-2 rounded-lg bg-[#142D4E] px-3 py-2.5 text-[13px] font-semibold text-white flex justify-between"><span>Warehouse receives</span><span>40 t</span></div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-slate-500">Buyer allocations</div>
          {[['Buyer A', 5], ['Buyer B', 10], ['Buyer C', 8], ['Buyer D', 7], ['Buyer E', 10]].map(([b, q]) => (
            <div key={b} className="mb-2"><div className="flex justify-between text-[13px]"><span className="text-slate-600">{b}</span><span className="font-semibold text-[#142D4E]">{q} t</span></div><Fill pct={q / 40 * 100} /></div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function Outbound() {
  const [rows, setRows] = useState([])
  const load = () => api('/shipments?direction=outbound').then(setRows).catch(() => {})
  useEffect(() => { load() }, [])
  const dispatch = async (s) => {
    const order = await api('/orders').then(os => os.find(o => o.outbound_shipment_id === s.id)).catch(() => null)
    if (!order) return toast.error('No order linked')
    try { await api(`/orders/${order.id}/advance`, { method: 'POST', body: JSON.stringify({ target: 'OUTBOUND_DISPATCHED' }) }); toast.success(`${s.shipment_no} dispatched — buyer now sees a live shipment`); load() } catch (e) { toast.error(e.message) }
  }
  const deliver = async (s) => {
    const order = await api('/orders').then(os => os.find(o => o.outbound_shipment_id === s.id)).catch(() => null)
    if (!order) return
    try { await api(`/orders/${order.id}/advance`, { method: 'POST', body: JSON.stringify({ target: 'DELIVERED' }) }); toast.success(`${s.shipment_no} delivered — awaiting buyer acceptance`); load() } catch (e) { toast.error(e.message) }
  }
  return (
    <Panel title="Outbound shipments" noPad>
      <DataTable rows={rows} columns={[
        { header: 'Shipment', cell: r => <span className="font-semibold text-[#142D4E]">{r.shipment_no}</span> },
        { header: 'Buyer', key: 'to' }, { header: 'Material', key: 'material' }, { header: 'Qty', cell: r => `${r.quantity} t` },
        { header: 'Vehicle', key: 'vehicle' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', right: true, cell: r => r.status === 'Planning' ? <button onClick={() => dispatch(r)} className="rounded-lg bg-[#007F78] px-3 py-1.5 text-[12px] font-semibold text-white">Dispatch</button> : r.status === 'Dispatched' ? <button onClick={() => deliver(r)} className="rounded-lg bg-[#142D4E] px-3 py-1.5 text-[12px] font-semibold text-white">Mark delivered</button> : <span className="text-[11px] text-emerald-600">Delivered</span> },
      ]} />
    </Panel>
  )
}

function Tracking() {
  const [rows, setRows] = useState([])
  const [selId, setSelId] = useState(null)
  useEffect(() => { api('/shipments?direction=outbound').then((r) => { setRows(r); setSelId((r.find((x) => x.status === 'Dispatched') || r[0])?.id) }).catch(() => {}) }, [])
  const steps = ['Warehouse', 'Vehicle dispatched', 'Checkpoint', 'Buyer location', 'POD confirmed']
  const sel = rows.find((r) => r.id === selId)
  const progOf = (s) => s?.status === 'Delivered' ? 1 : s?.status === 'Dispatched' ? 0.55 : 0.12
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-1">
        <div className="text-[13px] font-semibold text-slate-500">Active deliveries</div>
        {rows.slice(0, 6).map((s) => {
          const prog = s.status === 'Delivered' ? 5 : s.status === 'Dispatched' ? 2 : 1
          return (
            <button key={s.id} onClick={() => setSelId(s.id)} className={`w-full rounded-xl border p-3.5 text-left transition ${selId === s.id ? 'border-[#007F78] ring-2 ring-[#007F78]/15' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-[#142D4E]">{s.shipment_no}</span><StatusBadge status={s.status} /></div>
              <div className="mt-0.5 text-[12px] text-slate-400">{s.from} → {s.to}</div>
              <div className="mt-2.5 flex items-center">
                {steps.map((st, i) => (
                  <div key={i} className="flex flex-1 items-center last:flex-none">
                    <span className={`h-2.5 w-2.5 rounded-full ${i < prog ? 'bg-[#007F78]' : 'bg-slate-200'}`} />
                    {i < steps.length - 1 && <span className={`h-0.5 flex-1 ${i < prog - 1 ? 'bg-[#007F78]' : 'bg-slate-200'}`} />}
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
      <Panel className="lg:col-span-2" title={sel ? `Live tracking — ${sel.shipment_no}` : 'Delivery tracking'} subtitle={sel ? `${sel.from} → ${sel.to} · ETA ${sel.eta} · ${sel.vehicle}` : 'Select a shipment'}>
        {sel ? (
          <>
            <LiveMap fromKey={sel.from} toKey={sel.buyer_cluster || sel.to} progress={progOf(sel)} live={sel.status === 'Dispatched'} height={340} />
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-[12px]">
              <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-slate-400">Driver</div><div className="font-semibold text-[#142D4E]">{sel.driver}</div></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-slate-400">Vehicle</div><div className="font-semibold text-[#142D4E]">{sel.vehicle}</div></div>
              <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-slate-400">ETA</div><div className="font-semibold text-[#142D4E]">{sel.eta}</div></div>
            </div>
          </>
        ) : <div className="grid h-64 place-items-center text-[13px] text-slate-400">No active shipments</div>}
      </Panel>
    </div>
  )
}
