import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      unique: true,
     required: true,
      sparse: true, 
      match: [/^[0-9]{10,15}$/, "Invalid phone number"],
    },

    // 🔑 ADD THESE TWO FIELDS FOR FORGOT PASSWORD
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);