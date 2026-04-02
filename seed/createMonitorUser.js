import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const col = mongoose.connection.collection("monitorusers");

const email = "minderytesting@gmail.com";
const password = "guest@mindery";
const hashed = await bcrypt.hash(password, 10);

await col.deleteOne({ email });
await col.insertOne({
  name: "Mindery Monitor",
  email,
  password: hashed,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

console.log("✅ Monitor user created:", email);
await mongoose.disconnect();
