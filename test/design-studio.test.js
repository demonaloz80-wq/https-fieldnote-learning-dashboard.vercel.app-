const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildDesignPreviewDocument } = require('../script.js');
const studioView = fs.readFileSync(require.resolve('../views/designStudio.html'), 'utf8');

test('Design Studio includes photo, magazine, and local video editing workspaces', () => {
  assert.match(studioView, /Photo editor/);
  assert.match(studioView, /exportDesignPhoto\(\)/);
  assert.match(studioView, /Magazine layout/);
  assert.match(studioView, /exportMagazineLayout\(\)/);
  assert.match(studioView, /Video &amp; motion/);
  assert.match(studioView, /previewDesignVideo\(\)/);
  assert.match(studioView, /exportVideoEdit\(\)/);
});

test('design preview blocks network and isolates prototype code', () => {
  const document = buildDesignPreviewDocument('<main>Prototype</main>', 'main{color:green}', 'document.title = "Prototype";');

  assert.match(document, /<meta http-equiv="Content-Security-Policy"/);
  assert.match(document, /connect-src 'none'/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /<main>Prototype<\/main>/);
  assert.match(document, /document.title = "Prototype";/);
});

test('design preview escapes closing style and script tags in editor source', () => {
  const document = buildDesignPreviewDocument(
    '<main>Prototype</main>',
    'body::after{content:"</style><script>"}',
    'var example = "</script>";'
  );

  assert.match(document, /<\\\/style><script>/);
  assert.match(document, /var example = "<\\\/script>";/);
  assert.doesNotMatch(document, /content:"<\/style><script>/);
  assert.doesNotMatch(document, /var example = "<\/script>";/);
});
