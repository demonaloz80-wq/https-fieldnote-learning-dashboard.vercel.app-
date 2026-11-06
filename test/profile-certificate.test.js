const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidMatricScore, hasCompletedCourse, instructorAssessmentQuestions, buildLessonAssessmentQuestions, hasPassedCourseAssessments, instructorKeyPoints, validateInstructorLessonStandards, normalizeYouTubeEmbedUrl, isValidInstructorProfile, escapeCertificateText, buildCourseCertificateMarkup, buildPdfWithJpegImage, validateImageUpload } = require('../script.js');

test('Ethiopian Grade 12 matric score accepts only values from 2.00 to 6.00', () => {
  assert.equal(isValidMatricScore(''), true);
  assert.equal(isValidMatricScore(2), true);
  assert.equal(isValidMatricScore(2.1), true);
  assert.equal(isValidMatricScore(4.25), true);
  assert.equal(isValidMatricScore(6), true);
  assert.equal(isValidMatricScore(1.99), false);
  assert.equal(isValidMatricScore(6.01), false);
  assert.equal(isValidMatricScore(3.444), false);
  assert.equal(isValidMatricScore('not a score'), false);
});

test('course completion requires every lesson to be complete', () => {
  assert.equal(hasCompletedCourse({ completed: 3 }, 4), false);
  assert.equal(hasCompletedCourse({ completed: 4 }, 4), true);
  assert.equal(hasCompletedCourse({ completed: 5 }, 4), true);
  assert.equal(hasCompletedCourse(null, 4), false);
  assert.equal(hasCompletedCourse({ completed: 4 }, 0), false);
});

test('lesson tests use the instructor-authored options and answer', () => {
  const lesson = {
    assessmentQuestions: [
      { prompt: 'Which is correct?', options: ['First', 'Second', 'Third'], answerIndex: 1 }
    ]
  };
  assert.deepEqual(instructorAssessmentQuestions(lesson), [
    { prompt: 'Which is correct?', options: ['First', 'Second', 'Third'], answer: 'Second' }
  ]);
  assert.deepEqual(instructorAssessmentQuestions({}), []);
});

test('built-in lesson assessment questions cover the outcome, key ideas, and applied practice', () => {
  const lesson = {
    id: 'semantics',
    title: 'Build a semantic page',
    objective: 'Create a page that communicates structure.',
    keyPoints: ['Choose elements by meaning.', 'Maintain a logical heading hierarchy.'],
    practice: 'Build a page with clear landmarks and headings.'
  };
  const lessonBank = [
    lesson,
    { id: 'responsive', objective: 'Adapt layouts to different viewport widths.', keyPoints: ['Use flexible grid tracks.'] }
  ];
  const questions = buildLessonAssessmentQuestions(lesson, lessonBank);

  assert.equal(questions.length, 4);
  assert.match(questions[0].prompt, /outcome/);
  assert.match(questions[3].prompt, /practice task/);
  questions.forEach((question, index) => {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options).size, 4);
    assert.equal(question.options[question.answerIndex], [
      lesson.objective,
      lesson.keyPoints[0],
      lesson.keyPoints[1],
      lesson.practice
    ][index]);
  });
});

test('Nanodegree eligibility requires a passing result for every lesson', () => {
  const course = { id: 'web', curriculum: [{ id: 'one' }, { id: 'two' }] };
  assert.equal(hasPassedCourseAssessments({ 'web:one': { passed: true }, 'web:two': { passed: true } }, course), true);
  assert.equal(hasPassedCourseAssessments({ 'web:one': { passed: true }, 'web:two': { passed: false } }, course), false);
  assert.equal(hasPassedCourseAssessments({ 'web:one': { passed: true } }, course), false);
  assert.equal(hasPassedCourseAssessments({}, { id: 'empty', curriculum: [] }), false);
});

test('instructor lesson standards require concise key ideas and applied practice', () => {
  const lesson = {
    keyPointsText: 'Semantic elements describe meaning.\nHeadings form a logical outline.\nButtons perform actions.',
    practice: 'Build a semantic page and verify its outline with a screen reader.'
  };
  assert.deepEqual(instructorKeyPoints(lesson.keyPointsText), [
    'Semantic elements describe meaning.',
    'Headings form a logical outline.',
    'Buttons perform actions.'
  ]);
  assert.equal(validateInstructorLessonStandards(lesson), '');
  assert.match(validateInstructorLessonStandards({ keyPointsText: 'Only one', practice: 'Build something.' }), /3 to 8 concise key ideas/);
  assert.match(validateInstructorLessonStandards({ keyPointsText: 'One\nTwo\nThree', practice: '' }), /applied practice task/);
});

