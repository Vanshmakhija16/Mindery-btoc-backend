import mongoose from "mongoose";
import Assessment from "../models/Assessment.js";
import dotenv from "dotenv";

dotenv.config();

// ⭐ ADD YOUR DATA HERE (Place this array ABOVE the main function)
const assessments = [
  {
    "id": 1,
    "title": "Beck Depression Inventory (BDI)",
    "slug": "bdi",
    "description": "A self-assessment to measure levels of depression.",
    "category": "mental",
    "maxScore": 63,
    "questions": [
      {
        "id": "q1",
        "text": "Sadness",
        "options": [
          "I do not feel sad.",
          "I feel sad.",
          "I am sad all the time and I can't snap out of it.",
          "I am so sad and unhappy that I can't stand it."
        ],
        "optionsWithWeights": {
          "I do not feel sad.": 0,
          "I feel sad.": 1,
          "I am sad all the time and I can't snap out of it.": 2,
          "I am so sad and unhappy that I can't stand it.": 3
        }
      },
      {
        "id": "q2",
        "text": "Pessimism / Discouragement about the future",
        "options": [
          "I am not particularly discouraged about the future.",
          "I feel discouraged about the future.",
          "I feel I have nothing to look forward to.",
          "I feel the future is hopeless and that things cannot improve."
        ],
        "optionsWithWeights": {
          "I am not particularly discouraged about the future.": 0,
          "I feel discouraged about the future.": 1,
          "I feel I have nothing to look forward to.": 2,
          "I feel the future is hopeless and that things cannot improve.": 3
        }
      },
      {
        "id": "q3",
        "text": "Sense of Failure",
        "options": [
          "I do not feel like a failure.",
          "I feel I have failed more than the average person.",
          "As I look back on my life, all I can see is a lot of failures.",
          "I feel I am a complete failure as a person."
        ],
        "optionsWithWeights": {
          "I do not feel like a failure.": 0,
          "I feel I have failed more than the average person.": 1,
          "As I look back on my life, all I can see is a lot of failures.": 2,
          "I feel I am a complete failure as a person.": 3
        }
      },
      {
        "id": "q4",
        "text": "Loss of Pleasure",
        "options": [
          "I get as much satisfaction out of things as I used to.",
          "I don't enjoy things the way I used to.",
          "I don't get real satisfaction out of anything anymore.",
          "I am dissatisfied or bored with everything."
        ],
        "optionsWithWeights": {
          "I get as much satisfaction out of things as I used to.": 0,
          "I don't enjoy things the way I used to.": 1,
          "I don't get real satisfaction out of anything anymore.": 2,
          "I am dissatisfied or bored with everything.": 3
        }
      },
      {
        "id": "q5",
        "text": "Guilty Feelings",
        "options": [
          "I don't feel particularly guilty.",
          "I feel guilty a good part of the time.",
          "I feel quite guilty most of the time.",
          "I feel guilty all of the time."
        ],
        "optionsWithWeights": {
          "I don't feel particularly guilty.": 0,
          "I feel guilty a good part of the time.": 1,
          "I feel quite guilty most of the time.": 2,
          "I feel guilty all of the time.": 3
        }
      },
      {
        "id": "q6",
        "text": "Punishment Feelings",
        "options": [
          "I don't feel I am being punished.",
          "I feel I may be punished.",
          "I expect to be punished.",
          "I feel I am being punished."
        ],
        "optionsWithWeights": {
          "I don't feel I am being punished.": 0,
          "I feel I may be punished.": 1,
          "I expect to be punished.": 2,
          "I feel I am being punished.": 3
        }
      },
      {
        "id": "q7",
        "text": "Self-dislike / Disappointment",
        "options": [
          "I don't feel disappointed in myself.",
          "I am disappointed in myself.",
          "I am disgusted with myself.",
          "I hate myself."
        ],
        "optionsWithWeights": {
          "I don't feel disappointed in myself.": 0,
          "I am disappointed in myself.": 1,
          "I am disgusted with myself.": 2,
          "I hate myself.": 3
        }
      },
      {
        "id": "q8",
        "text": "Self-criticalness / Blaming",
        "options": [
          "I don't feel I am any worse than anybody else.",
          "I am critical of myself for my weaknesses or mistakes.",
          "I blame myself all the time for my faults.",
          "I blame myself for everything bad that happens."
        ],
        "optionsWithWeights": {
          "I don't feel I am any worse than anybody else.": 0,
          "I am critical of myself for my weaknesses or mistakes.": 1,
          "I blame myself all the time for my faults.": 2,
          "I blame myself for everything bad that happens.": 3
        }
      },
      {
        "id": "q9",
        "text": "Suicidal Thoughts or Wishes",
        "options": [
          "I don't have any thoughts of killing myself.",
          "I have thoughts of killing myself, but I would not carry them out.",
          "I would like to kill myself.",
          "I would kill myself if I had the chance."
        ],
        "optionsWithWeights": {
          "I don't have any thoughts of killing myself.": 0,
          "I have thoughts of killing myself, but I would not carry them out.": 1,
          "I would like to kill myself.": 2,
          "I would kill myself if I had the chance.": 3
        }
      },

      {
        "id": "q10",
        "text": "Crying",
        "options": [
          "I don't cry any more than usual.",
          "I cry more now than I used to.",
          "I cry all the time now.",
          "I used to be able to cry, but now I can't cry even though I want to."
        ],
        "optionsWithWeights": {
          "I don't cry any more than usual.": 0,
          "I cry more now than I used to.": 1,
          "I cry all the time now.": 2,
          "I used to be able to cry, but now I can't cry even though I want to.": 3
        }
      },

      {
        "id": "q11",
        "text": "Agitation / Irritability",
        "options": [
          "I am no more irritated by things than I ever was.",
          "I am slightly more irritated now than usual.",
          "I am quite annoyed or irritated a good deal of the time.",
          "I feel irritated all the time."
        ],
        "optionsWithWeights": {
          "I am no more irritated by things than I ever was.": 0,
          "I am slightly more irritated now than usual.": 1,
          "I am quite annoyed or irritated a good deal of the time.": 2,
          "I feel irritated all the time.": 3
        }
      },

      {
        "id": "q12",
        "text": "Loss of Interest",
        "options": [
          "I have not lost interest in other people.",
          "I am less interested in other people than I used to be.",
          "I have lost most of my interest in other people.",
          "I have lost all of my interest in other people."
        ],
        "optionsWithWeights": {
          "I have not lost interest in other people.": 0,
          "I am less interested in other people than I used to be.": 1,
          "I have lost most of my interest in other people.": 2,
          "I have lost all of my interest in other people.": 3
        }
      },

      {
        "id": "q13",
        "text": "Indecisiveness",
        "options": [
          "I make decisions about as well as I ever could.",
          "I put off making decisions more than I used to.",
          "I have greater difficulty in making decisions more than I used to.",
          "I can't make decisions at all anymore."
        ],
        "optionsWithWeights": {
          "I make decisions about as well as I ever could.": 0,
          "I put off making decisions more than I used to.": 1,
          "I have greater difficulty in making decisions more than I used to.": 2,
          "I can't make decisions at all anymore.": 3
        }
      },

      {
        "id": "q14",
        "text": "Worthlessness about appearance",
        "options": [
          "I don't feel that I look any worse than I used to.",
          "I am worried that I am looking old or unattractive.",
          "I feel there are permanent changes in my appearance that make me look unattractive.",
          "I believe that I look ugly."
        ],
        "optionsWithWeights": {
          "I don't feel that I look any worse than I used to.": 0,
          "I am worried that I am looking old or unattractive.": 1,
          "I feel there are permanent changes in my appearance that make me look unattractive.": 2,
          "I believe that I look ugly.": 3
        }
      },

      {
        "id": "q15",
        "text": "Work Difficulty",
        "options": [
          "I can work about as well as before.",
          "It takes an extra effort to get started at doing something.",
          "I have to push myself very hard to do anything.",
          "I can't do any work at all."
        ],
        "optionsWithWeights": {
          "I can work about as well as before.": 0,
          "It takes an extra effort to get started at doing something.": 1,
          "I have to push myself very hard to do anything.": 2,
          "I can't do any work at all.": 3
        }
      },

      {
        "id": "q16",
        "text": "Sleep Disturbance",
        "options": [
          "I can sleep as well as usual.",
          "I don't sleep as well as I used to.",
          "I wake up 1–2 hours earlier than usual and find it hard to get back to sleep.",
          "I wake up several hours earlier than I used to and cannot get back to sleep."
        ],
        "optionsWithWeights": {
          "I can sleep as well as usual.": 0,
          "I don't sleep as well as I used to.": 1,
          "I wake up 1–2 hours earlier than usual and find it hard to get back to sleep.": 2,
          "I wake up several hours earlier than I used to and cannot get back to sleep.": 3
        }
      },

      {
        "id": "q17",
        "text": "Fatigue",
        "options": [
          "I don't get more tired than usual.",
          "I get tired more easily than I used to.",
          "I get tired from doing almost anything.",
          "I am too tired to do anything."
        ],
        "optionsWithWeights": {
          "I don't get more tired than usual.": 0,
          "I get tired more easily than I used to.": 1,
          "I get tired from doing almost anything.": 2,
          "I am too tired to do anything.": 3
        }
      },

      {
        "id": "q18",
        "text": "Appetite",
        "options": [
          "My appetite is no worse than usual.",
          "My appetite is not as good as it used to be.",
          "My appetite is much worse now.",
          "I have no appetite at all anymore."
        ],
        "optionsWithWeights": {
          "My appetite is no worse than usual.": 0,
          "My appetite is not as good as it used to be.": 1,
          "My appetite is much worse now.": 2,
          "I have no appetite at all anymore.": 3
        }
      },

      {
        "id": "q19",
        "text": "Weight Loss",
        "options": [
          "I haven't lost much weight, if any, lately.",
          "I have lost more than five pounds.",
          "I have lost more than ten pounds.",
          "I have lost more than fifteen pounds."
        ],
        "optionsWithWeights": {
          "I haven't lost much weight, if any, lately.": 0,
          "I have lost more than five pounds.": 1,
          "I have lost more than ten pounds.": 2,
          "I have lost more than fifteen pounds.": 3
        }
      },

      {
        "id": "q20",
        "text": "Health Worries",
        "options": [
          "I am no more worried about my health than usual.",
          "I am worried about physical problems like aches, pains, upset stomach, or constipation.",
          "I am very worried about physical problems and it's hard to think of much else.",
          "I am so worried about my physical problems that I cannot think of anything else."
        ],
        "optionsWithWeights": {
          "I am no more worried about my health than usual.": 0,
          "I am worried about physical problems like aches, pains, upset stomach, or constipation.": 1,
          "I am very worried about physical problems and it's hard to think of much else.": 2,
          "I am so worried about my physical problems that I cannot think of anything else.": 3
        }
      },

      {
        "id": "q21",
        "text": "Loss of Interest in Sex",
        "options": [
          "I have not noticed any recent change in my interest in sex.",
          "I am less interested in sex than I used to be.",
          "I have almost no interest in sex.",
          "I have lost interest in sex completely."
        ],
        "optionsWithWeights": {
          "I have not noticed any recent change in my interest in sex.": 0,
          "I am less interested in sex than I used to be.": 1,
          "I have almost no interest in sex.": 2,
          "I have lost interest in sex completely.": 3
        }
      }
    ]
  },

  {
    "id": 2,
    "title": "GAD-7 Anxiety Assessment",
    "slug": "gad7",
    "description": "A 7-question screening tool to measure anxiety levels.",
    "category": "mental",
    "maxScore": 21,
    "questions": [
      {
        "id": "q1",
        "text": "Feeling nervous, anxious, or on edge",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q2",
        "text": "Not being able to stop or control worrying",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q3",
        "text": "Worrying too much about different things",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q4",
        "text": "Trouble relaxing",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q5",
        "text": "Being so restless that it is hard to sit still",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q6",
        "text": "Becoming easily annoyed or irritable",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      },

      {
        "id": "q7",
        "text": "Feeling afraid as if something awful might happen",
        "options": [
          "Not at all",
          "Several days",
          "More than half the days",
          "Nearly every day"
        ],
        "optionsWithWeights": {
          "Not at all": 0,
          "Several days": 1,
          "More than half the days": 2,
          "Nearly every day": 3
        }
      }
    ]
  },

  {
    "id": 3,
    "title": "Perceived Stress Scale (PSS)",
    "slug": "pss",
    "description": "A 10-item questionnaire to measure perceived stress levels over the past month.",
    "category": "stress",
    "maxScore": 40,
    "questions": [
      {
        "id": "q1",
        "text": "In the last month, how often have you been upset because of something that happened unexpectedly?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      },
      {
        "id": "q2",
        "text": "In the last month, how often have you felt that you were unable to control the important things in your life?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      },
      {
        "id": "q3",
        "text": "In the last month, how often have you felt nervous and stressed?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      },
      {
        "id": "q4",
        "text": "In the last month, how often have you felt confident about your ability to handle your personal problems?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 4, "Almost never": 3, "Sometimes": 2, "Fairly often": 1, "Very often": 0 }
      },
      {
        "id": "q5",
        "text": "In the last month, how often have you felt that things were going your way?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 4, "Almost never": 3, "Sometimes": 2, "Fairly often": 1, "Very often": 0 }
      },
      {
        "id": "q6",
        "text": "In the last month, how often have you found that you could not cope with all the things that you had to do?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      },
      {
        "id": "q7",
        "text": "In the last month, how often have you been able to control irritations in your life?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 4, "Almost never": 3, "Sometimes": 2, "Fairly often": 1, "Very often": 0 }
      },
      {
        "id": "q8",
        "text": "In the last month, how often have you felt that you were on top of things?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 4, "Almost never": 3, "Sometimes": 2, "Fairly often": 1, "Very often": 0 }
      },
      {
        "id": "q9",
        "text": "In the last month, how often have you been angered because of things that happened that were outside of your control?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      },
      {
        "id": "q10",
        "text": "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
        "options": ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
        "optionsWithWeights": { "Never": 0, "Almost never": 1, "Sometimes": 2, "Fairly often": 3, "Very often": 4 }
      }
    ]
  },

  {
  id: 4,
  title: "PSS-10 Stress Assessment",
  slug: "pss10",
  category: "stress",
  description: "Measures the perception of stress and how unpredictable, uncontrollable, and overloaded you find your life.",
  maxScore: 40,
  questions: [
    {
      id: "q1",
      text: "In the last month, how often have you been upset because of something that happened unexpectedly?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    },
    {
      id: "q2",
      text: "In the last month, how often have you felt unable to control the important things in your life?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    },
    {
      id: "q3",
      text: "In the last month, how often have you felt nervous and stressed?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    },
    {
      id: "q4",
      text: "In the last month, how often have you felt confident about your ability to handle personal problems?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 4,
        "Almost never": 3,
        "Sometimes": 2,
        "Fairly often": 1,
        "Very often": 0
      }
    },
    {
      id: "q5",
      text: "In the last month, how often have you felt that things were going your way?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 4,
        "Almost never": 3,
        "Sometimes": 2,
        "Fairly often": 1,
        "Very often": 0
      }
    },
    {
      id: "q6",
      text: "In the last month, how often have you found that you could not cope with all the things you had to do?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    },
    {
      id: "q7",
      text: "In the last month, how often have you been able to control irritations in your life?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 4,
        "Almost never": 3,
        "Sometimes": 2,
        "Fairly often": 1,
        "Very often": 0
      }
    },
    {
      id: "q8",
      text: "In the last month, how often have you felt that you were on top of things?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 4,
        "Almost never": 3,
        "Sometimes": 2,
        "Fairly often": 1,
        "Very often": 0
      }
    },
    {
      id: "q9",
      text: "In the last month, how often have you been angered because of things outside of your control?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    },
    {
      id: "q10",
      text: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?",
      options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
      optionsWithWeights: {
        "Never": 0,
        "Almost never": 1,
        "Sometimes": 2,
        "Fairly often": 3,
        "Very often": 4
      }
    }
  ]
},

{
  id: 5,
  title: "Self-Esteem Test (Rosenberg)",
  slug: "selfesteem",
  category: "self-esteem",
  description: "A 10-item scale that measures global self-worth by assessing positive and negative feelings about the self.",
  maxScore: 30,
  questions: [
    {
      id: "q1",
      text: "On the whole, I am satisfied with myself.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 0,
        "Disagree": 1,
        "Agree": 2,
        "Strongly agree": 3
      }
    },
    {
      id: "q2",
      text: "At times, I think I am no good at all.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 3,
        "Disagree": 2,
        "Agree": 1,
        "Strongly agree": 0
      }
    },
    {
      id: "q3",
      text: "I feel that I have a number of good qualities.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 0,
        "Disagree": 1,
        "Agree": 2,
        "Strongly agree": 3
      }
    },
    {
      id: "q4",
      text: "I am able to do things as well as most other people.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 0,
        "Disagree": 1,
        "Agree": 2,
        "Strongly agree": 3
      }
    },
    {
      id: "q5",
      text: "I feel I do not have much to be proud of.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 3,
        "Disagree": 2,
        "Agree": 1,
        "Strongly agree": 0
      }
    },
    {
      id: "q6",
      text: "I certainly feel useless at times.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 3,
        "Disagree": 2,
        "Agree": 1,
        "Strongly agree": 0
      }
    },
    {
      id: "q7",
      text: "I feel that I'm a person of worth.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 0,
        "Disagree": 1,
        "Agree": 2,
        "Strongly agree": 3
      }
    },
    {
      id: "q8",
      text: "I wish I could have more respect for myself.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 3,
        "Disagree": 2,
        "Agree": 1,
        "Strongly agree": 0
      }
    },
    {
      id: "q9",
      text: "All in all, I am inclined to feel that I am a failure.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 3,
        "Disagree": 2,
        "Agree": 1,
        "Strongly agree": 0
      }
    },
    {
      id: "q10",
      text: "I take a positive attitude toward myself.",
      options: ["Strongly disagree", "Disagree", "Agree", "Strongly agree"],
      optionsWithWeights: {
        "Strongly disagree": 0,
        "Disagree": 1,
        "Agree": 2,
        "Strongly agree": 3
      }
    }
  ]
}


];


// ==============================
// ⭐ MAIN SEED FUNCTION
// ==============================
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB Connected");

    // Remove old records
    await Assessment.deleteMany({});
    console.log("Old assessment data deleted");

    // Insert new assessments
    await Assessment.insertMany(assessments);
    console.log("Assessment data inserted successfully!");

    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
})();



