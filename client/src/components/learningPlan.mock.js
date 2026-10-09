
const DEMO_SKILLS = [
  {
    name: 'SQL',
    score: 0.81,
    skill_type: 'Technical',
    hours: '20 hrs',
    why: 'SQL is foundational for querying and managing data in software systems.',
    resource: 'https://sqlzoo.net/',
    completed: false,
  },
  {
    name: 'Software Design',
    score: 0.88,
    skill_type: 'Technical',
    hours: '24 hrs',
    why: 'Design principles and patterns help build maintainable, scalable applications.',
    resource: 'https://refactoring.guru/',
    completed: false,
  },
  {
    name: 'Agile Methodologies',
    score: 0.70,
    skill_type: 'Technical',
    hours: '12 hrs',
    why: 'Learn to plan work, deliver incrementally, and respond to feedback.',
    resource: 'https://www.atlassian.com/agile',
    completed: false,
  },
  {
    name: 'Testing and Quality Assurance',
    score: 0.76,
    skill_type: 'Technical',
    hours: '16 hrs',
    why: 'Testing helps identify regressions and improve software reliability.',
    resource: 'https://testing-library.com/',
    completed: false,
  },
  {
    name: 'Version Control with Git',
    score: 0.73,
    skill_type: 'Technical',
    hours: '10 hrs',
    why: 'Practise version control, collaboration, and safe change management.',
    resource: 'https://git-scm.com/book/en/v2',
    completed: false,
  },
  {
    name: 'Technical Communication',
    score: 0.75,
    skill_type: 'Soft',
    hours: '8 hrs',
    why: 'Communicate technical decisions clearly to teammates and stakeholders.',
    resource: 'https://developers.google.com/tech-writing',
    completed: false,
  },
];

export function createMockLearningPlan({
  anzscoCode = '2613',
  occupationName = 'Software and Applications Programmers',
  durationMonths = 6,
  hrsPerWeek = 10,
  missingSkills = [],
} = {}) {
  const duration = [3, 6, 9].includes(Number(durationMonths))
    ? Number(durationMonths)
    : 6;

  const weeklyHours = Number(hrsPerWeek) || 5;

  const suppliedSkills = missingSkills
    .map((skill, index) => {
      const fallback = DEMO_SKILLS[index % DEMO_SKILLS.length];

      const name =
        typeof skill === 'string'
          ? skill
          : skill?.name || skill?.skill_name;

      if (!name) return null;

      return {
        ...fallback,
        ...(typeof skill === 'object' && skill ? skill : {}),
        name,
        completed: false,
      };
    })
    .filter(Boolean);

  // Use real skill-gap names when available; otherwise use sample skills.
  const skills = suppliedSkills.length
    ? suppliedSkills
    : DEMO_SKILLS.map(skill => ({ ...skill }));

  const monthBuckets = Array.from(
    { length: duration },
    () => []
  );

  skills.forEach((skill, index) => {
    monthBuckets[index % duration].push(skill);
  });

  const phases = [];

  for (let start = 1; start <= duration; start += 3) {
    const end = Math.min(start + 2, duration);

    phases.push({
      phase: `Months ${start}-${end}`,
      focus:
        start === 1
          ? 'Foundation'
          : start === 4
            ? 'Building'
            : 'Integration',

      months: Array.from(
        { length: end - start + 1 },
        (_, index) => {
          const monthNumber = start + index;

          return {
            month: `Month ${monthNumber}`,
            total_hrs: weeklyHours * 4,
            skills: monthBuckets[monthNumber - 1],
          };
        }
      ),
    });
  }

  return {
    plan_code: `DEMO-${anzscoCode}-${duration}M`,
    occupation_name: occupationName,
    anzsco_code: String(anzscoCode),
    duration_months: duration,
    hrs_per_week: weeklyHours,
    total_skills: skills.length,
    total_hrs: duration * 4 * weeklyHours,
    phases,
  };
}
