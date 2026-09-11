'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { api, inr, inrShort, prettyState } from '@/lib/cb/api'
import { Sidebar, TopBar, KpiCard, Panel, DataTable, StatusBadge, Fill, Timeline, CostBreakdown, TextField, SelectField, TextAreaField, Chip, SectionTitle } from '@/components/cb/shared'
import { TrendArea, GroupedBars, Donut, TEAL, NAVY, AMBER } from '@/components/cb/charts'
import { CompanySettings, ProfilePage } from '@/components/cb/settings'
import {
  LayoutDashboard, FileText, Users, ReceiptText, Package, Truck, Boxes, CreditCard,
  Files, AlertTriangle, Building2, Bell, LifeBuoy, Settings, Plus, ArrowRight, ArrowLeft, CheckCircle2,
  Info, Sparkles, Calendar, IndianRupee, TrendingUp, Layers, BarChart3, PiggyBank, MapPin, Save, User,
} from 'lucide-react'
import { toast } from 'sonner'

const LiveMap = dynamic(() => import('@/components/cb/LiveMap'), { ssr: false, loading: () => <div className="grid h-full min-h-[240px] place-items-center rounded-xl bg-slate-50 text-[12px] text-slate-400">Loading map…</div> })

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'demands', label: 'My Demands', icon: FileText },
  { key: 'pools', label: 'Demand Pools', icon: Users },
  { key: 'savings', label: 'My Savings', icon: PiggyBank },
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

// ---- Dashboard chart data ----
const SPEND_TREND = [
  { month: 'Jan', spend: 3.2, saved: 0.3 }, { month: 'Feb', spend: 3.6, saved: 0.4 },
  { month: 'Mar', spend: 4.1, saved: 0.52 }, { month: 'Apr', spend: 3.9, saved: 0.48 },
  { month: 'May', spend: 4.35, saved: 0.61 }, { month: 'Jun', spend: 4.6, saved: 0.72 },
]
const SPEND_MIX = [
  { name: 'PP', value: 42 }, { name: 'HDPE', value: 24 }, { name: 'LDPE', value: 16 },
  { name: 'PET', value: 12 }, { name: 'ABS', value: 6 },
]

// ---- Material catalog for the Create Demand wizard ----
const MATERIAL_CATEGORIES = {
  'Plastics & Polymers': ['PP (Polypropylene)', 'HDPE', 'LDPE', 'PET Resin', 'ABS', 'PVC'],
  'Metals': ['Mild Steel', 'Stainless Steel 304', 'Aluminium 6061', 'Copper'],
  'Chemicals': ['Titanium Dioxide', 'Calcium Carbonate', 'Caustic Soda'],
  'Packaging': ['Corrugated Board', 'BOPP Film', 'Stretch Wrap'],
}
const MATERIAL_INFO = {
  'PP (Polypropylene)': { blurb: 'Polypropylene (PP) is widely used for injection molding, offering high strength, good chemical resistance and easy processability. Common applications include packaging, automotive parts and consumer goods.', grades: ['Grade X', 'Grade Y', 'Grade R'], related: ['HDPE', 'LDPE', 'ABS'], applications: ['Packaging', 'Automotive', 'Consumer goods', 'Industrial'], savings: '12 – 28%' },
  'HDPE': { blurb: 'High-Density Polyethylene (HDPE) is a rigid, durable polymer with excellent strength-to-density ratio. Used for pipes, containers, crates and blow-moulded products.', grades: ['Blow', 'Injection', 'Pipe'], related: ['LDPE', 'PP (Polypropylene)'], applications: ['Pipes', 'Containers', 'Crates', 'Films'], savings: '10 – 24%' },
  'LDPE': { blurb: 'Low-Density Polyethylene (LDPE) is flexible and tough, ideal for films, liners and flexible packaging.', grades: ['Film', 'General'], related: ['HDPE', 'PP (Polypropylene)'], applications: ['Films', 'Liners', 'Flexible packaging'], savings: '9 – 22%' },
  'PET Resin': { blurb: 'PET resin offers clarity, strength and good barrier properties, widely used for bottles and food-grade packaging.', grades: ['Bottle', 'Fibre'], related: ['HDPE', 'PP (Polypropylene)'], applications: ['Bottles', 'Food packaging', 'Fibre'], savings: '11 – 20%' },
  'ABS': { blurb: 'ABS is a tough engineering thermoplastic with good impact resistance and surface finish, used for enclosures and automotive trims.', grades: ['General', 'Plating'], related: ['PP (Polypropylene)', 'PVC'], applications: ['Enclosures', 'Automotive trim', 'Appliances'], savings: '12 – 26%' },
}
const DEFAULT_INFO = { blurb: 'Tell us your requirement and we will pool it with similar demand from nearby MSMEs to unlock better supplier pricing.', grades: ['Standard'], related: [], applications: ['General'], savings: '10 – 25%' }
const POOL_PEERS = ['AP', 'BC', 'GP', 'VP', 'MA']

