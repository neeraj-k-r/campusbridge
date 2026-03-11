import { createContext, useContext, useState, useEffect } from "react";
import { db, auth, messaging } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, arrayUnion, addDoc, getDocs, deleteDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { getToken } from "firebase/messaging";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children, user, profile }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const role = profile?.role;
  const dept = profile?.department;
  const uid = user?.uid;

  // Register for FCM Push Notifications
  useEffect(() => {
    const registerFCM = async () => {
      if (!uid || !('serviceWorker' in navigator)) return;

      try {
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get token
        const token = await getToken(messaging, {
          vapidKey: 'BEsh8csv6PNIvgIjKfeiRZlSVxzh0_9eYBLYwY-JhoaLoTNgSFYM6ANVMCKbbvlvRc1wZcOL9ZcC0V0Z-bX7LAI'
        });

        if (token) {
          // Store token in Firestore for backend to use
          await updateDoc(doc(db, "users", uid), { fcmToken: token });
        }
      } catch (error) {
        console.error("FCM registration error:", error);
      }
    };

    registerFCM();
  }, [uid]);

  useEffect(() => {
    if (!uid || !profile) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Define the recipient tokens to listen for
    const recipientTokens = [uid, "all"];

    // Add role-based tokens (handle both cases to be safe)
    if (role) {
      recipientTokens.push(`role_${role}`);
      recipientTokens.push(`role_${role.toLowerCase()}`);
      // Special case: if role is "management", also listen for "admin" just in case
      if (role.toLowerCase() === "management") {
        recipientTokens.push("role_admin");
      }
    }

    // Add department-based tokens
    if (dept) {
      recipientTokens.push(`dept_${dept}`);
      recipientTokens.push(`dept_${dept.toUpperCase()}`);
    }

    console.log("Notification Listener Active. Listening for:", recipientTokens);

    // Query notifications where the user is a recipient
    // Note: Firestore "array-contains-any" is limited to 10 values, which is fine here.
    // We sort in memory to avoid requiring a composite index immediately, which helps prevent setup errors.
    const q = query(
      collection(db, "notifications"),
      where("recipients", "array-contains-any", recipientTokens)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Handle new notifications with a toast
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newNotif = change.doc.data();
          // Only show toast if it's recent (within last 10 seconds) to avoid spam on initial load
          // And if it wasn't created by the current user (optional, but good UX)
          if (Date.now() - newNotif.createdAt < 10000 && !newNotif.readBy?.includes(uid)) {
            toast(newNotif.title, {
              icon: '🔔',
              duration: 4000
            });
          }
        }
      });

      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Check if the current user has read this notification
        isRead: doc.data().readBy?.includes(uid)
      })).filter(n => !n.clearedBy?.includes(uid)); // Filter out cleared notifications

      // Sort by createdAt desc (newest first)
      notifs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.isRead).length);
      setLoading(false);
    }, (error) => {
      console.error("Notification listener error:", error);
      if (error.code === 'permission-denied') {
        // This is a critical error, so we log it clearly but don't spam toasts on every retry
        console.warn("PERMISSION DENIED: Please update your Firestore Security Rules to allow access to the 'notifications' collection.");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid, role, dept]);

  const deleteNotificationsByRelatedId = async (relatedId) => {
    if (!relatedId) return;
    try {
      const q = query(collection(db, "notifications"), where("relatedId", "==", relatedId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "notifications", d.id)));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting notifications by relatedId:", error);
    }
  };

  const clearNotification = async (notificationId) => {
    if (!user) return;
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, {
        clearedBy: arrayUnion(user.uid)
      });
      // Optimistically update local state to remove it immediately
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error("Error clearing notification:", error);
      toast.error("Failed to clear notification");
    }
  };

  const markAsRead = async (notificationId) => {
    if (!user) return;
    try {
      const notifRef = doc(db, "notifications", notificationId);
      await updateDoc(notifRef, {
        readBy: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.isRead);
    const promises = unread.map(n => markAsRead(n.id));
    await Promise.all(promises);
  };

  // Helper function to send a notification
  const sendNotification = async (notificationData) => {
    if (!profile) return;

    try {
      // 1. Add to Firestore (Your existing code)
      await addDoc(collection(db, "notifications"), {
        ...notificationData,
        senderId: profile.id,
        senderName: profile.displayName || "Admin",
        createdAt: Date.now(),
        isRead: false
      });

      // 2. NEW: Trigger the background push notification!
      // In development this hits localhost, in production it hits your real URL
      const isLocal = window.location.hostname === "localhost";
      // Inside NotificationContext.jsx
      const BACKEND_URL = "https://campus-bridge-zcme.onrender.com/api/send-notification";

      fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notificationData.title,
          message: notificationData.message,
          link: notificationData.link,
          recipients: notificationData.recipients
        })
      }).catch(err => console.error("Push API failed to ping:", err));

    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotification,
      sendNotification,
      deleteNotificationsByRelatedId,
      loading
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
