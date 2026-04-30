import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const breakSchema = new mongoose.Schema({ startTime:{type:String,required:true}, endTime:{type:String,required:true} }, {_id:false});
const weeklyAvailabilitySchema = new mongoose.Schema({
  day:{type:String,enum:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],required:true},
  startTime:{type:String,required:true}, endTime:{type:String,required:true},
  slotDuration:{type:Number,required:true}, breaks:{type:[breakSchema],default:[]}, isActive:{type:Boolean,default:true}
},{_id:false});
const dateAvailabilitySchema = new mongoose.Schema({
  date:{type:String,required:true}, startTime:{type:String,required:true}, endTime:{type:String,required:true},
  slotDuration:{type:Number,required:true}, breaks:{type:[breakSchema],default:[]}, isActive:{type:Boolean,default:true}
},{_id:false});
const consultationOptionSchema = new mongoose.Schema({
  duration:{type:Number,required:true}, price:{type:Number,required:true}, isActive:{type:Boolean,default:true}
},{_id:false});

const btoDoctorSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  specialization:{type:String,default:""},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  phone:{type:String,default:""},
  password:{type:String,required:true},
  profession:{type:String,default:"",trim:true},
  qualification:{type:[{type:String,trim:true}],default:""},
  role:{type:String,enum:["doctor","admin"],default:"doctor"},
  experience:{type:Number,default:0},
  profilePhoto:{type:String,default:""},
  gender:{type:String,enum:["male","female","other"],default:"other"},
  about:{type:String,default:""},
  languages:{type:[String],default:["English","Hindi"]},
  availabilityType:{type:String,enum:["online","in_person","both"],default:"both"},
  onlineModes:{type:[String],enum:["audio","video"],default:["video","audio"]},
  location:{type:String,default:""},
  consultationOptions:{type:[consultationOptionSchema],default:[]},
  isFirstSessionOffer:{type:Boolean,default:false},
  firstSessionPrice:{type:Number,default:null},

  // ── CANADA PRICING ──────────────────────────────────────────────────
  // Set in admin panel per doctor. Defaults apply to all therapists.
  canadianPrice:      { type: Number, default: 55 },   // regular session CAD
  canadianOfferPrice: { type: Number, default: 10 },   // first-booking offer CAD
  // ───────────────────────────────────────────────────────────────────

  isAvailable:{type:String,enum:["available","not_available"],default:"available"},
  weeklyAvailability:{type:[weeklyAvailabilitySchema],default:[]},
  dateAvailability:{type:[dateAvailabilitySchema],default:[]},
  displayOrder:{type:Number,default:9999,index:true},
  meetLink:{type:String},
  weeklyTemplate:{type:[{
    day:{type:String,enum:["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],required:true},
    isActive:{type:Boolean,default:false},
    windows:[{startTime:{type:String,required:true},endTime:{type:String,required:true},_id:false}]
  }],default:[]},
  isActive:{type:Boolean,default:true}
},{timestamps:true});

btoDoctorSchema.pre("save", async function(next) {
  if (this.isModified("password") && this.password) this.password = await bcrypt.hash(this.password, 10);
  next();
});

