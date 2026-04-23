<div align="center">

# 🌍 GreenVision Cloud
**AI-Powered Cloud Resource & Carbon Emission Optimization Platform**

[![React](https://img.shields.io/badge/React-18.x-blue.svg?logo=react&logoColor=white)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?logo=mongodb&logoColor=white)](https://mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

*An intelligent, multi-cloud dashboard designed to monitor resource usage, track carbon emissions, and provide AI-driven rightsizing recommendations.*

[**Explore the Live Demo**]((add-your-vercel-link-here)) 

</div>

---

## 🚀 Overview

GreenVision Cloud is a comprehensive, full-stack enterprise dashboard built to tackle modernized multi-cloud infrastructure challenges. It unites AWS, Azure, GCP, and Kubernetes clustering metrics into a single real-time view. By leveraging advanced Machine Learning and AI models, GreenVision Cloud evaluates unused or overprovisioned resources to significantly slash costs while simultaneously tracking your infrastructure's carbon footprint.

## ✨ Core Features

*   **🌐 Multi-Cloud Aggregation:** Unified dashboard fetching real-time metrics across **AWS (EC2/S3)**, **Azure (VMs)**, and **GCP (Compute Engine)**.
*   **🤖 AI Rightsizing & Assistant:** OpenAI-powered analysis evaluates usage bounds, catching anomalies, predicting future costs, and suggesting actionable rightsizing.
*   **🌱 Carbon Tracking & Offsets:** Calculates real-time carbon offsets and emissions based on energy metrics powered by localized region models.
*   **⛵ Kubernetes (K8s) Health:** High-level overview of active nodes, pod statuses, and deployments scaling parameters.
*   **⚡ Real-Rime Interactivity:** WebSockets (`socket.io`) push real-time log alerts and anomaly flags directly to the client interface.
*   **🎨 Premium UI / UX:** Deeply immersive user experience featuring `Framer Motion` animations, Glassmorphism elements, dynamic Light/Dark themes, and complex `Chart.js`/`Recharts` visualizations.
*   **📧 Automated Alerts:** Send instant metric alerts and summary reports securely through SMTP email integration.

---

## 💻 Tech Stack

### Frontend
- **React.js (v18)** + **Vite**
- **Material UI (MUI v5)** for robust component styling
- **Framer Motion & Three.js** for high-end micro-animations & spatial rendering
- **React Router Dom (v6)** for secure routing
- **Chart.js & Recharts** for complex metric visualization

### Backend
- **Node.js + Express.js**
- **MongoDB + Mongoose** for scalable database modeling
- **Socket.io** for real-time bidirectional event-based communication
- **OpenAI API** & AI Recommendation Engine
- **AWS/Azure/GCP Cloud SDKs** natively integrated
- **JWT (JSON Web Tokens)** for stateless user authentication

---

## 🛠️ Local Development Setup

To run this project locally, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/krishavaiya01/GreenVision-Cloud-.git
cd GreenVision-Cloud-
```

### 2. Install Dependencies
Run the install command in both directories:
```bash
# In the root directory (for concurrent scripts)
npm install

# In the backend directory
cd backend && npm install

# In the frontend directory
cd ../frontend && npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the `backend/` directory and include the following key services:

```env
# Server
PORT=5050
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database & Auth
MONGO_URI=mongodb+srv://<user>:<password>@cluster...
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# AI Providers
OPENAI_API_KEY=your_openai_api_key

# Cloud Configs (Optional for local testing)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AZURE_CLIENT_ID=your_id 
```

### 4. Run the Platform
You can run the frontend and backend concurrently from the root directory:
```bash
npm run dev
```
The Frontend will start dynamically on `http://localhost:5173` and the Backend API on `http://localhost:5050`.

---

## ☁️ Deployment

GreenVision-Cloud is fully production-ready and optimized for Cloud PaaS. 
*   **Frontend (Vercel):** Optimized Vite configurations with automatic edge routing. 
*   **Backend (Render):** Express API utilizing secure CORS patterns tied strictly to frontend `process.env.FRONTEND_URL` mappings.
*   **Database (Atlas):** Ensure Network IP restrictions are enabled (`0.0.0.0/0` for universal PaaS access).

---

<div align="center">
  <p><b>Built with ❤️ by Krish Vaiya</b></p>
  <i>Empowering sustainable cloud computing for a greener tomorrow.</i>
</div>
