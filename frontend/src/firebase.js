import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPdwEnLv3vBscyOD46Cxdx8wqHD0N3mq4",
  authDomain: "aieventnew.firebaseapp.com",
  projectId: "aieventnew",
  storageBucket: "aieventnew.appspot.com",
  messagingSenderId: "901572136079",
  appId: "1:901572136079:web:1cc73e705129a938aaf4fa"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);


async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();