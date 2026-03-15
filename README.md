# SkillSwap AI

![CI/CD Pipeline](https://github.com/pankajbaid567/SkillSwap/actions/workflows/ci.yml/badge.svg)

SkillSwap AI is an innovative platform connecting professionals and learners to securely and transparently trade skills. Built on modern web technologies, the platform leverages AI to ensure highly compatible matches and facilitates real-time chat, profile curation, and peer reviews.

## 📖 Project Overview
SkillSwap aims to democratize learning by minimizing the friction of acquiring new, distinct skills directly from experts who, in return, want to grasp the skills you offer. The project encompasses a resilient matching algorithm, automated reputation mechanics, and an integrated session scheduling interface.

## 🔗 Quick Links
- **Architecture Diagram**: [View Architecture Overview](https://app.eraser.io/workspace/skillswap-arch) *(Replace with actual diagram link)*
- **API Documentation**: Accessible locally at [`/api/docs`](http://localhost:5001/api/docs) or via production at [`https://api.skillswap.ai/api/docs`](https://api.skillswap.ai/api/docs) once deployed.

## ✨ Setup Instructions

### Prerequisites
- Node.js (v20+)
- PostgreSQL Database
- Redis Instance

### 1. Backend Setup
```bash
cd backend
npm install

# Set up your .env file
cp .env.example .env
# Edit .env with your DATABASE_URL, redis context, and API keys.

# Run Prisma schema tracking locally
npx prisma generate
npx prisma migrate dev

# Run Backend
npm run dev
```

### 2. Frontend Setup
```bash
cd skillswap-frontend
npm install

# Map environment details for proxy connection
cp .env.example .env.development
# Ensure VITE_API_URL and VITE_SOCKET_URL are set to your local backend

# Start Vite App
npm run dev
```



## 🏗 Design Patterns & Implementations

1. **Observer / Pub-Sub**
   - **Where:** Used heavily in `events` / `socket` listeners inside the Backend (`backend/socket/*`).
   - **Why:** Real-time event broadcasting mechanism for messages and application-wide notifications.
 
2. **Repository Pattern**
   - **Where:** Backend `repositories/` layer (e.g. `UserRepository`, `ReviewRepository`).
   - **Why:** Abstracts database operations (Prisma) ensuring clean controllers that simply invoke explicit entity functions.
   
3. **Provider / Context UI Pattern**
   - **Where:** Frontend `contexts/AuthContext.jsx` and `contexts/SocketContext.jsx`.
   - **Why:** Safely hoists critical environment logic and user session status to provide global state.

4. **Strategy Pattern**
   - **Where:** Backend `strategies/` for different matching behaviors.
   - **Why:** Provides encapsulated algorithms for matchmaking logic based on tags or availability heuristics.
