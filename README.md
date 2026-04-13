# AgriAssist

A comprehensive AI-powered platform for farmers providing crop recommendations, disease detection, weather insights, and a marketplace for produce.

## Features

- **AI Crop Advisor**: Get personalized recommendations for crops and fertilizers based on soil type and location using Google Gemini.
- **Disease Scanner**: Upload photos of plant leaves for instant AI-powered diagnosis and treatment recommendations.
- **Market Prices**: Real-time agricultural market prices and trends.
- **Farmer's Marketplace**: Direct farm-to-buyer marketplace for agricultural produce.
- **Agri-Chat**: Multilingual AI assistant for all farming-related queries.
- **Weather Insights**: Real-time weather data, soil temperature, and humidity tracking.
- **Multilingual Support**: Available in English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, Spanish, French, and Portuguese.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **AI Integration**: Google GenAI SDK (Gemini 3.1 Flash)
- **Backend & Auth**: Firebase (Firestore, Authentication)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animations**: Motion

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Google Gemini API Key
- A Firebase Project

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables by creating a `.env` file based on `.env.example`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```
4. Ensure your Firebase configuration is set up in `firebase-applet-config.json`.
5. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the app for production.
- `npm run lint`: Lints the codebase.
- `npm run preview`: Previews the production build locally.
