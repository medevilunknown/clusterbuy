'use client'

import { useEffect, useState } from 'react'
import { api, inr, inrShort } from '@/lib/cb/api'
import { Sidebar, TopBar, KpiCard, Panel, DataTable, StatusBadge, Fill } from '@/components/cb/shared'
import { Notifications, SimpleList, Stub } from '@/components/cb/BuyerApp'
import {
  LayoutDashboard, Target, Gavel, ReceiptText, Package, Truck, Boxes, Wallet, Files,
  BarChart3, AlertTriangle, Bell, Building2, ArrowRight, ArrowLeft, Clock, TrendingDown, CheckCircle2, Upload,
} from 'lucide-react'
import { toast } from 'sonner'

const NAV = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'opps', label: 'Procurement Opportunities', icon: Target },
  { key: 'auctions', label: 'Auctions', icon: Gavel },
  { key: 'quotes', label: 'Quotes', icon: ReceiptText },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'shipments', label: 'Shipments', icon: Truck },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'settlements', label: 'Settlements', icon: Wallet },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'performance', label: 'Performance', icon: BarChart3 },
  { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'profile', label: 'Company Profile', icon: Building2 },
]

export default function SellerApp({ user, onLogout, roleSwitcher }) {
  const [view, setView] = useState('overview')
  const [sel, setSel] = useState(null)
  const go = (v) => { setSel(null); setView(v) }
  return (
    <div className="flex h-screen bg-[#E6EDF3]/40">
      <Sidebar items={NAV} active={view} onNav={go} dark footer="Shakti Polymers · Supplier" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Supplier workspace" subtitle="What can you supply, at what price, and when do you get paid?" user={user} onLogout={onLogout} roleSwitcher={roleSwitcher} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <Dash go={go} />}
          {view === 'opps' && <Opps open={(id) => { setSel(id); setView('oppDetail') }} />}
          {view === 'oppDetail' && <OppDetail id={sel} back={() => go('opps')} />}
          {view === 'auctions' && <Auctions open={(id) => { setSel(id); setView('auctionLive') }} />}
          {view === 'auctionLive' && <LiveAuction id={sel} back={() => go('auctions')} />}
          {view === 'orders' && <Orders open={(id) => { setSel(id); setView('fulfil') }} />}
          {view === 'fulfil' && <Fulfilment id={sel} back={() => go('orders')} />}
          {view === 'shipments' && <SimpleList collection="/shipments?direction=inbound" title="Shipments" cols={[['shipment_no', 'Shipment'], ['order_no', 'Order'], ['material', 'Material'], ['to', 'Destination'], ['status', 'Status', true]]} />}
          {view === 'inventory' && <SimpleList collection="/inventory" title="Inventory at hubs" cols={[['lot_no', 'Lot'], ['material', 'Material'], ['warehouse', 'Warehouse'], ['status', 'Status', true]]} />}
          {view === 'settlements' && <Settlements />}
          {view === 'quotes' && <SimpleList collection="/pools" title="Your quotes" cols={[['pool_no', 'Pool'], ['material', 'Material'], ['status', 'Status', true]]} />}
          {view === 'documents' && <SimpleList collection="/orders" title="Documents" cols={[['order_no', 'Order'], ['supplier', 'Supplier'], ['state', 'Status', true]]} />}
          {view === 'disputes' && <SimpleList collection="/disputes" title="Disputes" cols={[['case_no', 'Case'], ['order_no', 'Order'], ['title', 'Issue'], ['status', 'Status', true]]} />}
          {view === 'performance' && <Performance />}
          {view === 'notifications' && <Notifications role="SELLER" />}
          {view === 'profile' && <Stub title="Company Profile" />}
        </main>
      </div>
    </div>
  )
}

