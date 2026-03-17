import mongoose from "mongoose";

const orgMemberSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone:    { type: String, required: false, unique: true, sparse: true },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
      default: null,
    },

    otp:        { type: String },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);

const OrgMember = mongoose.models.OrgMember || mongoose.model("OrgMember", orgMemberSchema);
export default OrgMember;