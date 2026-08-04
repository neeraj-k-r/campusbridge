
# 🎓 Campus Bridge — AI-Driven Event Networking Platform

**Campus Bridge** is a Progressive Web App (PWA) built for college campuses to streamline event creation and connect students, alumni, and faculty in a live networking ecosystem. Powered by fine-tuned LLMs and encrypted QR-based ticketing, it delivers a frictionless digital campus experience — eliminating proxy attendance, cutting organizer workload, and closing communication gaps across departments.

🔗 **Live App:** [campusbridgepro.netlify.app](https://campusbridgepro.netlify.app/)

---

## 📚 Table of Contents

- [Overview](#-overview)
- [Core Features & Modules](#-core-features--modules)
- [Tech Stack](#-tech-stack)
- [System Requirements](#-system-requirements)
- [Getting Started](#-getting-started)
  - [Accessing the Live App](#accessing-the-live-app)
  - [Local Development Setup](#local-development-setup)
  - [Environment Variables](#environment-variables)
- [User Roles & Access](#-user-roles--access)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [Security Notes](#-security-notes)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🧭 Overview

Campus Bridge acts as a single digital hub for everything happening on campus — from official event announcements to peer-to-peer networking. It combines:

- **AI-assisted content creation** for event organizers (descriptions + posters generated from a prompt)
- **Cryptographically secured QR ticketing** to guarantee attendance is genuine
- **Real-time chat and notice systems** to keep the whole campus — students, alumni, faculty — in sync

The platform is installable as a PWA on any device, requiring no app-store distribution.

---

## 🚀 Core Features & Modules

| Module | Description |
|---|---|
| **Auth & RBAC** | User registration, JWT-based login, and role-based route protection (Student / Organizer / Admin / Faculty / Alumni). |
| **Event Manager** | Full CRUD for events, plus an admin approval workflow before events go live. |
| **AI Service** | Integrates Gemini API and Hugging Face models to auto-draft event descriptions and generate posters from a text prompt. |
| **Ticketing & QR** | Generates personalized, encrypted QR strings binding a Student ID to an Event ID — preventing proxy check-ins. |
| **Scanner App** | Webcam-based QR decoding for real-time attendance logging at event entry points. |
| **Digital Notice Board** | Central hub for official administration announcements, with department-level filtering and priority pinning. |
| **Anonymous Complaints** | Secure reporting system with image-attachment support; strict anti-abuse policy reveals a user's identity if the report itself contains abusive/offensive content. |
| **Campus Connect** | Live chat ecosystem for networking among current students and alumni. |

---

## 💻 Tech Stack

**Frontend**
- React.js — responsive, component-driven UI
- PWA (service workers, manifest) for installable, offline-tolerant experience

**Backend**
- Node.js + Express.js — REST API, real-time event architecture, push notifications

**Database**
- Firebase — user profiles, event data, real-time chat
- PostgreSQL — structured/relational data (events, tickets, roles)

**Media**
- Cloudinary — hosting & optimization of AI-generated event posters

**AI Services**
- Gemini API — text generation for event descriptions
- Hugging Face — supplementary model inference / poster generation

**Other**
- JWT — authentication tokens
- QR encryption libraries — secure ticket string generation/decoding

---

## 🖥 System Requirements

### Software
| Component | Requirement |
|---|---|
| OS | Platform-independent (runs in-browser as a PWA) |
| Frontend | React.js |
| Backend | Node.js + Express.js |
| Database | Firebase, PostgreSQL |
| Media | Cloudinary account |
| AI | Gemini API key and/or Hugging Face API token |

### Hardware
| Component | Requirement |
|---|---|
| Client | Any device with a webcam/camera (required for QR scanning) |
| Server | Node.js/Express/DB-capable host; GPU acceleration (e.g. RTX 4050 class) recommended if self-hosting AI inference |

---

## 🏁 Getting Started

### Accessing the Live App

No installation is required to try Campus Bridge:

1. Visit **[https://campusbridgepro.netlify.app/](https://campusbridgepro.netlify.app/)**
2. Register for an account (Student / Alumni / Faculty) or log in if you already have one.
3. Optional — **Install as PWA**: on desktop Chrome/Edge, click the install icon in the address bar; on mobile, use "Add to Home Screen" from your browser menu.
4. Admin/Organizer accounts are provisioned separately — contact your campus administrator for elevated access.

> ⚠️ Camera permission is required for the QR Scanner module. Grant camera access when prompted to enable check-in scanning.

### Local Development Setup

Clone the repository and set up frontend and backend separately.

```bash
# 1. Clone the repo
git clone https://github.com/nithincodesx/campus-bridge.git
cd campus-bridge

# 2. Install frontend dependencies
cd client
npm install

# 3. Install backend dependencies
cd ../server
npm install
```

**Run the backend:**
```bash
cd server
npm run dev
# Server runs on http://localhost:5000 (default)
```

**Run the frontend:**
```bash
cd client
npm start
# App runs on http://localhost:3000 (default)
```

> Replace the repo URL above with your actual GitHub path if it differs — update this section once the repository is public/linked.

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server
PORT=5000
JWT_SECRET=your_jwt_secret_key

# Database
DATABASE_URL=your_postgresql_connection_string
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id

# AI Services
GEMINI_API_KEY=your_gemini_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Media
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# QR Encryption
QR_ENCRYPTION_KEY=your_qr_encryption_secret
```

Create a matching `.env` file in `client/` for any public-facing keys (e.g. Firebase client config):

```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_API_BASE_URL=http://localhost:5000
```

---

## 🔐 User Roles & Access

| Role | Access Level |
|---|---|
| **Student** | Browse/register for events, chat via Campus Connect, receive QR ticket, file anonymous complaints |
| **Alumni** | Campus Connect networking, event browsing/registration |
| **Faculty** | Post/manage notices, view department event activity |
| **Organizer** | Create/edit events, generate AI descriptions & posters, view attendance analytics |
| **Admin** | Approve/reject events, moderate notice board, manage user roles, review complaint reports |

Route access is enforced server-side via JWT claims + RBAC middleware — role changes take effect on next login/token refresh.

---

## 📁 Project Structure

```
campus-bridge/
├── client/                 # React.js frontend (PWA)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/        # API calls, AI service wrappers
│   │   ├── context/          # Auth & RBAC context
│   │   └── App.js
│   └── package.json
├── server/                  # Node.js + Express backend
│   ├── routes/
│   ├── controllers/
│   ├── models/               # PostgreSQL schemas
│   ├── middleware/            # JWT auth, RBAC guards
│   ├── services/               # Gemini/Hugging Face, Cloudinary, QR logic
│   └── package.json
└── README.md
```

---

## 📖 Usage Guide

1. **Creating an Event** — Organizers submit event details; the AI Service module can auto-draft a description and generate a poster from a short prompt. Events enter a pending state until Admin approval.
2. **Registering for an Event** — Students register through the Event Manager; on registration, an encrypted QR ticket binding their Student ID + Event ID is issued.
3. **Checking In** — At the venue, the Scanner App module decodes the attendee's QR via webcam and marks attendance in real time, rejecting duplicate or invalid codes.
4. **Notices** — Faculty/Admin post to the Digital Notice Board, filterable by department, with support for pinning high-priority announcements.
5. **Reporting Issues** — Students can file anonymous complaints (with optional image attachments). Abusive or policy-violating submissions automatically de-anonymize the reporter.
6. **Campus Connect** — Students and alumni chat in real time to network, mentor, and stay connected post-graduation.

---

## 🛡 Security Notes

- QR tickets are encrypted and single-use to prevent proxy attendance and replay attacks.
- JWT tokens gate all protected routes; RBAC middleware enforces role-level permissions server-side (not just UI hiding).
- Anonymous complaints are stored without identity linkage unless an anti-abuse trigger is fired.
- All AI-generated content (descriptions/posters) passes through the Admin approval workflow before publication.

---

## 🗺 Roadmap

- [ ] Push notification support for event reminders
- [ ] Alumni mentorship matching within Campus Connect
- [ ] Analytics dashboard for organizers (attendance trends, engagement)
- [ ] Offline-first caching for notice board content

---

## 🤝 Contributing

Contributions are welcome. To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

Specify your project license here (e.g. MIT, Apache 2.0). If unset, the project is currently unlicensed and all rights are reserved by the author.

---
