importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPdwEnLv3vBscyOD46Cxdx8wqHD0N3mq4",
  authDomain: "aieventnew.firebaseapp.com",
  projectId: "aieventnew",
  storageBucket: "aieventnew.appspot.com",
  messagingSenderId: "901572136079",
  appId: "1:901572136079:web:1cc73e705129a938aaf4fa"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || "New Notification";
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/logo.png', // Ensure you have this image in your public folder!
    badge: '/logo.png', // Shown in the Android status bar (needs to be transparent PNG)
    data: {
      link: payload.data?.link || '/' // Pass your specific redirect URL
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- NEW: Add Click Handler to Open the App ---
self.addEventListener('notificationclick', function (event) {
  console.log('[firebase-messaging-sw.js] Notification click received.');

  // Close the notification
  event.notification.close();

  // Get the link to redirect to, or default to the homepage
  const targetUrl = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If app is already open in the background, bring it to the front and navigate
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If app is completely closed, open a new instance
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});