// update-clients-taxCategory.js
const admin = require('firebase-admin');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// Verificar variables de entorno
console.log("🔍 Verificando variables de entorno...");
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "✓ Presente" : "✗ Ausente");
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "✓ Presente" : "✗ Ausente");
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? `✓ Presente (${process.env.FIREBASE_PRIVATE_KEY.substring(0, 20)}...)` : "✗ Ausente");

// Inicializar Firebase Admin
try {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // Validar credenciales
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error("Faltan credenciales de Firebase. Verifica tu archivo .env.local");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin inicializado correctamente");
} catch (error) {
  console.error("❌ Error inicializando Firebase:", error.message);
  console.log("\n💡 AYUDA: Asegúrate de que tu archivo .env.local tenga:");
  console.log("FIREBASE_PROJECT_ID=tu-project-id");
  console.log("FIREBASE_CLIENT_EMAIL=tu-email@project.iam.gserviceaccount.com");
  console.log("FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...");
  process.exit(1);
}

const db = admin.firestore();

async function updateClientsWithTaxCategory() {
  try {
    console.log('\n🔍 Buscando clientes sin taxCategory...');
    
    const clientsSnapshot = await db.collection('clientes').get();
    
    if (clientsSnapshot.empty) {
      console.log("📭 No hay clientes en la base de datos");
      return;
    }
    
    console.log(`📊 Total de clientes: ${clientsSnapshot.size}`);
    
    const batch = db.batch();
    let count = 0;
    
    clientsSnapshot.forEach((doc) => {
      const client = doc.data();
      
      // Si no tiene taxCategory, asignar "consumidor_final" por defecto
      if (!client.taxCategory) {
        const clientRef = db.collection('clientes').doc(doc.id);
        batch.update(clientRef, { 
          taxCategory: "consumidor_final",
          updatedAt: new Date()
        });
        count++;
        console.log(`📝 Actualizando cliente: ${client.name || 'Sin nombre'} (ID: ${doc.id})`);
      } else {
        console.log(`✓ Cliente ya tiene taxCategory: ${client.name} -> ${client.taxCategory}`);
      }
    });
    
    if (count > 0) {
      console.log(`\n💾 Guardando ${count} actualizaciones...`);
      await batch.commit();
      console.log(`\n✅ Actualizados ${count} clientes con taxCategory = "consumidor_final"`);
    } else {
      console.log("\n✅ Todos los clientes ya tienen taxCategory");
    }
  } catch (error) {
    console.error("❌ Error actualizando clientes:", error);
  } finally {
    console.log("\n🎯 Script finalizado");
    admin.app().delete();
    process.exit(0);
  }
}

updateClientsWithTaxCategory();