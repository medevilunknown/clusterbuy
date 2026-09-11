const { MongoClient } = require('/app/node_modules/mongodb')
;(async () => {
  const c = new MongoClient('mongodb://localhost:27017')
  await c.connect()
  const db = c.db('your_database_name')
  const uid = 'dev-user-0001'
  await db.collection('users').updateOne({ id: uid }, { $set: { id: uid, name: 'Rohit Kumar', email: 'rohit@apexplastics.in', picture: '', role: 'BUYER', status: 'Active', permissions: ['all'], updated_at: new Date().toISOString() } }, { upsert: true })
  const token = 'devtoken123'
  await db.collection('sessions').updateOne({ session_token: token }, { $set: { id: 'dev-sess', session_token: token, user_id: uid, expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_at: new Date().toISOString() } }, { upsert: true })
  console.log('seeded dev session token=', token)
  await c.close()
})().catch(e => { console.error(e); process.exit(1) })
