'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// City / cluster coordinate lookup (approx). Used to place hub + buyer on the map.
export const GEO = {
  'Peenya, Bengaluru': [13.0287, 77.5199], 'Bommasandra, Bengaluru': [12.8060, 77.6990],
  'Bhiwandi, Maharashtra': [19.2967, 73.0631], 'Chakan, Pune': [18.7606, 73.8637],
  'Sanand, Gujarat': [22.9880, 72.3820], WH01: [13.0287, 77.5199], WH02: [12.8060, 77.6990],
  WH03: [19.2967, 73.0631], Bengaluru: [12.9716, 77.5946], Pune: [18.5204, 73.8567],
  Mumbai: [19.0760, 72.8777], Ahmedabad: [23.0225, 72.5714],
}

function coordFor(key, fallback = [12.9716, 77.5946]) {
  if (!key) return fallback
  if (GEO[key]) return GEO[key]
  const hit = Object.keys(GEO).find((k) => key.includes(k) || k.includes(key))
  return hit ? GEO[hit] : fallback
}

export function greatCircleKm(a, b) {
  const rad = x => x * Math.PI / 180
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

const hubIcon = L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  html: `<div style="width:26px;height:26px;border-radius:8px;background:#142D4E;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg></div>` })
const destIcon = L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 26],
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#007F78;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>` })
const truckIcon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:50%;background:#F59E0B;display:grid;place-items:center;box-shadow:0 0 0 6px rgba(245,158,11,.25),0 2px 8px rgba(0,0,0,.35)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/></svg></div>` })

function FitRoute({ from, to }) {
  const map = useMap()
  useEffect(() => { map.fitBounds([from, to], { padding: [45, 45] }) }, [map, from, to])
  return null
}

export default function LiveMap({ fromKey, toKey, fromCoordinates, toCoordinates, distanceKm, etaAt, progress = 0.4, live = false, delivered = false, height = 300 }) {
  const from = useMemo(() => fromCoordinates || coordFor(fromKey), [fromKey, fromCoordinates])
  const to = useMemo(() => toCoordinates || coordFor(toKey, [12.9716, 77.7]), [toKey, toCoordinates])
  const [t, setT] = useState(Math.min(1, Math.max(0, progress)))
  const [clock, setClock] = useState(Date.now())
  const [mapId] = useState(() => 'map-' + Math.random().toString(36).slice(2))

  // Ease toward target; when live, slowly creep forward to feel "in motion".
  useEffect(() => {
    setT(Math.min(1, Math.max(0, progress)))
    let target = Math.min(1, Math.max(0, progress))
    const id = setInterval(() => {
      setT((cur) => {
        if (live && target < 0.95) target = Math.min(0.95, target + 0.004)
        const next = cur + (target - cur) * 0.12
        return Math.abs(target - next) < 0.001 ? target : next
      })
    }, 700)
    return () => clearInterval(id)
  }, [progress, live])

  useEffect(() => {
    setClock(Date.now())
    if (!live) return
    const id = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(id)
  }, [etaAt, live, fromKey, toKey])

  const pos = lerp(from, to, t)
  const routeKm = Number(distanceKm) > 0 ? Number(distanceKm) : greatCircleKm(from, to)
  const remainingKm = delivered ? 0 : Math.max(0, routeKm * (1 - t))
  // If an explicit ETA is unavailable, estimate at a conservative inter-city speed of 35 km/h.
  const secondsLeft = delivered ? 0 : etaAt ? Math.max(0, Math.ceil((new Date(etaAt).getTime() - clock) / 1000)) : Math.ceil(remainingKm / 35 * 3600)
  const etaLabel = delivered || secondsLeft <= 0 ? 'Arrived' : `${String(Math.floor(secondsLeft / 3600)).padStart(2, '0')}:${String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer center={pos} zoom={9} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRoute from={from} to={to} />
        <Polyline positions={[from, to]} pathOptions={{ color: '#cbd5e1', weight: 4, dashArray: '2 8' }} />
        <Polyline positions={[from, pos]} pathOptions={{ color: '#007F78', weight: 4 }} />
        <Marker position={from} icon={hubIcon} />
        <Marker position={to} icon={destIcon} />
        <Marker position={pos} icon={truckIcon} />
      </MapContainer>
      <div data-testid="route-metrics" className="absolute bottom-3 left-3 z-[500] flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-md">
        <div className="px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Distance to go</div><div className="font-mono text-sm font-bold tabular-nums text-[#142D4E]">{remainingKm.toFixed(1)} km</div></div>
        <div className="border-l border-slate-200 px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">ETA countdown</div><div className="font-mono text-sm font-bold tabular-nums text-[#007F78]">{etaLabel}</div></div>
        <div className="border-l border-slate-200 px-2 py-2 text-[10px] text-slate-400">{distanceKm ? 'Route estimate' : 'Straight-line estimate'}</div>
      </div>
    </div>
  )
}
