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

const products = [
  {
    name: 'Helado de Pistacho',
    description: 'Cremoso helado de pistacho tostado',
    price: 3200,
    stock: 25,
    imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
    category: 'Premium',
  },
  {
    name: 'Helado de Cookies & Cream',
    description: 'Vainilla con trozos de galleta de chocolate',
    price: 3000,
    stock: 30,
    imageUrl: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
    category: 'Especiales',
  },
  {
    name: 'Helado de Dulce de Leche Granizado',
    description: 'Dulce de leche con granizado de chocolate',
    price: 3100,
    stock: 18,
    imageUrl: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=400&h=300&fit=crop',
    category: 'Clásicos',
  },
  {
    name: 'Helado de Frambuesa',
    description: 'Sorbete natural de frambuesa',
    price: 2800,
    stock: 40,
    imageUrl: 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=400&h=300&fit=crop',
    category: 'Frutas',
  },
  {
    name: 'Helado de Mango',
    description: 'Sorbete tropical de mango maduro',
    price: 2800,
    stock: 35,
    imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
    category: 'Frutas',
  },
  {
    name: 'Helado de Chocolate Amargo',
    description: 'Chocolate 70% cacao',
    price: 3200,
    stock: 22,
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=300&fit=crop',
    category: 'Premium',
  },
  {
    name: 'Helado de Vainilla & Almendras',
    description: 'Vainilla con almendras caramelizadas',
    price: 3050,
    stock: 20,
    imageUrl: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&h=300&fit=crop',
    category: 'Especiales',
  },
  {
    name: 'Helado de Limón & Jengibre',
    description: 'Sorbete refrescante con toque cítrico',
    price: 2700,
    stock: 28,
    imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=400&h=300&fit=crop',
    category: 'Frutas',
  },
  {
    name: 'Helado de Café',
    description: 'Café intenso con notas de cacao',
    price: 3000,
    stock: 24,
    imageUrl: 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=400&h=300&fit=crop',
    category: 'Clásicos',
  },
  {
    name: 'Helado de Banana Split',
    description: 'Banana, chocolate y crema',
    price: 2900,
    stock: 26,
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&h=300&fit=crop',
    category: 'Especiales',
  },
]

async function seed() {
  const batch = db.batch()
  const collection = db.collection('productos')

  products.forEach((product) => {
    const ref = collection.doc()
    batch.set(ref, {
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })

  await batch.commit()
  console.log(`Insertados ${products.length} productos en Firestore.`)
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error insertando productos:', error)
    process.exit(1)
  })
