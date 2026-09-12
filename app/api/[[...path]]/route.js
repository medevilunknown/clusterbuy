import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// MongoDB connection (reuse single client)
// ---------------------------------------------------------------------------
let client
let db
let connectingPromise

async function connectToMongo() {
  if (db) return db
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI
  if (!mongoUrl) {
    throw new Error('MongoDB is not configured. Add MONGO_URL (or MONGODB_URI) to .env.local.')
  }
  if (!connectingPromise) {
    client = new MongoClient(mongoUrl)
    connectingPromise = client.connect()
  }
  await connectingPromise
  db = client.db(process.env.DB_NAME || process.env.MONGO_DB_NAME || 'clusterbuy')
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

const json = (data, status = 200) => handleCORS(NextResponse.json(data, { status }))
const clean = (docs) => docs.map(({ _id, ...rest }) => rest)
const now = () => new Date().toISOString()
const remainingSeconds = (endsAt) => Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000))
const timeRemaining = (endsAt) => {
  const seconds = remainingSeconds(endsAt)
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  return h ? [h, m, s].map(x => String(x).padStart(2, '0')).join(':') : [m, s].map(x => String(x).padStart(2, '0')).join(':')
}
const withAuctionClock = (doc) => doc ? { ...doc, time_remaining: doc.ends_at ? timeRemaining(doc.ends_at) : doc.time_remaining } : doc
const durationSeconds = (value) => {
  const parts = String(value || '').split(':').map(Number)
  if (parts.some(x => !Number.isFinite(x))) return 0
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : (parts[0] || 0) * 60 + (parts[1] || 0)
}

// ---------------------------------------------------------------------------
// Emergent managed Google sign-in
// ---------------------------------------------------------------------------
const EMERGENT_SESSION_URL = 'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data'

async function getSessionUser(request, database) {
  // cookie or bearer
  let token = null
  const cookie = request.headers.get('cookie') || ''
  const m = cookie.match(/session_token=([^;]+)/)
  if (m) token = decodeURIComponent(m[1])
  const auth = request.headers.get('authorization') || ''
  if (!token && auth.startsWith('Bearer ')) token = auth.slice(7)
  if (!token) return null
  const session = await database.collection('sessions').findOne({ session_token: token })
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null
  const user = await database.collection('users').findOne({ id: session.user_id })
  return user || null
}

// ---------------------------------------------------------------------------
// Order lifecycle state machine
// ---------------------------------------------------------------------------
const ORDER_FLOW = [
  'PO_CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'SUPPLIER_PREPARING',
  'SUPPLIER_DISPATCHED', 'IN_TRANSIT_TO_HUB', 'HUB_RECEIVED', 'QC_PENDING',
  'QC_PASSED', 'INVENTORY_AVAILABLE', 'ALLOCATED', 'OUTBOUND_PLANNING',
  'OUTBOUND_DISPATCHED', 'IN_TRANSIT_TO_BUYER', 'DELIVERED', 'ACCEPTED',
  'SETTLEMENT_PENDING', 'COMPLETED'
]

function nextState(state) {
  const i = ORDER_FLOW.indexOf(state)
  if (i < 0 || i >= ORDER_FLOW.length - 1) return null
  return ORDER_FLOW[i + 1]
}

// Apply side-effects to linked entities when an order advances
async function applySideEffects(database, order, target) {
  const ordersC = database.collection('orders')
  const lotsC = database.collection('inventory_lots')
  const shipsC = database.collection('shipments')
  const inspC = database.collection('inspections')
  const settleC = database.collection('settlements')
  const notifC = database.collection('notifications')

  const pushNotif = async (role, title) => {
    await notifC.insertOne({ id: uuidv4(), role, title, order: order.order_no, read: false, created_at: now() })
  }

  if (target === 'SUPPLIER_DISPATCHED') {
    await shipsC.updateOne({ id: order.inbound_shipment_id }, { $set: { status: 'In transit', updated_at: now() } })
    await pushNotif('WAREHOUSE_OPERATOR', `Inbound shipment for ${order.order_no} dispatched by ${order.supplier}`)
  }
  if (target === 'HUB_RECEIVED') {
    await shipsC.updateOne({ id: order.inbound_shipment_id }, { $set: { status: 'Delivered', updated_at: now() } })
    await lotsC.updateOne({ id: order.lot_id }, { $set: { status: 'QC pending', received_qty: order.quantity, updated_at: now() } })
    await inspC.updateOne({ id: order.inspection_id }, { $set: { status: 'Pending', updated_at: now() } })
    await pushNotif('WAREHOUSE_OPERATOR', `QC task created for lot ${order.lot_no}`)
  }
  if (target === 'QC_PASSED') {
    await lotsC.updateOne({ id: order.lot_id }, { $set: { status: 'Available', available_qty: order.quantity, updated_at: now() } })
    await inspC.updateOne({ id: order.inspection_id }, { $set: { status: 'Pass', decision: 'PASS', updated_at: now() } })
    await pushNotif('BUYER', `Your material for ${order.order_no} passed quality inspection`)
  }
  if (target === 'ALLOCATED') {
    await lotsC.updateOne({ id: order.lot_id }, { $set: { status: 'Allocated', allocated_qty: order.quantity, buyer_allocation: order.buyer, updated_at: now() } })
  }
  if (target === 'OUTBOUND_DISPATCHED') {
    await shipsC.updateOne({ id: order.outbound_shipment_id }, { $set: { status: 'Dispatched', progress: 0.08, eta_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString(), updated_at: now() } })
    await lotsC.updateOne({ id: order.lot_id }, { $set: { status: 'Dispatched', updated_at: now() } })
    await pushNotif('BUYER', `Shipment for ${order.order_no} dispatched from hub`)
  }
  if (target === 'DELIVERED') {
    await shipsC.updateOne({ id: order.outbound_shipment_id }, { $set: { status: 'Delivered', pod: true, progress: 1, eta_at: now(), updated_at: now() } })
  }
  if (target === 'ACCEPTED' || target === 'SETTLEMENT_PENDING') {
    await settleC.updateOne({ id: order.settlement_id }, { $set: { status: 'Approved', updated_at: now() } })
    await pushNotif('SELLER', `Settlement approved for ${order.order_no}`)
  }
  if (target === 'COMPLETED') {
    await settleC.updateOne({ id: order.settlement_id }, { $set: { status: 'Paid', updated_at: now() } })
  }
}

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------
const CLUSTERS = ['Peenya, Bengaluru', 'Bommasandra, Bengaluru', 'Bhiwandi, Maharashtra', 'Chakan, Pune', 'Sanand, Gujarat']
const MATERIALS = ['PP Grade X', 'PP Grade Y', 'HDPE', 'LDPE', 'PET Resin', 'ABS', 'PVC']