btoDoctorSchema.methods.getSlotsForDate = function(dateStr, bookedSlots=[]) {
  const toM=(t)=>{const[h,m]=t.split(":").map(Number);return h*60+m;};
  const toT=(m)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  const build=(rule)=>{
    const s=toM(rule.startTime),e=toM(rule.endTime),d=rule.slotDuration;
    const br=rule.breaks.map(b=>({s:toM(b.startTime),e:toM(b.endTime)}));
    const slots=[];
    for(let t=s;t+d<=e;t+=d) if(!br.some(b=>t<b.e&&t+d>b.s)&&!bookedSlots.some(x=>x.start===t&&x.end===t+d)) slots.push({startTime:toT(t),endTime:toT(t+d)});
    return slots;
  };
  const dr=this.dateAvailability.filter(d=>d.date===dateStr&&d.isActive);
  if(dr.length>0) return dr.flatMap(build);
  const day=new Date(dateStr).toLocaleDateString("en-US",{weekday:"long"});
  const wr=this.weeklyAvailability.find(w=>w.day===day&&w.isActive);
  return wr?build(wr):[];
};
btoDoctorSchema.methods.getAvailabilityForDate=function(d){return this.getSlotsForDate(d);};
btoDoctorSchema.methods.clearSlotsForDate=async function(date){this.dateAvailability=this.dateAvailability.filter(d=>d.date!==date);this.markModified("dateAvailability");await this.save();};
btoDoctorSchema.methods.setSlotsForDate=async function(date,slots){
  this.dateAvailability=this.dateAvailability.filter(d=>d.date!==date);
  if(slots&&slots.length>0){let st="09:00",et="17:00",sd=30;if(typeof slots[0]==="object"&&slots[0].startTime){st=slots[0].startTime;et=slots[slots.length-1].endTime||"17:00";}if(this.weeklyAvailability?.length>0)sd=this.weeklyAvailability[0].slotDuration||30;this.dateAvailability.push({date,startTime:st,endTime:et,slotDuration:sd,breaks:[],isActive:true});}
  this.markModified("dateAvailability");await this.save();
};
btoDoctorSchema.methods.getUpcomingAvailability=function(days=30){
  const av={},today=new Date();
  const toM=(t)=>{const[h,m]=String(t).split(":").map(Number);return h*60+m;};
  const toT=(m)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  const DUR=45;
  for(let i=0;i<days;i++){const d=new Date(today);d.setDate(today.getDate()+i);const ds=d.toISOString().slice(0,10);const wd=d.toLocaleDateString("en-US",{weekday:"long"});const dr=this.dateAvailability.filter(x=>x.date===ds&&x.isActive);const wr=this.weeklyAvailability.find(w=>w.day===wd&&w.isActive);const rules=dr.length>0?dr:wr?[wr]:[];if(!rules.length)continue;const slots=[];for(const r of rules){const s=toM(r.startTime),e=toM(r.endTime);const br=(r.breaks||[]).filter(b=>b?.startTime&&b?.endTime&&b.startTime<b.endTime).map(b=>({s:toM(b.startTime),e:toM(b.endTime)}));for(let t=s;t+DUR<=e;t+=DUR)if(!br.some(b=>t<b.e&&t+DUR>b.s))slots.push(`${toT(t)} - ${toT(t+DUR)}`);}if(slots.length)av[ds]=slots;}
  return av;
};
btoDoctorSchema.methods.getUpcomingAvailability45=function(days=30){
  const av={},DUR=45,IST=5.5*60*60*1000;const nowIST=new Date(Date.now()+IST);
  const toM=(t)=>{const[h,m]=t.split(":").map(Number);return h*60+m;};
  const toT=(m)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  const toDs=(d)=>new Date(d.getTime()+IST).toISOString().slice(0,10);
  const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const toDay=(d)=>DAYS[new Date(d.getTime()+IST).getUTCDay()];
  for(let i=0;i<days;i++){const d=new Date(nowIST);d.setUTCDate(nowIST.getUTCDate()+i);const ds=toDs(d),wd=toDay(d);const dr=this.dateAvailability.filter(x=>x.date===ds&&x.isActive);const wr=this.weeklyAvailability.find(w=>w.day===wd&&w.isActive);const rules=dr.length>0?dr:wr?[wr]:[];if(!rules.length)continue;const slots=[];for(const r of rules){const s=toM(r.startTime),e=toM(r.endTime);const br=(r.breaks||[]).map(b=>({s:toM(b.startTime),e:toM(b.endTime)}));for(let t=s;t+DUR<=e;t+=DUR)if(!br.some(b=>t<b.e&&t+DUR>b.s))slots.push(`${toT(t)} - ${toT(t+DUR)}`);}if(slots.length)av[ds]=slots;}
  return av;
};

const BtoDoctor=mongoose.models.BtoDoctor||mongoose.model("BtoDoctor",btoDoctorSchema);
export default BtoDoctor;
