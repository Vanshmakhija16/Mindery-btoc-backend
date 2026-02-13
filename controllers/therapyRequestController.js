import TherapyRequest from "../models/TherapyRequest.js";
import BtoDoctor from "../models/btocDoctor.js";

/* =====================================================
   USER → CREATE REQUEST
===================================================== */
export const createRequest = async (req, res) => {
  try {
    const { queryText, selectedPrice } = req.body;

    if (!queryText) {
      return res.status(400).json({ message: "Missing fields" });
    }

    /* ===== GET USER INFO FROM TOKEN ===== */
    const employee = req.employee;

    /* ===== FIND THERAPISTS ===== */
    let doctors;

    if (selectedPrice) {
      doctors = await BtoDoctor.find({
        "consultationOptions.price": Number(selectedPrice),
        isActive: true,
      }).select("_id");
    } else {
      doctors = await BtoDoctor.find({ isActive: true }).select("_id");
    }

    const therapistIds = doctors.map((d) => d._id);

    const request = await TherapyRequest.create({
      name: employee.name,
      phone: employee.phone,
      email: employee.email,
      queryText,
      selectedPrice: selectedPrice || null,
      therapistsTargeted: therapistIds,
    });

    res.json(request);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =====================================================
   THERAPIST DASHBOARD → SEE REQUESTS
===================================================== */
// export const getTherapistRequests = async (req, res) => {
//   try {
//     const therapistId = req.doctorId;

//     const requests = await TherapyRequest.find({
//       therapistsTargeted: therapistId,
//       bookedTherapist: null,
//     }).sort({ createdAt: -1 });

//     res.json(requests);
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getTherapistRequests = async (req, res) => {
  try {
    const therapistId = req.doctorId; // from auth middleware

    /* =====================================================
       1️⃣ ACTIVE REQUESTS
       - therapist targeted
       - NOT booked yet
    ===================================================== */
    const activeRequests = await TherapyRequest.find({
      therapistsTargeted: therapistId,
      bookedTherapist: null,
    })
      .populate(
        "replies.therapistId",
        "name profilePhoto specialization"
      )
      .sort({ createdAt: -1 });

    /* =====================================================
       2️⃣ BOOKED REQUESTS (ONLY THIS DOCTOR)
       - user booked THIS therapist
       - show as history
    ===================================================== */
    const bookedRequests = await TherapyRequest.find({
      bookedTherapist: therapistId,
    })
      .populate(
        "replies.therapistId",
        "name profilePhoto specialization"
      )
      .sort({ updatedAt: -1 });

    /* =====================================================
       CLEAN FUNCTION
       removes replies where doctor no longer exists
    ===================================================== */
    const cleanReplies = (arr) =>
      arr.map((r) => {
        const validReplies = (r.replies || []).filter(
          (rep) => rep.therapistId
        );

        return {
          ...r.toObject(),
          replies: validReplies,
        };
      });

    const cleanedActive = cleanReplies(activeRequests);
    const cleanedBooked = cleanReplies(bookedRequests);

    /* =====================================================
       RETURN BOTH LISTS
       FRONTEND WILL SPLIT UI:
       - active
       - booked
    ===================================================== */
    res.json({
      active: cleanedActive,
      booked: cleanedBooked,
    });

  } catch (err) {
    console.log("getTherapistRequests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =====================================================
   THERAPIST → REPLY TO REQUEST
===================================================== */
export const replyToRequest = async (req, res) => {
  try {
    const therapistId = req.doctorId;
    const { id } = req.params;
    const { message } = req.body;

    /* ❗ DO NOT ALLOW EMPTY MESSAGE */
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Reply message required" });
    }

    const request = await TherapyRequest.findById(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    /* =====================================================
       ✅ VERY IMPORTANT — STOP REPLY IF USER ALREADY BOOKED
       This fixes:
       - Khushboo still seeing request
       - Dharmika still seeing request
    ===================================================== */
    if (request.bookedTherapist) {
      return res.status(400).json({
        message: "User already booked another therapist",
      });
    }

    /* Prevent duplicate reply */
    const alreadyReplied = request.replies.some(
      (r) => String(r.therapistId) === String(therapistId)
    );

    if (alreadyReplied) {
      return res.status(400).json({ message: "Already replied" });
    }

    /* ADD REPLY */
    request.replies.push({
      therapistId,
      message: message.trim(),
    });

    await request.save();

    res.json({ success: true });
  } catch (err) {
    console.log("replyToRequest error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =====================================================
   USER DASHBOARD → SEE RESPONSES
===================================================== */

// export const getUserRequests = async (req, res) => {
//   try {
//     const phone = req.employee.phone;

//     /* =====================================================
//        FETCH ONLY ACTIVE REQUESTS
//        bookedTherapist: null  → hide completed requests
//     ===================================================== */
//     const requests = await TherapyRequest.find({
//       phone,
//       bookedTherapist: null,
//     })
//       .populate(
//         "replies.therapistId",
//         `
//           name
//           profilePhoto
//           specialization
//           profession
//           languages
//           experience
//           consultationOptions
//           availabilityType
//           isAvailable
//           meetLink
//         `
//       )
//       .sort({ createdAt: -1 });

//     /* =====================================================
//        REMOVE INVALID REPLIES (doctor deleted or missing)
//     ===================================================== */
//     const cleanedRequests = requests.map((req) => {
//       const validReplies = (req.replies || []).filter(
//         (r) => r.therapistId
//       );

//       return {
//         ...req.toObject(),
//         replies: validReplies,
//       };
//     });

//     res.json(cleanedRequests);
//   } catch (err) {
//     console.log("getUserRequests error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export const getUserRequests = async (req, res) => {
  try {
    const phone = req.employee.phone;

    const requests = await TherapyRequest.find({
      phone,
    })
      .populate(
        "replies.therapistId",
        `
          name
          profilePhoto
          specialization
          profession
          languages
          experience
          consultationOptions
          availabilityType
          isAvailable
          meetLink
        `
      )
      .populate(
        "bookedTherapist",
        "name profilePhoto specialization profession"
      )
      .sort({ createdAt: -1 });

    const cleaned = requests.map((req) => {
      const validReplies = (req.replies || []).filter(
        (r) => r.therapistId
      );

      return {
        ...req.toObject(),
        replies: validReplies,
      };
    });

    res.json(cleaned);
  } catch (err) {
    console.log("getUserRequests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const markRequestBooked = async (req, res) => {
  try {
    const { requestId, therapistId } = req.body;

    const request = await TherapyRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    request.bookedTherapist = therapistId;
    request.status = "booked";

    await request.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