async function seed(database) {
  const collections = ['companies', 'warehouses', 'materials', 'demands', 'pools', 'quotes',
    'auctions', 'orders', 'inventory_lots', 'shipments', 'inspections', 'allocations',
    'settlements', 'disputes', 'notifications', 'action_queue']
  for (const c of collections) await database.collection(c).deleteMany({})

  // Companies -----------------------------------------------------------------
  const buyerNames = ['Apex Plastics Pvt. Ltd.', 'Beta Components Pvt. Ltd.', 'Gamma Packaging',
    'Venkateshwara Plastics', 'Metro Auto Parts', 'Sunrise Polymers', 'Deccan Moulders',
    'Kaveri Plastics', 'Nandi Industries', 'Prime Components']
  const sellerNames = ['Shakti Polymers', 'Bharat Resins', 'Delta Materials', 'Star Polymers',
    'Mahadev Polymers', 'Ganga Chemicals']

  const buyers = buyerNames.map((name, i) => ({
    id: uuidv4(), type: 'BUYER', name,
    gstin: `29AAECS${1000 + i}F1Z${i % 9}`,
    cluster: CLUSTERS[i % CLUSTERS.length],
    open_orders: (i % 4) + 1,
    lifetime_purchase: 1200000 + i * 340000,
    payment_risk: ['Low', 'Low', 'Medium', 'Low', 'High'][i % 5],
    status: 'Active', created_at: now(), updated_at: now(),
  }))
  const sellers = sellerNames.map((name, i) => ({
    id: uuidv4(), type: 'SELLER', name,
    gstin: `27AABCS${2000 + i}G1Z${i % 9}`,
    products: MATERIALS.slice(0, 3 + (i % 3)),
    regions: CLUSTERS.slice(0, 2 + (i % 2)),
    capacity: 200 + i * 40,
    win_rate: 40 + (i * 7) % 45,
    on_time: 88 + (i % 10),
    qc_pass: 90 + (i % 8),
    rating: (4 + (i % 10) / 10).toFixed(1),
    outstanding_settlement: 200000 + i * 90000,
    score: { price: 70 + i % 25, reliability: 75 + i % 20, quality: 80 + i % 15, delivery: 78 + i % 18, disputes: 5 + i % 8 },
    status: 'Active', created_at: now(), updated_at: now(),
  }))
  await database.collection('companies').insertMany([...buyers, ...sellers])

  // Warehouses + zones --------------------------------------------------------
  const warehouses = [
    { id: uuidv4(), code: 'WH01', name: 'Peenya', city: 'Bengaluru', capacity: 40, used: 25 },
    { id: uuidv4(), code: 'WH02', name: 'Bommasandra', city: 'Bengaluru', capacity: 60, used: 22 },
    { id: uuidv4(), code: 'WH03', name: 'Bhiwandi', city: 'Maharashtra', capacity: 80, used: 41 },
  ].map(w => ({
    ...w, status: 'Active', created_at: now(), updated_at: now(),
    zones: [
      { zone: 'A1', capacity: 5, used: 5, state: 'Allocated' },
      { zone: 'A2', capacity: 5, used: 5, state: 'Allocated' },
      { zone: 'B1', capacity: 10, used: 10, state: 'Available' },
      { zone: 'B2', capacity: 10, used: 0, state: 'Free' },
      { zone: 'Q1', capacity: 5, used: 5, state: 'Quality Hold' },
      { zone: 'R1', capacity: 5, used: 0, state: 'Reserved' },
    ],
  }))
  await database.collection('warehouses').insertMany(warehouses)
  const wh01 = warehouses[0]

  // Materials -----------------------------------------------------------------
  await database.collection('materials').insertMany(MATERIALS.map((m, i) => ({
    id: uuidv4(), name: m, category: 'Polymers',
    grades: ['A', 'B', 'C'], base_price: 70 + i * 4,
    status: 'Active', created_at: now(), updated_at: now(),
  })))

  // Demands -------------------------------------------------------------------
  const demandStatuses = ['Draft', 'Submitted', 'Matching', 'Pooling', 'Supplier bidding', 'Quotes received', 'Order confirmed', 'In transit', 'At warehouse', 'Delivered']
  const demands = []
  for (let i = 0; i < 12; i++) {
    const b = buyers[i % buyers.length]
    demands.push({
      id: uuidv4(), demand_no: `DEM-${1024 + i}`,
      buyer_id: b.id, buyer: b.name,
      material: MATERIALS[i % MATERIALS.length], grade: ['X', 'Y', 'F'][i % 3],
      quantity: 3 + (i % 8), unit: 'tonnes',
      required_date: `2025-0${6 + (i % 3)}-${10 + i}`,
      cluster: b.cluster, pool_no: i < 8 ? `POOL-${9082 + (i % 4)}` : '—',
      status: demandStatuses[i % demandStatuses.length],
      quotes: i % 5,
      created_at: now(), updated_at: now(),
    })
  }
  await database.collection('demands').insertMany(demands)

  // Pools ---------------------------------------------------------------------
  const pools = []
  for (let i = 0; i < 4; i++) {
    const target = [40, 60, 25, 50][i]
    const filled = [32, 45, 25, 18][i]
    pools.push({
      id: uuidv4(), pool_no: `POOL-${9082 + i}`,
      material: MATERIALS[i], grade: ['X', 'Y', 'F', 'X'][i],
      target_qty: target, pooled_qty: filled,
      cluster: CLUSTERS[i % CLUSTERS.length], hub: warehouses[i % 3].code,
      participants: 4 + i * 2,
      closing_date: `2025-06-${18 + i}`, auction_date: `2025-06-${20 + i}`,
      fill_pct: Math.round((filled / target) * 100),
      status: ['Pooling', 'Supplier bidding', 'Order confirmed', 'Matching'][i],
      your_qty: 5, est_individual: 88, est_pooled: 81,
      created_at: now(), updated_at: now(),
      timeline: [
        { step: 'Demand collected', done: true },
        { step: 'Pool threshold reached', done: filled >= target },
        { step: 'Supplier bidding', done: i >= 1 },
        { step: 'Supplier shortlisted', done: i >= 2 },
        { step: 'Order confirmed', done: i >= 2 },
        { step: 'Goods dispatched', done: false },
        { step: 'Quality check', done: false },
        { step: 'Distribution', done: false },
      ],
    })
  }
  await database.collection('pools').insertMany(pools)

  // Quotes (for pool 0) -------------------------------------------------------
  const quotes = sellers.slice(0, 4).map((s, i) => {
    const material = 74 - i * 2, freight = 3 + i, handling = 2, fee = 1
    return {
      id: uuidv4(), pool_id: pools[0].id, pool_no: pools[0].pool_no,
      supplier_id: s.id, supplier: s.name,
      material_price: material, freight, handling, platform_fee: fee,
      landed_cost: material + freight + handling + fee,
      lead_time: 7 + i * 2, moq: 5, payment_terms: ['30 days', 'Advance', '45 days', '15 days'][i],
      rating: s.rating, quality_score: 90 + i,
      created_at: now(), updated_at: now(),
    }
  })
  await database.collection('quotes').insertMany(quotes)

  // Auctions ------------------------------------------------------------------
  const auctions = []
  for (let i = 0; i < 3; i++) {
    const startBid = 90 - i * 3
    auctions.push({
      id: uuidv4(), auction_no: `AUC-${501 + i}`,
      pool_no: pools[i].pool_no, material: pools[i].material,
      quantity: pools[i].target_qty, hub: warehouses[i % 3].code, cluster: pools[i].cluster,
      status: ['Live', 'Scheduled', 'Live'][i],
      ends_at: new Date(Date.now() + [272, 86400, 70][i] * 1000).toISOString(),
      time_remaining: ['04:32', '—', '01:10'][i],
      current_bid: startBid - 6, your_bid: startBid - 6, your_rank: 2,
      decrement: 1,
      bids: [
        { time: '09:52', bid: startBid - 6, change: '—', rank: 2 },
        { time: '09:48', bid: startBid - 4, change: '-2', rank: 3 },
        { time: '09:41', bid: startBid - 2, change: '-2', rank: 3 },
        { time: '09:32', bid: startBid, change: '-2', rank: 4 },
      ],
      created_at: now(), updated_at: now(),
    })
  }
  await database.collection('auctions').insertMany(auctions)

  // Orders + linked lots/shipments/inspections/settlements --------------------
  // Each order is placed at a different lifecycle stage to show the connected chain.
  const orderStates = [
    'SUPPLIER_DISPATCHED', 'HUB_RECEIVED', 'QC_PENDING', 'QC_PASSED',
    'INVENTORY_AVAILABLE', 'ALLOCATED', 'OUTBOUND_DISPATCHED', 'IN_TRANSIT_TO_BUYER',
    'DELIVERED', 'COMPLETED',
  ]
  const orders = [], lots = [], shipments = [], inspections = [], settlements = []
  for (let i = 0; i < 10; i++) {
    const b = buyers[i % buyers.length]
    const s = sellers[i % sellers.length]
    const wh = warehouses[i % 3]
    const material = MATERIALS[i % MATERIALS.length]
    const qty = 5 + (i % 3) * 5
    const state = orderStates[i]
    const stateIdx = ORDER_FLOW.indexOf(state)

    const lotId = uuidv4(), inId = uuidv4(), outId = uuidv4(), inspId = uuidv4(), settId = uuidv4()
    const orderId = uuidv4()
    const orderNo = `CB-${1042 + i}`
    const lotNo = `L${101 + i}`

    const matPrice = 80, inHub = 3, handling = 1, inspection = 1, toBuyer = 2, fee = 1
    const gst = Math.round((matPrice + inHub + handling + inspection + toBuyer + fee) * 0.18)

    // lot status derived from order state
    let lotStatus = 'Expected'
    if (stateIdx >= ORDER_FLOW.indexOf('HUB_RECEIVED')) lotStatus = 'QC pending'
    if (stateIdx >= ORDER_FLOW.indexOf('QC_PASSED')) lotStatus = 'Available'
    if (stateIdx >= ORDER_FLOW.indexOf('ALLOCATED')) lotStatus = 'Allocated'
    if (stateIdx >= ORDER_FLOW.indexOf('OUTBOUND_DISPATCHED')) lotStatus = 'Dispatched'
    if (state === 'QC_FAILED') lotStatus = 'Quality hold'

    lots.push({
      id: lotId, lot_no: lotNo, order_id: orderId, order_no: orderNo,
      material, grade: 'X', supplier: s.name, supplier_id: s.id,
      original_qty: qty, received_qty: stateIdx >= ORDER_FLOW.indexOf('HUB_RECEIVED') ? qty : 0,
      available_qty: stateIdx >= ORDER_FLOW.indexOf('QC_PASSED') ? qty : 0,
      allocated_qty: stateIdx >= ORDER_FLOW.indexOf('ALLOCATED') ? qty : 0,
      warehouse: wh.code, zone: ['A1', 'A2', 'B1', 'Q1'][i % 4], rack: `R${i + 1}`,
      buyer_allocation: stateIdx >= ORDER_FLOW.indexOf('ALLOCATED') ? b.name : null,
      status: lotStatus, received_time: now(), created_at: now(), updated_at: now(),
    })

    shipments.push({
      id: inId, shipment_no: `IN-${21 + i}`, direction: 'inbound', order_id: orderId, order_no: orderNo,
      from: s.name, to: wh.code, material, quantity: qty,
      vehicle: `KA01 AB${1234 + i}`, driver: 'Ravi Kumar', driver_phone: '98450 00000',
      status: stateIdx >= ORDER_FLOW.indexOf('HUB_RECEIVED') ? 'Delivered' : (stateIdx >= ORDER_FLOW.indexOf('SUPPLIER_DISPATCHED') ? 'In transit' : 'Planning'),
      eta: '14:30', pod: false, created_at: now(), updated_at: now(),
    })
    shipments.push({
      id: outId, shipment_no: `OUT-${18 + i}`, direction: 'outbound', order_id: orderId, order_no: orderNo,
      from: wh.code, to: b.name, material, quantity: qty,
      vehicle: `KA05 CX${4321 + i}`, driver: 'Suresh M', driver_phone: '99000 11111',
      status: stateIdx >= ORDER_FLOW.indexOf('DELIVERED') ? 'Delivered' : (stateIdx >= ORDER_FLOW.indexOf('OUTBOUND_DISPATCHED') ? 'Dispatched' : 'Planning'),
      eta: '17:00', pod: stateIdx >= ORDER_FLOW.indexOf('DELIVERED'),
      buyer_cluster: b.cluster,
      from_coordinates: wh.code === 'WH01' ? [13.0287, 77.5199] : wh.code === 'WH02' ? [12.8060, 77.6990] : [19.2967, 73.0631],
      to_coordinates: b.cluster === 'Peenya, Bengaluru' ? [13.0287, 77.5199] : b.cluster === 'Bommasandra, Bengaluru' ? [12.8060, 77.6990] : b.cluster === 'Bhiwandi, Maharashtra' ? [19.2967, 73.0631] : b.cluster === 'Chakan, Pune' ? [18.7606, 73.8637] : [22.9880, 72.3820],
      distance_km: [18, 31, 22, 47, 36][i % 5],
      progress: stateIdx >= ORDER_FLOW.indexOf('DELIVERED') ? 1 : (stateIdx >= ORDER_FLOW.indexOf('OUTBOUND_DISPATCHED') ? 0.55 : 0),
      eta_at: stateIdx >= ORDER_FLOW.indexOf('DELIVERED') ? now() : new Date(Date.now() + (90 + i * 8) * 60000).toISOString(),
      created_at: now(), updated_at: now(),
    })

    inspections.push({
      id: inspId, lot_id: lotId, lot_no: lotNo, order_no: orderNo,
      material, supplier: s.name, warehouse: wh.code,
      status: stateIdx >= ORDER_FLOW.indexOf('QC_PASSED') ? 'Pass' : (stateIdx >= ORDER_FLOW.indexOf('HUB_RECEIVED') ? 'Pending' : 'Not started'),
      decision: stateIdx >= ORDER_FLOW.indexOf('QC_PASSED') ? 'PASS' : null,
      checklist: { grade: true, weight: true, packaging: true, moisture: false, contamination: false },
      created_at: now(), updated_at: now(),
    })

    let settStatus = 'Pending'
    if (stateIdx >= ORDER_FLOW.indexOf('QC_PASSED')) settStatus = 'On hold'
    if (stateIdx >= ORDER_FLOW.indexOf('DELIVERED')) settStatus = 'Approved'
    if (state === 'COMPLETED') settStatus = 'Paid'
    settlements.push({
      id: settId, order_id: orderId, order_no: orderNo, supplier: s.name, supplier_id: s.id,
      order_value: matPrice * qty * 1000, platform_deduction: 8000, logistics_deduction: 12000,
      tds: 5000, net: matPrice * qty * 1000 - 25000,
      status: settStatus, expected_date: '2025-07-05', created_at: now(), updated_at: now(),
    })

    const paymentStatus = ['Buyer paid', 'Buyer paid', 'Payment pending', 'Buyer paid', 'Buyer paid',
      'Buyer paid', 'Buyer paid', 'Buyer paid', 'Buyer paid', 'Buyer paid'][i]

    orders.push({
      id: orderId, order_no: orderNo, state,
      buyer_id: b.id, buyer: b.name, buyer_cluster: b.cluster,
      supplier_id: s.id, supplier: s.name,
      material, grade: 'X', quantity: qty, unit: 'tonnes',
      warehouse: wh.code, pool_no: pools[i % 4].pool_no,
      payment_status: paymentStatus,
      lot_id: lotId, lot_no: lotNo, inbound_shipment_id: inId, outbound_shipment_id: outId,
      inspection_id: inspId, settlement_id: settId,
      cost: { material: matPrice, in_hub: inHub, handling, inspection, to_buyer: toBuyer, platform_fee: fee, gst,
        total: matPrice + inHub + handling + inspection + toBuyer + fee + gst },
      documents: [
        { type: 'PO', status: 'Verified' }, { type: 'Invoice', status: stateIdx >= ORDER_FLOW.indexOf('SUPPLIER_DISPATCHED') ? 'Verified' : 'Missing' },
        { type: 'E-way bill', status: stateIdx >= ORDER_FLOW.indexOf('SUPPLIER_DISPATCHED') ? 'Verified' : 'Missing' },
        { type: 'Inspection report', status: stateIdx >= ORDER_FLOW.indexOf('QC_PASSED') ? 'Verified' : 'Pending' },
        { type: 'POD', status: stateIdx >= ORDER_FLOW.indexOf('DELIVERED') ? 'Verified' : 'Pending' },
      ],
      timeline: ORDER_FLOW.slice(0, stateIdx + 1).map(st => ({ step: st, done: true, at: now() })),
      created_at: now(), updated_at: now(),
    })
  }
  await database.collection('orders').insertMany(orders)
  await database.collection('inventory_lots').insertMany(lots)
  await database.collection('shipments').insertMany(shipments)
  await database.collection('inspections').insertMany(inspections)
  await database.collection('settlements').insertMany(settlements)

  // Disputes ------------------------------------------------------------------
  await database.collection('disputes').insertMany([
    { id: uuidv4(), case_no: 'CB-D018', order_no: 'CB-1044', material: 'PP Grade X',
      title: 'Hidden defect in supplied material', disputed_qty: 500, payment_state: 'Partial hold',
      status: 'Open', created_at: now(), updated_at: now() },
    { id: uuidv4(), case_no: 'CB-D019', order_no: 'CB-1043', material: 'HDPE',
      title: 'Short delivery at hub', disputed_qty: 200, payment_state: 'On hold',
      status: 'Under review', created_at: now(), updated_at: now() },
  ])

  // Action queue (admin) ------------------------------------------------------
  await database.collection('action_queue').insertMany([
    { id: uuidv4(), type: 'Pool below threshold', details: 'LDPE pool 32/50 tonnes', age: '2 hrs', priority: 'High', assigned: 'Ops', created_at: now() },
    { id: uuidv4(), type: 'Supplier failed quality', details: 'Mahadev Polymers QC fail', age: '5 hrs', priority: 'High', assigned: 'QC', created_at: now() },
    { id: uuidv4(), type: 'Delivery delayed', details: 'CB-991 from Bhiwandi', age: '1 day', priority: 'Medium', assigned: 'Logistics', created_at: now() },
    { id: uuidv4(), type: 'Dispute raised', details: 'CB-D018 hidden defect', age: '1 day', priority: 'Medium', assigned: 'Ops', created_at: now() },
    { id: uuidv4(), type: 'Invoice missing', details: 'CB-1048 not uploaded', age: '1 day', priority: 'Low', assigned: 'Finance', created_at: now() },
    { id: uuidv4(), type: 'Buyer payment pending', details: 'CB-1044 payment pending', age: '3 hrs', priority: 'Medium', assigned: 'Finance', created_at: now() },
  ])

  // Notifications -------------------------------------------------------------
  await database.collection('notifications').insertMany([
    { id: uuidv4(), role: 'BUYER', title: 'Pool POOL-9082 reached 80% fill', order: 'POOL-9082', read: false, created_at: now() },
    { id: uuidv4(), role: 'SELLER', title: 'New auction AUC-501 is live', order: 'AUC-501', read: false, created_at: now() },
    { id: uuidv4(), role: 'WAREHOUSE_OPERATOR', title: 'Inbound IN-21 arriving today', order: 'IN-21', read: false, created_at: now() },
    { id: uuidv4(), role: 'ADMIN', title: '6 items need attention in action queue', order: '', read: false, created_at: now() },
  ])

  return { buyers: buyers.length, sellers: sellers.length, warehouses: warehouses.length, orders: orders.length }
}

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    // Gemini stays server-side: the browser never receives the API key.
    if (route === '/ai/material-suggestions' && method === 'POST') {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) return json({ error: 'AI suggestions are not configured. Add GEMINI_API_KEY to .env.local.' }, 503)
      const body = await request.json().catch(() => ({}))
      const material = String(body.material || '').slice(0, 120)
      const application = String(body.application || '').slice(0, 1200)
      if (!material || !application) return json({ error: 'Material and application are required for AI suggestions.' }, 400)
      const context = { material, grade: String(body.grade || '').slice(0, 120), application, brand: String(body.brand || '').slice(0, 120), quantity: String(body.quantity || '').slice(0, 40), unit: String(body.unit || '').slice(0, 40), specification: String(body.specification || '').slice(0, 300), certification: String(body.certification || '').slice(0, 120), packaging: String(body.packaging || '').slice(0, 120) }
      const prompt = `You are a procurement assistant for Indian MSMEs. Recommend a material grade and a concise, practical procurement specification. Do not make safety, regulatory, or food-contact compliance claims without telling the buyer to verify them with the supplier and applicable standards. Return only valid JSON with these string keys: recommended_material, recommended_grade, specification, certification, packaging, rationale, caution. Buyer context: ${JSON.stringify(context)}`
      const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      })
      if (!response.ok) {
        const detail = await response.text()
        console.error('Gemini material suggestion error:', response.status, detail)
        return json({ error: 'AI suggestions are temporarily unavailable.' }, 502)
      }
      const payload = await response.json()
      const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
      let suggestion
      try { suggestion = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '')) } catch { return json({ error: 'AI returned an unreadable recommendation. Please try again.' }, 502) }
      return json({
        recommended_material: String(suggestion.recommended_material || material).slice(0, 120),
        recommended_grade: String(suggestion.recommended_grade || context.grade).slice(0, 120),
        specification: String(suggestion.specification || '').slice(0, 300),
        certification: String(suggestion.certification || '').slice(0, 120),
        packaging: String(suggestion.packaging || '').slice(0, 120),
        rationale: String(suggestion.rationale || 'Review the supplier technical data sheet before issuing a purchase order.').slice(0, 700),
        caution: String(suggestion.caution || 'Confirm final specifications, certifications, and suitability with the supplier.').slice(0, 500),
      })
    }
    const database = await connectToMongo()

    if (route === '/' && method === 'GET') return json({ message: 'ClusterBuy API' })

    // ---- AUTH ----
    if (route === '/auth/session' && method === 'POST') {
      const sid = request.headers.get('x-session-id') || (await request.json().catch(() => ({}))).session_id
      if (!sid) return json({ error: 'session_id required' }, 400)
      const resp = await fetch(EMERGENT_SESSION_URL, { headers: { 'X-Session-ID': sid } })
      if (!resp.ok) return json({ error: 'invalid session' }, 401)
      const data = await resp.json()
      let user = await database.collection('users').findOne({ email: data.email })
      if (!user) {
        user = {
          id: uuidv4(), name: data.name, email: data.email, picture: data.picture,
          mobile: '', role: 'BUYER', company_id: null, status: 'Active',
          permissions: ['all'], created_at: now(), updated_at: now(),
        }
        await database.collection('users').insertOne(user)
      }
      const token = data.session_token || uuidv4()
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      await database.collection('sessions').insertOne({ id: uuidv4(), session_token: token, user_id: user.id, expires_at: expires, created_at: now() })
      const res = json({ user: (({ _id, ...r }) => r)(user) })
      res.cookies.set('session_token', token, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 7 * 24 * 3600 })
      return res
    }
    if (route === '/auth/me' && method === 'GET') {
      const user = await getSessionUser(request, database)
      if (!user) return json({ user: null }, 401)
      return json({ user: (({ _id, ...r }) => r)(user) })
    }
    if (route === '/auth/logout' && method === 'POST') {
      const cookie = request.headers.get('cookie') || ''
      const m = cookie.match(/session_token=([^;]+)/)
      if (m) await database.collection('sessions').deleteOne({ session_token: decodeURIComponent(m[1]) })
      const res = json({ ok: true })
      res.cookies.set('session_token', '', { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 })
      return res
    }
    if (route === '/auth/role' && method === 'POST') {
      const body = await request.json()
      const user = await getSessionUser(request, database)
      if (!user) return json({ error: 'unauthorized' }, 401)
      await database.collection('users').updateOne({ id: user.id }, { $set: { role: body.role, updated_at: now() } })
      return json({ ok: true, role: body.role })
    }

    // ---- SEED ----
    if (route === '/seed' && method === 'POST') {
      const stats = await seed(database)
      return json({ ok: true, stats })
    }

    // ---- GENERIC LIST endpoints ----
    const listMap = {
      '/companies': 'companies', '/warehouses': 'warehouses', '/materials': 'materials',
      '/demands': 'demands', '/pools': 'pools', '/auctions': 'auctions', '/orders': 'orders',
      '/inventory': 'inventory_lots', '/shipments': 'shipments', '/inspections': 'inspections',
      '/settlements': 'settlements', '/disputes': 'disputes', '/notifications': 'notifications',
      '/action-queue': 'action_queue',
    }
    if (listMap[route] && method === 'GET') {
      const url = new URL(request.url)
      const q = {}
      for (const [k, v] of url.searchParams.entries()) {
        if (k === 'type' || k === 'direction' || k === 'status' || k === 'role' || k === 'warehouse') q[k] = v
      }
      const docs = await database.collection(listMap[route]).find(q).limit(500).toArray()
      const result = clean(docs)
      return json(route === '/auctions' ? result.map(withAuctionClock) : result)
    }

    // buyers / sellers via companies
    if (route === '/buyers' && method === 'GET') {
      return json(clean(await database.collection('companies').find({ type: 'BUYER' }).toArray()))
    }
    if (route === '/sellers' && method === 'GET') {
      return json(clean(await database.collection('companies').find({ type: 'SELLER' }).toArray()))
    }
    if (route === '/opportunities' && method === 'GET') {
      // opportunities = pools open for bidding
      const pools = await database.collection('pools').find({}).toArray()
      return json(clean(pools))
    }

    // ---- SAVINGS (real, derived from a buyer's actual orders + pool ratios) ----
    if (route === '/savings' && method === 'GET') {
      const url = new URL(request.url)
      const user = await getSessionUser(request, database)
      let buyerId = url.searchParams.get('buyer_id') || url.searchParams.get('company_id') || user?.company_id
      if (!buyerId) buyerId = (await database.collection('companies').findOne({ type: 'BUYER', name: 'Apex Plastics Pvt. Ltd.' }))?.id
      if (!buyerId) return json({ error: 'Buyer identity could not be resolved' }, 400)
      const q = { buyer_id: buyerId }
      const orders = await database.collection('orders').find(q).toArray()
      const pools = await database.collection('pools').find({}).toArray()
      const ratioFor = (material) => {
        const p = pools.find((x) => x.material === material)
        if (p && p.est_pooled) return Math.max(1.05, p.est_individual / p.est_pooled)
        return 1.15
      }
      const rows = orders.map((o) => {
        const qtyKg = (o.quantity || 0) * 1000
        const pooledPerKg = o.cost?.total || 0
        const alonePerKg = Math.round(pooledPerKg * ratioFor(o.material))
        const aloneTotal = alonePerKg * qtyKg
        const pooledTotal = pooledPerKg * qtyKg
        return {
          order_no: o.order_no, material: o.material, grade: o.grade, qty: o.quantity,
          alone_per_kg: alonePerKg, pooled_per_kg: pooledPerKg,
          alone_total: aloneTotal, pooled_total: pooledTotal,
          saved: aloneTotal - pooledTotal,
          pct: alonePerKg ? Math.round(((alonePerKg - pooledPerKg) / alonePerKg) * 100) : 0,
        }
      })
      const totalAlone = rows.reduce((a, r) => a + r.alone_total, 0)
      const totalPooled = rows.reduce((a, r) => a + r.pooled_total, 0)
      const totalSaved = totalAlone - totalPooled
      return json({
        rows,
        totals: { alone: totalAlone, pooled: totalPooled, saved: totalSaved, pct: totalAlone ? Math.round((totalSaved / totalAlone) * 100) : 0 },
        buyer_id: buyerId,
        drivers: [['Volume discount', 62], ['Shared freight', 22], ['Lower platform fee', 9], ['Faster payment terms', 7]],
      })
    }

    // ---- DETAIL endpoints ----
    if (path[0] === 'pools' && path[1] && method === 'GET') {
      const doc = await database.collection('pools').findOne({ id: path[1] })
      if (!doc) return json({ error: 'not found' }, 404)
      return json((({ _id, ...r }) => r)(doc))
    }
    if (path[0] === 'quotes' && path[1] && method === 'GET') {
      // quotes by pool id
      const docs = await database.collection('quotes').find({ pool_id: path[1] }).toArray()
      return json(clean(docs))
    }
    if (path[0] === 'orders' && path[1] && !path[2] && method === 'GET') {
      const doc = await database.collection('orders').findOne({ id: path[1] })
      if (!doc) return json({ error: 'not found' }, 404)
      const lot = await database.collection('inventory_lots').findOne({ id: doc.lot_id })
      const inbound = await database.collection('shipments').findOne({ id: doc.inbound_shipment_id })
      const outbound = await database.collection('shipments').findOne({ id: doc.outbound_shipment_id })
      const settlement = await database.collection('settlements').findOne({ id: doc.settlement_id })
      return json({ ...(({ _id, ...r }) => r)(doc),
        lot: lot ? (({ _id, ...r }) => r)(lot) : null,
        inbound: inbound ? (({ _id, ...r }) => r)(inbound) : null,
        outbound: outbound ? (({ _id, ...r }) => r)(outbound) : null,
        settlement: settlement ? (({ _id, ...r }) => r)(settlement) : null })
    }
    if (path[0] === 'auctions' && path[1] && !path[2] && method === 'GET') {
      const doc = await database.collection('auctions').findOne({ id: path[1] })
      if (!doc) return json({ error: 'not found' }, 404)
      return json(withAuctionClock((({ _id, ...r }) => r)(doc)))
    }
    if (path[0] === 'shipments' && path[1] && method === 'GET') {
      const doc = await database.collection('shipments').findOne({ id: path[1] })
      if (!doc) return json({ error: 'not found' }, 404)
      // An inbound receipt is only useful when the operator can verify the
      // linked order, lot, and inspection in the same view.
      const order = doc.order_id ? await database.collection('orders').findOne({ id: doc.order_id }) : null
      const lot = order?.lot_id ? await database.collection('inventory_lots').findOne({ id: order.lot_id }) : null
      const inspection = order?.inspection_id ? await database.collection('inspections').findOne({ id: order.inspection_id }) : null
      const clean = ({ _id, ...r }) => r
      return json({ ...clean(doc), order: order ? clean(order) : null, lot: lot ? clean(lot) : null, inspection: inspection ? clean(inspection) : null })
    }
    if (path[0] === 'warehouses' && path[1] && method === 'GET') {
      const doc = await database.collection('warehouses').findOne({ code: path[1] })
      if (!doc) return json({ error: 'not found' }, 404)
      return json((({ _id, ...r }) => r)(doc))
    }

    // ---- CREATE demand ----
    if (route === '/demands' && method === 'POST') {
      const body = await request.json()
      const count = await database.collection('demands').countDocuments({})
      const demand = {
        id: uuidv4(), demand_no: `DEM-${1024 + count}`,
        buyer: body.buyer || 'Apex Plastics Pvt. Ltd.',
        material: body.material, grade: body.grade, quantity: body.quantity, unit: body.unit || 'tonnes',
        required_date: body.required_date, cluster: body.cluster, pool_no: '—',
        status: 'Matching', quotes: 0, spec: body.spec || {}, commercial: body.commercial || {},
        delivery_pref: body.delivery_pref || '', created_at: now(), updated_at: now(),
      }
      await database.collection('demands').insertOne(demand)
      return json((({ _id, ...r }) => r)(demand))
    }

    // ---- BID ----
    if (path[0] === 'auctions' && path[2] === 'bid' && method === 'POST') {
      const body = await request.json()
      const auction = await database.collection('auctions').findOne({ id: path[1] })
      if (!auction) return json({ error: 'not found' }, 404)
      const bid = Number(body.bid)
      if (!Number.isFinite(bid) || bid <= 0) return json({ error: 'Bid must be a positive number' }, 400)
      if (auction.status !== 'Live') return json({ error: 'Auction is not live' }, 409)
      const acceptedAt = new Date()
      const deadline = auction.ends_at ? new Date(auction.ends_at) : new Date(acceptedAt.getTime() + durationSeconds(auction.time_remaining) * 1000)
      if (!Number.isFinite(deadline.getTime()) || deadline <= acceptedAt) return json({ error: 'Auction has closed' }, 409)
      const decrement = Number(auction.decrement) || 1
      if (bid > Number(auction.current_bid) - decrement) return json({ error: `Bid must be at least ${decrement} below the current bid` }, 400)
      const extended = deadline.getTime() - acceptedAt.getTime() <= 120000
      const endsAt = extended ? new Date(acceptedAt.getTime() + 120000).toISOString() : deadline.toISOString()
      const t = new Date().toTimeString().slice(0, 5)
      const prev = auction.your_bid
      const bids = [{ time: t, bid, change: prev ? `${bid - prev}` : '—', rank: 1 }, ...(auction.bids || [])]
      const result = await database.collection('auctions').updateOne(
        { id: path[1], status: 'Live', current_bid: auction.current_bid, $or: [{ ends_at: auction.ends_at }, { ends_at: { $exists: false } }] },
        { $set: { your_bid: bid, current_bid: bid, your_rank: 1, bids, ends_at: endsAt, updated_at: acceptedAt.toISOString() } }
      )
      if (!result.modifiedCount) return json({ error: 'Bid changed; refresh and try again' }, 409)
      const doc = await database.collection('auctions').findOne({ id: path[1] })
      return json({ ...withAuctionClock((({ _id, ...r }) => r)(doc)), extension: { extended, seconds: extended ? 120 : 0, message: extended ? 'Extended by 2:00' : null } })
    }

    // ---- ADVANCE order (state machine + side-effects) ----
    if (path[0] === 'orders' && path[2] === 'advance' && method === 'POST') {
      const order = await database.collection('orders').findOne({ id: path[1] })
      if (!order) return json({ error: 'not found' }, 404)
      const body = await request.json().catch(() => ({}))
      const target = body.target || nextState(order.state)
      if (!target) return json({ error: 'already at terminal state' }, 400)
      const idx = ORDER_FLOW.indexOf(target)
      const timeline = ORDER_FLOW.slice(0, idx + 1).map(st => ({ step: st, done: true, at: now() }))
      await database.collection('orders').updateOne({ id: order.id }, { $set: { state: target, timeline, updated_at: now() } })
      const updated = { ...order, state: target }
      await applySideEffects(database, updated, target)
      const doc = await database.collection('orders').findOne({ id: order.id })
      return json((({ _id, ...r }) => r)(doc))
    }

    // ---- INBOUND receive ----
    if (path[0] === 'inbound' && path[2] === 'receive' && method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const order = await database.collection('orders').findOne({ inbound_shipment_id: path[1] })
      if (!order) return json({ error: 'not found' }, 404)
      const receivedQty = Number(body.received_qty)
      if (!Number.isFinite(receivedQty) || receivedQty < 0) return json({ error: 'Received quantity must be a valid non-negative number' }, 400)
      const receivedAt = now()
      const timeline = ORDER_FLOW.slice(0, ORDER_FLOW.indexOf('HUB_RECEIVED') + 1).map(st => ({ step: st, done: true, at: now() }))
      await database.collection('orders').updateOne({ id: order.id }, { $set: { state: 'QC_PENDING', timeline, updated_at: receivedAt } })
      await applySideEffects(database, { ...order, state: 'HUB_RECEIVED' }, 'HUB_RECEIVED')
      await database.collection('shipments').updateOne({ id: path[1] }, { $set: { received_qty: receivedQty, received_at: receivedAt, status: 'Delivered', updated_at: receivedAt } })
      await database.collection('inventory_lots').updateOne({ id: order.lot_id }, { $set: { received_qty: receivedQty, received_time: receivedAt, updated_at: receivedAt } })
      return json({ ok: true, received_qty: receivedQty, received_at: receivedAt })
    }

    // ---- QC decision ----
    if (path[0] === 'quality' && path[2] === 'decision' && method === 'POST') {
      const body = await request.json()
      const insp = await database.collection('inspections').findOne({ lot_id: path[1] })
      if (!insp) return json({ error: 'not found' }, 404)
      const order = await database.collection('orders').findOne({ lot_id: path[1] })
      const decision = body.decision // PASS / FAIL / PARTIAL / QUARANTINE
      await database.collection('inspections').updateOne({ lot_id: path[1] }, { $set: { decision, status: decision === 'PASS' ? 'Pass' : 'Fail', updated_at: now() } })
      if (decision === 'PASS' && order) {
        const timeline = ORDER_FLOW.slice(0, ORDER_FLOW.indexOf('QC_PASSED') + 1).map(st => ({ step: st, done: true, at: now() }))
        await database.collection('orders').updateOne({ id: order.id }, { $set: { state: 'QC_PASSED', timeline, updated_at: now() } })
        await applySideEffects(database, { ...order, state: 'QC_PASSED' }, 'QC_PASSED')
      } else if (order) {
        await database.collection('orders').updateOne({ id: order.id }, { $set: { state: 'QC_FAILED', updated_at: now() } })
        await database.collection('inventory_lots').updateOne({ id: path[1] }, { $set: { status: 'Quality hold', updated_at: now() } })
        await database.collection('disputes').insertOne({ id: uuidv4(), case_no: `CB-D${Math.floor(Math.random() * 900 + 100)}`, order_no: order.order_no, material: order.material, title: 'QC failure', disputed_qty: order.quantity * 1000, payment_state: 'On hold', status: 'Open', created_at: now(), updated_at: now() })
      }
      return json({ ok: true, decision })
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Internal server error', detail: String(error) }, 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
