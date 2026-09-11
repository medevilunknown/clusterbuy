'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/cb/api'
import Landing from '@/components/cb/Landing'
import BuyerApp from '@/components/cb/BuyerApp'
import SellerApp from '@/components/cb/SellerApp'
import OpsApp from '@/components/cb/OpsApp'
import AdminApp from '@/components/cb/AdminApp'
import { Boxes } from 'lucide-react'

const ROLE_LABELS = { BUYER: 'Buyer', SELLER: 'Seller', WAREHOUSE_OPERATOR: 'Warehouse', ADMIN: 'Admin' }

function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('BUYER')
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  const ensureSeed = async () => {
    try {
      const orders = await api('/orders')
      if (!orders || orders.length === 0) await api('/seed', { method: 'POST' })
    } catch (e) { try { await api('/seed', { method: 'POST' }) } catch (_) {} }
  }

  useEffect(() => {
    (async () => {
      await ensureSeed()
      // Handle Emergent auth redirect (session_id in URL fragment)
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const m = hash.match(/session_id=([^&]+)/)
      if (m) {
        try {
          const res = await api('/auth/session', { method: 'POST', headers: { 'X-Session-ID': m[1] } })
          if (res.user) { setUser(res.user); setRole(res.user.role || 'BUYER') }
        } catch (e) {}
        window.history.replaceState(null, '', window.location.pathname)
        setLoading(false)
        return
      }
      try {
        const res = await api('/auth/me')
        if (res.user) { setUser(res.user); setRole(res.user.role || 'BUYER') }
      } catch (e) {}
      setLoading(false)
    })()
  }, [])

  const signIn = () => {
    setSigningIn(true)
    const redirect = window.location.origin + '/'
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`
  }

  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch (e) {}
    setUser(null)
  }

  const switchRole = async (r) => {
    setRole(r)
    try { await api('/auth/role', { method: 'POST', body: JSON.stringify({ role: r }) }) } catch (e) {}
  }

  if (loading) return (
    <div className="grid h-screen place-items-center bg-[#E6EDF3]/40">
      <div className="flex flex-col items-center gap-3">
        <div className="grid h-12 w-12 animate-pulse place-items-center rounded-xl bg-[#007F78] text-white"><Boxes className="h-6 w-6" /></div>
        <div className="text-[13px] font-medium text-slate-400">Loading ClusterBuy...</div>
      </div>
    </div>
  )

  if (!user) return <Landing onSignIn={signIn} loading={signingIn} />

  const roleSwitcher = (
    <div className="border-b border-slate-100 pb-1">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Demo: view as</div>
      {Object.entries(ROLE_LABELS).map(([r, label]) => (
        <button key={r} onClick={() => switchRole(r)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] ${role === r ? 'bg-[#007F78]/10 font-semibold text-[#007F78]' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
      ))}
    </div>
  )

  const props = { user, onLogout: logout, roleSwitcher }
  let AppComp = BuyerApp
  if (role === 'SELLER') AppComp = SellerApp
  else if (role === 'WAREHOUSE_OPERATOR' || role === 'LOGISTICS_MANAGER') AppComp = OpsApp
  else if (role === 'ADMIN' || role === 'SUPER_ADMIN') AppComp = AdminApp

  return (
    <>
      <AppComp key={role} {...props} />
      <FloatingSwitcher role={role} onSwitch={switchRole} />
    </>
  )
}

function FloatingSwitcher({ role, onSwitch }) {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1.5 py-1.5 shadow-lg backdrop-blur">
      <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Demo</span>
      {Object.entries(ROLE_LABELS).map(([r, label]) => (
        <button key={r} onClick={() => onSwitch(r)} className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${role === r ? 'bg-[#142D4E] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{label}</button>
      ))}
    </div>
  )
}

export default App
