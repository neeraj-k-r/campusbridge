import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import fs from "fs";
import webpush from 'web-push';
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

webpush.setVapidDetails(
  'mailto:campusbridgeofficials@gmail.com',
  process.env.VAPID_PUBLIC_KEY || "YOUR_PUBLIC_KEY",
  process.env.VAPID_PRIVATE_KEY || "YOUR_PRIVATE_KEY"
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db = null;

try {
  // Load the Service Account Key safely
  const serviceAccountPath = path.resolve(__dirname, "./serviceAccountKey.json");

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // For Render Deployment
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully from Environment Variables");
  } else if (fs.existsSync(serviceAccountPath)) {
    // For Local Testing
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin initialized successfully with Service Account Key");
  } else {
    console.warn("⚠️ WARNING: serviceAccountKey.json not found in backend folder. Firebase Admin SDK might fail.");
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  db = admin.firestore();
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
}

// Poll for new notifications (Fallback)
let lastNotificationTime = Date.now();

const notificationInterval = setInterval(async () => {
  if (!db) return;
  try {
    const snapshot = await db.collection("notifications")
      .where("createdAt", ">", lastNotificationTime)
      .get();

    snapshot.forEach(async (doc) => {
      const notif = doc.data();
      const recipients = notif.recipients || [];

      for (const recipient of recipients) {
        const userDoc = await db.collection("users").doc(recipient).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData && userData.fcmToken) {
            const message = {
              notification: {
                title: notif.title,
                body: notif.message,
              },
              token: userData.fcmToken,
            };
            try {
              await admin.messaging().send(message);
            } catch (error) {
              console.error("Error sending push notification:", error);
            }
          }
        }
      }
      lastNotificationTime = Math.max(lastNotificationTime, notif.createdAt);
    });
  } catch (error) {
    console.error("Error polling notifications:", error);
  }
}, 10000);

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({ origin: '*' }));
  app.use(express.json());

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
  });

  // --- NEW INSTANT PUSH NOTIFICATION ENDPOINT ---
  app.post("/api/send-notification", async (req, res) => {
    try {
      const { title, message, link, recipients } = req.body;
      if (!db) return res.status(500).json({ error: "Database not ready" });

      let targetTokens = [];
      const safeRecipients = recipients || [];

      if (safeRecipients.includes("role_student")) {
        const snap = await db.collection("users").where("role", "==", "student").get();
        snap.forEach(doc => { if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken); });
      } else if (safeRecipients.includes("role_management")) {
        const snap = await db.collection("users").where("role", "==", "management").get();
        snap.forEach(doc => { if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken); });
      } else {
        for (const userId of safeRecipients) {
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists && userDoc.data().fcmToken) {
            targetTokens.push(userDoc.data().fcmToken);
          }
        }
      }

      const uniqueTokens = [...new Set(targetTokens)];
      if (uniqueTokens.length === 0) {
        return res.status(200).json({ message: "No tokens found." });
      }

      const payload = {
        notification: { title: String(title), body: String(message) },
        data: { link: String(link || "/") },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`Successfully sent ${response.successCount} mobile push notifications.`);
      res.status(200).json({ success: true, response });
    } catch (error) {
      console.error("Error sending instant push notification:", error);
      res.status(500).json({ error: error.message });
    }
  });
  // --- END OF NEW ENDPOINT ---

  app.post("/api/verify-secret", (req, res) => {
    const { role, secret } = req.body;
    const trimmedSecret = secret?.trim();
    if (role === "management") {
      const validSecret = (process.env.MANAGER_SECRET || "IAMMANAGER").trim();
      return res.json({ valid: trimmedSecret === validSecret });
    }
    if (role === "faculty") {
      const validSecret = (process.env.FACULTY_SECRET || "IAMFACULTY").trim();
      return res.json({ valid: trimmedSecret === validSecret });
    }
    if (role === "developer") {
      const validPassword = (process.env.DEVELOPER_PASSWORD || "DEVELOPER_PASSWORD").trim();
      return res.json({ valid: trimmedSecret === validPassword });
    }
    res.json({ valid: false });
  });

  async function deleteUserAndCleanup(uid, dbInstance) {
    const userDoc = await dbInstance.collection("users").doc(uid).get();
    if (!userDoc.exists) return null;
    const userData = userDoc.data();

    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      console.error("Error deleting auth user:", e);
    }

    if (userData?.studentId) {
      await dbInstance.collection("studentIds").doc(userData.studentId).delete();
    }

    if (userData?.role === "student" && userData?.department && userData?.yearOfJoin) {
      const capId = `${userData.department}_${userData.yearOfJoin}`;
      const capRef = dbInstance.collection("departmentCapacity").doc(capId);
      const capSnap = await capRef.get();
      if (capSnap.exists) {
        const capData = capSnap.data();
        await capRef.update({
          registeredCount: Math.max(0, (capData?.registeredCount || 0) - 1)
        });
      }
    } else if (userData?.role === "faculty" && userData?.department) {
      const capId = `${userData.department}_FACULTY`;
      const capRef = dbInstance.collection("departmentCapacity").doc(capId);
      const capSnap = await capRef.get();
      if (capSnap.exists) {
        const capData = capSnap.data();
        await capRef.update({
          registeredCount: Math.max(0, (capData?.registeredCount || 0) - 1)
        });
      }
    }

    await dbInstance.collection("users").doc(uid).delete();
    return userData;
  }

  app.get("/api/test", (req, res) => {
    res.json({ success: true });
  });

  app.post(["/api/delete-user", "/api/delete-user/"], async (req, res) => {
    const { uid, developerEmail } = req.body;

    if (!uid || !developerEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (developerEmail.toLowerCase() !== "campusbridgeofficials@gmail.com") {
      return res.status(401).json({ error: "Unauthorized request. Only developers can perform this action." });
    }

    try {
      if (!db) throw new Error("Database not initialized");
      const deletedUser = await deleteUserAndCleanup(uid, db);
      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, deletedUser });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not matched", url: req.url });
  });

  app.use((err, req, res, next) => {
    console.error("Global error handler caught:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  const isProd = process.env.NODE_ENV === "production";
  const distExists = fs.existsSync(path.resolve(__dirname, "../frontend/dist"));

  if (!isProd) {
    console.log("Using Vite middleware (Development Mode)");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, "../frontend"),
    });
    app.use(vite.middlewares);
  } else if (distExists) {
    const distPath = path.resolve(__dirname, "../frontend/dist");
    app.use(express.static(distPath));

    // 👇 THIS IS THE LINE THAT WAS FIXED 👇
    app.get(/(.*)/, (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });

  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, "../frontend"),
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    clearInterval(notificationInterval);
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer();