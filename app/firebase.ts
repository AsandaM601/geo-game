import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCr5Gsv7USr6Wl6xLpsPxeHVI44NqBI9k",
  authDomain: "geo-game-874b6.firebaseapp.com",
  projectId: "geo-game-874b6"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);