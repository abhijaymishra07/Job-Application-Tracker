const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

const DEMO_EMAIL = 'abhijaymishra07@gmail.com';
const DEMO_PASSWORD = 'Demo@123';
const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(10 + (Math.abs(offset) % 5), 30, 0, 0);
  return d;
}

function daysAgo(days) {
  return daysFromNow(-days);
}

function afterApplied(applied, days) {
  const at = new Date(applied.getTime() + days * DAY);
  const latest = new Date(Date.now() - 60 * 60 * 1000);
  return at > latest ? latest : at;
}

const SAMPLE = [
  {
    company: 'Google',
    role: 'Software Engineer Intern',
    status: 'Interview',
    source: 'Campus',
    location: 'Bangalore, Hybrid',
    jobUrl: 'https://careers.google.com/jobs',
    salary: 80000,
    appliedAgo: 40,
    steps: [['OA', 6], ['Interview', 14]],
    interviewDate: daysFromNow(3),
    recruiterName: 'Priya Nair',
    recruiterEmail: 'priya.nair@google.com',
    notes: 'Phone screen went well. Prepare system design of a URL shortener and LeetCode graphs.',
    tags: ['dream', 'product'],
    customFields: { 'CGPA cutoff': 8, 'Bond months': 0, 'Work mode': 'Hybrid' },
    rounds: [
      { name: 'Online assessment', type: 'OA', at: 6, result: 'Passed', feedback: '2/2 solved, 1 partial on graphs.' },
      { name: 'Technical interview 1', type: 'Technical', at: 20, result: 'Passed', feedback: 'DSA + resume deep dive.' },
      { name: 'Technical interview 2', type: 'Technical', future: 3, result: 'Pending', feedback: '' },
    ],
  },
  {
    company: 'Microsoft',
    role: 'SWE Intern — Azure',
    status: 'OA',
    source: 'LinkedIn',
    location: 'Hyderabad',
    jobUrl: 'https://careers.microsoft.com',
    salary: 75000,
    appliedAgo: 12,
    steps: [['OA', 5]],
    interviewDate: daysFromNow(1),
    recruiterName: 'Rahul Mehta',
    notes: 'Codility OA scheduled. Focus on arrays, sliding window, and SQL joins.',
    tags: ['dream', 'cloud'],
    customFields: { 'CGPA cutoff': 7.5, 'Work mode': 'Onsite' },
    rounds: [{ name: 'Codility assessment', type: 'OA', future: 1, result: 'Pending', feedback: '' }],
  },
  {
    company: 'Amazon',
    role: 'SDE Intern',
    status: 'Applied',
    source: 'Company Site',
    location: 'Bangalore',
    jobUrl: 'https://www.amazon.jobs',
    salary: 70000,
    appliedAgo: 26,
    followUpDate: daysAgo(2),
    notes: 'Referred via alumni. Waiting for OA invite. Leadership principles examples ready.',
    tags: ['referral'],
    customFields: { 'Work mode': 'Onsite' },
  },
  {
    company: 'Atlassian',
    role: 'Backend Intern',
    status: 'Offer',
    source: 'Referral',
    location: 'Remote / Bangalore',
    jobUrl: 'https://www.atlassian.com/company/careers',
    salary: 90000,
    appliedAgo: 75,
    steps: [['Interview', 12], ['Offer', 30]],
    interviewDate: daysAgo(50),
    offerDeadline: daysFromNow(3),
    recruiterName: 'Sana Kapoor',
    recruiterEmail: 'sana.k@atlassian.com',
    notes: 'Offer received. Need to reply by Friday. Team: Jira Cloud platform.',
    tags: ['dream', 'remote-friendly'],
    customFields: { 'Bond months': 0, 'PPO chance': 'High', 'Work mode': 'Remote' },
    rounds: [
      { name: 'Technical interview', type: 'Technical', at: 15, result: 'Passed', feedback: 'Built a rate limiter live.' },
      { name: 'Values interview', type: 'Managerial', at: 22, result: 'Passed', feedback: '' },
      { name: 'HR discussion', type: 'HR', at: 27, result: 'Passed', feedback: 'Stipend and start date confirmed.' },
    ],
  },
  {
    company: 'Flipkart',
    role: 'SDE Intern',
    status: 'Rejected',
    source: 'Naukri',
    location: 'Bangalore',
    appliedAgo: 70,
    steps: [['OA', 4], ['Rejected', 11]],
    notes: 'Rejected after OA. Revisit DP on trees before next marketplace round.',
    rounds: [{ name: 'Online assessment', type: 'OA', at: 8, result: 'Failed', feedback: 'Timed out on tree DP.' }],
  },
  {
    company: 'Swiggy',
    role: 'Frontend Intern',
    status: 'Interview',
    source: 'LinkedIn',
    location: 'Bangalore',
    jobUrl: 'https://careers.swiggy.com',
    salary: 50000,
    appliedAgo: 20,
    steps: [['Interview', 9]],
    interviewDate: daysFromNow(6),
    recruiterName: 'Arjun Iyer',
    notes: 'React + performance round. Prepare virtualization and memoization examples.',
    tags: ['frontend'],
  },
  {
    company: 'CRED',
    role: 'Full Stack Intern',
    status: 'Applied',
    source: 'Company Site',
    location: 'Bangalore',
    appliedAgo: 9,
    followUpDate: daysFromNow(1),
    notes: 'Cover letter mentioned MongoDB aggregation project from DBMS course.',
    tags: ['fintech'],
  },
  {
    company: 'Zoho',
    role: 'Software Developer',
    status: 'OA',
    source: 'Campus',
    location: 'Chennai',
    appliedAgo: 50,
    steps: [['OA', 3]],
    interviewDate: daysFromNow(5),
    notes: 'Long-form coding OA. Practice C++ STL and nested loops without TLE.',
    customFields: { 'CGPA cutoff': 7, 'Bond months': 12 },
  },
  {
    company: 'Oracle',
    role: 'Server Technology Intern',
    status: 'Saved',
    source: 'LinkedIn',
    location: 'Hyderabad',
    jobUrl: 'https://www.oracle.com/careers',
    notes: 'Need referral from 2023 VIT alumni before applying. Resume not tailored yet.',
  },
  {
    company: 'Goldman Sachs',
    role: 'Summer Analyst — Engineering',
    status: 'Interview',
    source: 'Campus',
    location: 'Bangalore',
    salary: 100000,
    appliedAgo: 45,
    steps: [['OA', 7], ['Interview', 20]],
    interviewDate: daysFromNow(2),
    recruiterName: 'Meera Shah',
    notes: 'Superday: 2 technical + 1 hirevue. Brush up hashes, concurrency, and probability.',
    tags: ['finance'],
    customFields: { 'CGPA cutoff': 8.5 },
    rounds: [
      { name: 'HackerRank OA', type: 'OA', at: 10, result: 'Passed', feedback: '' },
      { name: 'Superday', type: 'Technical', future: 2, result: 'Pending', feedback: '' },
    ],
  },
  {
    company: 'Razorpay',
    role: 'SDE Intern',
    status: 'Applied',
    source: 'Referral',
    location: 'Bangalore',
    appliedAgo: 34,
    notes: 'Fintech stack: Node, Mongo, Kafka. Highlight this tracker as a portfolio piece.',
    tags: ['fintech', 'referral'],
    customFields: { Stack: 'Node, Mongo, Kafka' },
  },
  {
    company: 'Infosys',
    role: 'Specialist Programmer',
    status: 'Rejected',
    source: 'Campus',
    location: 'Mysore',
    appliedAgo: 100,
    steps: [['OA', 5], ['Rejected', 20]],
    notes: 'HackWithInfy — did not clear round 2. Keep for volume analytics.',
  },
  {
    company: 'Adobe',
    role: 'Product Intern',
    status: 'Saved',
    source: 'LinkedIn',
    location: 'Noida',
    notes: 'Need a stronger product-case writeup in the cover letter before applying.',
  },
  {
    company: 'PhonePe',
    role: 'SDE Intern',
    status: 'Offer',
    source: 'Referral',
    location: 'Pune / Bangalore',
    salary: 85000,
    appliedAgo: 85,
    steps: [['OA', 6], ['Interview', 18], ['Offer', 35]],
    interviewDate: daysAgo(60),
    offerDeadline: daysFromNow(8),
    recruiterName: 'Nikhil Rao',
    notes: 'Competing offer with Atlassian. Compare intern conversion rates and team.',
    tags: ['fintech'],
    customFields: { 'Bond months': 6, 'PPO chance': 'Medium', 'Work mode': 'Onsite' },
    rounds: [
      { name: 'Online assessment', type: 'OA', at: 6, result: 'Passed', feedback: '' },
      { name: 'Technical interview', type: 'Technical', at: 22, result: 'Passed', feedback: '' },
    ],
  },
  {
    company: 'Texas Instruments',
    role: 'Digital Design Intern',
    status: 'Rejected',
    source: 'Campus',
    location: 'Bangalore',
    appliedAgo: 210,
    steps: [['Rejected', 25]],
    notes: 'Early-season application from the previous semester.',
  },
  {
    company: 'Deloitte',
    role: 'Analyst Intern',
    status: 'Rejected',
    source: 'Naukri',
    location: 'Hyderabad',
    appliedAgo: 270,
    steps: [['Rejected', 14]],
    notes: 'First application of the season.',
  },
];

