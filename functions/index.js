const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.sendPushNotification = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snap, context) => {
        const notificationData = snap.data();

        // 1. Figure out who gets the notification
        let targetTokens = [];
        const recipients = notificationData.recipients || [];

        // 2. Fetch FCM tokens based on role or specific user ID
        if (recipients.includes("role_student")) {
            const studentsSnap = await db.collection("users").where("role", "==", "student").get();
            studentsSnap.forEach(doc => {
                if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken);
            });
        } else if (recipients.includes("role_management")) {
            const mgmtSnap = await db.collection("users").where("role", "==", "management").get();
            mgmtSnap.forEach(doc => {
                if (doc.data().fcmToken) targetTokens.push(doc.data().fcmToken);
            });
        } else {
            for (const userId of recipients) {
                const userDoc = await db.collection("users").doc(userId).get();
                if (userDoc.exists && userDoc.data().fcmToken) {
                    targetTokens.push(userDoc.data().fcmToken);
                }
            }
        }

        // 3. Remove duplicate tokens (just in case)
        const uniqueTokens = [...new Set(targetTokens)];

        if (uniqueTokens.length === 0) {
            console.log("No valid FCM tokens found for these recipients.");
            return null;
        }

        // 4. Construct the message payload
        const message = {
            notification: {
                title: String(notificationData.title || "New Update"),
                body: String(notificationData.message || "You have a new notification"),
            },
            data: {
                link: String(notificationData.link || "/"),
            },
            tokens: uniqueTokens,
        };

        // 5. Send to Google's Push Servers
        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`Successfully sent ${response.successCount} messages. Failed: ${response.failureCount}`);
            return response;
        } catch (error) {
            console.error("Error sending push notification:", error);
            return null;
        }
    });