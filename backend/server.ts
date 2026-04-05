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

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:campusbridgeofficials@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (error) {
    console.error("⚠️ WARNING: Invalid VAPID keys provided in .env. Web push will not work.", (error as Error).message);
  }
} else {
  console.warn("⚠️ WARNING: VAPID keys not found in .env. Web push notifications will not work.");
}
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

// ---------------------------------------------------------
// NEW: Firebase Authentication Middleware
// ---------------------------------------------------------
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token." });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Attach user data to the request
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Forbidden: Invalid or expired token." });
  }
};
// ---------------------------------------------------------

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

  const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*';
  // SECURITY WARNING: In production, ensure process.env.FRONTEND_URL is set restrictively.
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Backend is running" });
  });

  // --- SECURED INSTANT PUSH NOTIFICATION ENDPOINT ---
  app.post("/api/send-notification", verifyFirebaseToken, async (req, res) => {
    try {
      const { title, message, link, recipients } = req.body;
      if (!db) return res.status(500).json({ error: "Database not ready" });

      const requestorEmail = req.user.email;

      // Ensure only authorized emails can send notifications
      const authorizedSenders = process.env.DEVELOPER_EMAILS ? process.env.DEVELOPER_EMAILS.toLowerCase().split(',') : ["campusbridgeofficials@gmail.com"];
      if (!requestorEmail || !authorizedSenders.includes(requestorEmail.toLowerCase())) {
        return res.status(403).json({ error: "Forbidden: You do not have permission to send push notifications." });
      }

      let targetTokens = [];
      const safeRecipients = recipients || [];

      // 1. If "all" is in the array, fetch everyone with a token
      if (safeRecipients.includes("all")) {
        const snap = await db.collection("users").get();
        snap.forEach(doc => {
          if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken);
        });
      } else {
        // 2. Otherwise, check for specific roles or specific user IDs
        for (const recipient of safeRecipients) {
          if (recipient === "role_student") {
            const snap = await db.collection("users").where("role", "==", "student").get();
            snap.forEach(doc => { if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken); });
          } else if (recipient === "role_management") {
            const snap = await db.collection("users").where("role", "==", "management").get();
            snap.forEach(doc => { if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken); });
          } else if (recipient === "role_faculty") {
            const snap = await db.collection("users").where("role", "==", "faculty").get();
            snap.forEach(doc => { if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken); });
          } else {
            // Treat as a specific user ID
            const userDoc = await db.collection("users").doc(recipient).get();
            if (userDoc.exists && userDoc.data().fcmToken) {
              targetTokens.push(userDoc.data().fcmToken);
            }
          }
        }
      }

      // Remove duplicate tokens so a user doesn't get pinged twice
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
      res.status(500).json({ error: "An internal server error occurred while sending notifications." });
    }
  });

  // --- SECURED SECRET ROUTE ---
  app.post("/api/verify-secret", (req, res) => {
    const { role, secret } = req.body;
    const trimmedSecret = secret?.trim();
    
    if (!trimmedSecret) return res.json({ valid: false });

    // IMPORTANT: Ensure you set these environment variables in your production environment!
    // Otherwise fallback secrets are randomized so login will fail by default, securing the app.
    if (role === "management") {
      const validSecret = (process.env.MANAGER_SECRET || Math.random().toString(36)).trim();
      return res.json({ valid: trimmedSecret === validSecret });
    }
    if (role === "faculty") {
      const validSecret = (process.env.FACULTY_SECRET || Math.random().toString(36)).trim();
      return res.json({ valid: trimmedSecret === validSecret });
    }
    if (role === "developer") {
      const validPassword = (process.env.DEVELOPER_PASSWORD || Math.random().toString(36)).trim();
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

  // --- SECURED DELETE USER ENDPOINT ---
  app.post(["/api/delete-user", "/api/delete-user/"], verifyFirebaseToken, async (req, res) => {
    const { uid } = req.body; // Notice developerEmail is removed from here

    if (!uid) {
      return res.status(400).json({ error: "Missing required field: uid" });
    }

    const requestorEmail = req.user.email;

    // Verify this specific user has developer privileges 
    const authorizedSenders = process.env.DEVELOPER_EMAILS ? process.env.DEVELOPER_EMAILS.toLowerCase().split(',') : ["campusbridgeofficials@gmail.com"];
    if (!requestorEmail || !authorizedSenders.includes(requestorEmail.toLowerCase())) {
      return res.status(403).json({ error: "Forbidden: Only developers can perform this action." });
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
      res.status(500).json({ error: "An internal error occurred while trying to delete the user." });
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not matched", url: req.url });
  });

  app.use((err, req, res, next) => {
    console.error("Global error handler caught:", err);
    res.status(500).json({ error: "Internal Server Error" }); // Sanitized error message
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