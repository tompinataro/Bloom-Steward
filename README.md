# Bloom Steward

Bloom Steward is a custom accountability and quality control application designed for a live plant leasing and maintenance company. It was built as a solo project to streamline field technician workflows, improve data tracking, and ensure service standards.

## Features
- Technician check-ins and task tracking
- Quality control reporting
- Data persistence with PostgreSQL
- Secure user authentication
- Responsive React front-end

## Tech Stack
- React, Redux, Axios
- Node.js, Express
- PostgreSQL
- Heroku deployment

## Getting Started
1. Clone the repository
2. Install dependencies with `npm install` (root) and `npm install` in `mobile/`
3. Create environment files
   - Server: values from your local setup (optional for MVP)
   - Mobile: `mobile/.env` with `EXPO_PUBLIC_API_URL=http://localhost:5100` (or a tunnel when testing on device)
4. Build the server with `npm run build` (Heroku will run this automatically)
5. Run the API locally with `npm run dev` (TypeScript) or `npm run server` (compiled)
6. Run the mobile app from `mobile/` with `npm start`

### Endpoints
- `GET /health` – liveness check
- `GET /metrics` – Prometheus metrics
- `POST /api/auth/login` – returns a demo token and user
- `GET /api/routes/today` – requires `Authorization: Bearer <token>`
- `GET /api/visits/:id` – requires auth
- `POST /api/visits/:id/submit` – requires auth

## Deployment
Bloom Steward is deployed on Heroku at: [https://pinataro.com](https://pinataro.com)

## License
This project was developed as part of Prime Digital Academy and is maintained by Tom Pinataro.
