# HipHopHub Backend

Backend API for HipHopHub - A community platform for hip-hop music fans.

## 🚀 Tech Stack

- **Java 17**
- **Spring Boot 3.2.2**
- **Maven 3.9+**
- **H2 Database** (Development)
- **JWT Authentication**
- **Last.fm + iTunes Integration**

## 📦 Dependencies

- Spring Web (REST APIs)
- Spring Data JPA (Database)
- Spring Security (Authentication)
- Lombok (Reduce boilerplate)
- H2/MySQL (Database)
- JJWT (JWT tokens)

## 🏃‍♂️ How to Run

### 1. Prerequisites
- Java 17 or higher
- Maven 3.9+

### 2. Configure Last.fm API
Add keys in `src/main/resources/application-local.properties` (recommended):
```properties
lastfm.api.key=YOUR_LASTFM_KEY
lastfm.api.secret=YOUR_LASTFM_SECRET
```

### 3. Run the Application
```bash
cd backend
mvn spring-boot:run
```

The server will start on **http://localhost:8080**

### 4. Test the API
Open your browser or Postman and visit:
```
http://localhost:8080/api/test/health
```

You should see:
```json
{
  "status": "OK",
  "message": "HipHopHub Backend is running! 🎵",
  "version": "1.0.0"
}
```

## 🗄️ Database

Development uses **H2 in-memory database**. Access the console at:
```
http://localhost:8080/h2-console

JDBC URL: jdbc:h2:mem:hiphophub
Username: sa
Password: (leave empty)
```

## 📁 Project Structure

```
backend/
├── src/main/java/com/hiphophub/
│   ├── HipHopHubApplication.java   # Main application
│   ├── config/                     # Configuration classes
│   ├── controller/                 # REST API endpoints
│   ├── service/                    # Business logic
│   ├── repository/                 # Database access
│   ├── model/                      # Entity classes
│   └── dto/                        # Data Transfer Objects
├── src/main/resources/
│   └── application.properties      # Configuration
└── pom.xml                         # Maven dependencies
```

## 🔧 Development

### Build the project
```bash
mvn clean install
```

### Run tests
```bash
mvn test
```

### Package as JAR
```bash
mvn package
```

## 📚 API Documentation

Coming soon! We'll add Swagger/OpenAPI documentation.
