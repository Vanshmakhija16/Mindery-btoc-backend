import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  doctorName: {
  type: String,
  trim: true,
},

  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },

  phone: {
  type: String,
  required: true,
  trim: true,
},

meetLink: {
  type: String,
},

reminderAt: {
  type: Date,
},

reminderSent: {
  type: Boolean,
  default: false,
},

name: {
    type: String,
    required: true,
    trim: true,
  },
email: {
  type: String,
  required: false,   // ✅ optional
  lowercase: true,
  trim: true,
},

  date: String,
  slot: String,
  mode: String,

  amount: Number,
  duration: String,
  isOfferBooking: Boolean,

  payment: {
    orderId: String,
    paymentId: String,
    status: String,
  },
  confirmationSent: {
  type: Boolean,
  default: false,
},

//   whatsappLogs: [
//   {
//     to: String,            // phone number
//     type: String,          // "confirmation" | "reminder"
//     template: String,      // template name
//     params: [String],      // 👈 to rebuild exact message
//     status: String,        // "sent" | "failed"
//     sentAt: {
//       type: Date,
//       default: Date.now,
//     },
//   },
// ],

}, { timestamps: true });


export default mongoose.model("Booking", bookingSchema);
