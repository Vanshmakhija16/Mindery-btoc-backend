import mongoose from "mongoose";

const GoogleTokenSchema = new mongoose.Schema(
  {
    owner: { type: String, default: "admin" }, // or userId/companyId
    tokens: { type: Object, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("GoogleToken", GoogleTokenSchema);
