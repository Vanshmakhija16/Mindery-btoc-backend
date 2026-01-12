import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
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

  phone: {
  type: String,
  required: true,
  trim: true,
},

meetLink: {
  type: String,
},



  // ✅ ADD THESE
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
}, { timestamps: true });


export default mongoose.model("Booking", bookingSchema);
