require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore();

const BROKEN_IMAGES = [
  '/premium_product_card.png',
  '/luxury_gelato.png',
  '/premium_hero_ice_cream.png',
];

async function run() {
  const snapshot = await db.collection('productos').get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (BROKEN_IMAGES.includes(data.imageUrl)) {
      await doc.ref.update({ imageUrl: '/logo.png' });
      console.log(`  Fixed: ${doc.id} (${data.name}) — ${data.imageUrl} -> /logo.png`);
      count++;
    }
  }
  console.log(`\nDone. Updated ${count} products.`);
}

run().catch(console.error);
