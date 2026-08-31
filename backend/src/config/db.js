import pkg from "@prisma/client"
const { PrismaClient } = pkg

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
})

const connectDB = async () => {
  try {
    await prisma.$connect()
    console.log("DB Connected via Prisma")
  } catch (error) {
    console.error(`Database connection error: ${error.message}`)
    process.exit(1)
  }
}

const disconnectDB = async () => { await prisma.$disconnect() }

export { prisma, connectDB, disconnectDB }
