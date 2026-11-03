const test = require('node:test');
const assert = require('node:assert/strict');

const { isValidMatricScore, hasCompletedCourse, normalizeYouTubeEmbedUrl, isValidInstructorProfile, escapeCertificateText, buildCourseCertificateMarkup, validateImageUpload } = require('../script.js');

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

test('image uploads accept PNG, JPEG, or WebP up to 5 MB', () => {
  const limit = 5 * 1024 * 1024;
  assert.equal(validateImageUpload({ type: 'image/png', size: limit }), '');
  assert.equal(validateImageUpload({ type: 'image/jpeg', size: limit - 1 }), '');
  assert.equal(validateImageUpload({ type: 'image/webp', size: limit + 1 }), 'The image must be 5 MB or smaller.');
  assert.equal(validateImageUpload({ type: 'application/pdf', size: 100 }), 'Choose a PNG, JPG, or WebP image.');
});
