'use client'

import { useState } from 'react'
import { Panel, TextField, SelectField, TextAreaField, Toggle, StatusBadge } from '@/components/cb/shared'
import { Building2, MapPin, Bell, Users, ShieldCheck, CreditCard, Camera, Save, Plus, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'

const TABS_BY_ROLE = {
  BUYER: [['company', 'Company', Building2], ['addresses', 'Addresses', MapPin], ['notifications', 'Notifications', Bell], ['team', 'Team', Users], ['security', 'Security', ShieldCheck]],
  SELLER: [['company', 'Company', Building2], ['products', 'Products & regions', CreditCard], ['notifications', 'Notifications', Bell], ['team', 'Team', Users], ['security', 'Security', ShieldCheck]],
  DEFAULT: [['company', 'Organisation', Building2], ['notifications', 'Notifications', Bell], ['team', 'Team', Users], ['security', 'Security', ShieldCheck]],
}

export function CompanySettings({ role = 'BUYER', companyName = 'Apex Plastics Pvt. Ltd.', cluster = 'Peenya, Bengaluru' }) {
  const tabs = TABS_BY_ROLE[role] || TABS_BY_ROLE.DEFAULT
  const [tab, setTab] = useState('company')
  const [f, setF] = useState({
    name: companyName, gstin: '29AAECS1000F1Z5', pan: 'AAECS1000F', type: role === 'SELLER' ? 'Manufacturer / Supplier' : 'MSME Manufacturer',
    email: 'accounts@apexplastics.in', phone: '+91 98450 12345', cluster, website: 'www.apexplastics.in',
    about: 'Precision injection-moulded components for automotive and consumer goods, serving OEMs across South India since 2009.',
    udyam: 'UDYAM-KR-03-0012345', turnover: '5-25 Cr',
  })
  const [notif, setNotif] = useState({ pool: true, auction: true, order: true, qc: true, payment: true, marketing: false, sms: true, whatsapp: true, email: true })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const save = () => toast.success('Company settings saved')

  const addresses = [
    { label: 'Registered office', line: '#42, Peenya Industrial Area, Phase 1, Bengaluru 560058', tag: 'Billing' },
    { label: 'Factory / delivery', line: 'Plot 18, KIADB Industrial Estate, Peenya, Bengaluru 560058', tag: 'Shipping' },
  ]
  const team = [
    { name: 'Rohit Kumar', role: 'Procurement Manager', email: 'rohit@apexplastics.in', status: 'Active' },
    { name: 'Sneha Rao', role: 'Finance', email: 'sneha@apexplastics.in', status: 'Active' },
    { name: 'Imran Shaikh', role: 'Store in-charge', email: 'imran@apexplastics.in', status: 'Invited' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="relative">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#142D4E] to-[#007F78] text-[22px] font-bold text-white">{f.name.slice(0, 2).toUpperCase()}</div>
          <button className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow"><Camera className="h-3.5 w-3.5" /></button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="text-[18px] font-bold text-[#142D4E]">{f.name}</h2><StatusBadge status="Verified" /></div>
          <div className="text-[13px] text-slate-400">{f.type} · {f.cluster}</div>
        </div>
        <button onClick={save} className="flex items-center gap-1.5 rounded-lg bg-[#007F78] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110"><Save className="h-4 w-4" /> Save changes</button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-px">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-[13px] font-semibold transition ${tab === k ? 'border-b-2 border-[#007F78] text-[#007F78]' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'company' && (
        <Panel title="Company profile" subtitle="Details shown on POs, invoices and to matched suppliers.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Legal company name" value={f.name} onChange={(v) => set('name', v)} required />
            <SelectField label="Business type" value={f.type} onChange={(v) => set('type', v)} options={['MSME Manufacturer', 'Manufacturer / Supplier', 'Trader', 'Fabricator', 'Assembler']} />
            <TextField label="GSTIN" value={f.gstin} onChange={(v) => set('gstin', v)} />
            <TextField label="PAN" value={f.pan} onChange={(v) => set('pan', v)} />
            <TextField label="Udyam registration" value={f.udyam} onChange={(v) => set('udyam', v)} />
            <SelectField label="Annual turnover" value={f.turnover} onChange={(v) => set('turnover', v)} options={['< 1 Cr', '1-5 Cr', '5-25 Cr', '25-100 Cr', '> 100 Cr']} />
            <TextField label="Billing email" value={f.email} onChange={(v) => set('email', v)} type="email" />
            <TextField label="Phone" value={f.phone} onChange={(v) => set('phone', v)} />
            <SelectField label="Primary cluster" value={f.cluster} onChange={(v) => set('cluster', v)} options={['Peenya, Bengaluru', 'Bommasandra, Bengaluru', 'Bhiwandi, Maharashtra', 'Chakan, Pune', 'Sanand, Gujarat']} />
            <TextField label="Website" value={f.website} onChange={(v) => set('website', v)} />
            <TextAreaField className="md:col-span-2" label="About the company" value={f.about} onChange={(v) => set('about', v)} maxLength={400} rows={3} />
          </div>
        </Panel>
      )}

      {tab === 'addresses' && (
        <Panel title="Addresses" action={<button className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><Plus className="h-4 w-4" /> Add address</button>}>
          <div className="grid gap-3 md:grid-cols-2">
            {addresses.map((a) => (
              <div key={a.label} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-[#142D4E]">{a.label}</span><StatusBadge status={a.tag === 'Billing' ? 'Info' : 'Active'} className="capitalize" /></div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{a.line}</p>
                <div className="mt-3 flex gap-2 text-[12px] font-semibold"><button className="text-[#007F78]">Edit</button><button className="text-slate-400">Set default</button></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'products' && (
        <Panel title="Products & regions" subtitle="What you supply and where you can deliver.">
          <div className="mb-4">
            <div className="mb-2 text-[12.5px] font-medium text-slate-600">Materials you supply</div>
            <div className="flex flex-wrap gap-2">
              {['PP Grade X', 'PP Grade Y', 'HDPE', 'LDPE', 'PET Resin'].map((m) => <span key={m} className="rounded-lg border border-[#007F78] bg-[#007F78]/8 px-3 py-1.5 text-[12.5px] font-medium text-[#007F78]">{m}</span>)}
              <button className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-400">+ Add material</button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-slate-600">Delivery regions</div>
            <div className="flex flex-wrap gap-2">
              {['Bengaluru', 'Pune', 'Mumbai'].map((m) => <span key={m} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600">{m}</span>)}
              <button className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-400">+ Add region</button>
            </div>
          </div>
        </Panel>
      )}

      {tab === 'notifications' && (
        <Panel title="Notification preferences" subtitle="Choose what updates you receive and how.">
          <div className="space-y-1">
            {[['pool', 'Pool updates', 'When a pool you joined fills or closes'], ['auction', 'Auction alerts', 'When an auction goes live or you are outbid'], ['order', 'Order status', 'PO, dispatch, delivery and acceptance events'], ['qc', 'Quality results', 'When your lots pass or fail QC'], ['payment', 'Payments & settlements', 'Invoices, payments and settlement releases'], ['marketing', 'Product & offers', 'News, tips and occasional offers']].map(([k, t, d]) => (
              <div key={k} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0">
                <div><div className="text-[13.5px] font-medium text-slate-700">{t}</div><div className="text-[12px] text-slate-400">{d}</div></div>
                <Toggle checked={notif[k]} onChange={(v) => setNotif((s) => ({ ...s, [k]: v }))} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-6 rounded-xl bg-slate-50 p-4">
            {[['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp']].map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] font-medium text-slate-600"><Toggle checked={notif[k]} onChange={(v) => setNotif((s) => ({ ...s, [k]: v }))} /> {t}</label>
            ))}
          </div>
          <button onClick={save} className="mt-4 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white">Save preferences</button>
        </Panel>
      )}

      {tab === 'team' && (
        <Panel title="Team members" action={<button className="flex items-center gap-1 text-[13px] font-semibold text-[#007F78]"><Plus className="h-4 w-4" /> Invite</button>} noPad>
          <div className="divide-y divide-slate-50">
            {team.map((m) => (
              <div key={m.email} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#142D4E] text-[12px] font-bold text-white">{m.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-[#142D4E]">{m.name}</div><div className="text-[12px] text-slate-400">{m.email}</div></div>
                <span className="hidden text-[12.5px] text-slate-500 sm:block">{m.role}</span>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'security' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Sign-in & security">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between border-b border-slate-50 py-2"><span className="text-slate-500">Sign-in method</span><span className="font-medium text-[#142D4E]">Google (Emergent)</span></div>
              <div className="flex items-center justify-between border-b border-slate-50 py-2"><span className="text-slate-500">Two-factor auth</span><StatusBadge status="Active" /></div>
              <div className="flex items-center justify-between py-2"><span className="text-slate-500">Active sessions</span><span className="font-medium text-[#142D4E]">2 devices</span></div>
            </div>
          </Panel>
          <Panel title="Data & compliance">
            <div className="space-y-2 text-[13px]">
              {[['KYC documents', 'Verified'], ['GST verification', 'Verified'], ['Bank account', 'Verified'], ['Digital signature', 'Pending']].map(([l, s]) => (
                <div key={l} className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0"><span className="text-slate-500">{l}</span><StatusBadge status={s} /></div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

export function ProfilePage({ user, roleLabel = 'Procurement Manager' }) {
  const [f, setF] = useState({
    name: user?.name || 'Rohit Kumar', email: user?.email || 'rohit@apexplastics.in',
    phone: '+91 98450 12345', designation: roleLabel, department: 'Procurement', language: 'English',
    timezone: 'IST (UTC+5:30)',
  })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center">
        <div className="relative">
          {user?.picture
            ? <img src={user.picture} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[#142D4E] to-[#007F78] text-[26px] font-bold text-white">{(f.name || 'U').slice(0, 2).toUpperCase()}</div>}
          <button className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow"><Camera className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 text-[19px] font-bold text-[#142D4E]">{f.name}</div>
        <div className="text-[13px] text-slate-400">{f.designation}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-[12.5px] text-slate-500">
          <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-slate-400" /> {f.email}</span>
          <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-slate-400" /> {f.phone}</span>
        </div>
      </div>
      <Panel title="Personal details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Full name" value={f.name} onChange={(v) => set('name', v)} />
          <TextField label="Email" value={f.email} onChange={(v) => set('email', v)} type="email" />
          <TextField label="Phone" value={f.phone} onChange={(v) => set('phone', v)} />
          <TextField label="Designation" value={f.designation} onChange={(v) => set('designation', v)} />
          <SelectField label="Department" value={f.department} onChange={(v) => set('department', v)} options={['Procurement', 'Finance', 'Operations', 'Management', 'Stores']} />
          <SelectField label="Preferred language" value={f.language} onChange={(v) => set('language', v)} options={['English', 'Hindi', 'Kannada', 'Marathi', 'Gujarati', 'Tamil']} />
          <SelectField label="Timezone" value={f.timezone} onChange={(v) => set('timezone', v)} options={['IST (UTC+5:30)']} />
        </div>
        <button onClick={() => toast.success('Profile updated')} className="mt-5 flex items-center gap-1.5 rounded-lg bg-[#007F78] px-5 py-2.5 text-[13px] font-semibold text-white"><Save className="h-4 w-4" /> Save profile</button>
      </Panel>
    </div>
  )
}
