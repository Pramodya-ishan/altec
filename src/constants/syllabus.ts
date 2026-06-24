import { SyllabusDef } from "../types";

export const SYLLABUS: Record<string, SyllabusDef> = {
  sft: {
    mcqMax: 50,
    mcqMult: 1.0,
    mcqItems: [
      { q: "Q1-5", title: "සෛල (ක්ෂුද්‍රජීව විද්‍යාව ඇතුළුව)", count: 5 },
      { q: "Q6-7", title: "ජෛවාණු", count: 2 },
      { q: "Q8", title: "තාප රසායනය", count: 1 },
      { q: "Q9", title: "චාලක රසායනය", count: 1 },
      { q: "Q10-11", title: "බහුඅවයවික", count: 2 },
      { q: "Q12-13", title: "ස්වභාවික නිෂ්පාදන", count: 2 },
      { q: "Q14-15", title: "රසායනික කර්මාන්ත", count: 2 },
      { q: "Q16-17", title: "පරිසරය", count: 2 },
      { q: "Q18", title: "මිනුම් උපකරණ", count: 1 },
      { q: "Q19-21", title: "වර්ගඵලය හා පරිමාව", count: 3 },
      { q: "Q22-23", title: "ත්‍රිකෝණමිතිය", count: 2 },
      { q: "Q24-25", title: "ඛණ්ඩාංක ජ්‍යාමිතිය", count: 2 },
      { q: "Q26-28", title: "සංඛ්‍යානය", count: 3 },
      { q: "Q29-36", title: "ICT (තොරතුරු තාක්ෂණය)", count: 8 },
      { q: "Q37-39", title: "චලිතය", count: 3 },
      { q: "Q40-41", title: "බලය", count: 2 },
      { q: "Q42", title: "යාන්ත්‍රික ශක්තිය", count: 1 },
      { q: "Q43-44", title: "පදාර්ථයේ යාන්ත්‍රික ගුණ", count: 2 },
      { q: "Q45-46", title: "තරල", count: 2 },
      { q: "Q47-48", title: "තාපය", count: 2 },
      { q: "Q49-50", title: "විද්‍යුතය", count: 2 },
    ],
    partAMax: 400,
    partAItems: [
      { q: "Q1", title: "Q1", subTitle: "ජීව විද්‍යාව", max: 100, topics: ["සෛල (ක්ෂුද්‍රජීව විද්‍යාව ඇතුළුව)", "ජෛවාණු"] },
      { q: "Q2", title: "Q2", subTitle: "රසායන විද්‍යාව", max: 100, topics: ["බහුඅවයවික", "චාලක රසායනය", "රසායනික කර්මාන්ත"] },
      { q: "Q3", title: "Q3", subTitle: "මිශ්‍ර ප්‍රශ්නය", max: 100, topics: ["මිනුම් උපකරණ", "තරල", "තාපය", "තාප රසායනය", "විද්‍යුතය"] },
      { q: "Q4", title: "Q4", subTitle: "භෞතික විද්‍යාව", max: 100, topics: ["බලය", "චලිතය", "යාන්ත්‍රික ශක්තිය"] },
    ],
    partBCDMax: 600,
    partBCDItems: [],
    bcdGroups: [
      {
        title: "ගණිතය & ICT", label: "Part B", items: [
          { q: "Q5", title: "Q5", max: 150, topics: ["සංඛ්‍යානය"] },
          { q: "Q6", title: "Q6", subTitle: "මිශ්‍ර ගණිතය", max: 150, topics: ["ත්‍රිකෝණමිතිය", "ඛණ්ඩාංක ජ්‍යාමිතිය", "වර්ගඵලය හා පරිමාව"] }
        ]
      },
      {
        title: "ජෛව හා රසායනික කර්මාන්ත", label: "Part C", items: [
          { q: "Q7", title: "Q7", max: 150, topics: ["පරිසරය", "ස්වභාවික නිෂ්පාදන"] },
          { q: "Q8", title: "Q8", max: 150, topics: ["රසායනික කර්මාන්ත"] }
        ]
      },
      {
        title: "භෞතික විද්‍යාව", label: "Part D", items: [
          { q: "Q9", title: "Q9", max: 150, topics: ["විද්‍යුතය", "චලිතය"] },
          { q: "Q10", title: "Q10", max: 150, topics: ["තාපය", "පදාර්ථයේ යාන්ත්‍රික ගුණ", "තරල"] }
        ]
      }
    ]
  },
  et: {
    mcqMax: 50,
    mcqMult: 0.7,
    mcqItems: [
      { q: "Q1", title: "හදින්වීම", count: 1 },
      { q: "Q2-3", title: "මිනුම්", count: 2 },
      { q: "Q4", title: "ප්‍රමිති සහ පිරිවිතර", count: 1 },
      { q: "Q5-6", title: "Drawing", count: 2 },
      { q: "Q7", title: "Safety", count: 1 },
      { q: "Q8-10", title: "ව්‍යවසායකත්වය", count: 3 },
      { q: "Q11-15", title: "Civil", count: 5 },
      { q: "Q16-18", title: "බිම් මැනුම්", count: 3 },
      { q: "Q19-20", title: "TDS", count: 2 },
      { q: "Q21-22", title: "කසළ අපවහනය", count: 2 },
      { q: "Q23-24", title: "චලිතය", count: 2 },
      { q: "Q25-29", title: "AutoMobile", count: 5 },
      { q: "Q30-31", title: "තරල යන්ත්‍ර", count: 2 },
      { q: "Q32-38", title: "production", count: 7 },
      { q: "Q39-40", title: "විදුලි යන්ත්‍ර", count: 2 },
      { q: "Q41-44", title: "electrical", count: 4 },
      { q: "Q45-50", title: "electronic", count: 6 }
    ],
    partAMax: 300,
    partAItems: [
      { q: "Q1", title: "Q1", max: 75, topics: ["Drawing"] },
      { q: "Q2", title: "Q2", max: 75, topics: ["Civil", "බිම් මැනුම්", "තරල යන්ත්‍ර", "කසළ අපවහනය"] },
      { q: "Q3", title: "Q3", max: 75, topics: ["production", "මිනුම්", "Safety", "චලිතය"] },
      { q: "Q4", title: "Q4", max: 75, topics: ["ව්‍යවසායකත්වය"] }
    ],
    partBCDMax: 400,
    partBCDItems: [],
    bcdGroups: [
      {
        title: "සිවිල් තාක්ෂණවේදය", label: "Part B", items: [
          { q: "Q5", title: "Q5", max: 100, topics: ["Civil"] },
          { q: "Q6", title: "Q6", max: 100, topics: ["TDS", "බිම් මැනුම්"] }
        ]
      },
      {
        title: "යාන්ත්‍රික තාක්ෂණවේදය", label: "Part C", items: [
          { q: "Q7", title: "Q7", max: 100, topics: ["AutoMobile"] },
          { q: "Q8", title: "Q8", max: 100, topics: ["production", "තරල යන්ත්‍ර"] }
        ]
      },
      {
        title: "විදුලි හා ඉලෙක්ට්‍රොනික තාක්ෂණවේදය", label: "Part D", items: [
          { q: "Q9", title: "Q9", max: 100, topics: ["electrical", "විදුලි යන්ත්‍ර"] },
          { q: "Q10", title: "Q10", max: 100, topics: ["electronic"] }
        ]
      }
    ]
  },
  ict: {
    mcqMax: 50,
    mcqMult: 1.0,
    mcqItems: [
      { q: "Q1-6", title: "Concept of ICT & Intro", count: 6 },
      { q: "Q7-10", title: "Number System", count: 4 },
      { q: "Q11-14", title: "Logic Gates", count: 4 },
      { q: "Q15-18", title: "OS", count: 4 },
      { q: "Q19-24", title: "Networking", count: 6 },
      { q: "Q25-29", title: "Information System", count: 5 },
      { q: "Q30-34", title: "Database", count: 5 },
      { q: "Q35-40", title: "Python", count: 6 },
      { q: "Q41-45", title: "Web", count: 5 },
      { q: "Q46-50", title: "IoT, E-commerce, New Trends", count: 5 }
    ],
    partAMax: 40,
    partAItems: [
      { q: "Q1", title: "Q1", max: 10, topics: ["Web", "Number System"] },
      { q: "Q2", title: "Q2", max: 10, topics: ["OS", "Logic Gates"] },
      { q: "Q3", title: "Q3", max: 10, topics: ["Python"] },
      { q: "Q4", title: "Q4", max: 10, topics: ["Web", "OS"] }
    ],
    partBCDMax: 60,
    partBCDItems: [],
    bcdGroups: [
      {
        title: "රචනා ප්‍රශ්න (6න් 4ක් පමණි)", label: "Part B", items: [
          { q: "Q5", title: "Q5", max: 15, topics: ["Python"] },
          { q: "Q6", title: "Q6", max: 15, topics: ["Database"] },
          { q: "Q7", title: "Q7", max: 15, topics: ["Networking"] },
          { q: "Q8", title: "Q8", max: 15, topics: ["Information System", "OS"] },
          { q: "Q9", title: "Q9", max: 15, topics: ["Logic Gates"] },
          { q: "Q10", title: "Q10", max: 15, topics: ["IoT, E-commerce, New Trends"] }
        ]
      }
    ]
  }
};
