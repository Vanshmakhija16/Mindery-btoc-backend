import mongoose from "mongoose";

const clinicalReportSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      required: true,
    },

    diagnosis: {
      type: String,
      default: "",
    },

    prescription: {
      type: String,
      default: "",
    },

    attachments: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("ClinicalReport", clinicalReportSchema);
