'use client'

import { useEffect, useState } from 'react'
import { api, inr, inrShort } from '@/lib/cb/api'
import { Sidebar, TopBar, KpiCard, Panel, DataTable, StatusBadge } from '@/components/cb/shared'
import { TrendArea, Donut, GroupedBars, TEAL, NAVY, AMBER } from '@/components/cb/charts'
import { CompanySettings, ProfilePage } from '@/components/cb/settings'
import { SimpleList, Stub } from '@/components/cb/BuyerApp'
import {
  LayoutDashboard, Users, Building2, Layers, Gavel, Package, Warehouse, Boxes, ShieldCheck,
  Truck, CreditCard, AlertTriangle, Files, FileCheck2, BarChart3, ScrollText, Settings, ArrowLeft,
} from 'lucide-react'

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'buyers', label: 'Buyers', icon: Users },
  { key: 'sellers', label: 'Sellers', icon: Building2 },
  { key: 'pools', label: 'Pools', icon: Layers },
  { key: 'auctions', label: 'Auctions', icon: Gavel },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'quality', label: 'Quality', icon: ShieldCheck },
  { key: 'logistics', label: 'Logistics', icon: Truck },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'compliance', label: 'Compliance', icon: FileCheck2 },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
  { key: 'settings', label: 'Settings', icon: Settings },
]

const GMV_TREND = [
  { month: 'Jan', gmv: 210, orders: 42 }, { month: 'Feb', gmv: 260, orders: 51 }, { month: 'Mar', gmv: 320, orders: 63 },
  { month: 'Apr', gmv: 300, orders: 58 }, { month: 'May', gmv: 380, orders: 72 }, { month: 'Jun', gmv: 440, orders: 84 },
]
const ORDER_STAGE_MIX = [
  { name: 'In transit', value: 3 }, { name: 'At hub / QC', value: 2 }, { name: 'Allocated', value: 2 },
  { name: 'Delivered', value: 2 }, { name: 'Completed', value: 1 },
]
const CLUSTER_FILL = [
  { name: 'Peenya', rate: 82 }, { name: 'Bommasandra', rate: 75 }, { name: 'Bhiwandi', rate: 68 },
  { name: 'Chakan', rate: 71 }, { name: 'Sanand', rate: 59 },
]

export default function AdminApp({ user, onLogout, roleSwitcher }) {
  const [view, setView] = useState('overview')
  const [sel, setSel] = useState(null)
  const go = (v) => { setSel(null); setView(v) }
  return (
    <div className="flex h-screen bg-[#E6EDF3]/40">
      <Sidebar items={NAV} active={view} onNav={go} dark footer="System Admin · ClusterBuy Ops" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Admin control center" subtitle="What requires intervention across the network?" user={user} onLogout={onLogout} roleSwitcher={roleSwitcher} onNavigate={go} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <Control go={go} />}
          {view === 'buyers' && <Buyers open={(id) => { setSel(id); setView('buyerDetail') }} />}
          {view === 'buyerDetail' && <BuyerDetail id={sel} back={() => go('buyers')} />}
          {view === 'sellers' && <Sellers />}
          {view === 'pools' && <SimpleList collection="/pools" title="Demand pools" cols={[['pool_no', 'Pool'], ['material', 'Material'], ['cluster', 'Cluster'], ['fill_pct', 'Fill %'], ['status', 'Status', true]]} />}
          {view === 'auctions' && <SimpleList collection="/auctions" title="Auctions" cols={[['auction_no', 'Auction'], ['material', 'Material'], ['hub', 'Hub'], ['status', 'Status', true]]} />}
          {view === 'orders' && <SimpleList collection="/orders" title="Orders" cols={[['order_no', 'Order'], ['buyer', 'Buyer'], ['supplier', 'Seller'], ['warehouse', 'Hub'], ['state', 'Status', true]]} />}
          {view === 'warehouses' && <SimpleList collection="/warehouses" title="Warehouses" cols={[['code', 'Code'], ['name', 'Name'], ['city', 'City'], ['used', 'Used (t)'], ['capacity', 'Capacity (t)']]} />}
          {view === 'inventory' && <SimpleList collection="/inventory" title="Inventory" cols={[['lot_no', 'Lot'], ['material', 'Material'], ['supplier', 'Seller'], ['warehouse', 'Hub'], ['status', 'Status', true]]} />}
          {view === 'quality' && <SimpleList collection="/inspections" title="Quality" cols={[['lot_no', 'Lot'], ['material', 'Material'], ['supplier', 'Supplier'], ['status', 'Status', true]]} />}
          {view === 'logistics' && <SimpleList collection="/shipments" title="Logistics" cols={[['shipment_no', 'Shipment'], ['direction', 'Type'], ['from', 'From'], ['to', 'To'], ['status', 'Status', true]]} />}
          {view === 'payments' && <SimpleList collection="/settlements" title="Payments & settlements" cols={[['order_no', 'Order'], ['supplier', 'Supplier'], ['net', 'Net'], ['status', 'Status', true]]} />}
          {view === 'disputes' && <SimpleList collection="/disputes" title="Disputes" cols={[['case_no', 'Case'], ['order_no', 'Order'], ['title', 'Issue'], ['payment_state', 'Payment'], ['status', 'Status', true]]} />}
          {['documents', 'compliance', 'reports', 'audit'].includes(view) && <Stub title={NAV.find(n => n.key === view)?.label} />}
          {view === 'settings' && <CompanySettings role="DEFAULT" companyName="ClusterBuy Operations" cluster="Pan-India network" />}
          {view === 'profile' && <ProfilePage user={user} roleLabel="System Administrator" />}
        </main>
      </div>
    </div>
  )
}