function Dash({ go }) {
  const [pools, setPools] = useState([]); const [auctions, setAuctions] = useState([]); const [orders, setOrders] = useState([]); const [setts, setSetts] = useState([])
  useEffect(() => {
    api('/pools').then(setPools).catch(() => {}); api('/auctions').then(setAuctions).catch(() => {})
    api('/orders').then(setOrders).catch(() => {}); api('/settlements').then(setSetts).catch(() => {})
  }, [])
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Open opportunities" value={pools.length} icon={Target} onClick={() => go('opps')} />
        <KpiCard label="Live auctions" value={auctions.filter(a => a.status === 'Live').length} icon={Gavel} accent="#F59E0B" onClick={() => go('auctions')} />
        <KpiCard label="Active orders" value={orders.length} icon={Package} accent="#142D4E" onClick={() => go('orders')} />
        <KpiCard label="Pending dispatch" value={orders.filter(o => ['CONFIRMED', 'SUPPLIER_PREPARING'].includes(o.state)).length} icon={Truck} />
        <KpiCard label="Pending settlements" value={setts.filter(s => ['Pending', 'On hold'].includes(s.status)).length} icon={Wallet} accent="#F59E0B" onClick={() => go('settlements')} />
        <KpiCard label="Revenue (mo)" value={inrShort(setts.reduce((a, s) => a + (s.net || 0), 0))} icon={TrendingDown} accent="#142D4E" />
        <KpiCard label="Win rate" value="62%" icon={BarChart3} />
      </div>
      <Panel title="Procurement opportunities" subtitle="Bid on group procurement requirements from trusted buyers." action={<button onClick={() => go('opps')} className="text-[13px] font-semibold text-[#007F78]">View all</button>} noPad>
        <DataTable rows={pools} onRow={() => go('opps')} columns={[
          { header: 'Pool', cell: r => <span className="font-semibold text-[#142D4E]">{r.pool_no}</span> },
          { header: 'Material', cell: r => `${r.material} ${r.grade}` }, { header: 'Total qty', cell: r => `${r.target_qty} t` },
          { header: 'Hub', key: 'hub' }, { header: 'Cluster', key: 'cluster' }, { header: 'Auction', key: 'auction_date' },
          { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        ]} />
      </Panel>
    </div>
  )
}

function Opps({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/opportunities').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Procurement opportunities" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Pool', cell: r => <span className="font-semibold text-[#142D4E]">{r.pool_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` }, { header: 'Qty', cell: r => `${r.target_qty} t` },
        { header: 'Hub', key: 'hub' }, { header: 'Cluster', key: 'cluster' }, { header: 'Required', key: 'closing_date' },
        { header: 'Auction', key: 'auction_date' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', cell: () => <span className="text-[12px] font-semibold text-[#007F78]">View opportunity</span>, right: true },
      ]} />
    </Panel>
  )
}

function OppDetail({ id, back }) {
  const [p, setP] = useState(null)
  const [q, setQ] = useState({ price: 78, moq: 5, available: 40, lead: 10, freight: 3, terms: '30 days', validity: '7 days' })
  useEffect(() => { if (id) api(`/pools/${id}`).then(setP).catch(() => {}) }, [id])
  if (!p) return <Stub title="Loading opportunity..." />
  const F = ({ label, k, type = 'text' }) => (
    <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">{label}</span>
      <input type={type} value={q[k]} onChange={e => setQ(s => ({ ...s, [k]: type === 'number' ? Number(e.target.value) : e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#007F78]" /></label>
  )
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1" title="Opportunity">
          <div className="text-[18px] font-bold text-[#142D4E]">{p.material} {p.grade}</div>
          <div className="mt-3 space-y-2 text-[13px]">
            {[['Quantity', `${p.target_qty} tonnes`], ['Delivery hub', p.hub], ['Buyer cluster', p.cluster], ['Required by', p.closing_date], ['Auction date', p.auction_date], ['Payment terms', '30 days']].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-400">{l}</span><span className="font-medium text-[#142D4E]">{v}</span></div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-500">Buyer identities remain anonymized until contract rules permit disclosure.</p>
        </Panel>
        <Panel className="lg:col-span-2" title="Submit quotation">
          <div className="grid grid-cols-2 gap-4">
            <F label="Material price (₹/kg)" k="price" type="number" /><F label="MOQ (t)" k="moq" type="number" />
            <F label="Available quantity (t)" k="available" type="number" /><F label="Lead time (days)" k="lead" type="number" />
            <F label="Freight estimate (₹/kg)" k="freight" type="number" /><F label="Payment terms" k="terms" />
            <F label="Validity" k="validity" />
            <label className="block"><span className="mb-1 block text-[12.5px] font-medium text-slate-600">Certifications</span>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[12px] text-slate-400"><Upload className="h-4 w-4" /> Upload COA / test report</div></label>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#142D4E] px-4 py-3 text-white">
            <span className="text-[13px]">Estimated landed cost</span>
            <span className="text-[16px] font-bold">{inr(q.price + q.freight + 3)}/kg</span>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={() => toast.success('Quotation submitted')} className="rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Submit quotation</button>
            <button onClick={back} className="rounded-lg border border-slate-200 px-5 py-2.5 text-[13px] font-semibold text-slate-500">Decline</button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Auctions({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/auctions').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Auctions" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Auction', cell: r => <span className="font-semibold text-[#142D4E]">{r.auction_no}</span> },
        { header: 'Material', key: 'material' }, { header: 'Qty', cell: r => `${r.quantity} t` }, { header: 'Hub', key: 'hub' },
        { header: 'Your bid', cell: r => inr(r.your_bid) + '/kg' }, { header: 'Rank', cell: r => `#${r.your_rank}` },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        { header: '', cell: r => <span className="text-[12px] font-semibold text-[#007F78]">{r.status === 'Live' ? 'Enter auction' : 'View'}</span>, right: true },
      ]} />
    </Panel>
  )
}

