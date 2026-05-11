import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // Try to use application default credentials or mock for now
  // We assume there's a lib/firebase-admin.ts we can import, let's try that.
}

// Since we cannot easily know how firebase-admin is setup in lib, we will use a raw REST API call if needed, 
import { cert, getApps, initializeApp } from "firebase-admin/app";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

const adminDb = getFirestore(app);

async function updateImages() {
  const snapshot = await adminDb.collection('products').get();
  
  let updatedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const cat = (data.category || '').toLowerCase();
    
    let imageUrl = '/logo.png';
    if (cat.includes('helado individual') || cat.includes('torta helada')) {
      imageUrl = '/premium_product_card.png';
    } else if (cat.includes('helado a granel')) {
      imageUrl = '/luxury_gelato.png';
    } else if (cat.includes('cárnico') || cat.includes('embutido') || cat.includes('rebozado')) {
      imageUrl = '/logo.png';
    } else if (cat.includes('papa')) {
      imageUrl = '/logo.png';
    } else if (cat.includes('verdura')) {
      // Using a local existing image for vegetables as fallback
      imageUrl = '/fondo.jpg'; 
    } else {
      imageUrl = '/premium_hero_ice_cream.png';
    }
    
    // Only update if different
    if (data.imageUrl !== imageUrl) {
      await doc.ref.update({ imageUrl });
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount} products.`);
}

updateImages().catch(console.error);