function Control({ go }) {
  const [d, setD] = useState({ buyers: [], sellers: [], pools: [], auctions: [], orders: [], insp: [], setts: [], disputes: [], queue: [] })
  useEffect(() => {
    Promise.all([api('/buyers'), api('/sellers'), api('/pools'), api('/auctions'), api('/orders'), api('/inspections'), api('/settlements'), api('/disputes'), api('/action-queue')])
      .then(([buyers, sellers, pools, auctions, orders, insp, setts, disputes, queue]) => setD({ buyers, sellers, pools, auctions, orders, insp, setts, disputes, queue })).catch(() => {})
  }, [])
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Active buyers" value={d.buyers.length} icon={Users} onClick={() => go('buyers')} />
        <KpiCard label="Active sellers" value={d.sellers.length} icon={Building2} accent="#142D4E" onClick={() => go('sellers')} />
        <KpiCard label="Demand pools" value={d.pools.length} icon={Layers} accent="#F59E0B" onClick={() => go('pools')} />
        <KpiCard label="Live auctions" value={d.auctions.filter(a => a.status === 'Live').length} icon={Gavel} onClick={() => go('auctions')} />
        <KpiCard label="Open orders" value={d.orders.length} icon={Package} accent="#142D4E" onClick={() => go('orders')} />
        <KpiCard label="Pending QC" value={d.insp.filter(i => i.status === 'Pending').length} icon={ShieldCheck} accent="#F59E0B" onClick={() => go('quality')} />
        <KpiCard label="Pending payments" value={d.setts.filter(s => ['Pending', 'On hold'].includes(s.status)).length} icon={CreditCard} onClick={() => go('payments')} />
        <KpiCard label="Disputes" value={d.disputes.length} icon={AlertTriangle} accent="#DC2626" onClick={() => go('disputes')} />
        <KpiCard label="Overdue deliveries" value={2} icon={Truck} accent="#F59E0B" />
        <KpiCard label="Network GMV" value={inrShort(d.setts.reduce((a, s) => a + (s.order_value || 0), 0))} icon={BarChart3} accent="#007F78" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Network GMV & orders" subtitle="Monthly gross merchandise value and order volume">
          <TrendArea data={GMV_TREND} xKey="month" series={[{ key: 'gmv', name: 'GMV (₹ L)', color: TEAL }, { key: 'orders', name: 'Orders', color: NAVY }]} height={240} />
        </Panel>
        <Panel title="Orders by stage">
          <Donut data={ORDER_STAGE_MIX} height={240} centerLabel="live orders" centerValue={d.orders.length} />
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Pool fill rate by cluster" subtitle="Demand aggregation health across clusters">
          <GroupedBars data={CLUSTER_FILL} xKey="name" series={[{ key: 'rate', name: 'Avg fill %', color: TEAL }]} height={220} />
        </Panel>
        <Panel title="Network health">
          <div className="grid grid-cols-2 gap-3 text-center">
            {[['On-time delivery', '91%', '#007F78'], ['QC pass rate', '93%', '#142D4E'], ['Avg pool savings', '18%', '#F59E0B'], ['Dispute rate', '2.4%', '#DC2626']].map(([l, v, c]) => (
              <div key={l} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="text-[24px] font-bold" style={{ color: c }}>{v}</div><div className="mt-1 text-[12px] text-slate-500">{l}</div></div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Action queue" subtitle="Items that need intervention across the network" noPad>
        <DataTable rows={d.queue} columns={[
          { header: 'Type', cell: r => <span className="font-semibold text-[#142D4E]">{r.type}</span> },
          { header: 'Details', key: 'details' }, { header: 'Age', key: 'age' },
          { header: 'Priority', cell: r => <StatusBadge status={r.priority} /> }, { header: 'Assigned', key: 'assigned' },
          { header: '', cell: () => <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-[#007F78]">Review</button>, right: true },
        ]} />
      </Panel>
    </div>
  )
}

function Buyers({ open }) {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/buyers').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Buyer management" noPad>
      <DataTable rows={rows} onRow={r => open(r.id)} columns={[
        { header: 'Company', cell: r => <span className="font-semibold text-[#142D4E]">{r.name}</span> },
        { header: 'GSTIN', key: 'gstin' }, { header: 'Cluster', key: 'cluster' },
        { header: 'Open orders', key: 'open_orders' }, { header: 'Lifetime', cell: r => inrShort(r.lifetime_purchase) },
        { header: 'Payment risk', cell: r => <StatusBadge status={r.payment_risk} /> },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}

function BuyerDetail({ id, back }) {
  const [b, setB] = useState(null)
  useEffect(() => { api('/buyers').then(rows => setB(rows.find(r => r.id === id))).catch(() => {}) }, [id])
  if (!b) return <Stub title="Loading buyer..." />
  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to buyers</button>
      <Panel title={b.name}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[['GSTIN', b.gstin], ['Cluster', b.cluster], ['Open orders', b.open_orders], ['Lifetime purchase', inrShort(b.lifetime_purchase)]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-[11px] text-slate-400">{l}</div><div className="text-[14px] font-semibold text-[#142D4E]">{v}</div></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
          {['Orders', 'Demand history', 'Payments', 'Disputes', 'Documents', 'Users', 'Addresses'].map(t => <span key={t} className="rounded-full border border-slate-200 px-3 py-1 text-slate-500">{t}</span>)}
        </div>
      </Panel>
    </div>
  )
}

function Sellers() {
  const [rows, setRows] = useState([])
  useEffect(() => { api('/sellers').then(setRows).catch(() => {}) }, [])
  return (
    <Panel title="Seller management" noPad>
      <DataTable rows={rows} columns={[
        { header: 'Company', cell: r => <span className="font-semibold text-[#142D4E]">{r.name}</span> },
        { header: 'Capacity', cell: r => `${r.capacity} t` }, { header: 'Win rate', cell: r => `${r.win_rate}%` },
        { header: 'On-time', cell: r => `${r.on_time}%` }, { header: 'QC pass', cell: r => `${r.qc_pass}%` },
        { header: 'Rating', cell: r => `★ ${r.rating}` }, { header: 'Outstanding', cell: r => inrShort(r.outstanding_settlement) },
        { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
      ]} />
    </Panel>
  )
}
