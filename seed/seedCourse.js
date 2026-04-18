import mongoose from "mongoose";
import Course from "../models/Course.js";

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔥 Load .env from root folder
dotenv.config({ path: path.resolve(__dirname, "../.env") });


const seedCourse = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    // Optional: clear existing courses
    await Course.deleteMany();

    const course = await Course.create({
      title: "Rorschach Inkblot Test (Advanced Level)",

      description:
        "The Rorschach Inkblot Test is a projective assessment used to understand how an individual perceives, thinks, and responds emotionally. It helps uncover personality dynamics that may not always be expressed directly.",

      price: 3499,
      originalPrice : 3999,
      duration: "10 Days",

      whyEnroll:
        "The Rorschach Inkblot Test is one of the most widely used and clinically significant projective assessments, but also one of the most complex to learn. This course provides structured, hands-on training to ensure accurate administration, scoring, and interpretation. It is especially valuable for students preparing for M.Phil or a career in clinical psychology.",

      whatYouWillLearn: [
        {
          title: "Administration",
          description:
            "Learn structured and standardized administration of the Rorschach test.",
        },
        {
          title: "Scoring System",
          description:
            "Understand all 7 coding categories and how to score responses accurately.",
        },
        {
          title: "Interpretation",
          description:
            "Analyze response patterns and understand personality dynamics.",
        },
        {
          title: "Report Writing",
          description:
            "Create clear, professional psychological reports.",
        },
        {
          title: "Case-Based Learning",
          description:
            "Work on real and simulated cases for practical understanding.",
        },
      ],

modules: [
  {
    title: "Day 1: Introduction",
    points: [
      "Conceptual foundation of projective techniques",
      "Understanding projection and perceptual processes",
      "Clinical relevance and scope of the test",
    ],
  },
  {
    title: "Day 2: Basic Prerequisites",
    points: [
      "Clinical mindset required for administration",
      "Ethical guidelines and professional boundaries",
      "Suitability across settings and populations",
    ],
  },
  {
    title: "Day 3: Preliminary Preparation",
    points: [
      "Standard test materials and setting",
      "Establishing rapport without influencing responses",
      "Structuring instructions with precision",
    ],
  },
  {
    title: "Day 4: Administration",
    points: [
      "Response phase and Inquiry phase",
      "Handling variations in responses",
      "Managing common challenges",
      "Maintaining neutrality",
    ],
  },
  {
    title: "Day 5: Scoring (Part 1)",
    points: [
      "Introduction to scoring system",
      "Understanding coding categories",
    ],
  },
  {
    title: "Day 6: Scoring (Part 2)",
    points: [
      "Accurate response coding",
      "Avoiding common scoring errors",
    ],
  },
  {
    title: "Day 7: Interpretation (Part 1)",
    points: [
      "Understanding response patterns",
      "Configuration analysis",
    ],
  },
  {
    title: "Day 8: Interpretation (Part 2)",
    points: [
      "Linking scores to personality",
      "Clinical meaning of variables",
    ],
  },
  {
    title: "Day 9: Report Writing & Case Work",
    points: [
      "Structuring professional reports",
      "Translating scores into clinical language",
      "Writing clear case reports",
    ],
  },
  {
    title: "Day 10: Case Discussions & Roleplays",
    points: [
      "In-depth case discussions",
      "Simulated application",
      "Roleplays and feedback",
    ],
  },
],
    });

    console.log("Course Seeded Successfully ✅");
    console.log(course);

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedCourse();

seedCourse();