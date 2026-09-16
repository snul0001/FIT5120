export const RIASEC_QUESTIONS = [
  {
    id: 1,
    question: "Your uni's network drops mid-presentation. What's your role in fixing it?",
    options: [
      { letter: 'R', role: 'Computer Network Support Specialist', text: 'Physically check the switches and routers' },
      { letter: 'I', role: 'Computer Network Architect', text: 'Trace the root cause through the network logs' },
      { letter: 'A', role: 'Web and Digital Interface Designer', text: "Redesign the clunky status page everyone's staring at" },
      { letter: 'S', role: 'IT Support', text: 'Calmly help panicking classmates find a workaround' },
      { letter: 'E', role: 'IT Consultant', text: 'Message IT proposing how they could prevent this next time' },
      { letter: 'C', role: 'Database Administrator', text: 'Log the incident with timestamps for the report' }
    ]
  },
  {
    id: 2,
    question: "You're handed a messy, undocumented group project codebase:",
    options: [
      { letter: 'R', role: 'Telecom Engineering Specialist', text: "Check if it's actually a hardware/config issue" },
      { letter: 'I', role: 'Software Developer', text: 'Trace the logic line by line to understand what it does' },
      { letter: 'A', role: 'Video Game Designer', text: 'Mock up how much better this could look and feel' },
      { letter: 'S', role: 'Team Lead / Support', text: 'Get the group together to agree on next steps' },
      { letter: 'E', role: 'Project Manager', text: 'Push to cut scope so the team actually ships' },
      { letter: 'C', role: 'Software QA Tester', text: 'Write a proper README and start testing systematically' }
    ]
  },
  {
    id: 3,
    question: "Your team's 24-hour hackathon project just crashed with 2 hours left:",
    options: [
      { letter: 'R', role: 'Systems Administrator', text: 'Check if the server/hosting just fell over' },
      { letter: 'I', role: 'Computer Systems Analyst', text: 'Trace back through the code to find exactly where it broke' },
      { letter: 'A', role: 'Web Developer', text: "Focus on making sure the demo UI still looks finished" },
      { letter: 'S', role: 'Team Coordinator', text: "Check in on the team to manage stress and keep morale up" },
      { letter: 'E', role: 'ICT Business Analyst', text: "Rework the pitch so the crash doesn't sink the demo" },
      { letter: 'C', role: 'Web Administrator', text: 'Make a rapid checklist of what absolutely must work' }
    ]
  },
  {
    id: 4,
    question: "You have to choose ONE elective and can never take the others:",
    options: [
      { letter: 'R', role: 'Telecommunications', text: 'Hands-on labs wiring and configuring real network gear' },
      { letter: 'I', role: 'Penetration Testing', text: 'Breaking into systems legally to find weaknesses' },
      { letter: 'A', role: 'Game & Multimedia Dev', text: 'Designing and building a playable game from scratch' },
      { letter: 'S', role: 'IT Training & Support', text: 'Learning to teach non-technical people how systems work' },
      { letter: 'E', role: 'ICT Business Analysis', text: 'Translating business problems into tech requirements and pitching' },
      { letter: 'C', role: 'Database Systems', text: 'Designing and maintaining data structures everything runs on' }
    ]
  },
  {
    id: 5,
    question: "A friend's laptop is glitching before an exam:",
    options: [
      { letter: 'R', role: 'User Support Specialist', text: 'Physically inspect the machine' },
      { letter: 'I', role: 'Information Security Analyst', text: "Check if it's actually been compromised" },
      { letter: 'A', role: 'UI/UX Designer', text: "Suggest a cleaner reinstall/setup while you're in there" },
      { letter: 'S', role: 'IT Support Specialist', text: 'Patiently walk them through it, no judgment' },
      { letter: 'E', role: 'IT Sales / Advisor', text: 'Tell them which new laptop to just buy' },
      { letter: 'C', role: 'Database Architect', text: 'Back everything up methodically first' }
    ]
  },
  {
    id: 6,
    question: "Career fair—which booth do you linger at?",
    options: [
      { letter: 'R', role: 'Telecom / Infrastructure', text: 'Network/Telecom Infrastructure team' },
      { letter: 'I', role: 'Security / Hacking', text: 'Security / Penetration Testing team' },
      { letter: 'A', role: 'Media / Design', text: 'Game & Multimedia Development team' },
      { letter: 'S', role: 'Support / Training', text: 'ICT Customer Support / Training team' },
      { letter: 'E', role: 'Business / Analytics', text: 'Business Intelligence / Analyst team' },
      { letter: 'C', role: 'Database / Admin', text: 'Systems/Database Administration team' }
    ]
  },
  {
    id: 7,
    question: "Your club needs a working sign-up system by Friday:",
    options: [
      { letter: 'R', role: 'Network Specialist', text: 'Make sure the server/form can handle traffic' },
      { letter: 'I', role: 'Systems Analyst', text: "Check last year's data to predict turnout" },
      { letter: 'A', role: 'Video Game / Web Designer', text: 'Design something people actually enjoy using' },
      { letter: 'S', role: 'Community Lead', text: 'Ask members what annoyed them about last year system' },
      { letter: 'E', role: 'ICT Business Analyst', text: 'Pitch sponsors to fund a better tool' },
      { letter: 'C', role: 'Web Administrator', text: "Build the checklist so nothing's missed" }
    ]
  },
  {
    id: 8,
    question: "What made your best uni project satisfying?",
    options: [
      { letter: 'R', role: 'Hardware / Infra', text: 'It ran reliably under pressure, hardware and all' },
      { letter: 'I', role: 'QA Tester', text: 'You found the bug nobody else could' },
      { letter: 'A', role: 'Designer', text: 'People said it genuinely looked good' },
      { letter: 'S', role: 'Mentor', text: 'You helped a teammate get unstuck' },
      { letter: 'E', role: 'Product Lead', text: 'It could actually become something real' },
      { letter: 'C', role: 'DBA / Admin', text: 'Everything was clean, tested, and documented' }
    ]
  },
  {
    id: 9,
    question: "It's 11pm, 2 days before a major group assignment is due and files are missing. What do you do?",
    options: [
      { letter: 'R', role: 'Support Specialist', text: "Hop on a call and check everyone's setup to see what went wrong technically" },
      { letter: 'I', role: 'Systems Analyst', text: 'Go through the folder piece by piece to figure out exactly what is missing and why' },
      { letter: 'A', role: 'Web Developer', text: 'Rebuild the folder/doc into something clean and easy to navigate' },
      { letter: 'S', role: 'Support Lead', text: 'Message the teammate who sounds most stressed to check they are okay' },
      { letter: 'E', role: 'Business Analyst', text: 'Take charge and assign who is finishing what so it gets done' },
      { letter: 'C', role: 'Database Admin', text: "Create a proper file-naming system and tracker so this doesn't happen again" }
    ]
  },
  {
    id: 10,
    question: "LinkedIn headline you'd want after graduating:",
    options: [
      { letter: 'R', role: 'Infrastructure', text: '"Keeping infrastructure running at scale"' },
      { letter: 'I', role: 'Architect / Security', text: '"Finding what others miss"' },
      { letter: 'A', role: 'UI/UX Designer', text: '"Building products people love using"' },
      { letter: 'S', role: 'IT Support', text: '"Helping people get unstuck with tech"' },
      { letter: 'E', role: 'Business Analyst', text: '"Turning ideas into business wins"' },
      { letter: 'C', role: 'Database Admin', text: '"Making sure nothing falls through the cracks"' }
    ]
  }
];

export const getTopHollandCodes = (answers) => {
  const tallies = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  Object.values(answers).forEach((letter) => {
    if (tallies[letter] !== undefined) tallies[letter]++;
  });

  const sortedLetters = Object.keys(tallies).sort((a, b) => tallies[b] - tallies[a]);
  return [sortedLetters[0], sortedLetters[1]].join('');
};