function LiveAuction({ id, back }) {
  const [a, setA] = useState(null); const [bid, setBid] = useState('')
  const load = () => api(`/auctions/${id}`).then(x => { setA(x); setBid(String(x.current_bid - 1)) }).catch(() => {})
  useEffect(() => { if (id) load() }, [id])
  if (!a) return <Stub title="Loading auction..." />
  const place = async () => {
    const v = Number(bid); if (!v) return
    try { const u = await api(`/auctions/${a.id}/bid`, { method: 'POST', body: JSON.stringify({ bid: v }) }); setA(u); toast.success(`Bid placed at ${inr(v)}/kg — you are now rank #1`) } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to auctions</button>
      <div className="rounded-xl border border-slate-200 bg-[#142D4E] p-6 text-white">
        <div className="flex items-center justify-between">
          <div><div className="text-[24px] font-bold">{a.material} · {a.quantity} tonnes</div><div className="text-[13px] text-white/60">{a.cluster} · Hub {a.hub}</div></div>
          <StatusBadge status={a.status} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-white/5 p-4"><div className="flex items-center gap-1.5 text-[12px] text-white/60"><Clock className="h-3.5 w-3.5" /> Time remaining</div><div className="mt-1 text-[26px] font-bold">{a.time_remaining}</div></div>
          <div className="rounded-lg bg-white/5 p-4"><div className="text-[12px] text-white/60">Your current bid</div><div className="mt-1 text-[26px] font-bold">{inr(a.your_bid)}/kg</div></div>
          <div className="rounded-lg bg-white/5 p-4"><div className="text-[12px] text-white/60">Your rank</div><div className="mt-1 text-[26px] font-bold text-[#F59E0B]">#{a.your_rank}</div></div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Place a bid" className="lg:col-span-1">
          <label className="mb-1 block text-[12.5px] font-medium text-slate-600">Enter new bid (₹/kg)</label>
          <input type="number" value={bid} onChange={e => setBid(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[16px] font-bold outline-none focus:border-[#007F78]" />
          <div className="mt-1 text-[12px] text-slate-400">Minimum decrement {inr(a.decrement)}/kg. Award considers landed cost & eligibility.</div>
          <button onClick={place} className="mt-3 w-full rounded-lg bg-[#007F78] py-2.5 text-[13px] font-semibold text-white">Review &amp; place bid</button>
        </Panel>
        <Panel title="Your bid history" className="lg:col-span-2" noPad>
          <DataTable rows={a.bids || []} columns={[
            { header: 'Time', key: 'time' }, { header: 'Bid', cell: r => inr(r.bid) + '/kg' },
            { header: 'Change', cell: r => <span className={String(r.change).startsWith('-') ? 'text-emerald-600' : 'text-slate-400'}>{r.change}</span> },
            { header: 'Rank', cell: r => `#${r.rank}` },
          ]} />
          <div className="px-5 pb-3 text-[11px] text-slate-400">Only your bids are shown. Competitor company names are not disclosed.</div>
        </Panel>
      </div>
    </div>
  )
}

function Orders({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/orders').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Orders to fulfil" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Order', cell: r => <span className="font-semibold text-[#142D4E]">{r.order_no}</span> },
        { header: 'Material', cell: r => `${r.material} ${r.grade}` }, { header: 'Qty', cell: r => `${r.quantity} t` },
        { header: 'Hub', key: 'warehouse' }, { header: 'Status', cell: r => <StatusBadge status={r.state} /> },
      ]} />
    </Panel>
  )
}

