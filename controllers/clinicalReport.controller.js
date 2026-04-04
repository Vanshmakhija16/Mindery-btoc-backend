import mongoose from "mongoose";
import ClinicalReport from "../models/ClinicalReport.js";

export const createClinicalReport = async (req, res) => {
  try {
    const { employeeId, title, notes, diagnosis, prescription } = req.body;


    if (!employeeId || !title || !notes) {
      return res.status(400).json({ success: false, message: "employeeId, title and notes are required" });
    }

    const report = await ClinicalReport.create({
      doctorId: new mongoose.Types.ObjectId(String(req.doctorId)),
      employeeId: new mongoose.Types.ObjectId(String(employeeId)),
      title,
      notes,
      diagnosis: diagnosis || "",
      prescription: prescription || "",
    });


    res.status(201).json({ success: true, data: report });
  } catch (err) {
    console.error("[ClinicalReport] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


export const updateClinicalReport = async (req, res) => {
  const { reportId } = req.params;
  const { title, notes, diagnosis, prescription } = req.body;
  try {
    const report = await ClinicalReport.findOneAndUpdate(
      { _id: reportId, doctorId: new mongoose.Types.ObjectId(String(req.doctorId)) },
      { title, notes, diagnosis: diagnosis || "", prescription: prescription || "" },
      { new: true }
    );
    if (!report) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteClinicalReport = async (req, res) => {
  const { reportId } = req.params;
  try {
    const report = await ClinicalReport.findOneAndDelete({
      _id: reportId,
      doctorId: new mongoose.Types.ObjectId(String(req.doctorId)),
    });
    if (!report) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getClinicalReportsByPatient = async (req, res) => {
  const { employeeId } = req.params;
  // always use doctorId from the verified JWT, not the URL param
  const doctorId = req.doctorId;
  try {
    const reports = await ClinicalReport.find({
      doctorId: new mongoose.Types.ObjectId(String(doctorId)),
      employeeId: new mongoose.Types.ObjectId(String(employeeId)),
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
