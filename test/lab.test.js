const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateCodeLab, buildAngularJsExample } = require('../script.js');

test('buildAngularJsExample includes AngularJS app scaffold', () => {
  const source = buildAngularJsExample();
  assert.match(source, /angular\.module/i);
  assert.match(source, /app\.controller/i);
  assert.match(source, /track by/i);
  assert.match(source, /AngularJS/i);
});

test('evaluateCodeLab returns strong performance and security scores', () => {
  const score = evaluateCodeLab(`
    <div ng-app="performanceApp" ng-controller="MetricsCtrl">
      <div ng-repeat="item in items track by item.id">
        <span ng-bind="item.label"></span>
      </div>
      <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"></script>
    </div>
  `);

  assert.ok(score.performance >= 75, 'performance score should be strong');
  assert.ok(score.security >= 75, 'security score should be strong');
  assert.equal(score.status, 'Pass');
});

test('evaluateCodeLab flags unsafe APIs and inefficient repeated lists', () => {
  const score = evaluateCodeLab(`
    <div ng-repeat="item in items">{{ item.name }}</div>
    <script>eval(userInput); element.innerHTML = userInput;</script>
    $sce.trustAsHtml(userInput);
  `);

  assert.equal(score.status, 'Risk found');
  assert.ok(score.security < 75);
  assert.ok(score.performance < 75);
  assert.ok(score.checks.some(check => /eval/i.test(check.message)));
  assert.ok(score.checks.some(check => /track by/i.test(check.message)));
});

test('evaluateCodeLab reports an empty editor without claiming a pass', () => {
  const score = evaluateCodeLab('  ');

  assert.equal(score.status, 'Review');
  assert.equal(score.performance, 0);
  assert.equal(score.security, 0);
  assert.match(score.checks[0].message, /Add AngularJS code/);
});