// ---- Savings story data (before / after pooling) ----
const SAVINGS_ROWS = [
  { material: 'PP Grade X', qty: 5, alone: 92, pooled: 79, unit: 'kg' },
  { material: 'HDPE Blow', qty: 8, alone: 88, pooled: 77, unit: 'kg' },
  { material: 'LDPE Film', qty: 6, alone: 95, pooled: 84, unit: 'kg' },
  { material: 'PET Resin', qty: 4, alone: 101, pooled: 90, unit: 'kg' },
]

export default function BuyerApp({ user, onLogout, roleSwitcher }) {
  const [view, setView] = useState('overview')
  const [sel, setSel] = useState(null) // {type, id}

  const go = (v) => { setSel(null); setView(v) }

  return (
    <div className="flex h-screen bg-[#E6EDF3]/40">
      <Sidebar items={NAV} active={view} onNav={go} dark={false} footer="Indian MSMEs · Stronger together" />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title="Your procurement" subtitle="Track your demands, pools and orders in one place." user={user} onLogout={onLogout} roleSwitcher={roleSwitcher} onNavigate={go}
          right={<button onClick={() => go('new')} className="flex items-center gap-1.5 rounded-lg bg-[#007F78] px-3.5 py-2 text-[13px] font-semibold text-white hover:brightness-110"><Plus className="h-4 w-4" /> New demand</button>} />
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'overview' && <Overview go={go} openOrder={(id) => { setSel({ type: 'order', id }); setView('orderDetail') }} />}
          {view === 'new' && <NewDemand onDone={() => go('demands')} back={() => go('demands')} />}
          {view === 'demands' && <Demands go={go} />}
          {view === 'savings' && <SavingsStory />}
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
          {view === 'profile' && <ProfilePage user={user} roleLabel="Procurement Manager" />}
          {view === 'settings' && <CompanySettings role="BUYER" companyName="Apex Plastics Pvt. Ltd." cluster="Peenya, Bengaluru" />}
          {view === 'support' && <Stub title="Support" />}
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
        <Panel className="lg:col-span-2" title="Spend vs savings" subtitle="Monthly procurement spend and what pooling saved you">
          <TrendArea data={SPEND_TREND} xKey="month" series={[{ key: 'spend', name: 'Spend', color: NAVY }, { key: 'saved', name: 'Saved by pooling', color: TEAL }]} height={230} />
        </Panel>
        <Panel title="Spend by material">
          <Donut data={SPEND_MIX} height={230} centerLabel="this quarter" centerValue={inrShort(4350000)} />
        </Panel>
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

const STEPS = [
  { label: 'Material', icon: Boxes }, { label: 'Requirement', icon: Layers }, { label: 'Specifications', icon: FileText },
  { label: 'Delivery', icon: Truck }, { label: 'Commercials', icon: IndianRupee }, { label: 'Review', icon: CheckCircle2 },
]

function NewDemand({ onDone, back }) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState({
    category: 'Plastics & Polymers', material: 'PP (Polypropylene)', grade: 'Grade X', brand: '',
    application: 'Injection molding components for consumer goods.', quantity: '', unit: 'tonnes', min_qty: '',
    required_date: '', spec: '', tolerance: '', cert: '', packaging: '', cluster: 'Peenya, Bengaluru',
    address: '', pincode: '', delivery_pref: 'Pickup at hub', target_price: '', max_cost: '',
    payment_terms: '30 days', gst: 'GST invoice required',
  })
  const [done, setDone] = useState(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const info = MATERIAL_INFO[f.material] || DEFAULT_INFO

  const submit = async () => {
    try {
      const payload = { ...f, quantity: Number(f.quantity) || 5, target_price: Number(f.target_price) || undefined }
      const d = await api('/demands', { method: 'POST', body: JSON.stringify(payload) })
      setDone(d); toast.success(`Demand ${d.demand_no} submitted`)
    } catch (e) { toast.error(e.message) }
  }

  if (done) return (
    <div className="mx-auto max-w-xl">
      <Panel>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
          <div className="mt-3 text-[13px] uppercase tracking-wide text-slate-400">Demand submitted</div>
          <div className="text-[26px] font-bold text-[#142D4E]">{done.demand_no}</div>
          <StatusBadge status="Matching" className="mt-2" />
          <p className="mt-3 max-w-sm text-[13px] text-slate-500">We&apos;re matching your requirement with similar demand from nearby MSMEs to build a pool and unlock better pricing.</p>
          <button onClick={onDone} className="mt-5 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Go to my demands</button>
        </div>
      </Panel>
    </div>
  )

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))
  const isLast = step === STEPS.length - 1
  const summaryVal = (v, suffix = '') => (v === '' || v == null) ? <span className="text-slate-300">—</span> : <span className="font-medium text-[#142D4E]">{v}{suffix}</span>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={back} className="mb-1 flex items-center gap-1 text-[12.5px] font-semibold text-[#007F78]"><ArrowLeft className="h-4 w-4" /> Back to My Demands</button>
          <h1 className="text-[26px] font-bold text-[#142D4E]">Create New Demand</h1>
          <p className="text-[13px] text-slate-400">Submit your raw material requirement and let&apos;s find better prices together.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast.success('Saved as draft')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"><Save className="h-4 w-4" /> Save as draft</button>
          <button onClick={isLast ? submit : next} className="flex items-center gap-1.5 rounded-lg bg-[#142D4E] px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110">{isLast ? 'Submit demand' : 'Next'} <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {/* Stepper */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex flex-1 items-center gap-1">
                <button onClick={() => setStep(i)} className="flex min-w-max flex-col items-center gap-1">
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold transition ${i < step ? 'bg-[#007F78] text-white' : i === step ? 'bg-[#007F78] text-white ring-4 ring-[#007F78]/15' : 'bg-slate-100 text-slate-400'}`}>{i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</span>
                  <span className={`text-[11px] font-semibold ${i <= step ? 'text-[#142D4E]' : 'text-slate-400'}`}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span className={`mb-4 h-0.5 flex-1 ${i < step ? 'bg-[#007F78]' : 'bg-slate-100'}`} />}
              </div>
            ))}
          </div>

          {/* Step 0: Material */}
          {step === 0 && (
            <div className="space-y-5">
              <SectionTitle icon={Boxes} title={`${step + 1}. Material Details`} subtitle="Tell us what material you need." />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Material category" required value={f.category} onChange={(v) => { const first = MATERIAL_CATEGORIES[v][0]; setF((s) => ({ ...s, category: v, material: first, grade: (MATERIAL_INFO[first] || DEFAULT_INFO).grades[0] })) }} options={Object.keys(MATERIAL_CATEGORIES)} />
                <SelectField label="Material" required value={f.material} onChange={(v) => { setF((s) => ({ ...s, material: v, grade: (MATERIAL_INFO[v] || DEFAULT_INFO).grades[0] })) }} options={MATERIAL_CATEGORIES[f.category] || []} />
                <SelectField label="Grade" required value={f.grade} onChange={(v) => set('grade', v)} options={info.grades} />
                <TextField label="Brand preference (optional)" value={f.brand} onChange={(v) => set('brand', v)} placeholder="e.g. Reliance, SABIC, Borealis" />
              </div>
              <TextAreaField label="Application / Use case" required value={f.application} onChange={(v) => set('application', v)} maxLength={500} rows={3} placeholder="Where and how will you use this material?" />

              <div className="flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 sm:flex-row">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600"><Info className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[#142D4E]">About {f.material} {f.grade}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{info.blurb}</p>
                  <button onClick={() => toast('Material spec sheet opened')} className="mt-2 text-[12.5px] font-semibold text-[#007F78]">View material specs →</button>
                </div>
                <div className="hidden h-20 w-28 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 text-slate-400 sm:grid"><Boxes className="h-8 w-8" /></div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-[#007F78]/20 bg-[#007F78]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#007F78]/15 text-[#007F78]"><Sparkles className="h-5 w-5" /></span>
                  <div><div className="text-[13.5px] font-semibold text-[#142D4E]">Need help choosing the right material?</div><div className="text-[12px] text-slate-500">Get recommendations based on your use case.</div></div>
                </div>
                <button onClick={() => toast.success('AI suggested: PP Grade X for your use case')} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#007F78] bg-white px-4 py-2 text-[13px] font-semibold text-[#007F78]"><Sparkles className="h-4 w-4" /> Get AI suggestions</button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><Layers className="h-4 w-4" /> Common grades</div>
                  <div className="flex flex-wrap gap-1.5">{info.grades.map((g) => <Chip key={g} active={f.grade === g} onClick={() => set('grade', g)}>{g}</Chip>)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><Boxes className="h-4 w-4" /> Related materials</div>
                  <div className="flex flex-wrap gap-1.5">{(info.related.length ? info.related : ['—']).map((m) => <Chip key={m} onClick={() => MATERIAL_INFO[m] && set('material', m)}>{m}</Chip>)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500"><FileText className="h-4 w-4" /> Typical applications</div>
                  <div className="flex flex-wrap gap-1.5">{info.applications.map((a) => <Chip key={a}>{a}</Chip>)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Requirement */}
          {step === 1 && (
            <div className="space-y-5">
              <SectionTitle icon={Layers} title="2. Requirement" subtitle="How much do you need and by when?" />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Quantity" required type="number" value={f.quantity} onChange={(v) => set('quantity', v)} placeholder="e.g. 5" />
                <SelectField label="Unit" value={f.unit} onChange={(v) => set('unit', v)} options={['tonnes', 'kg', 'quintal', 'bags']} />
                <TextField label="Minimum acceptable quantity" type="number" value={f.min_qty} onChange={(v) => set('min_qty', v)} hint="Smallest quantity you'd still accept if the pool is partly filled." />
                <TextField label="Required-by date" required type="date" value={f.required_date} onChange={(v) => set('required_date', v)} />
              </div>
            </div>
          )}

          {/* Step 2: Specifications */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionTitle icon={FileText} title="3. Specifications" subtitle="Quality parameters and certifications." />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Specification / MFI" value={f.spec} onChange={(v) => set('spec', v)} placeholder="e.g. MFI 12 g/10min" />
                <TextField label="Tolerance" value={f.tolerance} onChange={(v) => set('tolerance', v)} placeholder="e.g. ± 2%" />
                <SelectField label="Certification required" value={f.cert} onChange={(v) => set('cert', v)} options={['', 'COA', 'RoHS', 'FDA food-grade', 'REACH', 'ISO 9001']} />
                <SelectField label="Packaging requirement" value={f.packaging} onChange={(v) => set('packaging', v)} options={['', '25 kg bags', '500 kg jumbo bags', 'Loose / bulk', 'Palletised']} />
              </div>
            </div>
          )}

          {/* Step 3: Delivery */}
          {step === 3 && (
            <div className="space-y-5">
              <SectionTitle icon={Truck} title="4. Delivery" subtitle="Where should we deliver or pool for pickup?" />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField label="Cluster" required value={f.cluster} onChange={(v) => set('cluster', v)} options={['Peenya, Bengaluru', 'Bommasandra, Bengaluru', 'Bhiwandi, Maharashtra', 'Chakan, Pune', 'Sanand, Gujarat']} />
                <SelectField label="Delivery preference" value={f.delivery_pref} onChange={(v) => set('delivery_pref', v)} options={['Pickup at hub', 'Deliver to factory', 'Direct supplier delivery']} />
                <TextField className="md:col-span-2" label="Delivery address" value={f.address} onChange={(v) => set('address', v)} placeholder="Factory / warehouse address" />
                <TextField label="Pincode" value={f.pincode} onChange={(v) => set('pincode', v)} />
              </div>
            </div>
          )}

          {/* Step 4: Commercials */}
          {step === 4 && (
            <div className="space-y-5">
              <SectionTitle icon={IndianRupee} title="5. Commercials" subtitle="Your target pricing and terms." />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Target price (₹/kg)" type="number" value={f.target_price} onChange={(v) => set('target_price', v)} placeholder="e.g. 80" />
                <TextField label="Max landed cost (₹/kg)" type="number" value={f.max_cost} onChange={(v) => set('max_cost', v)} />
                <SelectField label="Payment terms" value={f.payment_terms} onChange={(v) => set('payment_terms', v)} options={['Advance', '15 days', '30 days', '45 days', '60 days']} />
                <TextField label="GST requirement" value={f.gst} onChange={(v) => set('gst', v)} />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-5">
              <SectionTitle icon={CheckCircle2} title="6. Review & submit" subtitle="Check the details before we start matching." />
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[13px]">
                {[['Material', `${f.material} · ${f.grade}`], ['Application', f.application], ['Quantity', `${f.quantity || '—'} ${f.unit}`], ['Required by', f.required_date || '—'], ['Specification', f.spec || '—'], ['Cluster', f.cluster], ['Delivery', f.delivery_pref], ['Target price', f.target_price ? inr(f.target_price) + '/kg' : '—'], ['Payment terms', f.payment_terms]].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-4 border-b border-slate-200/70 py-2 last:border-0"><span className="text-slate-500">{l}</span><span className="text-right font-medium text-[#142D4E]">{v}</span></div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button disabled={step === 0} onClick={prev} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-600 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Back</button>
            {isLast
              ? <button onClick={submit} className="rounded-lg bg-[#007F78] px-6 py-2.5 text-[13px] font-semibold text-white hover:brightness-110">Submit demand</button>
              : <button onClick={next} className="flex items-center gap-1.5 rounded-lg bg-[#142D4E] px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110">Next <ArrowRight className="h-4 w-4" /></button>}
          </div>
        </div>

        {/* Right sidebar — "what you're getting" */}
        <aside className="space-y-4">
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-400" /><span className="text-[14px] font-bold text-[#142D4E]">Demand summary</span></div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Auto-saved</span>
            </div>
            <div className="space-y-2.5 text-[12.5px]">
              {[['Material', f.material, Boxes], ['Grade', f.grade, Layers], ['Application', (f.application || '').slice(0, 34) + ((f.application || '').length > 34 ? '…' : ''), FileText], ['Quantity', f.quantity ? `${f.quantity} ${f.unit}` : '', Layers], ['Required by', f.required_date, Calendar], ['Delivery', f.delivery_pref, Truck], ['Target price', f.target_price ? `${inr(f.target_price)}/kg` : '', IndianRupee]].map(([l, v, Icon]) => (
                <div key={l} className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-400"><Icon className="h-3.5 w-3.5" /> {l}</span>
                  <span className="text-right">{summaryVal(v)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <div className="rounded-xl border border-[#007F78]/20 bg-[#007F78]/5 p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-[#007F78]/15 text-[#007F78]"><Users className="h-5 w-5" /></span>
              <div>
                <div className="text-[13.5px] font-bold text-[#142D4E]">You&apos;re in good company</div>
                <p className="mt-0.5 text-[12px] text-slate-500">5 other MSMEs are likely to join a similar demand in your region.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center -space-x-2">
              {POOL_PEERS.map((p) => <span key={p} className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#142D4E] text-[9px] font-bold text-white">{p}</span>)}
              <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#007F78] text-[9px] font-bold text-white">+2</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#142D4E]"><BarChart3 className="h-4 w-4 text-[#F59E0B]" /> Potential savings</div>
            <p className="mt-1 text-[12px] text-slate-500">Based on past pools, buyers saved</p>
            <div className="mt-1 text-[24px] font-extrabold text-[#F59E0B]">{info.savings}<span className="ml-1 text-[12px] font-medium text-slate-500">by procuring together</span></div>
          </div>

          <Panel>
            <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#142D4E]"><Calendar className="h-4 w-4 text-slate-400" /> Estimated timeline</div>
            <ol className="space-y-2.5 text-[12.5px]">
              {[['Today', 'Submit demand'], ['1–3 days', 'Find & match similar demands'], ['3–7 days', 'Pool formation'], ['7–14 days', 'Supplier quotes / auction'], ['14+ days', 'Order confirmation']].map(([t, d], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${i === 0 ? 'bg-[#007F78]' : 'bg-slate-300'}`} />
                  <div><span className="font-semibold text-[#142D4E]">{t}</span> <span className="text-slate-500">— {d}</span></div>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

