/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
    apiKey: params.get('apiKey') || '',
    authDomain: params.get('authDomain') || '',
    projectId: params.get('projectId') || '',
    storageBucket: params.get('storageBucket') || '',
    messagingSenderId: params.get('messagingSenderId') || '',
    appId: params.get('appId') || '',
    measurementId: params.get('measurementId') || ''
};

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'ProjectFlow';
        const options = {
            body: payload.notification?.body || 'You have a new ProjectFlow update.',
            data: {
                deepLink: payload.data?.deepLink || '/notifications'
            }
        };

        self.registration.showNotification(title, options);
    });
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const deepLink = event.notification.data?.deepLink || '/notifications';
    const targetUrl = new URL(deepLink, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const matchingClient = clientList.find((client) => client.url === targetUrl);
            if (matchingClient) {
                return matchingClient.focus();
            }
            return clients.openWindow(targetUrl);
        })
    );
});
