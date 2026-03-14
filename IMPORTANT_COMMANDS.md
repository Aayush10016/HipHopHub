# 🎵 HipHopHub - Important Commands Reference

This guide contains all the essential commands you need to run and manage the HipHopHub project.

---

## 🚀 Starting the Application

### 1. **Start Backend Server**
```bash
cd backend
mvn spring-boot:run
```
**What it does:** Starts the Java Spring Boot backend server on `http://localhost:8080`. This handles all API requests, database operations, and Last.fm + iTunes integration.

**First Run:** If `app.seed.enabled=true`, the server will import the default seed list using Last.fm + iTunes.

---

### 2. **Start Frontend Development Server**
```bash
cd frontend
npm run dev
```
**What it does:** Starts the React + Vite frontend development server on `http://localhost:5173`. Opens the web application in your browser with hot-reload enabled.

---

### 3. **Install Frontend Dependencies** (One-time setup)
```bash
cd frontend
npm install
```
**What it does:** Installs all required npm packages for the React frontend. Only needed once or when dependencies change.

---

## 🎤 Managing Artists

### **Seed Import (Optional)**

Enable the seed importer to populate a starter list from Last.fm + iTunes.

1. Set `app.seed.enabled=true` in `backend/src/main/resources/application.properties`
2. Start the backend server

You can also trigger imports manually via the endpoints below.

---

### **Manual Import - Single Artist**

**Using curl (Windows CMD):**
```bash
curl -X POST http://localhost:8080/api/admin/music/import-artist -H "Content-Type: application/json" -d "{\"artistName\":\"KR$NA\"}"
```

**Using PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/music/import-artist" -Method POST -ContentType "application/json" -Body '{"artistName":"Talha Anjum"}'
```

**What it does:** Imports the artist using Last.fm + iTunes (bios, images, albums, and 30-second previews when available).

---

### **Manual Import - Seed List**

**Using curl (Windows CMD):**
```bash
curl -X POST http://localhost:8080/api/admin/music/import-seeds
```

**Using PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/music/import-seeds" -Method POST
```

**What it does:** Imports the default seed list using Last.fm + iTunes.

---

## 🗄️ Database Commands

### **View H2 Database Console** (Development)
1. Start the backend server
2. Open browser: `http://localhost:8080/h2-console`
3. **JDBC URL:** `jdbc:h2:mem:hiphopdb`
4. **Username:** `sa`
5. **Password:** *(leave empty)*

**What it does:** Opens the H2 in-memory database web console. You can run SQL queries, browse tables, and see all imported artists/albums/songs.

---

### **Reset Database** (Clear all data)
Simply restart the backend server. Since we're using H2 in-memory database (for development), all data is cleared on restart.

To keep data persistent, you'll need to configure a real database (PostgreSQL/MySQL) in production.

---

## 📦 Building for Production

### **Build Backend**
```bash
cd backend
mvn clean package
```
**What it does:** Creates a production-ready JAR file in `backend/target/`. You can deploy this to any server.

**Run the JAR:**
```bash
java -jar backend/target/hiphophub-0.0.1-SNAPSHOT.jar
```

---

### **Build Frontend**
```bash
cd frontend
npm run build
```
**What it does:** Creates optimized production build in `frontend/dist/`. Deploy these files to any static hosting (Netlify, Vercel, etc.).

---

## 🧪 Testing API Endpoints

### **Test Backend is Running**
```bash
curl http://localhost:8080/api/test
```
**Expected Response:** `"HipHopHub API is running! 🎵"`

---

### **Get All Artists**
```bash
curl http://localhost:8080/api/artists
```
**What it does:** Returns JSON array of all artists in database with their details.

---

### **Get Artist Albums**
```bash
curl http://localhost:8080/api/albums/artist/1
```
**What it does:** Returns all albums for artist with ID 1. Replace `1` with the actual artist ID.

---

### **Get Album Songs**
```bash
curl http://localhost:8080/api/albums/1/songs
```
**What it does:** Returns all songs in album with ID 1. Includes 30-second preview URLs!

---

### **Get Song of the Day**
```bash
curl http://localhost:8080/api/recommendations/song-of-the-day
```
**What it does:** Returns a random recommended song with preview URL for the music game.

---

## 🎮 Game Endpoints

### **Start New Game**
```bash
curl http://localhost:8080/api/game/random-songs?count=5
```
**What it does:** Returns 5 random songs with preview URLs for the "Guess the Song" game.

---

### **Submit Score**
```bash
curl -X POST http://localhost:8080/api/game/submit-score ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"Player1\",\"score\":850,\"songsPlayed\":5}"
```
**What it does:** Saves player score to leaderboard.

---

### **Get Leaderboard**
```bash
curl http://localhost:8080/api/game/leaderboard
```
**What it does:** Returns top 10 scores from the leaderboard.

---

## 🔧 Troubleshooting

### **Port Already in Use**
If port 8080 or 5173 is already in use:

**Backend:** Change port in `backend/src/main/resources/application.properties`
```properties
server.port=8081
```

**Frontend:** Change port in `frontend/vite.config.js`
```javascript
server: { port: 5174 }
```

---

### **Last.fm API Not Working**
1. Check `backend/src/main/resources/application-local.properties`
2. Verify your `lastfm.api.key` and `lastfm.api.secret` are correct
3. Get credentials from: https://www.last.fm/api/account/create

---

### **Maven Build Fails**
```bash
cd backend
mvn clean install -U
```
**What it does:** Cleans the project and downloads fresh dependencies.

---

### **Frontend Not Loading**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```
**What it does:** Cleans and reinstalls all frontend dependencies.

---

## 🎯 Quick Start Workflow

1. **Start Backend:**
   ```bash
   cd backend && mvn spring-boot:run
   ```
   *(Wait for "Started HipHopHubApplication" message)*
   *(Enable app.seed.enabled if you want the seed list auto-imported.)*

2. **Start Frontend:**
   ```bash
   cd frontend && npm run dev
   ```
   *(Opens browser to http://localhost:5173)*

3. **Enjoy!** The app is ready with real artist data! 🎉

---

## 📝 Notes

- **Development Database:** H2 (in-memory, data lost on restart)
- **Production Database:** Configure PostgreSQL/MySQL in `application.properties`
- **Auto-Import:** First startup imports 15+ DHH artists automatically
- **Manual Import:** Use API endpoints to add more artists anytime
- **Preview URLs:** Tracks include 30-second iTunes previews when available
- **CORS:** Frontend and backend are configured to work together

---

## 🆘 Need Help?

Check these files for more details:
- `README.md` - Project overview
- `MUSIC_IMPORT_GUIDE.md` - Import instructions (Last.fm + iTunes)
- `quick_start_guide.md` - Step-by-step setup guide
