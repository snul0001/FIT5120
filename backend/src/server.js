import express from "express"
import cors from "cors"
import { config } from "dotenv"
import { connectDB, disconnectDB } from "./config/db.js"
import profileRoutes from "./routes/profileRoutes.js"
import occupationRoutes from "./routes/occupationRoutes.js"

config()

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}))

app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true }))

app.get("/", (req, res) => res.json({ message: "FutureReady API is running 🚀" }))
app.get("/health", (req, res) => res.json({ status: "ok" }))
app.use("/api/profile", profileRoutes)
app.use("/api/occupations", occupationRoutes)

const startServer = async () => {
  try {
    await connectDB()
    const server = app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
      console.log(`🚀 Server running on PORT ${process.env.PORT || 3000}`)
    })

    process.on("unhandledRejection", (err) => {
      console.error("Unhandled Rejection:", err)
      server.close(async () => { await disconnectDB(); process.exit(1) })
    })
    process.on("uncaughtException", async (err) => {
      console.error("Uncaught Exception:", err)
      await disconnectDB(); process.exit(1)
    })
    process.on("SIGTERM", async () => {
      server.close(async () => { await disconnectDB(); process.exit(0) })
    })
  } catch (error) {
    console.error("Failed to start server:", error)
    process.exit(1)
  }
}

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})

startServer()