const path = require('path')
const dotenv = require('dotenv')
const admin = require('firebase-admin')

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error('Faltan variables de Firebase Admin en .env.local')
}

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
})

const db = admin.firestore()

async function backfill() {
  const [salesSnap, ordersSnap] = await Promise.all([
    db.collection('ventas').get(),
    db.collection('pedidos').get(),
  ])

  const existingSaleIds = new Set()
  ordersSnap.forEach((doc) => {
    const data = doc.data()
    if (data.saleId) existingSaleIds.add(data.saleId)
  })

  const batch = db.batch()
  let created = 0

  for (const saleDoc of salesSnap.docs) {
    const sale = saleDoc.data()
    if (existingSaleIds.has(saleDoc.id)) continue

    let address = 'Retiro en local'
    let clientName = sale.clientName || 'Venta directa'
    if (sale.clientId) {
      const clientDoc = await db.collection('clientes').doc(sale.clientId).get()
      if (clientDoc.exists) {
        const clientData = clientDoc.data()
        address = clientData.address || address
        clientName = clientData.name || clientName
      }
    }

    const orderRef = db.collection('pedidos').doc()
    batch.set(orderRef, {
      saleId: saleDoc.id,
      clientId: sale.clientId || null,
      clientName,
      items: sale.items || [],
      status: 'pending',
      address,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    created += 1
  }

  if (created > 0) {
    await batch.commit()
  }

  console.log(`Pedidos creados: ${created}`)
}

backfill()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creando pedidos:', error)
    process.exit(1)
  })