function buildDocument(item, userId) {
  const { appliedAgo, steps = [], rounds = [], ...fields } = item;
  const doc = { ...fields, userId };

  if (appliedAgo === undefined) {
    doc.statusHistory = [{ status: item.status, changedAt: daysAgo(3) }];
    return doc;
  }

  const applied = daysAgo(appliedAgo);
  doc.appliedDate = applied;
  doc.statusHistory = [
    { status: 'Applied', changedAt: applied },
    ...steps.map(([status, after]) => ({ status, changedAt: afterApplied(applied, after) })),
  ];
  doc.rounds = rounds.map(({ at, future, ...round }) => ({
    ...round,
    scheduledAt: future !== undefined ? daysFromNow(future) : afterApplied(applied, at),
  }));
  return doc;
}

async function seedDatabase() {
  await Application.init();

  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    user = await User.create({
      name: 'Abhijay Mishra',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      university: 'VIT Vellore',
    });
    console.log('Created demo user');
  } else {
    console.log('Demo user already exists');
  }

  await Application.deleteMany({ userId: user._id });
  await Notification.deleteMany({ userId: user._id });
  const docs = SAMPLE.map((item) => buildDocument(item, user._id));
  await Application.insertMany(docs);

  console.log(`Seeded ${docs.length} applications for ${DEMO_EMAIL}`);
  console.log('Login with:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

module.exports = { seedDatabase, DEMO_EMAIL, DEMO_PASSWORD };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const connectDB = require('../config/db');
  connectDB()
    .then(() => seedDatabase())
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
