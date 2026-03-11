# CampusBridge

## Firebase Setup

To enable notifications and fix permission errors, you must deploy the Firestore security rules and indexes.

1.  **Install Firebase CLI** (if not already installed):
    ```bash
    npm install -g firebase-tools
    ```

2.  **Login to Firebase**:
    ```bash
    firebase login
    ```

3.  **Initialize Firestore** (if needed, select existing project):
    ```bash
    firebase init firestore
    ```

4.  **Deploy Rules and Indexes**:
    ```bash
    firebase deploy --only firestore:rules,firestore:indexes
    ```

This will apply the rules defined in `firestore.rules` and indexes in `firestore.indexes.json` to your project.
