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
  const ordersSnap = await db.collection('pedidos').get()
  let updated = 0

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data()
    if (order.sellerName) continue

    let sellerId = order.sellerId
    let sellerName = null

    if (!sellerId && order.saleId) {
      const saleDoc = await db.collection('ventas').doc(order.saleId).get()
      if (saleDoc.exists) {
        const sale = saleDoc.data()
        sellerId = sale.sellerId || null
        sellerName = sale.sellerName || null
      }
    }

    if (sellerId && !sellerName) {
      const sellerDoc = await db.collection('vendedores').doc(sellerId).get()
      if (sellerDoc.exists) {
        const seller = sellerDoc.data()
        sellerName = seller.name || null
      }
    }

    if (sellerId || sellerName) {
      await db.collection('pedidos').doc(orderDoc.id).update({
        sellerId: sellerId || null,
        sellerName: sellerName || null,
      })
      updated += 1
    }
  }

  console.log(`Pedidos actualizados con vendedor: ${updated}`)
}

backfill()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error actualizando pedidos:', error)
    process.exit(1)
  })
