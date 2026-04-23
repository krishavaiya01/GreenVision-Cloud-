# GreenVision Cloud: AI Coding Agent Instructions

## Project Architecture
- **Monorepo** with `backend/` (Node.js/Express/MongoDB) and `frontend/` (React/Vite/MUI)
- **Backend**: Modular Express routes, controllers, models, and services. MongoDB for all persistent data. AI logic in `src/services/ai-recommendation-service.js` and `src/services/ai-data-service.js`.
- **Frontend**: React components organized by feature (dashboard, analytics, carbon tracking, etc.), API calls via service modules in `src/services/api/`.

## Key Patterns & Conventions
- **API endpoints**: All backend APIs are prefixed with `/api/` (e.g., `/api/cloud/dashboard`, `/api/ai/recommendations`).
- **Authentication**: Most routes use JWT via `protect` middleware. Frontend sends token in `Authorization` header.
- **Data Models**: MongoDB models in `backend/src/models/` (e.g., `CloudMetrics`, `AITrainingData`, `CarbonFootprint`).
- **AI Recommendations**: Rule-based logic in `ai-recommendation-service.js` auto-generates suggestions if no training data exists.
- **Frontend API Integration**: Use service modules (e.g., `cloudApi`, `cloudMetricApi`) for all data fetches. Example:
  ```js
  import { cloudApi } from "../../services/api/cloudApi";
  cloudApi.getDashboard();
  ```
- **Data Mapping**: Frontend expects backend to return `{ success, data, ... }` JSON. Map `data` fields directly to component state.
- **Error Handling**: Backend returns `{ success: false, error, message }` on failure. Frontend displays error messages from these fields.
- **Testing Data**: If no real data exists, backend may auto-insert mock records (see `ai-recommendation-service.js`).

## Developer Workflows
- **Backend**: Start with `npm start` in `backend/`. Uses port 5050 by default.
- **Frontend**: Start with `npm run dev` in `frontend/`. Uses Vite dev server (port 5173). Proxy `/api` to backend in `vite.config.js`.
- **Database**: MongoDB required. Data migration via `backend/migrate-existing-data.js`.
- **Build/Test**: No custom build/test scripts found; use standard npm scripts.

## Integration Points
- **Cloud Metrics**: `/api/cloud/aws/metrics`, `/api/cloud/dashboard` for usage/cost/emissions.
- **AI**: `/api/ai/recommendations` for optimization suggestions. AI logic is rule-based unless training data is present.
- **Carbon Tracking**: `/api/cloud/carbon`, `/api/cloud/carbon/trends` for footprint and history.
- **Frontend**: All API calls via service modules. Example for metrics:
  ```js
  cloudMetricApi.getAll();
  cloudMetricApi.getSummary();
  ```

## Examples
- **Backend route protection**:
  ```js
  router.use(protect());
  ```
- **Frontend API call**:
  ```js
  apiClient.get("/api/cloud/dashboard");
  ```
- **AI fallback to mock data**:
  ```js
  if (!recentData) { /* auto-create mock record */ }
  ```

## Key Files/Directories
- `backend/src/routes/` - API route definitions
- `backend/src/controllers/` - Business logic
- `backend/src/models/` - MongoDB schemas
- `backend/src/services/` - AI/data logic
- `frontend/src/services/api/` - API integration modules
- `frontend/src/pages/dashboard/` - Main dashboard components

---

**For new features:**
- Add backend route/controller/model as needed
- Integrate via frontend service module
- Map returned `data` to React state
- Handle errors using `{ success, error, message }` pattern

---

If any section is unclear or missing, please provide feedback for improvement.