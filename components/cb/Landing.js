'use client'

import { Logo } from '@/components/cb/shared'
import { inr } from '@/lib/cb/api'
import { Users, FileText, Truck, CheckCircle2, ArrowRight } from 'lucide-react'

const HERO = 'https://images.unsplash.com/photo-1601912552080-0fb89fd08042'

export default function Landing({ onSignIn, loading }) {
  const features = [
    { icon: Users, title: 'Pool demand', body: 'Nearby manufacturers combine their material requirements into larger, negotiated volumes.' },
    { icon: FileText, title: 'Compare supplier offers', body: 'Get multiple quotes with landed costs, lead times and supplier ratings.' },
    { icon: Truck, title: 'Inspect and distribute', body: 'Coordinate quality checks and schedule delivery to all members.' },
  ]
  const cost = [['Material (ex-works)', 74000], ['Logistics (inbound + hub)', 3800], ['Handling (inspection, storage)', 2200], ['Platform fees', 1000]]
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-[14px] font-medium text-slate-600 md:flex">
          <a href="#how">How it works</a><a href="#suppliers">For suppliers</a>
        </nav>
        <div className="flex items-center gap-3">
          <button onClick={onSignIn} className="text-[14px] font-semibold text-slate-600">Sign in</button>
          <button onClick={onSignIn} disabled={loading} className="rounded-lg bg-[#007F78] px-4 py-2 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60">{loading ? 'Loading...' : 'Get started'}</button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-widest text-slate-400">Indian MSMEs. Stronger together.</div>
          <h1 className="mt-3 text-[48px] font-extrabold leading-[1.05] tracking-tight text-[#142D4E]">Small orders. <br /><span className="text-[#007F78]">Greater buying power.</span></h1>
          <p className="mt-4 max-w-md text-[16px] text-slate-500">Pool material demand with nearby manufacturers. Compare landed costs. Coordinate warehousing, quality and delivery — together.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={onSignIn} className="flex items-center gap-2 rounded-lg bg-[#007F78] px-5 py-3 text-[14px] font-semibold text-white hover:brightness-110">Submit your requirement <ArrowRight className="h-4 w-4" /></button>
            <button onClick={onSignIn} className="rounded-lg border border-slate-200 px-5 py-3 text-[14px] font-semibold text-[#142D4E]">Become a supplier</button>
          </div>
          <div className="mt-6 flex flex-wrap gap-5 text-[13px] text-slate-500">
            {['Lower costs', 'Reliable supply', 'Stronger MSME clusters'].map(t => <span key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#007F78]" /> {t}</span>)}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
          <img src={HERO} alt="Warehouse logistics" className="h-[360px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#142D4E]/40 to-transparent" />
        </div>
      </section>

      <section id="how" className="mx-auto grid max-w-6xl gap-4 px-6 py-6 md:grid-cols-3">
        {features.map(f => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#E6EDF3] text-[#142D4E]"><f.icon className="h-5 w-5" /></span>
            <div className="mt-3 text-[16px] font-bold text-[#142D4E]">{f.title}</div>
            <p className="mt-1 text-[13px] text-slate-500">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="suppliers" className="mx-auto grid max-w-6xl gap-4 px-6 py-8 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-slate-400">Active pool (illustrative)</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Collecting</span></div>
          <div className="mt-2 text-[20px] font-bold text-[#142D4E]">PP Grade X</div>
          <div className="text-[13px] text-slate-500">Peenya cluster · 8 participating units</div>
          <div className="mt-4 flex items-end justify-between text-[14px]"><span className="font-bold text-[#142D4E]">32 / 40 tonnes</span><span className="font-bold text-[#007F78]">80%</span></div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#007F78]" style={{ width: '80%' }} /></div>
          <button onClick={onSignIn} className="mt-5 flex items-center gap-2 rounded-lg bg-[#142D4E] px-5 py-2.5 text-[13px] font-semibold text-white">View pool <ArrowRight className="h-4 w-4" /></button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="text-[15px] font-bold text-[#142D4E]">Estimated landed cost <span className="text-[13px] font-normal text-slate-400">(per tonne)</span></div>
          <div className="mt-4 space-y-2 text-[14px]">
            {cost.map(([l, v]) => (<div key={l} className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-500">{l}</span><span className="font-medium text-[#142D4E]">{inr(v)}</span></div>))}
            <div className="flex justify-between pt-2"><span className="font-bold text-[#142D4E]">Estimated landed cost</span><span className="text-[18px] font-bold text-[#007F78]">{inr(81000)}</span></div>
          </div>
          <div className="mt-2 text-right text-[11px] text-slate-400">Indicative only. Final price may vary.</div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-[13px] text-slate-400"><Logo sub={null} /><span>Together buys further. · Made for India&apos;s makers</span></div>
      </footer>
    </div>
  )
}
