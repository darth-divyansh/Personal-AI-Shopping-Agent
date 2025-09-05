# 🛒 AI-Personal Shopping Assistant 🤖

## Overview 🌐

Walmart-Personal-AI-Shopping-Assistant is an advanced, interactive shopping agent that leverages **3D models**, **voice interaction**, and **AI-powered intelligence** to assist users in online shopping and customer support. The system combines **React Three.js** for 3D avatars, **Rhubarb Lip-Sync** with **Eleven Labs TTS**, a **MongoDB Vector Database** for fast query responses, and integration with **Telegram**, **LangChain**, **OpenAI**, and **Gemini AI API** for research, order handling, and customer support.

---

## Demo 🌐
### Click me ⬇️
[![Watch the demo](https://img.youtube.com/vi/3WptJIvEloA/hqdefault.jpg)](https://youtu.be/3WptJIvEloA)

## Features ✨

### 3D Shopping Agent 🕹️

* Interactive 3D avatar built with **React Three.js**.
* Smooth **animations** including talking, gestures, and reactions.
* **Rhubarb** for accurate lip-sync with voice output 🎤.
* Voice responses generated using **Eleven Labs TTS** 🗣️.

### AI-Powered Assistance 🧠

* Uses **vector databases** to quickly answer user queries and resolve order issues 🔍.
* Capable of **placing orders** via voice commands 🛍️.
* Handles customer support queries seamlessly using **LangChain**.
* Integration with **OpenAI** and **Gemini AI API** for enhanced natural language understanding and intelligent responses 🤖💡.

### Telegram Support Bot 📱

* Telegram bot interface for remote customer support 💬.
* Can **conduct research**, provide recommendations, and resolve queries 📝.
* Acts as a human assistant replacement, leveraging AI for faster, accurate responses ⚡.

### Voice Interaction 🎙️

* Users can interact with the system using **voice commands**.
* Lip-syncing 3D avatar provides a realistic conversational experience 🗣️👄.
* Text-to-speech and speech recognition integration ensures smooth communication 🔊.

---

## Tech Stack 🛠️

### Frontend ⚛️

* **React.js** with **Three.js** for 3D rendering
* **Tailwind CSS** for styling
* Custom **React Hooks** for chat and voice interactions

### Backend 🖥️

* **Node.js** for API and backend services
* **MongoDB Vector Database** for fast semantic search
* **Eleven Labs TTS** and **Rhubarb Lip-Sync** for audio processing
* **LangChain** for AI workflow orchestration
* **OpenAI & Gemini API** for natural language processing and order handling
* **Telegram Bot API** for messaging and support automation

---

## Project Structure 📂

```
AI-Personal Shopping Assistant/
├─ backend/           # Backend services, AI helpers, and audio processing
├─ frontend/          # React 3D interface and assets

└─ Telegram-Langchain-Bot/  # Telegram bot integration
```

---

## Installation ⚡

### Backend

```bash
cd backend
yarn install
cp .env.example .env
# Configure your API keys in .env
```

### Frontend

```bash
cd frontend
yarn install
yarn dev
```

### Telegram Bot 🤖

```bash
cd Telegram-Langchain-Bot
pip install -r req.txt
# Configure your .env with bot token
```

---

## Usage 🏃‍♂️

1. Start the backend server 🖥️.
2. Run the frontend React app to interact with the 3D shopping agent 🕹️.
3. Use voice commands to query orders, place new orders, or ask general product questions 🎤.
4. Access Telegram bot for remote support and research tasks 📱.

---

## Contribution 🤝

* Fork the repository and create a new branch for your feature 🌿.
* Submit a pull request with clear description of changes 📝.

---

## Hackathon Info 🏆
This project was developed for the **Walmart Sparkathon 2025**. It showcases the integration of cutting-edge AI technologies to create new online shopping experiences.
