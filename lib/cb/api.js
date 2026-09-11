// ClusterBuy client helpers, formatters and design tokens

export const CB = {
  navy: '#142D4E',
  teal: '#007F78',
  orange: '#F59E0B',
  surface: '#E6EDF3',
}

export async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok && res.status !== 401) {
    let msg = 'Request failed'
    try { const j = await res.json(); msg = j.error || msg } catch (e) {}
    throw new Error(msg)
  }
  return res.json()
}

export const inr = (n) => {
  if (n == null || isNaN(n)) return '\u20B90'
  return '\u20B9' + Number(n).toLocaleString('en-IN')
}
export const inrShort = (n) => {
  if (n == null) return '\u20B90'
  if (n >= 10000000) return '\u20B9' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '\u20B9' + (n / 100000).toFixed(2) + ' L'
  if (n >= 1000) return '\u20B9' + (n / 1000).toFixed(1) + 'K'
  return '\u20B9' + n
}

// Status -> tailwind class buckets. Returns {cls} for badge styling.
const GREEN = 'bg-emerald-50 text-emerald-700 border-emerald-200'
const AMBER = 'bg-amber-50 text-amber-700 border-amber-200'
const RED = 'bg-red-50 text-red-700 border-red-200'
const BLUE = 'bg-blue-50 text-blue-700 border-blue-200'
const TEAL = 'bg-teal-50 text-teal-700 border-teal-200'
const GRAY = 'bg-slate-100 text-slate-600 border-slate-200'

const MAP = {
  // generic good
  'Available': GREEN, 'Delivered': GREEN, 'Completed': GREEN, 'Paid': GREEN, 'Pass': GREEN,
  'QC_PASSED': GREEN, 'ACCEPTED': GREEN, 'COMPLETED': GREEN, 'Buyer paid': GREEN, 'Active': GREEN,
  'Won': GREEN, 'Verified': GREEN, 'Approved': GREEN, 'PASS': GREEN, 'Low': GREEN,
  // teal / in-progress
  'Allocated': TEAL, 'In pooling': TEAL, 'Pooling': TEAL, 'POOLING': TEAL, 'Confirmed': TEAL,
  'Order confirmed': TEAL, 'Live': TEAL, 'Dispatched': TEAL, 'Ready for dispatch': TEAL,
  // blue / info
  'Submitted': BLUE, 'Matching': BLUE, 'Supplier bidding': BLUE, 'BIDDING': BLUE, 'In transit': BLUE,
  'IN_TRANSIT_TO_HUB': BLUE, 'IN_TRANSIT_TO_BUYER': BLUE, 'Scheduled': BLUE, 'Quotes received': BLUE,
  'Expected': BLUE, 'Receiving': BLUE, 'Under review': BLUE, 'Info': BLUE, 'OUTBOUND_DISPATCHED': BLUE,
  'SUPPLIER_DISPATCHED': BLUE, 'HUB_RECEIVED': BLUE, 'INVENTORY_AVAILABLE': GREEN,
  // amber / warning
  'QC pending': AMBER, 'QC_PENDING': AMBER, 'Quality hold': AMBER, 'Quarantine': AMBER, 'Draft': GRAY,
  'Payment pending': AMBER, 'Pending': AMBER, 'On hold': AMBER, 'Partial hold': AMBER, 'Medium': AMBER,
  'PAYMENT_PENDING': AMBER, 'Follow up': AMBER, 'Open': AMBER, 'Upcoming': GRAY, 'Planning': GRAY,
  'Waiting': AMBER, 'Settlement held': RED,
  // red / bad
  'Fail': RED, 'QC_FAILED': RED, 'Failed': RED, 'Lost': RED, 'High': RED, 'Missing': RED, 'Delayed': RED,
  'Delivery exception': RED, 'Cancelled': RED, 'Disputed': RED,
}

export function statusCls(status) {
  return MAP[status] || GRAY
}

export const prettyState = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
