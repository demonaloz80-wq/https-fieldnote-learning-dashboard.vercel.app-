const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCourseModules } = require('../lib/fieldnote-api-proxy');

function completeModule() {
  return {
    title: 'Build a semantic page',
    objective: 'Create a page that communicates structure to browsers and assistive technology.',
    content: 'Use semantic landmarks and headings.',
    keyPoints: ['Choose semantic elements by meaning.', 'Maintain a logical heading hierarchy.', 'Use links for navigation and buttons for actions.'],
    practice: 'Build a page with a header, navigation, main landmark, and a correctly nested heading structure.',
    videoUrl: 'https://youtu.be/UB1O30fR-EE',
    assessmentQuestions: [
      { prompt: 'What is main for?', options: ['Primary page content', 'A generic container', 'A navigation menu'], answerIndex: 0 },
      { prompt: 'What follows h1?', options: ['h2 for a subsection', 'h4 for style', 'Any heading'], answerIndex: 0 },
      { prompt: 'What should trigger an action?', options: ['A button', 'A heading', 'An image'], answerIndex: 0 }
    ]
  };
}

test('course publishing stores lesson objectives, key ideas, practice, YouTube URLs, and authored assessments', () => {
  const [lesson] = validateCourseModules([completeModule()]);

  assert.equal(lesson.objective, completeModule().objective);
  assert.deepEqual(lesson.keyPoints, completeModule().keyPoints);
  assert.equal(lesson.practice, completeModule().practice);
  assert.equal(lesson.videoUrl, completeModule().videoUrl);
  assert.equal(lesson.assessmentQuestions.length, 3);
  assert.equal(lesson.assessmentQuestions[0].answerIndex, 0);
});

test('course publishing rejects lessons below the learning-content standard', () => {
  const lesson = completeModule();
  lesson.keyPoints = ['Only two', 'key ideas'];
  assert.throws(() => validateCourseModules([lesson]), /3 to 8 key ideas/);

  const withoutPractice = completeModule();
  delete withoutPractice.practice;
  assert.throws(() => validateCourseModules([withoutPractice]), /applied practice task/);

  const withoutQuestions = completeModule();
  withoutQuestions.assessmentQuestions.pop();
  assert.throws(() => validateCourseModules([withoutQuestions]), /between 3 and 20 assessment questions/);
});

test('course publishing continues to reject non-YouTube video URLs', () => {
  const lesson = completeModule();
  lesson.videoUrl = 'https://example.com/video';
  assert.throws(() => validateCourseModules([lesson]), /valid YouTube video URL/);
});