function Fulfilment({ id, back }) {
  const [o, setO] = useState(null)
  const load = () => api(`/orders/${id}`).then(setO).catch(() => {})
  useEffect(() => { if (id) load() }, [id])
  if (!o) return <Stub title="Loading order..." />
  const idx = ['PO_CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'SUPPLIER_PREPARING', 'SUPPLIER_DISPATCHED', 'IN_TRANSIT_TO_HUB', 'HUB_RECEIVED'].indexOf(o.state)
  const dispatched = idx >= 4 || ['IN_TRANSIT_TO_HUB', 'HUB_RECEIVED', 'QC_PENDING', 'QC_PASSED', 'INVENTORY_AVAILABLE', 'ALLOCATED', 'OUTBOUND_PLANNING', 'OUTBOUND_DISPATCHED', 'IN_TRANSIT_TO_BUYER', 'DELIVERED', 'ACCEPTED', 'SETTLEMENT_PENDING', 'COMPLETED'].includes(o.state)
  const confirmDispatch = async () => {
    try { await api(`/orders/${o.id}/advance`, { method: 'POST', body: JSON.stringify({ target: 'SUPPLIER_DISPATCHED' }) }); toast.success('Dispatch confirmed — warehouse now sees an inbound shipment'); load() } catch (e) { toast.error(e.message) }
  }
  const CHECK = ['Accept PO', 'Prepare material', 'Upload invoice', 'Upload quality certificate', 'Enter batch / lot number', 'Vehicle number', 'Driver details', 'E-way bill']
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back</button>
      <div className="flex items-center justify-between">
        <div><div className="text-[22px] font-bold text-[#142D4E]">Order {o.order_no}</div><div className="text-[13px] text-slate-400">{o.material} {o.grade} · {o.quantity} t · Hub {o.warehouse}</div></div>
        <StatusBadge status={o.state} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Fulfilment checklist" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2.5">
            {CHECK.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px]">
                <span className={`grid h-5 w-5 place-items-center rounded ${dispatched ? 'bg-[#007F78] text-white' : 'border border-slate-300'}`}>{dispatched && <CheckCircle2 className="h-3.5 w-3.5" />}</span>
                <span className="text-slate-600">{c}</span>
              </div>
            ))}
          </div>
          {!dispatched
            ? <button onClick={confirmDispatch} className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Confirm dispatch <ArrowRight className="h-4 w-4" /></button>
            : <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Dispatched. Track inbound shipment {o.inbound?.shipment_no || ''} to hub.</div>}
        </Panel>
        <Panel title="Settlement">
          {o.settlement && (
            <div className="space-y-2 text-[13px]">
              {[['Order value', o.settlement.order_value], ['Platform deductions', -o.settlement.platform_deduction], ['Logistics deductions', -o.settlement.logistics_deduction], ['TDS', -o.settlement.tds]].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-400">{l}</span><span className="font-medium text-[#142D4E]">{inr(v)}</span></div>
              ))}
              <div className="flex justify-between pt-1"><span className="font-semibold text-[#142D4E]">Net settlement</span><span className="text-[15px] font-bold text-[#007F78]">{inr(o.settlement.net)}</span></div>
              <div className="mt-2 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-700">Payment released after hub QC passes. Status: <b className="capitalize">{o.settlement.status}</b></div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Settlements() {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/settlements').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Settlements" noPad>
      <DataTable rows={rows} columns={[
        { header: 'Order', cell: r => <span className="font-semibold text-[#142D4E]">{r.order_no}</span> },
        { header: 'Order value', cell: r => inr(r.order_value), right: true }, { header: 'Net', cell: r => <span className="font-semibold text-[#007F78]">{inr(r.net)}</span>, right: true },
        { header: 'Expected', key: 'expected_date' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function Performance() {
  const stats = [['Price competitiveness', 82], ['Reliability', 88], ['Quality', 94], ['Delivery', 90], ['Dispute frequency', 12]]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Supplier score">
        {stats.map(([l, v]) => (
          <div key={l} className="mb-3"><div className="mb-1 flex justify-between text-[13px]"><span className="text-slate-500">{l}</span><span className="font-semibold text-[#142D4E]">{v}</span></div><Fill pct={v} color={l === 'Dispute frequency' ? '#DC2626' : '#007F78'} /></div>
        ))}
      </Panel>
      <div className="grid grid-cols-2 gap-4 self-start">
        <KpiCard label="Win rate" value="62%" icon={BarChart3} />
        <KpiCard label="On-time delivery" value="92%" icon={Truck} accent="#142D4E" />
        <KpiCard label="QC pass rate" value="94%" icon={CheckCircle2} />
        <KpiCard label="Rating" value="4.6" icon={BarChart3} accent="#F59E0B" />
      </div>
    </div>
  )
}
