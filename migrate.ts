import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';

// Old config
const oldApp = initializeApp({
  projectId: "automatic-loop-m224x",
  appId: "1:53136050195:web:0f1edee3c44517a32dd7e6",
  apiKey: "AIzaSyDaiT-us5imXDg-YUgWVqo4-eknE7iWOdQ",
  authDomain: "automatic-loop-m224x.firebaseapp.com",
  storageBucket: "automatic-loop-m224x.firebasestorage.app",
  messagingSenderId: "53136050195"
}, "oldApp");
const oldDb = getFirestore(oldApp, "ai-studio-publishedcakesnb-ad7aa9fc-3789-47c0-ac18-56072b13c9e2");

// New config
const newApp = initializeApp({
  projectId: "studio-7344862199-ef5ac",
  appId: "1:888666411500:web:c7ccce33424001f1d3f0c9",
  apiKey: "AIzaSyBx4UL8iVCjRQ9X4D7c4SusPa2G77dUrVQ",
  authDomain: "studio-7344862199-ef5ac.firebaseapp.com",
  storageBucket: "studio-7344862199-ef5ac.firebasestorage.app",
  messagingSenderId: "888666411500"
}, "newApp");
const newDb = getFirestore(newApp);

async function migrateData() {
  console.log("Starting migration...");
  
  // Migrate products
  console.log("Migrating products...");
  const productsSnap = await getDocs(collection(oldDb, 'products'));
  for (const p of productsSnap.docs) {
    await setDoc(doc(newDb, 'products', p.id), p.data());
  }
  console.log(`Migrated ${productsSnap.docs.length} products.`);

  // Migrate sections
  console.log("Migrating sections...");
  const sectionsSnap = await getDocs(collection(oldDb, 'sections'));
  for (const s of sectionsSnap.docs) {
    await setDoc(doc(newDb, 'sections', s.id), s.data());
  }
  console.log(`Migrated ${sectionsSnap.docs.length} sections.`);

  // Migrate admin config
  console.log("Migrating admin config...");
  const adminSnap = await getDocs(collection(oldDb, 'admin_config'));
  for (const a of adminSnap.docs) {
    await setDoc(doc(newDb, 'admin_config', a.id), a.data());
  }
  console.log(`Migrated ${adminSnap.docs.length} admin config docs.`);

  console.log("Migration complete!");
}

migrateData().catch(console.error);
