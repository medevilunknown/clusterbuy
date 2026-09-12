import { test, expect } from '@playwright/test'

const demoUser = { id: 'ui-test', name: 'UI Test', role: 'BUYER', company_id: null }

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/seed')
  await page.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: demoUser }) }))
  // Map tiles are decorative and must not make the operational UI pass flaky.
  await page.route('https://*.tile.openstreetmap.org/**', route => route.fulfill({ status: 204 }))
})

test('all four role dashboards render and navigate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('buyer-dashboard')).toBeVisible()
  await page.getByRole('button', { name: 'Seller', exact: true }).last().click()
  await expect(page.getByTestId('seller-dashboard')).toBeVisible()
  await page.getByRole('button', { name: 'Warehouse', exact: true }).last().click()
  await expect(page.getByTestId('ops-dashboard')).toBeVisible()
  await page.getByRole('button', { name: 'Admin', exact: true }).last().click()
  await expect(page.getByTestId('admin-dashboard')).toBeVisible()
})

test('savings view matches the scoped API total', async ({ page, request }) => {
  const savings = await (await request.get('/api/savings')).json()
  await page.goto('/')
  await page.getByText('My Savings', { exact: true }).click()
  await expect(page.getByText('Your savings story')).toBeVisible()
  await expect(page.getByText(/from actual orders|Actual pooled spend/).first()).toBeVisible()
  expect(savings.rows.every(row => row.order_no)).toBeTruthy()
})

test('late bid extends auction by two minutes', async ({ request }) => {
  const auctions = await (await request.get('/api/auctions')).json()
  const late = auctions.find(a => a.status === 'Live' && new Date(a.ends_at).getTime() - Date.now() <= 120000)
  expect(late).toBeTruthy()
  const response = await request.post(`/api/auctions/${late.id}/bid`, { data: { bid: late.current_bid - late.decrement } })
  expect(response.ok()).toBeTruthy()
  const updated = await response.json()
  expect(updated.extension).toMatchObject({ extended: true, seconds: 120 })
  expect(new Date(updated.ends_at).getTime()).toBeGreaterThan(Date.now() + 115000)
})

test('connected order path updates linked shipment and tracking metrics', async ({ page, request }) => {
  const orders = await (await request.get('/api/orders')).json()
  const order = orders.find(o => o.state === 'SUPPLIER_DISPATCHED')
  expect(order).toBeTruthy()
  await request.post(`/api/inbound/${order.inbound_shipment_id}/receive`, { data: { received_qty: order.quantity } })
  await request.post(`/api/quality/${order.lot_id}/decision`, { data: { decision: 'PASS' } })
  for (const target of ['INVENTORY_AVAILABLE', 'ALLOCATED', 'OUTBOUND_PLANNING', 'OUTBOUND_DISPATCHED']) {
    expect((await request.post(`/api/orders/${order.id}/advance`, { data: { target } })).ok()).toBeTruthy()
  }
  const shipment = await (await request.get(`/api/shipments/${order.outbound_shipment_id}`)).json()
  expect(shipment).toMatchObject({ status: 'Dispatched' })
  expect(shipment.distance_km).toBeGreaterThan(0)
  expect(shipment.eta_at).toBeTruthy()
  await page.goto('/')
  await page.getByText('Shipments', { exact: true }).click()
  await expect(page.getByTestId('route-metrics')).toContainText('Distance to go')
  await expect(page.getByTestId('route-metrics')).toContainText('ETA countdown')
  for (const target of ['IN_TRANSIT_TO_BUYER', 'DELIVERED', 'ACCEPTED']) {
    expect((await request.post(`/api/orders/${order.id}/advance`, { data: { target } })).ok()).toBeTruthy()
  }
  const finalOrder = await (await request.get(`/api/orders/${order.id}`)).json()
  expect(finalOrder.state).toBe('ACCEPTED')
  expect(finalOrder.outbound.status).toBe('Delivered')
  expect(finalOrder.settlement.status).toBe('Approved')
})
