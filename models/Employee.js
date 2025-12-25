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
      sparse: true, // allows old users without phone
      match: [/^[0-9]{10,15}$/, "Invalid phone number"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", employeeSchema);