// ---- Savings Story: before/after pooling vs buying alone ----
function SavingsStory() {
  const [orders, setOrders] = useState([])
  useEffect(() => { api('/orders').then(setOrders).catch(() => {}) }, [])
  const rows = SAVINGS_ROWS.map((r) => {
    const kg = r.qty * 1000
    const aloneTotal = r.alone * kg, pooledTotal = r.pooled * kg
    return { ...r, kg, aloneTotal, pooledTotal, saved: aloneTotal - pooledTotal, pct: Math.round(((r.alone - r.pooled) / r.alone) * 100) }
  })
  const totalAlone = rows.reduce((a, r) => a + r.aloneTotal, 0)
  const totalPooled = rows.reduce((a, r) => a + r.pooledTotal, 0)
  const totalSaved = totalAlone - totalPooled
  const avgPct = Math.round((totalSaved / totalAlone) * 100)
  const chartData = rows.map((r) => ({ name: r.material.split(' ')[0], alone: Math.round(r.aloneTotal / 1000), pooled: Math.round(r.pooledTotal / 1000) }))

  return (
    <div className="space-y-6">
      <SectionTitle icon={PiggyBank} title="Your savings story" subtitle="Here's what pooling with other MSMEs saved you versus buying alone." />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-[12.5px] font-medium text-slate-500">If you bought alone</div>
          <div className="mt-2 text-[26px] font-bold text-slate-400 line-through">{inrShort(totalAlone)}</div>
          <div className="mt-1 text-[12px] text-slate-400">Estimated individual spend</div>
        </div>
        <div className="rounded-xl border border-[#007F78]/25 bg-[#007F78]/5 p-5">
          <div className="text-[12.5px] font-medium text-[#007F78]">You paid (pooled)</div>
          <div className="mt-2 text-[26px] font-bold text-[#142D4E]">{inrShort(totalPooled)}</div>
          <div className="mt-1 text-[12px] text-slate-500">Actual pooled spend</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#F59E0B]"><TrendingUp className="h-4 w-4" /> You saved</div>
          <div className="mt-2 text-[26px] font-extrabold text-[#F59E0B]">{inrShort(totalSaved)}</div>
          <div className="mt-1 text-[12px] text-slate-500">{avgPct}% lower on average</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Before vs after by material" subtitle="Total cost (₹ '000) — buying alone vs pooled">
          <GroupedBars data={chartData} xKey="name" series={[{ key: 'alone', name: 'Buying alone', color: '#CBD5E1' }, { key: 'pooled', name: 'Pooled with ClusterBuy', color: TEAL }]} height={260} />
        </Panel>
        <Panel title="Savings breakdown" subtitle="What drives your savings">
          <div className="space-y-3.5">
            {[['Volume discount', 62], ['Shared freight', 22], ['Lower platform fee', 9], ['Faster payment terms', 7]].map(([l, v]) => (
              <div key={l}>
                <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-slate-500">{l}</span><span className="font-semibold text-[#142D4E]">{v}%</span></div>
                <Fill pct={v} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Line-by-line savings" noPad>
        <DataTable rows={rows} columns={[
          { header: 'Material', cell: (r) => <span className="font-semibold text-[#142D4E]">{r.material}</span> },
          { header: 'Qty', cell: (r) => `${r.qty} t` },
          { header: 'Alone (/kg)', cell: (r) => <span className="text-slate-400 line-through">{inr(r.alone)}</span>, right: true },
          { header: 'Pooled (/kg)', cell: (r) => <span className="font-semibold text-[#142D4E]">{inr(r.pooled)}</span>, right: true },
          { header: 'You saved', cell: (r) => <span className="font-bold text-[#007F78]">{inrShort(r.saved)}</span>, right: true },
          { header: '%', cell: (r) => <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">{r.pct}%</span>, right: true },
        ]} />
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
  const [selId, setSelId] = useState(null)
  useEffect(() => { api('/shipments?direction=outbound').then((r) => { setRows(r); const active = r.find((x) => x.status === 'Dispatched') || r[0]; setSelId(active?.id) }).catch(() => {}) }, [])
  const sel = rows.find((r) => r.id === selId)
  const progress = sel ? (sel.status === 'Delivered' ? 1 : sel.status === 'Dispatched' ? 0.5 : 0.15) : 0.15
  const live = sel?.status === 'Dispatched'
  return (
    <div className="space-y-6">
      {sel && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2" title={`Live tracking — ${sel.shipment_no}`} subtitle={`${sel.from} → ${sel.to}`}>
            <LiveMap fromKey={sel.from} toKey={sel.buyer_cluster || sel.to} progress={progress} live={live} height={300} />
          </Panel>
          <Panel title="Shipment details">
            <div className="space-y-2.5 text-[13px]">
              {[['Order', sel.order_no], ['Material', sel.material], ['Quantity', `${sel.quantity} t`], ['Vehicle', sel.vehicle], ['Driver', sel.driver], ['ETA', sel.eta]].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-slate-50 py-1.5 last:border-0"><span className="text-slate-400">{l}</span><span className="font-medium text-[#142D4E]">{v}</span></div>
              ))}
              <div className="flex justify-between pt-1"><span className="text-slate-400">Status</span><StatusBadge status={sel.status} /></div>
            </div>
            {live && <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#007F78]/8 px-3 py-2 text-[12px] font-medium text-[#007F78]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#007F78]" /> Vehicle moving — live position on map</div>}
          </Panel>
        </div>
      )}
      <Panel title="Shipments to you" noPad>
        <DataTable rows={rows} onRow={(r) => setSelId(r.id)} columns={[
          { header: 'Shipment', cell: r => <span className="font-semibold text-[#142D4E]">{r.shipment_no}</span> },
          { header: 'Order', key: 'order_no' }, { header: 'Material', key: 'material' },
          { header: 'Qty', cell: r => `${r.quantity} t` }, { header: 'Vehicle', key: 'vehicle' },
          { header: 'ETA', key: 'eta' }, { header: 'Status', cell: r => <StatusBadge status={r.status} /> },
        ]} />
      </Panel>
    </div>
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
