# NEOMED Research Forum - Backend

Backend API for the NEOMED Research Forum abstract submission and review system.

## 🏗️ What We've Built So Far

### Project Structure
```
neomed-backend/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── Abstract.js          # Abstract submission model
│   ├── Reviewer.js          # Reviewer profile model
│   └── Admin.js             # Admin authentication model
├── routes/                  # API routes (coming next)
├── controllers/             # Business logic (coming next)
├── middleware/              # Auth & validation (coming next)
├── uploads/                 # PDF file storage
├── .env                     # Environment variables
├── .gitignore
├── package.json
└── server.js               # Main Express server
```

## 📦 Dependencies Installed

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **cors** - Cross-origin resource sharing
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **multer** - File upload handling
- **nodemailer** - Email sending
- **dotenv** - Environment variables
- **nodemon** (dev) - Auto-restart server

## 🗄️ Database Models

### Abstract Model
- Basic info: title, authors, email, department, category, keywords
- Abstract text content
- Optional PDF upload
- Status tracking (pending/under_review/accepted/rejected)
- Reviews array with scores (1-10)
- Average score calculation
- Publication status

### Reviewer Model
- Name, email, department
- Statistics (total reviews completed)
- Assigned abstracts tracking

### Admin Model
- Email, password (hashed), name
- Password comparison method

## ⚙️ Setup Instructions

### 1. Install MongoDB
Make sure MongoDB is installed and running on your machine.

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
Download from https://www.mongodb.com/try/download/community

**Linux:**
```bash
sudo apt-get install mongodb
sudo systemctl start mongodb
```

### 2. Install Dependencies
```bash
cd neomed-backend
npm install
```

### 3. Configure Environment
Edit `.env` file with your settings:
- Update `JWT_SECRET` with a random string
- Configure email settings (we'll do this later)
- Update `MONGODB_URI` if needed

### 4. Run the Server
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

Server will start on http://localhost:5000

## 🧪 Testing the Server

Open your browser or use a tool like Postman:
```
GET http://localhost:5000/
```

You should see:
```json
{
  "message": "🎓 NEOMED Research Forum API",
  "status": "Server is running",
  "version": "1.0.0"
}
```

## 🚀 Next Steps

1. ✅ Basic server setup (DONE)
2. ✅ Database models (DONE)
3. ⬜ Create abstract submission route
4. ⬜ Add file upload functionality
5. ⬜ Implement email confirmation
6. ⬜ Build reviewer authentication
7. ⬜ Create review submission endpoints
8. ⬜ Build admin panel endpoints

## 📝 Notes

- MongoDB will create the database automatically on first connection
- Uploaded PDFs will be stored in the `uploads/` folder
- All passwords are hashed using bcrypt
- JWT tokens are used for authentication