test('YouTube URLs normalize to privacy-enhanced embeds and reject other hosts', () => {
  assert.equal(normalizeYouTubeEmbedUrl('https://www.youtube.com/watch?v=UB1O30fR-EE'), 'https://www.youtube-nocookie.com/embed/UB1O30fR-EE?rel=0');
  assert.equal(normalizeYouTubeEmbedUrl('https://youtu.be/UB1O30fR-EE'), 'https://www.youtube-nocookie.com/embed/UB1O30fR-EE?rel=0');
  assert.equal(normalizeYouTubeEmbedUrl('https://youtube.com/embed/UB1O30fR-EE'), 'https://www.youtube-nocookie.com/embed/UB1O30fR-EE?rel=0');
  assert.equal(normalizeYouTubeEmbedUrl('https://example.com/embed/UB1O30fR-EE'), '');
  assert.equal(normalizeYouTubeEmbedUrl('javascript:alert(1)'), '');
  assert.equal(normalizeYouTubeEmbedUrl('https://youtu.be/invalid'), '');
});

test('instructor registration requires education and teaching subjects', () => {
  assert.equal(isValidInstructorProfile('Master degree', ['Mathematics']), true);
  assert.equal(isValidInstructorProfile('', ['Mathematics']), false);
  assert.equal(isValidInstructorProfile('Master degree', []), false);
});

test('certificate text escapes markup characters', () => {
  assert.equal(escapeCertificateText('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('certificate contains instructor sign-off, teaching details, and student signature', () => {
  const markup = buildCourseCertificateMarkup({
    studentName: 'Aster Student',
    courseTitle: 'Web Foundations',
    instructorName: 'Maya Chen',
    instructorRole: 'Product designer',
    instructorSpecialty: 'UX Design',
    issuedDate: 'October 12, 2026'
  });

  assert.match(markup, /Aster Student/);
  assert.match(markup, /Web Foundations/);
  assert.match(markup, /Maya Chen/);
  assert.match(markup, /Teaches UX Design/);
  assert.match(markup, /Instructor sign-off/);
  assert.match(markup, /Student signature/);
});

test('Nanodegree certificate PDF has a valid image page and cross-reference offsets', () => {
  const pdf = buildPdfWithJpegImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), 1600, 1131);
  const source = Buffer.from(pdf).toString('latin1');
  assert.match(source, /^%PDF-1\.4/);
  assert.match(source, /\/MediaBox \[0 0 842 595\]/);
  assert.match(source, /\/Subtype \/Image \/Width 1600 \/Height 1131/);
  const xrefOffset = Number(source.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(source.slice(xrefOffset, xrefOffset + 5), 'xref\n');
  const xref = source.slice(xrefOffset).split('\n');
  const objectCount = Number(xref[1].split(' ')[1]);
  for (let objectNumber = 1; objectNumber < objectCount; objectNumber += 1) {
    const offset = Number(xref[2 + objectNumber].slice(0, 10));
    assert.ok(source.startsWith(objectNumber + ' 0 obj\n', offset));
  }
});

test('Nanodegree PDF builder rejects missing image data', () => {
  assert.throws(() => buildPdfWithJpegImage(new Uint8Array(), 1600, 1131), /valid JPEG image/);
  assert.throws(() => buildPdfWithJpegImage(Uint8Array.from([1]), 0, 1131), /valid JPEG image/);
});

test('image uploads accept PNG, JPEG, or WebP up to 5 MB', () => {
  const limit = 5 * 1024 * 1024;
  assert.equal(validateImageUpload({ type: 'image/png', size: limit }), '');
  assert.equal(validateImageUpload({ type: 'image/jpeg', size: limit - 1 }), '');
  assert.equal(validateImageUpload({ type: 'image/webp', size: limit + 1 }), 'The image must be 5 MB or smaller.');
  assert.equal(validateImageUpload({ type: 'application/pdf', size: 100 }), 'Choose a PNG, JPG, or WebP image.');
});
