import ClinicalReport from "../models/ClinicalReport.js";

export const createClinicalReport = async (req, res) => {
  try {
    const report = await ClinicalReport.create({
      doctorId: req.doctorId,
      employeeId: req.body.employeeId,
      title: req.body.title,
      notes: req.body.notes,
      diagnosis: req.body.diagnosis,
      prescription: req.body.prescription,
    });

    res.status(201).json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


export const getClinicalReportsByPatient = async (req, res) => {
  const { doctorId, employeeId } = req.params;

  const reports = await ClinicalReport.find({
    doctorId,
    employeeId,
  }).sort({ createdAt: -1 });

  res.json({ success: true, data: reports });
};
