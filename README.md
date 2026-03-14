# 🎵 HipHopHub

A modern, interactive community platform for hip-hop music fans to discover new releases, explore artists, play music games, and compete on leaderboards.

## ✨ Features

- 🎧 **New Releases Tracker** - Stay updated with latest albums, EPs, and singles
- 👤 **Artist Profiles** - Detailed artist info, bio, and discography
- 🎤 **Tour Dates** - Find upcoming shows and get ticket links
- 🎮 **Guess the Song Game** - Test your knowledge with song snippets (1s, 3s, 5s, 10s, 30s)
- 🏆 **Leaderboards** - Compete with other fans globally and per-artist
- 📊 **User Stats** - Track your progress and achievements

## 🎯 Featured Artists

- Seedhe Maut
- Raftaar
- Chaar Diwari
- Tsumayoki
- King

## 🚀 Tech Stack

### Backend
- Java 17
- Spring Boot 3.2.2
- Spring Data JPA
- Spring Security + JWT
- H2/MySQL Database
- Last.fm + iTunes APIs

### Frontend
- React 18
- Vite
- Modern CSS (Glassmorphism & Animations)
- Axios for API calls
- React Router

## 📦 Project Structure

```
hiphophub/
├── backend/          # Spring Boot backend
│   ├── src/
│   ├── pom.xml
│   └── README.md
│
└── frontend/         # React frontend
    ├── src/
    ├── package.json
    └── README.md
```

## 🏃‍♂️ Quick Start

### Prerequisites
- Java 17+
- Node.js 20+
- Maven 3.9+
- Last.fm API key

### 1. Set up Last.fm API
Create a free Last.fm API key and add it to `backend/src/main/resources/application-local.properties`.

### 2. Configure Backend
```bash
cd backend
# Add your Last.fm credentials to application-local.properties
mvn spring-boot:run
```
Backend runs on **http://localhost:8080**

### 3. Set up Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on **http://localhost:5173**

## 📖 Documentation

Check the individual README files:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Music Import Guide](./MUSIC_IMPORT_GUIDE.md)

## 🎨 Design Philosophy

HipHopHub features a stunning, modern UI with:
- Dark theme with vibrant accent colors
- Glassmorphism effects
- Smooth animations and transitions
- Fully responsive design
- Premium feel throughout

## 🤝 Contributing

This project is currently in development. More information coming soon!

## 📝 License

This is a learning project.

---

**Built with ❤️ for the hip-hop community**
