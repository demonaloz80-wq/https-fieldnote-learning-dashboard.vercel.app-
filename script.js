function buildAngularJsExample(fileName = 'app.js') {
  const examples = {
    'app.js': `var app = angular.module('performanceApp', ['ngSanitize']);

// AngularJS course example.
app.controller('MetricsCtrl', function ($scope) {
  $scope.items = [
    { id: 1, label: 'Bundle size' },
    { id: 2, label: 'Cache hit rate' },
    { id: 3, label: 'Security hardening' }
  ];
});
// Template: <li ng-repeat="item in items track by item.id" ng-bind="item.label"></li>`,
    'performance.js': `var app = angular.module('performanceApp', []);
app.controller('MetricsCtrl', function ($scope) {
  $scope.items = [{ id: 1, label: 'Focus' }, { id: 2, label: 'Practice' }];
});
// Template: <li ng-repeat="item in items track by item.id" ng-bind="::item.label"></li>`,
    'security.js': `var app = angular.module('securityApp', ['ngSanitize']);
app.controller('ContentCtrl', function ($scope) {
  $scope.message = 'AngularJS binds this text safely.';
});
// Template: <p ng-bind="message"></p>`
  };
  return examples[fileName] || examples['app.js'];
}

function evaluateCodeLab(source) {
  const code = String(source || '');
  const checks = [];
  const add = (area, status, message) => checks.push({ area, status, message });
  if (!code.trim()) {
    add('Code', 'review', 'Add AngularJS code to run the checks.');
    return { performance: 0, security: 0, status: 'Review', summary: 'Review. Static checks only; pasted code is not executed.', checks };
  }

  add('AngularJS', /angular\.module|ng-app|ng-controller/i.test(code) ? 'pass' : 'review',
    /angular\.module|ng-app|ng-controller/i.test(code) ? 'AngularJS app structure detected.' : 'No AngularJS app or controller pattern detected.');
  const unsafePatterns = [
    [/\beval\s*\(/i, 'Avoid eval(); it can execute untrusted input.'],
    [/\$sce\.trustAsHtml/i, 'Review $sce.trustAsHtml; trusted HTML can bypass AngularJS protections.'],
    [/\binnerHTML\b|\.html\s*\(/i, 'Avoid direct HTML insertion; use AngularJS bindings for user content.']
  ];
  const unsafe = unsafePatterns.filter(([pattern]) => pattern.test(code));
  unsafe.forEach(([, message]) => add('Security', 'risk', message));
  if (!unsafe.length) add('Security', 'pass', 'No eval or direct HTML insertion patterns detected.');
  if (/ng-bind\s*=|\{\{[^}]+\}\}/i.test(code)) add('Security', 'pass', 'Text uses AngularJS bindings, which escape values by default.');
  if (/ng-bind-html/i.test(code) && !/ngsanitize/i.test(code.toLowerCase())) {
    add('Security', 'review', 'ng-bind-html found; verify ngSanitize is configured and content is trusted.');
  }

  const repeats = code.match(/ng-repeat\s*=\s*["'][^"']*["']/ig) || [];
  if (repeats.some(repeat => !/track\s+by/i.test(repeat))) add('Performance', 'review', 'Add track by to repeated lists to reduce unnecessary DOM work.');
  else if (repeats.length) add('Performance', 'pass', 'Repeated lists use track by for stable item identity.');
  if (/\$watch\s*\([^,]+,\s*[^,]+,\s*true\s*\)/i.test(code)) add('Performance', 'review', 'Deep $watch can be expensive; watch a specific value where possible.');
  if (/\bng-bind\s*=|::\s*[\w.$]+/.test(code)) add('Performance', 'pass', 'One-way text binding reduces unnecessary view updates.');
  if (!checks.some(item => item.area === 'Performance')) add('Performance', 'review', 'Review list tracking and bindings for large views.');

  const scoreFor = area => {
    const items = checks.filter(item => item.area === area);
    if (!items.length) return 100;
    return Math.round(items.reduce((sum, item) => sum + (item.status === 'pass' ? 1 : item.status === 'review' ? 0.5 : 0), 0) / items.length * 100);
  };
  const performance = scoreFor('Performance');
  const security = scoreFor('Security');
  const status = checks.some(item => item.status === 'risk') ? 'Risk found' : performance >= 75 && security >= 75 ? 'Pass' : 'Review';
  return { performance, security, status, summary: `${status}. Static checks only; pasted code is not executed.`, checks };
}

function isValidMatricScore(value) {
	if (value === '' || value === null || value === undefined) return true;
	const score = Number(value);
	const hundredths = score * 100;
	return Number.isFinite(score) && score >= 2 && score <= 6 && Math.abs(hundredths - Math.round(hundredths)) < 1e-8;
}

function hasCompletedCourse(enrollment, lessonCount) {
	return !!enrollment && lessonCount > 0 && Number(enrollment.completed) >= lessonCount;
}

function normalizeYouTubeEmbedUrl(value) {
	try {
		var url = new URL(String(value || ""));
		var host = url.hostname.toLowerCase().replace(/^www\./, "");
		var videoId = "";
		if (url.protocol !== "https:" && url.protocol !== "http:") return "";
		if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
		else if (["youtube.com", "m.youtube.com", "youtube-nocookie.com"].indexOf(host) !== -1) {
			videoId = url.pathname === "/watch" ? url.searchParams.get("v") || "" : (url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/) || [])[1] || "";
		}
		return /^[\w-]{11}$/.test(videoId) ? "https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0" : "";
	} catch (error) {
		return "";
	}
}

function isValidInstructorProfile(education, teachingSubjects) {
	const hasSubjects = Array.isArray(teachingSubjects)
		? teachingSubjects.some(subject => String(subject || '').trim())
		: Boolean(String(teachingSubjects || '').trim());
	return Boolean(String(education || '').trim() && hasSubjects);
}

function escapeCertificateText(value) {
	return String(value || '').replace(/[&<>"']/g, character => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[character]));
}

function validateImageUpload(file, maxBytes = 5 * 1024 * 1024) {
	if (!file) return "Choose an image file.";
	if (["image/png", "image/jpeg", "image/webp"].indexOf(file.type) === -1) return "Choose a PNG, JPG, or WebP image.";
	if (file.size > maxBytes) return "The image must be 5 MB or smaller.";
	return "";
}

function buildCourseCertificateMarkup(details) {
	const studentName = escapeCertificateText(details.studentName);
	const courseTitle = escapeCertificateText(details.courseTitle);
	const instructorName = escapeCertificateText(details.instructorName);
	const instructorRole = escapeCertificateText(details.instructorRole);
	const instructorSpecialty = escapeCertificateText(details.instructorSpecialty);
	const issuedDate = escapeCertificateText(details.issuedDate);
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Certificate - ${courseTitle}</title><style>*{box-sizing:border-box}body{margin:0;padding:36px;background:#f5f7f2;color:#172a25;font:16px/1.5 Georgia,serif}.certificate{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:calc(100vh - 72px);padding:64px;border:12px double #1d6b52;background:#fff;text-align:center}.eyebrow{font:700 12px Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#1d6b52}.title{margin:14px 0 24px;font:700 38px/1.1 Georgia,serif}.student{margin:12px 0;font:italic 36px/1.2 Georgia,serif;color:#174d3d}.course{margin:14px 0 32px;font:700 24px/1.3 Georgia,serif}.signatures{display:flex;justify-content:space-around;gap:40px;margin-top:34px}.signature{min-width:220px;padding-top:12px;border-top:1px solid #718078}.signed-name{display:block;margin-bottom:4px;font:italic 25px/1.2 "Brush Script MT",cursive;color:#174d3d}.role,.date{font:12px Arial,sans-serif;color:#52665b}.instructor-meta{margin:4px 0 10px;font:11px Arial,sans-serif;color:#52665b}.notice{margin-top:30px;font:11px Arial,sans-serif;color:#718078}@media print{body{padding:0;background:#fff}.certificate{min-height:100vh;break-inside:avoid}}</style></head><body><main class="certificate"><div class="eyebrow">Fieldnote Learning</div><h1 class="title">Certificate of Completion</h1><p>This certificate is awarded to</p><div class="student">${studentName}</div><p>for successfully completing</p><div class="course">${courseTitle}</div><div class="signatures"><div class="signature"><span class="signed-name">${instructorName}</span><span class="role">Instructor sign-off</span><div class="instructor-meta">${instructorRole} · Teaches ${instructorSpecialty}</div></div><div class="signature"><span class="signed-name">${studentName}</span><span class="role">Student signature</span></div></div><p class="date">Issued ${issuedDate}</p><p class="notice">Browser-generated course record; instructor name is a typed sign-off, not a verified digital signature or accredited credential.</p></main></body></html>`;
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { buildAngularJsExample, evaluateCodeLab, isValidMatricScore, hasCompletedCourse, normalizeYouTubeEmbedUrl, isValidInstructorProfile, escapeCertificateText, buildCourseCertificateMarkup, validateImageUpload };
}


if (typeof angular !== 'undefined') {

		(function () {
			"use strict";
			var app = angular.module("learnLoopApp", []);
			app.factory("LearningDatabase", function ($window, $q) {
				var databasePromise;
				function openDatabase() {
					if (!$window.indexedDB) return $q.reject(new Error("IndexedDB is unavailable."));
					if (!databasePromise) {
						databasePromise = $q(function (resolve, reject) {
							var request = $window.indexedDB.open("fieldnote-learning", 1);
							request.onupgradeneeded = function () {
								var database = request.result;
								if (!database.objectStoreNames.contains("records")) database.createObjectStore("records");
							};
							request.onsuccess = function () { resolve(request.result); };
							request.onerror = function () { reject(request.error); };
							request.onblocked = function () { reject(new Error("IndexedDB upgrade is blocked.")); };
						});
					}
					return databasePromise;
				}

				function requestRecord(mode, key, value) {
					return openDatabase().then(function (database) {
						return $q(function (resolve, reject) {
							var transaction;
							var request;
							var result;
							try {
								transaction = database.transaction(["records"], mode === "get" ? "readonly" : "readwrite");
								var store = transaction.objectStore("records");
								request = mode === "get" ? store.get(key) : mode === "put" ? store.put(value, key) : store.delete(key);
							} catch (error) {
								reject(error);
								return;
							}
							request.onsuccess = function () { result = request.result; };
							request.onerror = function () { reject(request.error); };
							transaction.oncomplete = function () { resolve(result); };
							transaction.onerror = function () { reject(transaction.error); };
							transaction.onabort = function () { reject(transaction.error || new Error("IndexedDB transaction aborted.")); };
						});
					});
				}

				return {
					get: function (key) { return requestRecord("get", key); },
					put: function (key, value) { return requestRecord("put", key, value); },
					remove: function (key) { return requestRecord("remove", key); }
				};
			});
			app.directive("fileChange", function ($parse) {
				return {
					restrict: "A",
					link: function (scope, element, attributes) {
						var changeExpression = $parse(attributes.fileChange);
						var onChange = function (event) {
							var files = event.target.files;
							scope.$apply(function () { changeExpression(scope, { files: files }); });
						};
						element.on("change", onChange);
						scope.$on("$destroy", function () { element.off("change", onChange); });
					}
				};
			});
			app.directive("draggablePanel", function ($window, LearningDatabase) {
				return {
					restrict: "A",
					link: function (scope, element, attributes) {
						var panel = element[0];
						var handle = panel.querySelector(".learning-coach-head");
						var positionKey = attributes.draggablePanel;
						var dragging = false;
						var startX = 0;
						var startY = 0;
						var startLeft = 0;
						var startTop = 0;

						function placePanel(left, top) {
							var maxLeft = $window.innerWidth - panel.offsetWidth - 8;
							var maxTop = $window.innerHeight - panel.offsetHeight - 8;
							panel.style.left = Math.min(Math.max(8, left), Math.max(8, maxLeft)) + "px";
							panel.style.top = Math.min(Math.max(8, top), Math.max(8, maxTop)) + "px";
							panel.style.right = "auto";
							panel.style.bottom = "auto";
						}

						function savePosition() {
							var rect = panel.getBoundingClientRect();
							var position = { left: rect.left, top: rect.top };
							LearningDatabase.put(positionKey, position).catch(function () {
								try { $window.localStorage.setItem(positionKey, JSON.stringify(position)); } catch (error) { }
							});
						}

						function applySavedPosition(position) {
							if (position && isFinite(position.left) && isFinite(position.top)) placePanel(position.left, position.top);
						}

						function readFallbackPosition() {
							try { applySavedPosition(JSON.parse($window.localStorage.getItem(positionKey) || "null")); } catch (error) { }
						}

						function onPointerMove(event) {
							if (!dragging) return;
							placePanel(startLeft + event.clientX - startX, startTop + event.clientY - startY);
						}

						function onPointerUp() {
							if (!dragging) return;
							dragging = false;
							$window.removeEventListener("pointermove", onPointerMove);
							$window.removeEventListener("pointerup", onPointerUp);
							$window.removeEventListener("pointercancel", onPointerUp);
							savePosition();
						}

						function onPointerDown(event) {
							if (event.button !== undefined && event.button !== 0) return;
							if (event.target.closest("button")) return;
							var rect = panel.getBoundingClientRect();
							startX = event.clientX;
							startY = event.clientY;
							startLeft = rect.left;
							startTop = rect.top;
							placePanel(startLeft, startTop);
							dragging = true;
							event.preventDefault();
							$window.addEventListener("pointermove", onPointerMove);
							$window.addEventListener("pointerup", onPointerUp);
							$window.addEventListener("pointercancel", onPointerUp);
						}

						function onResize() {
							if (panel.style.left) placePanel(panel.getBoundingClientRect().left, panel.getBoundingClientRect().top);
						}

						handle.addEventListener("pointerdown", onPointerDown);
						LearningDatabase.get(positionKey).then(function (savedPosition) {
							if (savedPosition) {
								applySavedPosition(savedPosition);
								return;
							}
							try {
								var legacyPosition = JSON.parse($window.localStorage.getItem(positionKey) || "null");
								applySavedPosition(legacyPosition);
								if (legacyPosition) LearningDatabase.put(positionKey, legacyPosition).then(function () { $window.localStorage.removeItem(positionKey); });
							} catch (error) { }
						}).catch(readFallbackPosition);
						$window.addEventListener("resize", onResize);
						scope.$on("$destroy", function () {
							handle.removeEventListener("pointerdown", onPointerDown);
							$window.removeEventListener("pointermove", onPointerMove);
							$window.removeEventListener("pointerup", onPointerUp);
							$window.removeEventListener("pointercancel", onPointerUp);
							$window.removeEventListener("resize", onResize);
						});
					}
				};
			});

				app.controller("LearningController", function ($scope, $window, $timeout, $interval, $q, $sce, LearningDatabase) {
				var storageKey = "fieldnote-learning-v1";
				var legacyStorageKey = storageKey;
				var seed = {
					instructors: [
						{ id: "maya", name: "Maya Chen", role: "Product designer", bio: "Maya helps teams turn complex problems into simple, human-centered digital products.", specialty: "UX Design", image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80" },
						{ id: "marcus", name: "Marcus Reed", role: "Software engineer", bio: "A frontend engineer and mentor focused on building accessible, resilient web experiences.", specialty: "Web Development", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" },
						{ id: "elena", name: "Elena Torres", role: "Data storyteller", bio: "Elena makes data approachable, connecting analytical thinking to decisions that matter.", specialty: "Data Science", image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80" },
						{ id: "james", name: "James Okafor", role: "Creative strategist", bio: "James teaches clear communication, stronger writing habits, and creative problem solving.", specialty: "Communication", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80" },
						{ id: "aisha", name: "Aisha Khan", role: "Graphic designer", bio: "Aisha helps creators build strong brands, clean layouts, and visuals that communicate with clarity.", specialty: "Graphic Design", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80" },
						{ id: "leo", name: "Leo Park", role: "Motion editor", bio: "Leo teaches people how to shape stories through pacing, sound, motion, and edit rhythm.", specialty: "Video Editing", image: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=160&q=80" },
						{ id: "nia", name: "Nia Gomez", role: "AI creative strategist", bio: "Nia helps designers and editors use AI thoughtfully to speed up ideation, iteration, and workflow.", specialty: "AI & Creative Tech", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=160&q=80" },
						{ id: "oliver", name: "Oliver Reed", role: "3D artist", bio: "Oliver turns concepts into immersive scenes and product visuals using modern 3D workflows.", specialty: "3D Design", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80" }
					],
					courses: [
						{ id: "ux-foundations", title: "UX Design Foundations", category: "UX Design", instructorId: "maya", duration: "6 weeks", lessons: 8, description: "Build the research and prototyping habits behind thoughtful digital experiences.", image: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=800&q=82" },
						{ id: "web-basics", title: "Web Development, From Zero", category: "Web Development", instructorId: "marcus", duration: "8 weeks", lessons: 10, description: "Learn the building blocks of the web and ship your first responsive pages.", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=82" },
						{ id: "data-stories", title: "Data Stories That Matter", category: "Data Science", instructorId: "elena", duration: "5 weeks", lessons: 7, description: "Find the signal in a dataset and communicate it with clear visual stories.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=82" },
						{ id: "clear-writing", title: "Writing with Clarity", category: "Communication", instructorId: "james", duration: "4 weeks", lessons: 6, description: "Make your ideas easier to understand, remember, and act on.", image: "assets/writing-with-clarity.svg" },
						{ id: "creative-photoshop", title: "Photoshop & Illustrator for Creatives", category: "Graphic Design", instructorId: "aisha", duration: "6 weeks", lessons: 8, tools: "PS, AI", description: "Design polished brand visuals, artwork, and social content with the Adobe creative tools used by modern designers.", image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=82" },
						{ id: "brand-layouts", title: "InDesign Brand Systems", category: "Graphic Design", instructorId: "aisha", duration: "5 weeks", lessons: 7, tools: "ID", description: "Create brand-ready layouts, editorial pages, and print-ready systems with clean typography and structure.", image: "https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=800&q=82" },
						{ id: "motion-stories", title: "Video Editing with Premiere Pro & After Effects", category: "Video Editing", instructorId: "leo", duration: "8 weeks", lessons: 9, tools: "PR, AE", description: "Learn story structure, color, transitions, motion graphics, and editing systems used in real video projects.", image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=82" },
						{ id: "ai-for-creatives", title: "AI for Design & Content Workflow", category: "AI & Creative Tech", instructorId: "nia", duration: "4 weeks", lessons: 6, tools: "AI, prompt design, creative automation", description: "Use AI to brainstorm, speed up concepts, improve asset variation, and build smarter creative workflows.", image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=82" },
						{ id: "blender-visuals", title: "Blender 3D Visual Storytelling", category: "3D Design", instructorId: "oliver", duration: "6 weeks", lessons: 8, tools: "Blender", description: "Model, light, and animate 3D scenes for product shots, scenes, and concepts that look cinematic.", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=82" },
						{ id: "interface-lab", title: "Interface Design Lab", category: "UX Design", instructorId: "maya", duration: "7 weeks", lessons: 9, description: "Practice visual systems, interface patterns, and product design critique.", image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=800&q=82" },
						{ id: "javascript-practical", title: "JavaScript in Practice", category: "Web Development", instructorId: "marcus", duration: "6 weeks", lessons: 8, description: "Use core JavaScript to build interactive tools with confidence.", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=82" },
						{ id: "html-css-essentials", title: "HTML & CSS Essentials", category: "Web Development", instructorId: "marcus", duration: "4 lessons", lessons: 4, description: "Build a well-structured, responsive web page from the first tag to the final layout.", image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=82", curriculum: [
							{ id: "html-structure", title: "Structure a page with HTML", objective: "Use semantic elements to give page content a clear structure.", content: "HTML describes the meaning and structure of a web page. Start with a document, then use elements such as header, nav, main, section, and footer to describe each region. Headings form an outline: use one h1 for the page topic, then h2 and h3 for nested sections. Use a button for an action and an anchor for navigation.", practice: "Create a simple profile page with a header, one main section, a heading, a paragraph, and a link. Check that the heading order makes sense." },
							{ id: "css-foundations", title: "Style with CSS", objective: "Connect a stylesheet and control color, type, spacing, and the box model.", content: "CSS rules pair a selector with declarations. A class selector such as .profile can style a reusable component. Every element is a box: content sits inside padding, then border, then margin. Set box-sizing: border-box so declared widths include padding and border. Keep colors and spacing consistent with custom properties when a page grows.", practice: "Add a class to your profile section. Give it padding, a border, a readable font, and a background color. Set box-sizing: border-box on all elements." },
							{ id: "responsive-layout", title: "Build a responsive layout", objective: "Use flexible CSS layout rules so content adapts to narrow screens.", content: "Responsive pages adapt to available space instead of assuming one screen width. Flexbox works well for one-dimensional rows or columns; CSS Grid handles two-dimensional layouts. Use minmax(0, 1fr) for flexible grid columns and a media query when the layout needs a meaningful change on small screens. Images should use max-width: 100%.", practice: "Place two content sections side by side with CSS Grid, then switch to one column below 600px. Test by resizing the browser." },
							{ id: "accessible-html", title: "Polish for accessibility", objective: "Make page controls understandable and usable with a keyboard.", content: "Accessible HTML starts with native elements and labels. Give every form control a connected label, write useful alternative text for informative images, and keep decorative images' alt text empty. Make sure keyboard focus is visible and text has sufficient contrast. Semantic markup helps assistive technology explain the page structure.", practice: "Add a labeled email input and a submit button to your page. Tab through every control and confirm the focus indicator is easy to see." }
						] },
						{ id: "javascript-essentials", title: "JavaScript Essentials", category: "Web Development", instructorId: "marcus", duration: "4 lessons", lessons: 4, description: "Learn the core JavaScript ideas behind interactive pages and small browser tools.", image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=82", curriculum: [
							{ id: "js-values", title: "Values and variables", objective: "Store and update information with clear, predictable variables.", content: "JavaScript values include strings, numbers, booleans, arrays, objects, and null. Use const when a variable binding will not be reassigned and let when it will. A const object can still have its properties changed; const protects the binding, not every value inside it. Choose names that explain what the data represents.", practice: "Create a const variable for a course title and a let variable for a lesson count. Update the count and display both values with console.log." },
							{ id: "js-functions", title: "Make reusable functions", objective: "Group related steps into functions with clear inputs and results.", content: "A function packages work behind a name. Parameters are the inputs; return sends a result back to the caller. Keep a function focused on one task so it is easier to understand and test. For example, a function that calculates a progress percentage can accept completed and total lesson counts, then return completed divided by total times one hundred.", practice: "Write a function called progressPercent that accepts completed and total, returns a percentage, and try it with 2 completed lessons out of 8." },
							{ id: "js-arrays", title: "Work with arrays", objective: "Store lists and derive new lists with common array methods.", content: "Arrays keep ordered collections. Use map to transform each item, filter to keep matching items, and find to retrieve the first match. These methods return values without changing the original array, which makes data flow easier to reason about. Use a stable id property when each item represents a course, task, or student.", practice: "Create an array of three course objects. Use filter to find courses in Web Development, then map the result to an array of course titles." },
							{ id: "js-dom-events", title: "Respond to user actions", objective: "Connect a user event to a small, visible page update.", content: "Browser events let a page react to a person. Select an element, listen for an event such as click or submit, then update the page or application state. For forms, listen to submit and prevent the default page reload when the app will handle the data. Keep the current state as the source of truth for what the interface displays.", practice: "Add a button and a message element to a page. When the button is clicked, update the message to say that the lesson is complete." }
						] }
					]
				};
				seed.courses.push(
					{ id: "advanced-ux-strategy", title: "Advanced UX Research and Product Strategy", category: "UX Design", instructorId: "maya", duration: "6 weeks", lessons: 4, description: "Plan rigorous research, evaluate product bets, and turn evidence into defensible product decisions.", image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=82" },
					{ id: "senior-frontend", title: "Senior Frontend Engineering Practice", category: "Web Development", instructorId: "marcus", duration: "6 weeks", lessons: 4, tools: "JavaScript, browser devtools, automated tests", description: "Apply architecture, performance, testing, and security practices to production frontend systems.", image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=82" },
					{ id: "advanced-data-analytics", title: "Advanced Data Analytics for Decisions", category: "Data Science", instructorId: "elena", duration: "5 weeks", lessons: 4, tools: "SQL, spreadsheets, dashboards", description: "Use cohorts, experiments, and uncertainty-aware reporting to support high-stakes decisions.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=82" },
					{ id: "professional-client-delivery", title: "Professional Client Project Delivery", category: "Communication", instructorId: "james", duration: "4 weeks", lessons: 4, description: "Scope work, manage feedback, present decisions, and hand off polished deliverables with confidence.", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800&q=82" }
				);
				function createLesson(id, title, objective, content, keyPoints, practice, teachingTip, codeExample, codeLanguage) {
					return { id: id, title: title, objective: objective, content: content, keyPoints: keyPoints, practice: practice, teachingTip: teachingTip, codeExample: codeExample, codeLanguage: codeLanguage };
				}
				var additionalCurricula = {
					"ux-foundations": [
						createLesson("ux-problem", "Frame the right problem", "Turn a broad request into a focused user problem.", "Good design starts by understanding the person and situation behind a request. Separate the proposed solution from the underlying need. Ask who is affected, what they are trying to accomplish, and what currently gets in their way. A concise problem statement keeps a team aligned while leaving room to explore more than one solution.", ["Describe a user and a goal, not a feature.", "Use evidence to distinguish symptoms from root causes."], "Write a one-sentence problem statement for a student trying to choose a first course. Avoid naming a specific feature as the answer.", "A useful problem statement is specific enough to guide research but open enough to allow several possible solutions."),
						createLesson("ux-research", "Learn from user research", "Plan interviews that uncover behavior and context.", "Research reduces guessing. Before an interview, define what you need to learn and recruit people who have relevant experience. Ask about a recent real example rather than hypothetical preferences. Neutral questions such as 'Tell me about the last time...' invite detail. Record observations separately from your interpretation so assumptions remain visible.", ["Ask open questions about past behavior.", "Do not lead participants toward your preferred answer."], "Draft three neutral interview questions about how someone decides whether to enroll in an online course.", "Listen for the steps people take and the workarounds they create, not only for feature requests."),
						createLesson("ux-flows", "Map journeys and wireframes", "Translate a user goal into a clear sequence of steps.", "A user flow makes the steps and decisions in a task visible. Begin with the user's entry point and intended outcome, then add only the decisions that change what happens next. A wireframe turns those steps into a rough layout. Keep early wireframes simple: their job is to test hierarchy and task flow, not visual polish.", ["Show the main path and important decision points.", "Put the next useful action where people can find it."], "Sketch a four-step flow for finding a course, checking its details, enrolling, and opening lesson one.", "Review the flow by narrating it from the user's point of view; missing steps become easier to spot."),
						createLesson("ux-testing", "Test and improve a design", "Use usability observations to choose the next improvement.", "A usability test asks a person to attempt a realistic task while you observe. Give a goal, not a list of instructions. Notice hesitations, errors, and unexpected choices. A finding should connect an observation to its impact. Prioritize issues that block the task or repeatedly confuse people, then test the revision rather than treating the first design as final.", ["Let participants try the task without coaching.", "Prioritize severity and frequency, then retest."], "Write one test task and one observable success measure for a course enrollment screen.", "A small, focused test can reveal a confusing label faster than a long opinion survey.")
					],
					"creative-photoshop": [
						createLesson("ps-layout", "Start with strong composition", "Use spacing and focal points to guide visual attention.", "Good design starts with a clear hierarchy. Use the rule of thirds, balanced margins, and a strong focal point to help the eye find the intended message. Photoshop and Illustrator are most effective when the layout is ordered first and visual details come second. Build the piece in layers so you can adjust each part without disturbing the whole composition.", ["Lead the eye with contrast and spacing.", "Keep the layout organized with clean layers."], "Create a simple social post for a course launch and decide where the headline, image, and call to action should sit.", "A clean layout strengthens the message more than adding extra decorative effects.", "<style>\n  body { font-family: Arial, sans-serif; background: #f3f4ef; margin: 0; display: grid; place-items: center; min-height: 100vh; }\n  .promo { width: 440px; background: linear-gradient(135deg, #fff6d9, #eef7f2); border-radius: 22px; overflow: hidden; box-shadow: 0 18px 35px rgba(28, 46, 36, 0.12); }\n  .promo-header { background: #1d6b52; color: #fff; padding: 24px 24px 18px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; font-size: 12px; }\n  .promo-body { padding: 28px 24px 24px; }\n  h2 { margin: 0 0 12px; font-size: 32px; color: #172a25; }\n  p { margin: 0 0 18px; color: #475a52; line-height: 1.6; }\n  .cta { display: inline-block; padding: 12px 18px; border-radius: 999px; background: #d9f276; color: #172a25; font-weight: 700; text-decoration: none; }\n</style>\n<section class=\"promo\">\n  <div class=\"promo-header\">Creative launch</div>\n  <div class=\"promo-body\">\n    <h2>Design that feels premium</h2>\n    <p>Create a strong visual hierarchy, balance spacing, and guide attention to the call to action.</p>\n    <a href=\"#\" class=\"cta\">Start learning</a>\n  </div>\n</section>", "html"),
						createLesson("ps-retouch", "Refine and edit with precision", "Adjust images and clean artwork without losing visual realism.", "Retouching means selecting the right fix for the right problem. Use masking, blending modes, and localized adjustments for surfaces like skin, highlights, and shadows. In Illustrator, shape tools and vector paths help you maintain scalable details. Save versions as you work so you can revisit different directions without losing progress.", ["Use masks for targeted edits.", "Keep artwork editable by working in layers."], "Edit a portrait photo by improving tone and removing small distractions while keeping the image natural.", "Precision beats over-editing when the goal is a believable, polished result.", "<style>\n  body { margin: 0; font-family: Arial, sans-serif; background: #f3f3f3; display: grid; place-items: center; min-height: 100vh; }\n  .photo-card { width: 360px; background: white; border-radius: 18px; padding: 18px; box-shadow: 0 15px 30px rgba(0,0,0,0.08); }\n  .image { height: 260px; background: linear-gradient(135deg, #c6d9ff, #f7d6c9 35%, #f5e8d7); border-radius: 14px; position: relative; overflow: hidden; }\n  .image:before { content: \"\"; position: absolute; inset: 18% 25% 14% 20%; background: rgba(255,255,255,0.2); border-radius: 50%; filter: blur(12px); }\n  .tag { display: inline-block; margin-top: 16px; padding: 8px 12px; border-radius: 999px; background: #eaf0e9; color: #1d6b52; font-weight: 700; }\n</style>\n<div class=\"photo-card\">\n  <div class=\"image\"></div>\n  <div class=\"tag\">Retouch layer</div>\n</div>", "html"),
						createLesson("ai-brand", "Build vector brand assets", "Create reusable shapes, icons, and brand marks with clean vectors.", "Vector tools are ideal when your design needs to scale without losing sharpness. Use simple shapes, consistent stroke weights, and a limited color system to create a clear identity. Brand assets should be practical: keep them recognizable and easy to reuse across print, web, and social formats. Icons and logos become stronger when they reduce the message to one simple idea.", ["Use a small, consistent color palette.", "Keep shapes simple and recognizable."], "Design a small icon set for a digital course brand using basic geometric forms and limited colors.", "Simple, scalable assets are easier to reuse across all channels.", "<style>\n  body { display: grid; place-items: center; min-height: 100vh; background: #f4f4ee; margin: 0; font-family: Arial, sans-serif; }\n  .brand { display: flex; gap: 28px; align-items: center; }\n  .mark { width: 96px; height: 96px; border-radius: 24px; background: linear-gradient(135deg, #1d6b52, #d9f276); position: relative; }\n  .mark:before { content: \"\"; position: absolute; inset: 24px; border-radius: 18px; background: white; transform: rotate(45deg); }\n  .word { font-size: 28px; font-weight: 800; color: #172a25; letter-spacing: 1px; }\n</style>\n<div class=\"brand\">\n  <div class=\"mark\"></div>\n  <div class=\"word\">FIELDNOTE</div>\n</div>", "html"),
						createLesson("ps-finalize", "Prepare polished files for output", "Save artwork in formats that match the purpose and platform.", "A design is not finished until it is output correctly. Use PNG for transparent web graphics, JPG for photo-based assets, PDF for print layouts, and preserve editable originals in layered PSD or AI files. Review for alignment, margin, and contrast before sending it out. A final check for size and readability makes the difference between a good draft and a ready-to-use asset.", ["Keep original editable files next to exported versions.", "Match the file format to the final purpose."], "Export a completed design in two formats and list what each format is best suited for.", "Final output quality depends on checking the exact size, file type, and final visual contrast.", "<style>\n  body { background: #f2f5f1; margin: 0; font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; }\n  .sheet { background: white; padding: 22px; border-radius: 18px; width: 420px; box-shadow: 0 12px 28px rgba(0,0,0,0.08); }\n  h3 { margin: 0 0 12px; color: #172a25; }\n  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e8e4; }\n  .row:last-child { border-bottom: 0; }\n  .label { color: #53655b; }\n  .value { font-weight: 700; color: #1d6b52; }\n</style>\n<div class=\"sheet\">\n  <h3>Export checklist</h3>\n  <div class=\"row\"><span class=\"label\">PNG</span><span class=\"value\">Web</span></div>\n  <div class=\"row\"><span class=\"label\">JPG</span><span class=\"value\">Photo</span></div>\n  <div class=\"row\"><span class=\"label\">PDF</span><span class=\"value\">Print</span></div>\n</div>", "html"),
					],
					"brand-layouts": [
						createLesson("id-structure", "Build a consistent page system", "Use grids, margins, and text styles to create clean editorial pages.", "InDesign shines when text, imagery, and layout patterns work together. Start by establishing the page grid, margins, and master styles. Keep type hierarchy consistent so people can scan the page without effort. A well-structured layout feels intentional even before someone studies the content closely.", ["Set a rigid grid before adding details.", "Use consistent styles for headings and captions."], "Create a simple brochure layout with a title, two text blocks, and one image area, then review spacing consistency.", "Structure keeps the page readable, even when the content is complex.", "<style>\n  body { margin: 0; background: #eef1ed; font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; }\n  .spread { width: 480px; background: white; padding: 22px; border-radius: 18px; box-shadow: 0 16px 32px rgba(18, 33, 29, 0.09); }\n  .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; }\n  .title { font-size: 30px; font-weight: 800; margin: 0 0 12px; }\n  .box { background: #eaf0e9; height: 140px; border-radius: 12px; }\n  p { margin: 0; color: #4c5a54; line-height: 1.6; }\n</style>\n<div class=\"spread\">\n  <div class=\"grid\">\n    <div>\n      <div class=\"title\">Brand story</div>\n      <p>Use structure, rhythm, and consistent spacing to keep the page premium and readable.</p>\n    </div>\n    <div class=\"box\"></div>\n  </div>\n</div>", "html"),
						createLesson("id-typography", "Control type with intention", "Use typography to support the message instead of fighting it.", "Typography determines rhythm, emphasis, and readability. Limit your font family choices, define heading hierarchy, and adjust tracking or leading carefully. Long form reading works best when the text is not crowded or over-styled. Use one or two strong accents rather than changing type too often across a page.", ["Pair fonts intentionally and limit the system.", "Use hierarchy instead of visual noise."], "Draft a two-column flyer and decide which text receives the largest scale, strongest weight, and most spacing.", "Clear type rhythm makes information easier to understand and remember.", "<style>\n  body { margin: 0; background: #f6f6f3; display: grid; place-items: center; min-height: 100vh; font-family: Georgia, serif; }\n  .card { width: 400px; background: white; padding: 24px; border-radius: 16px; box-shadow: 0 16px 32px rgba(0,0,0,0.08); }\n  h2 { font-size: 28px; margin: 0 0 8px; }\n  .eyebrow { text-transform: uppercase; letter-spacing: 2px; color: #1d6b52; font-size: 11px; font-weight: 700; }\n  p { color: #4a5b53; line-height: 1.7; }\n</style>\n<div class=\"card\">\n  <div class=\"eyebrow\">Editorial</div>\n  <h2>Clear type creates calm</h2>\n  <p>Type scale and rhythm can make a layout feel thoughtful and premium without adding more visual noise.</p>\n</div>", "html"),
						createLesson("id-brand", "Create reusable brand elements", "Turn assets into repeatable style systems for a project.", "A brand system works best when it is reusable. Create paragraph styles, character styles, swatches, and master pages that can be applied consistently across documents. This helps maintain visual order and saves time when you update information later. Reusable system elements are especially valuable for multi-page documents and campaign packages.", ["Document style decisions to keep consistency.", "Create reusable components for repeated pages."], "Build a master page with a header, footer, and page number system for a branded document set.", "Reusable rules save time and keep a brand recognizable across projects.", "<style>\n  body { margin: 0; background: #efefe9; display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }\n  .sheet { background: white; width: 440px; padding: 22px; border-radius: 18px; box-shadow: 0 14px 28px rgba(0,0,0,0.08); }\n  .header { display: flex; justify-content: space-between; align-items: center; background: #1d6b52; color: white; padding: 14px 16px; border-radius: 12px; font-weight: 700; }\n  .meta { margin-top: 18px; color: #475a52; line-height: 1.7; }\n</style>\n<div class=\"sheet\">\n  <div class=\"header\"><span>Brand System</span><span>01</span></div>\n  <div class=\"meta\">Master pages keep style and spacing consistent across a full campaign or report.</div>\n</div>", "html"),
						createLesson("id-export", "Export for print and digital use", "Prepare files for the right output method with final checks.", "Export settings determine whether a design prints cleanly or displays correctly online. Check bleed, crop marks, and resolution for print, while digital outputs need size and accessibility in mind. Review the final output at full size and on a smaller screen. This final check catches issues that can otherwise be hidden until the last step.", ["Check bleed and resolution before export.", "Use the output format that matches the final use case."], "Prepare one print-oriented document and one digital one from the same brand system and describe the differences in export settings.", "The export phase is where production quality is confirmed, not guessed.", "<style>\n  body { margin: 0; background: #f1f4f1; font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; }\n  .export { background: white; width: 440px; border-radius: 18px; padding: 22px; box-shadow: 0 14px 28px rgba(0,0,0,0.07); }\n  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e7e9e6; }\n  .row:last-child { border-bottom: 0; }\n  .name { color: #53655b; }\n  .value { color: #1d6b52; font-weight: 700; }\n</style>\n<div class=\"export\">\n  <div class=\"row\"><span class=\"name\">Format</span><span class=\"value\">Print PDF</span></div>\n  <div class=\"row\"><span class=\"name\">Bleed</span><span class=\"value\">3 mm</span></div>\n  <div class=\"row\"><span class=\"name\">Resolution</span><span class=\"value\">300 dpi</span></div>\n</div>", "html"),
					],
					"motion-stories": [
						createLesson("pr-cut", "Edit for story and rhythm", "Arrange clips to keep energy and clarity in a video sequence.", "Editing is not just trimming clips. It is shaping pace, emphasis, and the viewer's attention. Start with the strongest sequence of moments, then cut on the beat of the narrative or action. Premiere Pro makes this process easier when you focus on the emotional arc and timing as much as the visuals themselves.", ["Cut for timing and clarity.", "Let the sequence support the story."], "Create a short five-clip sequence that introduces a product or concept and decide which clip starts the story.", "Strong pacing makes a video feel intentional and polished.", "<style>\n  body { margin: 0; background: #1c2a2a; display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }\n  .timeline { width: 430px; background: rgba(255,255,255,0.08); border-radius: 18px; padding: 18px; }\n  .clip { height: 56px; margin-bottom: 12px; border-radius: 12px; background: linear-gradient(90deg, #d9f276, #9fe0c7); opacity: 0.9; }\n  .clip:nth-child(2) { background: linear-gradient(90deg, #dfe9ea, #90d0d9); }\n  .clip:nth-child(3) { background: linear-gradient(90deg, #ffd9b5, #dbb7ff); }\n</style>\n<div class=\"timeline\">\n  <div class=\"clip\"></div>\n  <div class=\"clip\"></div>\n  <div class=\"clip\"></div>\n</div>", "html"),
						createLesson("ae-motion", "Add motion graphics and transitions", "Use animation to support the message without distracting the viewer.", "After Effects turns still design into movement. Use easing, timing, and simple transformations to create movement that feels natural. Motion should reveal meaning, not overwhelm it. Use color, scale, and opacity changes to direct attention and make a design feel dynamic and controlled.", ["Keep animation purposeful.", "Add easing and timing for a natural feel."], "Design a short title animation that moves in, settles, and reveals the final message with a soft motion.", "Motion graphics are most effective when they reinforce the idea rather than competing with it.", "<style>\n  body { margin: 0; display: grid; place-items: center; min-height: 100vh; background: linear-gradient(135deg, #162b31, #1d6b52); font-family: Arial, sans-serif; }\n  .title { font-size: 46px; font-weight: 800; color: #fff; animation: drift 2.8s ease-in-out infinite alternate; }\n  @keyframes drift { from { opacity: 0.6; transform: translateY(14px); } to { opacity: 1; transform: translateY(-4px); } }\n</style>\n<div class=\"title\">Motion Story</div>", "html"),
						createLesson("pr-audio", "Match sound and image", "Use audio to strengthen pacing and emotional impact.", "Sound helps tell the audience where to focus and how to feel. Balance music, narration, and sound effects so they support the video without overpowering it. Clean audio levels and purposeful transitions create a more polished final film. Small edits here often make the biggest difference in perceived quality.", ["Check levels and balance before the final render.", "Use sound to reinforce the story beat."], "Edit a short video with voiceover and music, then adjust the levels so the essential message remains clear.", "Good sound design can make a simple video feel premium.", "<style>\n  body { margin: 0; font-family: Arial, sans-serif; background: #161d1c; color: white; display: grid; place-items: center; min-height: 100vh; }\n  .wave { display: flex; align-items: end; gap: 8px; height: 120px; }\n  .bar { width: 10px; border-radius: 10px 10px 0 0; background: linear-gradient(180deg, #d9f276, #7ac7c8); animation: bounce 1s ease-in-out infinite alternate; }\n  .bar:nth-child(2){ animation-delay: .15s; } .bar:nth-child(3){ animation-delay: .3s; } .bar:nth-child(4){ animation-delay: .45s; }\n  @keyframes bounce { from { height: 20%; } to { height: 100%; } }\n</style>\n<div class=\"wave\">\n  <span class=\"bar\" style=\"height: 30%\"></span>\n  <span class=\"bar\" style=\"height: 80%\"></span>\n  <span class=\"bar\" style=\"height: 60%\"></span>\n  <span class=\"bar\" style=\"height: 100%\"></span>\n</div>", "html"),
						createLesson("ae-finalize", "Compose the final deliverable", "Render the final cut with technical and creative checks.", "Before export, review the project for pacing, contrast, color, font visibility, and audio consistency. Choose a delivery format that suits the platform and audience. Use a render preset that balances quality and file size. A final preview helps catch mistakes that are easy to miss while you are working in the timeline.", ["Preview the full sequence before export.", "Match export settings to the delivery destination."], "Render a short branded promo video and list the settings you changed to optimize quality and size.", "Final polish often comes from a focused review of the whole project, not only the last few seconds.", "<style>\n  body { margin: 0; background: #f3f5f3; font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; }\n  .panel { width: 420px; padding: 24px; background: white; border-radius: 18px; box-shadow: 0 16px 32px rgba(0,0,0,0.08); }\n  .label { color: #53655b; font-weight: 700; margin-bottom: 8px; display: block; }\n  .value { font-size: 30px; font-weight: 800; color: #172a25; }\n</style>\n<div class=\"panel\">\n  <span class=\"label\">Render</span>\n  <div class=\"value\">4K export</div>\n</div>", "html"),
					],
					"ai-for-creatives": [
						createLesson("ai-ideation", "Use AI as a creative partner", "Generate ideas and directions faster while keeping your taste and decisions in control.", "AI works best when you treat it as a collaborator, not a replacement for judgment. Prompt with context, specify the goal, and define the style or constraints. Review outputs critically and refine them through iteration. The more specific your direction, the more useful the output becomes.", ["Give clear goals and constraints in your prompt.", "Review each result with a critical eye."], "Generate three different campaign concepts for a course launch and choose one that best fits the audience.", "Smart prompting turns AI into a fast sketchpad for creative exploration.", "const prompts = [\n  'Create 3 creative directions for a sustainable wellness brand',\n  'Generate a tagline for a beginner-friendly course launch',\n  'Suggest a mood board for a premium online learning product'\n];\nconsole.log(prompts.map((prompt, index) => (index + 1) + '. ' + prompt).join('\\n'));", "javascript"),
						createLesson("ai-research", "Quick research and reference generation", "Use AI to synthesize trends, references, and inspiration clusters.", "AI can help gather and compare examples quickly, especially in early concept work. Use it to summarize references, propose moodboards, or compare styles. Make sure to validate that the output is aligned with your target audience and brand. Research is most useful when it expands perspective instead of replacing your design instincts.", ["Use AI for inspiration and synthesis, not replacement.", "Check references against the actual brief."], "Ask AI to recommend mood boards or visual references for a productivity app and refine the results with your own criteria.", "The best AI outputs are still shaped by your creative judgment.", "const references = ['Minimal editorial', 'Warm earth tones', 'Bold product photography'];\nconst results = references.map((item, index) => ({ id: index + 1, style: item }));\nconsole.log(results);", "javascript"),
						createLesson("ai-ops", "Turn AI into workflow support", "Build repeatable prompts and systems for common creative tasks.", "Workflow efficiency matters when you repeat the same design tasks often. Create prompt templates for concept generation, asset variation, and copywriting. Save successful versions so future work starts from a useful base rather than a blank page. This helps your creative process stay consistent while still leaving room for experimentation.", ["Document successful prompts.", "Use AI for routine work so you can focus on judgment."], "Design a prompt library for course thumbnails, social captions, and headline variations.", "A good workflow makes AI feel useful and repeatable rather than unpredictable.", "const promptLibrary = {\n  thumbnail: 'Create a premium course thumbnail with a clean white background and bold typography',\n  caption: 'Write a short promotional caption with a confident, modern tone',\n  headline: 'Generate 3 headline options for a design class'\n};\nconsole.log(promptLibrary);", "javascript"),
						createLesson("ai-ethics", "Use AI responsibly", "Balance speed with accuracy, originality, and consent.", "AI is powerful, but it also requires care. Check outputs for bias, inaccuracies, and legal concerns, especially when using brand or personal data. Keep a human in the loop for approval and review. Responsible use is not about limiting creativity; it is about making the process transparent and trustworthy.", ["Verify results before publishing.", "Protect sensitive information and brand integrity."], "Review an AI-generated concept for factual accuracy, brand fit, and any hidden assumptions before final approval.", "Creative speed is strongest when it is paired with accountability.", "const workflow = { review: true, factCheck: true, humanApproval: true, brandSafety: true };\nconsole.log('AI workflow ready for production:', workflow);", "javascript"),
					],
					"blender-visuals": [
						createLesson("blender-scene", "Build a 3D concept scene", "Use primitive forms, lighting, and camera framing to tell a visual story.", "Blender begins with simple shapes and a camera. Build the scene in layers: objects, lighting, material style, and finally framing. A strong composition can make a modest object feel cinematic. Each addition should support the visual story you want the viewer to understand quickly.", ["Frame the hero object before polishing details.", "Use light to shape mood and focus."], "Model a simple scene with a product object and light it so the main form reads clearly from the camera angle.", "An intentionally framed scene communicates more than a cluttered environment.", "<style>\n  body { margin: 0; background: linear-gradient(135deg, #101c1c, #293845); display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }\n  .scene { width: 360px; height: 220px; position: relative; border-radius: 18px; background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)); }\n  .object { position: absolute; left: 45%; top: 50%; width: 100px; height: 100px; background: linear-gradient(135deg, #d9f276, #77d5c2); border-radius: 18px; transform: translate(-50%, -50%) rotate(-12deg); box-shadow: 0 24px 30px rgba(0,0,0,0.2); }\n  .light { position: absolute; inset: 0; background: radial-gradient(circle at 55% 40%, rgba(255,255,255,0.25), transparent 30%); }\n</style>\n<div class=\"scene\">\n  <div class=\"light\"></div>\n  <div class=\"object\"></div>\n</div>", "html"),
						createLesson("blender-materials", "Give materials a believable finish", "Apply surfaces and shaders that fit the object and scene.", "Material choices change how the object feels. Roughness, reflectivity, color, and texture all influence realism. Keep materials simple at first, then refine the specific surfaces that matter most. This keeps the work efficient while still making the final render feel polished.", ["Use materials to support the story, not distract from it.", "Check how surfaces react under light."], "Create two materials for the same object — one glossy and one matte — and compare how the scene changes.", "Materials should support the object’s purpose and the mood of the scene.", "<style>\n  body { margin: 0; background: #edf1ef; display: grid; place-items: center; min-height: 100vh; }\n  .materials { display: flex; gap: 24px; }\n  .sample { width: 110px; height: 110px; border-radius: 22px; box-shadow: inset 0 0 24px rgba(0,0,0,0.1); }\n  .glossy { background: linear-gradient(135deg, #c7f1d0, #84d2c1); }\n  .matte { background: linear-gradient(135deg, #d9f276, #b6d3ce); opacity: 0.7; }\n</style>\n<div class=\"materials\">\n  <div class=\"sample glossy\"></div>\n  <div class=\"sample matte\"></div>\n</div>", "html"),
						createLesson("blender-animate", "Add motion for storytelling", "Animate the camera or objects to create a sense of motion and narrative.", "Animation changes how a viewer experiences a scene. Small camera movement or object motion can make the shot feel alive without overloading the composition. Use timing, easing, and simple transitions to make motion feel intentional. Animation should guide attention and create a feeling of progression.", ["Move only the elements that need attention.", "Use timing to control the viewer's focus."], "Animate a camera move around a 3D product and note how it changes the sense of scale and importance.", "Motion is strongest when it supports the story's emotional arc.", "<style>\n  body { margin: 0; background: #111d1c; display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }\n  .orb { width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff, #d9f276 40%, #5bbfb4 100%); animation: orbit 2.8s ease-in-out infinite alternate; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }\n  @keyframes orbit { from { transform: translateX(-45px) scale(0.9); } to { transform: translateX(45px) scale(1.12); } }\n</style>\n<div class=\"orb\"></div>", "html"),
						createLesson("blender-render", "Prepare a final render", "Use the right render settings and checks before output.", "Rendering is the moment where technical quality is confirmed. Adjust view and lighting, preview the frame, and choose output settings that balance detail with file size. A final render review should check composition, clarity, and whether the scene communicates the intended mood. Production quality comes from deliberate checks, not just adding more detail.", ["Preview before you finalize.", "Match render settings to the target output."], "Render a finished product shot and review whether the camera angle, materials, and lighting clearly communicate the intended message.", "A polished render is usually the sum of disciplined small decisions.", "<style>\n  body { margin: 0; background: #edf3ef; display: grid; place-items: center; min-height: 100vh; font-family: Arial, sans-serif; }\n  .render { width: 420px; background: white; border-radius: 18px; padding: 22px; box-shadow: 0 14px 30px rgba(0,0,0,0.08); }\n  .title { font-size: 32px; font-weight: 800; margin: 0 0 12px; color: #172a25; }\n  .thumb { height: 150px; border-radius: 12px; background: linear-gradient(135deg, #d9f276, #9ee3d8); }\n</style>\n<div class=\"render\">\n  <div class=\"title\">Final render</div>\n  <div class=\"thumb\"></div>\n</div>", "html"),
					],
					"interface-lab": [
						createLesson("interface-hierarchy", "Establish visual hierarchy", "Make the most important action and information easy to find.", "Visual hierarchy directs attention through size, position, contrast, and spacing. Begin with the user's most important question or task, then make supporting information visibly secondary. Repeated elements should look related. Hierarchy is not a contest to make everything bold; a restrained set of differences lets the important elements stand out.", ["Prioritize by user need, not by stakeholder volume.", "Use a small, repeatable set of type and spacing levels."], "Sketch a course card that makes its title and enrollment action easy to spot before secondary metadata.", "Squint at the layout or view it small; the primary action should remain obvious."),
						createLesson("interface-tokens", "Build a reusable visual system", "Turn repeated visual decisions into consistent design tokens.", "A visual system gives a product reusable decisions for color, spacing, type, and borders. Tokens make consistency easier and simplify updates. Start with a small set that reflects actual use instead of inventing many near-duplicates. Check contrast for text and controls, and document where each token should be used so consistency does not become mechanical sameness.", ["Name tokens by role, such as text-muted or surface-raised.", "Check contrast in the contexts where colors appear."], "Define three spacing tokens and two text colors for a small learning dashboard.", "Test tokens in real components; unused tokens add noise rather than value."),
						createLesson("interface-states", "Design useful interface states", "Account for loading, empty, error, and completed states.", "A component is more than its default appearance. Consider what happens before data arrives, when a list is empty, when a request fails, and after an action succeeds. Each state should explain what is happening and preserve a useful next step. Consistent states make an interface feel dependable and reduce uncertainty when something goes wrong.", ["Design empty and error states as part of the workflow.", "Confirm destructive actions and acknowledge successful actions."], "Write the message and next action for an empty course list and for a failed lesson save.", "Check state transitions, not only screenshots of a fully populated page."),
						createLesson("interface-critique", "Give constructive design critique", "Evaluate an interface against a user goal and observable evidence.", "A useful critique focuses on the work, the user, and the intended outcome. Describe what you observed before suggesting a change. Explain the impact on the task, then offer a question or experiment that could resolve uncertainty. This keeps critique specific and collaborative rather than turning personal taste into a universal rule.", ["Describe an observation and its task impact.", "Offer a testable next step rather than a taste-based verdict."], "Review a course page and write one observation, its effect on a learner, and a testable design question.", "Prioritize the issue that blocks a learner, even if a smaller visual inconsistency is easier to discuss.")
					],
					"web-basics": [
						createLesson("web-html", "Build a semantic page", "Give page content a meaningful HTML structure.", "Semantic HTML tells browsers and assistive technology what content means. Use header for introductory content, nav for navigation, main for the page's primary content, and section for a thematic group. Headings should form a logical outline. Native buttons and links already support keyboard interaction, so choose them based on whether an action happens or navigation occurs.", ["Use one clear h1, followed by ordered section headings.", "Prefer native elements over generic containers when possible."], "Create a small page with a header, main area, section heading, paragraph, and a link.", "Inspect the page outline before adding styles; structure is easier to correct early.", "<!doctype html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>Course notes</title></head>\n<body>\n  <header><h1>Course notes</h1></header>\n  <main><section><h2>Getting started</h2><p>One clear idea at a time.</p><a href=\"#practice\">Go to practice</a></section></main>\n</body>\n</html>", "html"),
						createLesson("web-css", "Style with the CSS box model", "Control component spacing with predictable CSS rules.", "CSS applies declarations through selectors. Each element occupies a box made of content, padding, border, and margin. The box-sizing property determines how width is calculated; border-box includes padding and border in the declared width, which makes layouts easier to reason about. Reusable classes let the same visual rule serve several related elements.", ["Padding is inside the border; margin is outside it.", "Use classes for reusable component styles."], "Style a card with internal padding, a subtle border, and a readable line height.", "Use browser developer tools to inspect computed spacing when the result looks unexpected.", "<!doctype html>\n<style>\n* { box-sizing: border-box; }\n.card { max-width: 420px; padding: 20px; border: 1px solid #cbd7cc; border-radius: 8px; }\n.card p { line-height: 1.6; }\n</style>\n<article class=\"card\"><h1>Course card</h1><p>Comfortable spacing makes content easier to scan.</p></article>", "html"),
						createLesson("web-layout", "Create responsive layouts", "Make a layout adapt to viewport size without fixed assumptions.", "Flexbox distributes items along one axis, while Grid manages rows and columns together. Use flexible tracks such as minmax(0, 1fr) so content can shrink without overflowing. A media query should respond when the current layout stops working, not target one particular device. Images can scale with max-width: 100% to stay inside their container.", ["Choose Flexbox for a row or column and Grid for a two-dimensional layout.", "Test at narrow and wide widths, including intermediate sizes."], "Make two course cards sit in columns on a wide screen and stack below 640px.", "Resize continuously rather than checking only named device presets.", "<!doctype html>\n<style>\n.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }\n.cards article { padding: 18px; background: #eaf0e9; }\n@media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }\n</style>\n<div class=\"cards\"><article>First course</article><article>Second course</article></div>", "html"),
						createLesson("web-accessible", "Build accessible forms", "Make form controls easy to understand and use with a keyboard.", "Every form control needs a programmatic label. Associate a label's for value with the control's id, and connect help or error text when more context is needed. Use the right input type so browsers can provide useful validation and mobile keyboards. Preserve a visible focus style, and explain errors in text rather than relying on color alone.", ["Labels should identify each field outside its placeholder.", "Keep keyboard focus visible and error messages specific."], "Add a labeled email field, a required indicator, and a visible error message to a form.", "Try completing the form using only the keyboard before calling it finished.", "<!doctype html>\n<form>\n  <label for=\"email\">Email address</label>\n  <input id=\"email\" name=\"email\" type=\"email\" required aria-describedby=\"email-help\">\n  <small id=\"email-help\">Use name@example.com</small>\n  <button type=\"submit\">Join course</button>\n</form>", "html")
					],
					"data-stories": [
						createLesson("data-question", "Start with a useful question", "Choose a question that can be answered with observable evidence.", "Analysis begins with a decision or curiosity, not with a chart. Write down the question, who needs the answer, and what action the answer could change. Define the unit being measured and the time period. This keeps a convenient dataset from quietly changing the question into something easier but less useful.", ["State the audience and decision alongside the question.", "Define the unit and period before comparing values."], "Turn 'How is learning going?' into a measurable question about course lesson completion this month.", "If an answer would not change understanding or action, refine the question."),
						createLesson("data-quality", "Prepare trustworthy data", "Check data quality before calculating or visualizing results.", "Before analysis, inspect where each field came from and what its values mean. Check for missing entries, inconsistent labels, duplicate rows, and impossible values. Keep an untouched original and document each cleaning decision. A cleaned dataset is not automatically unbiased; consider whose experiences are missing and how data collection shaped the result.", ["Preserve source data and record transformations.", "Look for missingness and inconsistent categories."], "Review a small table of course enrollments and list three quality checks you would perform before reporting a completion rate.", "Write down exclusions so another person can understand what the final number represents."),
						createLesson("data-visuals", "Choose a clear visual", "Match a chart type to the comparison or pattern you need to show.", "A chart should make one relationship easier to see. Bars work well for comparing categories; lines are useful for change over ordered time; a scatter plot can reveal relationships between two numeric variables. Label axes with units, use a meaningful scale, and avoid decorative effects that compete with the data. Always check whether the visual could suggest a misleading comparison.", ["Choose the simplest chart that answers the question.", "Label units and inspect scale and ordering."], "Choose a chart for comparing weekly lesson completion across three courses and explain why it fits.", "Ask a viewer what conclusion they see before you explain the chart."),
						createLesson("data-narrative", "Explain the finding", "Turn an analysis into an honest, useful explanation.", "A data story links context, evidence, and implication. Lead with the finding in plain language, show the most relevant evidence, and state what remains uncertain. Distinguish a correlation from a cause. Include sample size and timeframe when they change how a reader should interpret the result. A good conclusion is useful without claiming more than the data supports.", ["Separate observation from interpretation.", "State limits and uncertainty next to the finding."], "Write a two-sentence summary for a chart showing a change in weekly course completion, including one limitation.", "Keep the caveat close to the claim so it is not lost when the chart is shared.")
					],
					"clear-writing": [
						createLesson("writing-audience", "Write for a real reader", "Adapt detail and tone to what the reader needs to do.", "Before drafting, name the reader, the situation, and the action or understanding you want to support. A message for a new learner needs different context from a note for a subject expert. Prefer concrete words and explain necessary technical terms once. Respect the reader's attention by moving the most useful information near the beginning.", ["Identify the audience and intended next step.", "Explain unfamiliar terms without overexplaining familiar ones."], "Rewrite a course announcement for a student who has never used the platform. Put the next action in the first two sentences.", "Ask someone outside the project to describe what they think the message asks them to do."),
						createLesson("writing-structure", "Shape a clear first draft", "Organize ideas so each paragraph advances one point.", "A useful structure helps readers build understanding. Start with the main point, then arrange supporting details in the order the reader needs them. Give each paragraph one job and use transitions only when they clarify a relationship. Headings can make a longer document scannable, but they should describe the section rather than tease it.", ["Lead with the main point, not a long preamble.", "Group related details under descriptive headings."], "Outline a short guide explaining how a student enrolls in and starts a course.", "If the outline reads clearly on its own, drafting the full text becomes easier."),
						createLesson("writing-edit", "Edit for precision", "Remove friction while keeping the meaning and necessary detail.", "Editing is a sequence of decisions. First check whether the message answers its purpose. Then remove repetition, replace vague words with specific ones, and prefer direct verbs. Read the final version aloud to catch awkward rhythm. Do not cut a necessary qualification merely to make a sentence shorter; concise writing is complete writing without avoidable effort.", ["Revise structure before polishing individual sentences.", "Use specific verbs and preserve important caveats."], "Edit a paragraph by removing repeated ideas, then confirm that no required instruction disappeared.", "Read from the reader's point of view and flag every sentence that makes them reread."),
						createLesson("writing-review", "Review and prepare a final draft", "Check a document for accuracy, consistency, and accessibility.", "A final review checks more than spelling. Verify names, numbers, links, and instructions. Make headings consistent, describe meaningful images, and avoid relying on color alone to communicate. Check that a reader can scan the page and understand the next step. For important material, ask another person to review it against the original goal.", ["Check factual details and working links.", "Use consistent headings and accessible text structure."], "Create a five-item checklist for reviewing a learning resource before publishing it.", "Separate proofreading from content review so small typos do not distract from larger gaps.")
					],
					"interface-lab": [
						createLesson("interface-hierarchy", "Establish visual hierarchy", "Make the most important action and information easy to find.", "Visual hierarchy directs attention through size, position, contrast, and spacing. Begin with the user's most important question or task, then make supporting information visibly secondary. Repeated elements should look related. Hierarchy is not a contest to make everything bold; a restrained set of differences lets the important elements stand out.", ["Prioritize by user need, not by stakeholder volume.", "Use a small, repeatable set of type and spacing levels."], "Sketch a course card that makes its title and enrollment action easy to spot before secondary metadata.", "Squint at the layout or view it small; the primary action should remain obvious."),
						createLesson("interface-tokens", "Build a reusable visual system", "Turn repeated visual decisions into consistent design tokens.", "A visual system gives a product reusable decisions for color, spacing, type, and borders. Tokens make consistency easier and simplify updates. Start with a small set that reflects actual use instead of inventing many near-duplicates. Check contrast for text and controls, and document where each token should be used so consistency does not become mechanical sameness.", ["Name tokens by role, such as text-muted or surface-raised.", "Check contrast in the contexts where colors appear."], "Define three spacing tokens and two text colors for a small learning dashboard.", "Test tokens in real components; unused tokens add noise rather than value."),
						createLesson("interface-states", "Design useful interface states", "Account for loading, empty, error, and completed states.", "A component is more than its default appearance. Consider what happens before data arrives, when a list is empty, when a request fails, and after an action succeeds. Each state should explain what is happening and preserve a useful next step. Consistent states make an interface feel dependable and reduce uncertainty when something goes wrong.", ["Design empty and error states as part of the workflow.", "Confirm destructive actions and acknowledge successful actions."], "Write the message and next action for an empty course list and for a failed lesson save.", "Check state transitions, not only screenshots of a fully populated page."),
						createLesson("interface-critique", "Give constructive design critique", "Evaluate an interface against a user goal and observable evidence.", "A useful critique focuses on the work, the user, and the intended outcome. Describe what you observed before suggesting a change. Explain the impact on the task, then offer a question or experiment that could resolve uncertainty. This keeps critique specific and collaborative rather than turning personal taste into a universal rule.", ["Describe an observation and its task impact.", "Offer a testable next step rather than a taste-based verdict."], "Review a course page and write one observation, its effect on a learner, and a testable design question.", "Prioritize the issue that blocks a learner, even if a smaller visual inconsistency is easier to discuss.")
					],
					"javascript-practical": [
						createLesson("js-practical-values", "Model data with values", "Choose variables and data shapes that express a small feature clearly.", "A browser feature begins with data. Use strings for labels, numbers for counts, arrays for lists, and objects for related fields. Prefer const for bindings that will not be reassigned and let when the binding changes. Keep rendering separate from data updates so each step can be understood and tested on its own.", ["Give values names that communicate their meaning.", "Keep related record fields together in an object."], "Create a course object with a title and lesson count, then show the values in the console.", "Before adding a framework, make sure the data shape matches the information the screen needs.", "const course = { title: \"JavaScript in Practice\", lessons: 8 };\nconsole.log(course.title);\nconsole.log(course.lessons + \" lessons\");", "javascript"),
						createLesson("js-practical-functions", "Write predictable functions", "Use function inputs and return values to make behavior reusable.", "A function is easier to reuse when it depends on explicit inputs and returns a result rather than quietly reading unrelated state. Handle edge cases such as a zero total before calculating a percentage. Small functions make it possible to verify behavior with a few representative values before connecting it to the page.", ["Make inputs and outputs explicit.", "Check edge cases before using a calculation."], "Write a progressPercent function and test it for zero lessons and for a partly completed course.", "A function with a clear name and one responsibility is easier to compose with other behavior.", "function progressPercent(completed, total) {\n  if (total === 0) return 0;\n  return Math.round(completed / total * 100);\n}\nconsole.log(progressPercent(3, 8) + \"% complete\");", "javascript"),
						createLesson("js-practical-events", "Respond to browser events", "Connect a user action to an accessible, visible state change.", "An event listener runs when something happens, such as a click or a form submission. Select the intended element, register the listener, and update a visible result. For forms, prevent the browser's default navigation when the page handles the submission itself. Use a real button so keyboard and assistive-technology users can trigger the same action.", ["Use event listeners instead of inline event attributes.", "Show an outcome that does not depend on color alone."], "Create a button that changes a message to 'Lesson complete' when activated.", "Try the control with both a pointer and the keyboard.", "document.querySelector(\"button\").addEventListener(\"click\", function () {\n  document.querySelector(\"#status\").textContent = \"Lesson complete\";\n});", "javascript"),
						createLesson("js-practical-render", "Transform and display a list", "Use array methods to filter data before rendering it.", "Keep source data separate from the view. Filter selects the records that match a condition; map can turn each record into display text. Build the result from the current data each time so the screen does not drift away from the underlying list. When rendering user-provided text, use textContent rather than inserting it as HTML.", ["Use filter for selection and map for transformation.", "Render text as text to avoid treating it as markup."], "Filter completed courses, convert their titles into list items, and inspect the result.", "Test with an empty array as well as a list containing matches.", "const courses = [\n  { title: \"HTML & CSS\", complete: true },\n  { title: \"Data Stories\", complete: false }\n];\nconst titles = courses.filter(course => course.complete).map(course => course.title);\nconsole.log(titles.join(\", \"));", "javascript")
					]
				};
				var professionalCurricula = {
					"advanced-ux-strategy": [
						createLesson("ux-ops", "Build a reliable research operation", "Plan recruitment, consent, and evidence quality for repeatable research.", "Professional research starts before the interview. Define the decision the study will inform, recruit participants who represent the relevant behaviors, and document consent and data handling. Track assumptions and sampling gaps so findings are not presented as universal when the sample is narrow. Keep raw observations separate from interpretation to make the reasoning auditable.", ["Tie each study to a specific decision.", "Document consent, sampling limits, and assumptions."], "Draft a research plan for evaluating a new enrollment flow, including the decision, participant criteria, and two risks to validity.", "A research repository is useful only when another teammate can trace a finding back to its evidence."),
						createLesson("ux-mixed-methods", "Combine qualitative and quantitative evidence", "Triangulate behavioral data with interviews and usability observations.", "Quantitative signals can show where a journey changes, while qualitative research helps explain what people experienced. Align event definitions and time windows before comparing sources. Look for agreement and contradiction, and preserve the context around each observation. Avoid treating correlation or a small interview sample as proof of causation.", ["Use quantitative data to locate patterns and qualitative data to investigate context.", "Report disagreement between sources instead of smoothing it away."], "A funnel shows a large drop at account creation. Propose one analytics check and one research activity before recommending a redesign.", "Triangulation strengthens a decision when each source answers a different part of the question."),
						createLesson("ux-experiment-design", "Design a defensible product experiment", "Write a testable hypothesis with outcomes and guardrail metrics.", "A useful experiment names the change, expected user behavior, primary outcome, and guardrails. Check that the assigned unit and exposure match the hypothesis. Consider novelty effects, sample size, duration, and segments that could be harmed. Predefine how you will interpret an inconclusive result so teams do not move the goalposts after seeing the data.", ["Choose one primary outcome before launch.", "Use guardrails to detect unintended harm."], "Write an experiment plan for simplifying course enrollment with one primary metric, two guardrails, and a stop condition.", "An experiment informs a decision; it does not replace judgment about user impact."),
						createLesson("ux-product-strategy", "Turn evidence into product strategy", "Translate user needs and business constraints into a prioritized roadmap.", "Strategy connects an audience, an unmet need, a differentiated approach, and measurable outcomes. Use opportunity mapping to keep proposed features connected to evidence. Prioritize by expected impact, confidence, effort, and risk, then state what the team will not do yet. A concise decision memo makes tradeoffs and assumptions visible to stakeholders.", ["Connect roadmap items to evidence and outcomes.", "Make tradeoffs, confidence, and deferred work explicit."], "Create a one-page recommendation for improving learner course discovery, including the opportunity, proposed bet, success measure, and one deferred idea.", "A strong strategy gives the team a reasoned direction, not a longer feature list.")
					],
					"senior-frontend": [
						createLesson("frontend-architecture", "Design maintainable frontend boundaries", "Organize components and state around clear responsibilities.", "Production frontend architecture balances reuse with local clarity. Keep state close to the feature that owns it, define stable component inputs, and isolate data access from presentation where that boundary improves testing. Avoid abstractions that only wrap one call site. Document shared contracts and plan how breaking changes are introduced.", ["Give each component a clear responsibility.", "Abstract repeated behavior only when it removes real complexity."], "Refactor a course dashboard with duplicated filtering and progress logic. Sketch the smallest useful component and data boundaries.", "The best architecture makes the next change easier without hiding how data moves."),
						createLesson("frontend-performance", "Profile and improve rendering performance", "Use measurement to prioritize bundle, network, and interaction bottlenecks.", "Performance work begins with a representative measurement. Inspect loading, rendering, and interaction traces before changing code. Reduce unnecessary JavaScript, defer noncritical assets, and avoid repeated expensive work in hot paths. Compare before-and-after results on a consistent device and network profile, and verify that improvements do not regress accessibility or correctness.", ["Profile real user journeys before optimizing.", "Measure the same conditions before and after a change."], "A course page loads slowly on mobile. List the first three measurements you would collect and one optimization you would test first.", "A smaller bundle is useful only if users experience a faster, more responsive product."),
						createLesson("frontend-quality", "Build a layered quality strategy", "Use unit, integration, and end-to-end tests at the right boundaries.", "Reliable interfaces need more than one test type. Unit tests cover focused transformations, integration tests verify component behavior across boundaries, and end-to-end tests protect a small set of critical user journeys. Add accessibility checks and test failure states, not only the happy path. Keep tests deterministic and make failures actionable.", ["Choose test scope based on the behavior and risk.", "Protect critical user journeys without duplicating every assertion at every layer."], "Design a test plan for student registration and course enrollment with one example at each test layer.", "A passing test suite should increase confidence in user-visible behavior, not just code coverage."),
						createLesson("frontend-security", "Protect the frontend application boundary", "Handle untrusted input, browser storage, and third-party dependencies carefully.", "Treat all user-provided values as untrusted. Render text as text, validate data at system boundaries, and avoid placing secrets in frontend code. Review what personal data is stored in the browser and provide a clear deletion path. Keep dependencies current and limit embedded content permissions to the capabilities it actually needs.", ["Never ship private credentials in client-side code.", "Minimize stored personal data and restrict embedded content capabilities."], "Review a profile form that stores information in localStorage. Identify two privacy risks and propose safer handling for each.", "Client-side controls improve safety but cannot replace server-side authorization and validation.")
					],
					"advanced-data-analytics": [
						createLesson("analytics-sql", "Model reliable analytical datasets", "Use joins and documented definitions to create reproducible analysis tables.", "Analytical queries should state the grain of each table and join on stable identifiers. Check join cardinality to avoid silently duplicating records. Define time zones, exclusions, and metric denominators once, then reuse those definitions. Validate totals against a trusted source before interpreting a trend.", ["State the grain and join keys for each dataset.", "Validate row counts and totals after joins."], "Plan a query joining enrollments, lessons, and completions. State the expected row grain and one check for duplicate rows.", "Reproducibility depends on clear definitions as much as correct SQL syntax."),
						createLesson("analytics-cohorts", "Analyze cohorts and retention", "Compare learner groups over time without confusing age and calendar effects.", "Cohort analysis groups people by a meaningful starting event and follows the same measure over consistent intervals. Separate cohort age from calendar time, define what counts as active, and keep the denominator visible. Small or incomplete cohorts can produce unstable rates, so include counts and avoid ranking groups without context.", ["Define cohort entry and activity consistently.", "Show counts alongside percentages to communicate uncertainty."], "Define a weekly learner cohort and a four-week retention measure for an online course. List one limitation in the comparison.", "A cohort chart describes a pattern; it does not explain the cause by itself."),
						createLesson("analytics-experiments", "Interpret experiment results responsibly", "Distinguish practical impact from statistical evidence and uncertainty.", "Experiment analysis should follow the plan written before launch. Check assignment balance, exposure, missing data, and guardrail outcomes. Interpret effect size and uncertainty together rather than treating a threshold as the whole decision. If results are inconclusive, report what range of effects remains plausible and what additional evidence would change the decision.", ["Inspect experiment quality before interpreting outcomes.", "Use uncertainty and practical impact together."], "A test estimates a small positive lift but has a wide confidence interval. Write a recommendation that explains what you know and what remains uncertain.", "A statistically detectable change is not automatically a worthwhile product change."),
						createLesson("analytics-governance", "Deliver decision-ready analytics", "Present definitions, limitations, and recommendations in a trustworthy report.", "A professional analysis leads with the decision it supports, then presents the measure, comparison, and relevant limitations. Make the time period and population clear. Separate observed results from interpretation and recommendations. Provide enough method detail for review without burying the main finding in implementation notes.", ["Put the finding and decision near the beginning.", "Keep caveats close to the claim they qualify."], "Turn a completion-rate chart into a short executive summary with the population, timeframe, key result, limitation, and next action.", "A clear report helps readers act without implying more certainty than the data supports.")
					],
					"professional-client-delivery": [
						createLesson("client-discovery", "Scope a professional project", "Turn a client request into outcomes, constraints, and an agreed plan.", "A reliable project begins with shared definitions of success. Clarify the audience, deliverables, decision makers, constraints, dependencies, and review dates. Separate required outcomes from proposed solutions, document assumptions, and identify what is outside scope. Confirm the plan in writing so changes can be discussed without relying on memory.", ["Define outcomes before listing deliverables.", "Record assumptions, dependencies, and out-of-scope work."], "Turn a request for a new campaign into a short discovery checklist with five questions and two assumptions to verify.", "Clear scope protects the quality of the work and the working relationship."),
						createLesson("client-feedback", "Facilitate useful feedback", "Guide stakeholder reviews toward specific, actionable decisions.", "Feedback is most useful when reviewers know the audience, goal, and decision required. Present work with focused questions, separate preference from evidence, and record who owns each decision. When opinions conflict, return to agreed criteria and identify what can be tested. Summarize decisions and next steps after the review.", ["Ask reviewers to respond to defined criteria.", "Capture decisions, owners, and open questions."], "Prepare three review questions for a client presenting a first draft of a course launch campaign.", "A review meeting should reduce uncertainty, not collect an unstructured list of opinions."),
						createLesson("client-presentation", "Present recommendations with confidence", "Explain the reasoning behind a proposal and make tradeoffs understandable.", "A professional presentation connects the client goal to evidence, options, recommendation, and next step. Lead with the decision rather than a long process recap. Explain the tradeoffs and risks of the recommended option, then invite focused questions. Tailor the level of detail to the people making the decision.", ["Connect each recommendation to a stated goal.", "Explain alternatives and tradeoffs plainly."], "Outline a five-minute presentation recommending one of two visual directions for a client project.", "Confidence comes from clear reasoning and honest limits, not from overstating certainty."),
						createLesson("client-handoff", "Deliver a polished project handoff", "Package final assets so another person can use and maintain them.", "A useful handoff includes final files, editable sources where agreed, naming conventions, formats, dependencies, and a short guide to important decisions. Confirm that links and permissions work for the recipient. Identify any known limitations and the owner of future updates. A final checklist reduces avoidable rework after delivery.", ["Include source files, formats, and usage notes when agreed.", "Verify access and explain known limitations."], "Create a handoff checklist for a design project with web and print outputs, including file formats and ownership notes.", "A deliverable is complete when the next person can confidently use it.")
					]
				};
				Object.keys(professionalCurricula).forEach(function (courseId) { additionalCurricula[courseId] = professionalCurricula[courseId]; });
				Object.keys(additionalCurricula).forEach(function (courseId) {
					var course = seed.courses.filter(function (item) { return item.id === courseId; })[0];
					if (course) course.curriculum = additionalCurricula[courseId];
				});
				var uxCourse = seed.courses.filter(function (course) { return course.id === "ux-foundations"; })[0];
				if (uxCourse && uxCourse.curriculum) {
					var uxTestingLesson = uxCourse.curriculum.filter(function (lesson) { return lesson.id === "ux-testing"; })[0];
					if (uxTestingLesson) uxTestingLesson.scenario = {
						start: "start",
						nodes: {
							start: { prompt: "During a usability test, a learner pauses at the enrollment step and asks, 'What should I do now?' How do you respond?", choices: [
								{ text: "Ask what they expected to happen at this point.", next: "curious" },
								{ text: "Tell them which button to click.", next: "leading" },
								{ text: "Skip the step and move to the next task.", next: "missed" }
							] },
							curious: { prompt: "The learner explains they expected enrollment to happen automatically.", outcome: "Good choice.", feedback: "A neutral follow-up reveals their expectation without directing their behavior. Record the observation and ask them to continue." },
							leading: { prompt: "The learner clicks the button after your instruction.", outcome: "This may bias the test.", feedback: "Giving directions hides whether the interface communicates the next step. Ask a neutral question and let the learner continue independently." },
							missed: { prompt: "The learner moves on, but the enrollment confusion remains unexplored.", outcome: "An opportunity was missed.", feedback: "A pause is useful evidence. Ask what the learner expected, then observe what they try next." }
						}
					};
				}
				var originalLessonNotes = {
					"html-structure": { points: ["Use landmark elements to make page regions understandable.", "Keep heading levels in a logical order."], tip: "View the document structure in your browser's accessibility tools to confirm the landmarks are meaningful." },
					"css-foundations": { points: ["A selector chooses which elements receive a rule.", "The cascade resolves competing rules using origin, importance, specificity, and order."], tip: "Change one CSS declaration at a time and inspect the result so you learn which rule controls the element." },
					"responsive-layout": { points: ["Use flexible tracks instead of fixed page widths.", "Add breakpoints when content needs a different arrangement."], tip: "Test the content between breakpoints too; responsive design is a continuous range, not just phone and desktop." },
					"accessible-html": { points: ["Native controls provide keyboard behavior by default.", "Labels and useful alternative text communicate purpose."], tip: "Try the page with a keyboard and screen-reader landmarks before adding visual polish." },
					"js-values": { points: ["Arrays represent ordered lists; objects group named properties.", "Use const by default, then choose let only when reassignment is needed."], tip: "Log values while learning, but remove noisy debugging output from finished work." },
					"js-functions": { points: ["Parameters provide a function's inputs.", "Return values make results reusable and testable."], tip: "Try normal, boundary, and invalid inputs instead of only the example that should succeed." },
					"js-arrays": { points: ["filter returns matching items; map transforms each item.", "find is useful when you need one item by a known property."], tip: "Keep each transformation small; chaining methods is clearest when each step has an obvious purpose." },
					"js-dom-events": { points: ["Use a semantic button for an action.", "Update a visible status message so the outcome is clear."], tip: "Test the interaction with both Enter and Space when using a button." }
				};
				seed.courses.forEach(function (course) {
					if (!course.curriculum) return;
					course.lessons = course.curriculum.length;
					course.curriculum.forEach(function (lesson) {
						var notes = originalLessonNotes[lesson.id];
						if (notes) {
							lesson.keyPoints = notes.points;
							lesson.teachingTip = notes.tip;
						}
					});
				});
				var lessonVideos = {
					"html-structure": "https://www.youtube.com/watch?v=UB1O30fR-EE",
					"css-foundations": "https://www.youtube.com/watch?v=yfoY53QXEnI",
					"responsive-layout": "https://www.youtube.com/watch?v=srvUrASNj0s",
					"js-values": "https://www.youtube.com/watch?v=hdI2bqOjy3c"
				};
				seed.courses.forEach(function (course) {
					(course.curriculum || []).forEach(function (lesson) {
						if (!lesson.videoUrl && lessonVideos[lesson.id]) lesson.videoUrl = lessonVideos[lesson.id];
					});
				});
				var legacySavedState = null;
				try { legacySavedState = JSON.parse($window.localStorage.getItem(legacyStorageKey) || "null"); } catch (error) { legacySavedState = null; }

				$scope.instructors = seed.instructors;
				$scope.courses = seed.courses;
				$scope.categories = ["UX Design", "Web Development", "Data Science", "Communication", "Graphic Design", "Video Editing", "AI & Creative Tech", "3D Design"];
				$scope.instructorCourses = [];
				$scope.instructorModuleDrafts = [];
				$scope.newInstructorCourse = { title: "", category: "", description: "" };
				function createAssessmentQuestionDraft() {
					return { prompt: "", options: ["", "", "", ""], answerIndex: 0 };
				}
				function createInstructorModuleDraft() {
					return { title: "", objective: "", content: "", videoUrl: "", assessmentQuestions: [createAssessmentQuestionDraft()] };
				}
				$scope.newInstructorModule = createInstructorModuleDraft();
				$scope.registeredInstructors = [];
								$scope.platformState = { tab: "video", network: "steady", streamQuality: "Auto", edge: null, subtitles: "English", transcriptSearch: "", activeTranscript: "", prefetched: false, videoPlaying: false, videoLoaded: false, videoName: "", videoStatus: "", ltiLaunched: false, inRoom: false, raisedHand: false, cameraActive: false, cameraStatus: "", screenSharing: false, screenStatus: "", pollOpen: false, pollVote: "", breakoutRoom: "Breakout A", quizActive: false, quizSeconds: 30, quizAnswer: "", quizResult: "", scheduleNotice: "" };
								$scope.streamQualities = ["Auto", "1080p", "720p", "480p", "360p"];
								$scope.networkProfiles = [{ id: "slow", label: "Slow · 1 Mbps", rendition: "360p" }, { id: "steady", label: "Steady · 5 Mbps", rendition: "720p" }, { id: "fast", label: "Fast · 15 Mbps", rendition: "1080p" }];
								$scope.edgeRegions = [{ name: "Frankfurt", latency: 24 }, { name: "Singapore", latency: 38 }, { name: "New York", latency: 31 }, { name: "Sao Paulo", latency: 52 }];
								$scope.platformState.edge = $scope.edgeRegions[0];
								$scope.subtitleTracks = ["English", "Spanish", "Off"];
								$scope.transcriptLines = [{ time: "00:00", text: "A clear message begins with one main idea." }, { time: "00:08", text: "Remove details that distract from that idea." }, { time: "00:16", text: "Use concrete words and a structure your reader can follow." }, { time: "00:25", text: "Read the result aloud, then revise anything that feels unclear." }];
								$scope.demoLearners = [{ name: "Learner A", completion: 28, inactiveDays: 8, missedChecks: 2 }, { name: "Learner B", completion: 62, inactiveDays: 3, missedChecks: 1 }, { name: "Learner C", completion: 84, inactiveDays: 1, missedChecks: 0 }];
								$scope.xapiEvents = [];
								$scope.cohortSessions = [{ id: "cohort-web-1", name: "Web Foundations", starts: "Thu · 17:00", seats: "8 / 12 learners", note: "Demo session" }, { id: "cohort-writing-1", name: "Writing Studio", starts: "Fri · 15:30", seats: "6 / 10 learners", note: "Demo session" }];
								$scope.breakoutRooms = ["Breakout A", "Breakout B", "Quiet study"];
				$scope.student = null;
				$scope.enrollments = [];
				$scope.studentForm = { role: "student", teachingSubjects: [] };
				$scope.studentRegistration = null;
				$scope.authMode = "register";
				$scope.authUser = null;
				$scope.authForm = { email: "", password: "", resetCode: "", newPassword: "" };
				var directFileSessionToken = "";
				var directFileSessionKey = "fieldnote-session-token";
				$scope.showPassword = false;
				$scope.serviceError = "";
				$scope.view = "overview";
				$scope.viewTemplate = "views/overview.html";
								$scope.mobileMenuOpen = false;
				$scope.courseQuery = "";
				$scope.categoryFilter = "";
				$scope.formError = "";
				$scope.submitAttempted = false;
				$scope.toastMessage = "";
				$scope.today = new Date();
				$scope.darkMode = false;
				$scope.highContrast = false;
				$scope.speechSupported = !!($window.speechSynthesis && $window.SpeechSynthesisUtterance);
				$scope.speechActive = false;
				$scope.commandBarOpen = false;
								$scope.coachState = { draft: "", open: false };
								var botpressReadyHandler = function () {
									$scope.$applyAsync(function () { $scope.botpressReady = true; });
								};
								var botpressErrorHandler = function (event) {
									$scope.$applyAsync(function () { $scope.botpressErrorMessage = event.detail || "Botpress could not connect."; });
								};
								$scope.botpressConfigured = !!($window.FIELDNOTE_BOTPRESS_CONFIG && $window.FIELDNOTE_BOTPRESS_CONFIG.botId && $window.FIELDNOTE_BOTPRESS_CONFIG.clientId && !/^x+$/i.test($window.FIELDNOTE_BOTPRESS_CONFIG.botId) && !/^x+$/i.test($window.FIELDNOTE_BOTPRESS_CONFIG.clientId));
								$scope.botpressReady = $scope.botpressConfigured && $window.FIELDNOTE_BOTPRESS_READY === true;
								$scope.botpressErrorMessage = $window.FIELDNOTE_BOTPRESS_ERROR || "";
								if ($scope.botpressConfigured) {
									$window.document.addEventListener("fieldnote:botpress-ready", botpressReadyHandler);
									$window.document.addEventListener("fieldnote:botpress-error", botpressErrorHandler);
								}
								$scope.coachMessages = [{ role: "assistant", text: "Hi! I can explain the page or lesson you are viewing. Ask a question or choose Teach this part." }];
				$scope.commandQuery = "";
				$scope.lessonDiscussions = {};
				$scope.copilotQuestion = "";
				$scope.copilotResponse = "";
				$scope.copilotSummary = "";
				$scope.copilotQuestions = [];
				$scope.lessonCommentDraft = "";
				$scope.lessonNotes = [];
				$scope.certificateError = "";
				$scope.learningActivity = [];
				$scope.goalOptions = [1, 2, 3];
				$scope.dailyGoal = 1;
				$scope.quizResults = {};
				$scope.lessonTest = null;
				var toastTimer;
				var liveQuizTimer = null;
				var platformVideoUrl = "";
				var platformCameraStream = null;
				var platformScreenStream = null;

				var stateChangedDuringLoad = false;

				function isLocalApiMode() {
					return $window.location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test($window.location.hostname);
				}

				function applySavedState(data) {
					data = data || {};
					$scope.student = $scope.authUser ? Object.assign({}, data.student || {}, $scope.authUser.profile || {}, { id: $scope.authUser.id, name: $scope.authUser.name, email: $scope.authUser.email, role: $scope.authUser.role }) : null;
					if ($scope.student && !$scope.student.role) $scope.student.role = "student";
					$scope.enrollments = angular.isArray(data.enrollments) ? data.enrollments : [];
					$scope.studentForm = $scope.student ? angular.copy($scope.student) : {};
					$scope.studentForm.role = $scope.studentForm.role || "student";
					$scope.studentForm.teachingSubjects = angular.isArray($scope.studentForm.teachingSubjects) ? $scope.studentForm.teachingSubjects : [];
					$scope.darkMode = !!data.darkMode;
					$scope.highContrast = !!data.highContrast;
					$scope.lessonDiscussions = data.lessonDiscussions || {};
					$scope.learningActivity = angular.isArray(data.learningActivity) ? data.learningActivity : [];
					$scope.dailyGoal = Number(data.dailyGoal) || 1;
					$scope.quizResults = data.quizResults || {};
					if ($scope.view === "lesson" && $scope.refreshLessonNotes) $scope.refreshLessonNotes();
				}

				function persist() {
					if (!$scope.authUser) return Promise.resolve(false);
					stateChangedDuringLoad = true;
					var data = { student: $scope.student, enrollments: $scope.enrollments, darkMode: $scope.darkMode, highContrast: $scope.highContrast, lessonDiscussions: $scope.lessonDiscussions, learningActivity: $scope.learningActivity, dailyGoal: $scope.dailyGoal, quizResults: $scope.quizResults };
					return LearningDatabase.put(storageKey, data).then(function () {
						return true;
					}).catch(function () {
						try {
							$window.localStorage.setItem(storageKey, JSON.stringify(data));
							showToast("IndexedDB is unavailable. Changes are saved in fallback browser storage.");
							return false;
						} catch (error) {
							showToast("Browser storage is unavailable. Your changes may not persist.");
							return false;
						}
					}).then(function (savedLocally) {
						if (isLocalApiMode() || !$scope.authUser || $scope.authUser.role !== "student") return savedLocally;
						var cloudState = angular.copy(data);
						delete cloudState.student;
						return authRequest("/api/student/state", "PUT", { state: cloudState }).then(function () {
							return savedLocally;
						}).catch(function (error) {
							showToast("Progress is saved on this device, but cloud sync failed: " + error.message);
							return savedLocally;
						});
					});
				}

				function authRequest(path, method, body) {
					var openedFromFile = $window.location.protocol === "file:";
					var apiBase = openedFromFile ? "https://localhost:3000" : "";
					var options = { method: method || "GET", credentials: openedFromFile ? "omit" : "same-origin", headers: {} };
					if (openedFromFile) {
						options.headers["X-Fieldnote-File-Client"] = "true";
						try { directFileSessionToken = $window.sessionStorage.getItem(directFileSessionKey) || directFileSessionToken; } catch (error) { }
						if (directFileSessionToken) options.headers.Authorization = "Bearer " + directFileSessionToken;
					}
					if (body !== undefined) {
						options.headers["Content-Type"] = "application/json";
						options.body = JSON.stringify(body);
					}
					return $q(function (resolveRequest, rejectRequest) {
						$window.fetch(apiBase + path, options).then(function (response) {
							return response.json().catch(function () { return {}; }).then(function (payload) {
								if (!response.ok) {
									var fallbackMessage = response.status === 401 ? "Email or password is incorrect." : "Authentication request failed (HTTP " + response.status + "). Please try again.";
									var requestError = new Error(payload.error || fallbackMessage);
									requestError.status = response.status;
									throw requestError;
								}
								if (openedFromFile && payload.sessionToken) {
									directFileSessionToken = payload.sessionToken;
									try { $window.sessionStorage.setItem(directFileSessionKey, directFileSessionToken); } catch (error) { }
								}
								if (openedFromFile && (payload.loggedOut || payload.deleted)) {
									directFileSessionToken = "";
									try { $window.sessionStorage.removeItem(directFileSessionKey); } catch (error) { }
								}
								return payload;
							});
						}).then(function (payload) {
							$scope.serviceError = "";
							resolveRequest(payload);
						}, function (error) {
							if (error && error.name === "TypeError") {
								var apiOrigin = openedFromFile ? "https://localhost:3000" : $window.location.origin;
								var connectionHelp = openedFromFile ? "Make sure the local service is running and its localhost certificate is trusted." : "Check that the API is deployed and routed to this site.";
								error = new Error("Cannot connect to Fieldnote API at " + apiOrigin + ". " + connectionHelp);
							}
							rejectRequest(error);
						});
					});
				}

				function mergePublishedCourses(publishedCourses) {
					var existingCourses = $scope.courses.filter(function (course) { return !course.instructorCreated; });
					$scope.courses = existingCourses.concat(publishedCourses || []);
				}

				function loadPublishedCourses() {
					return authRequest("/api/courses").then(function (result) {
						mergePublishedCourses(result.courses);
					}).catch(function () { });
				}

				function loadRegisteredInstructors() {
					return authRequest("/api/instructors").then(function (result) {
						$scope.registeredInstructors = result.instructors || [];
						var seededIds = seed.instructors.map(function (instructor) { return instructor.id; });
						$scope.instructors = seed.instructors.concat($scope.registeredInstructors.filter(function (instructor) {
							return seededIds.indexOf(instructor.id) === -1;
						}).map(function (instructor) {
							return { id: instructor.id, name: instructor.name, role: "Registered instructor", bio: "Instructor at Fieldnote Learning.", specialty: (instructor.teachingSubjects || []).join(", "), image: instructor.profilePhoto || "assets/writing-with-clarity.svg" };
						}));
					}).catch(function () { });
				}

				$scope.loadInstructorCourses = function () {
					if (!$scope.authUser || $scope.authUser.role !== "instructor") return;
					authRequest("/api/instructor/courses").then(function (result) {
						$scope.instructorCourses = result.courses || [];
					}).catch(function (error) { showToast(error.message); });
				};

				function readCachedState(key) {
					try { return JSON.parse($window.localStorage.getItem(key) || "null"); } catch (error) { return null; }
				}

				function loadAuthenticatedUser(user) {
					var userStateKey = legacyStorageKey + ":" + user.id;
					var cachedState = readCachedState(userStateKey);
					var legacyMatchesUser = legacySavedState && legacySavedState.student && String(legacySavedState.student.email || "").toLowerCase() === user.email.toLowerCase();
					var migrateLegacy = !cachedState && legacyMatchesUser;
					storageKey = userStateKey;
					stateChangedDuringLoad = false;
					$scope.$applyAsync(function () {
						$scope.authUser = user;
						$scope.student = Object.assign({}, user.profile || {}, { id: user.id, name: user.name, email: user.email, role: user.role });
						$scope.studentForm = angular.copy($scope.student);
						$scope.studentForm.teachingSubjects = angular.isArray($scope.studentForm.teachingSubjects) ? $scope.studentForm.teachingSubjects : [];
					});
					return LearningDatabase.get(userStateKey).then(function (storedState) {
						if (stateChangedDuringLoad) return;
						var localState = storedState || cachedState || (migrateLegacy ? legacySavedState : {});
						function restore(state, shouldSync) {
							$scope.$applyAsync(function () {
								if (stateChangedDuringLoad) return;
								applySavedState(Object.assign({}, state || {}, { student: user.profile || {} }));
								if (shouldSync) {
									persist().then(function (savedToDatabase) {
										if (savedToDatabase && migrateLegacy && !storedState && !cachedState) {
											try { $window.localStorage.removeItem(legacyStorageKey); } catch (error) { }
										}
									});
								}
							});
						}
						if (isLocalApiMode() || user.role !== "student") {
							restore(localState, Boolean(migrateLegacy && !storedState && !cachedState));
							return;
						}
						authRequest("/api/student/state").then(function (result) {
							var hasCloudState = !!result.state;
							restore(hasCloudState ? result.state : localState, true);
						}).catch(function (error) {
							restore(localState, false);
							showToast("Using this device's saved progress; cloud sync is unavailable: " + error.message);
						});
					}).catch(function () {
						if (stateChangedDuringLoad) return;
						$scope.$applyAsync(function () {
							if (!stateChangedDuringLoad) applySavedState(Object.assign({}, cachedState || (migrateLegacy ? legacySavedState : {}), { student: user.profile || {} }));
						});
						showToast("IndexedDB is unavailable. Using fallback browser storage.");
					});
				}

				$scope.authRequest = authRequest;
				$scope.loadAuthenticatedUser = loadAuthenticatedUser;
				loadPublishedCourses();
				loadRegisteredInstructors();
				var authRedirectResult = new URLSearchParams($window.location.search).get("auth");
				if (["google-success", "google-error", "signup-confirmed", "password-recovery"].indexOf(authRedirectResult) === -1) authRedirectResult = "";
				if (authRedirectResult) $window.history.replaceState({}, "", $window.location.pathname + $window.location.hash);
				authRequest("/api/auth/me").then(function (result) {
					loadAuthenticatedUser(result.user);
					if (authRedirectResult === "google-success") {
						$scope.$applyAsync(function () { setPage("account"); });
						showToast("Signed in with Google.");
					}
					}).catch(function (error) {
						if (authRedirectResult) {
							$scope.$applyAsync(function () {
								setPage("account");
								if (authRedirectResult === "signup-confirmed") {
									$scope.authMode = "login";
									$scope.formError = "";
									$scope.resetNotice = "Your email is confirmed. Sign in with your new account.";
								} else if (authRedirectResult === "password-recovery") {
									$scope.authMode = "reset-request";
									$scope.formError = "";
									$scope.resetNotice = "Enter your email address to request a password-reset code.";
								} else {
									$scope.authMode = "login";
									$scope.formError = "Google sign-in could not be completed. Try again or use email and password.";
								}
							});
						}
						if (error.status !== 401) $scope.serviceError = error.message;
					});

				$scope.toggleTheme = function () {
					$scope.darkMode = !$scope.darkMode;
					$scope.highContrast = false;
					persist();
				};

				$scope.toggleContrast = function () {
					$scope.highContrast = !$scope.highContrast;
					if ($scope.highContrast) $scope.darkMode = false;
					persist();
				};

				$scope.readCurrentLesson = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var text = [lesson.title, lesson.objective, lesson.content, (lesson.keyPoints || []).join(". ")].join(". ");
					$scope.stopReading();
					var utterance = new $window.SpeechSynthesisUtterance(text);
					utterance.onend = function () { $scope.$applyAsync(function () { $scope.speechActive = false; }); };
					utterance.onerror = function () { $scope.$applyAsync(function () { $scope.speechActive = false; }); };
					$scope.speechActive = true;
					$window.speechSynthesis.speak(utterance);
				};

				$scope.stopReading = function () {
					if ($window.speechSynthesis) $window.speechSynthesis.cancel();
					$scope.speechActive = false;
				};

				$scope.openCommandBar = function () {
					$scope.commandQuery = "";
					$scope.commandBarOpen = true;
					$timeout(function () {
						var searchInput = $window.document.getElementById("commandSearch");
						if (searchInput) searchInput.focus();
					});
				};

				$scope.closeCommandBar = function () {
					$scope.commandBarOpen = false;
				};

				$scope.commandMatches = function (course) {
					var query = ($scope.commandQuery || "").toLowerCase().trim();
					if (!query) return true;
					var instructor = $scope.instructorById(course.instructorId);
					return [course.title, course.category, instructor.name].join(" ").toLowerCase().indexOf(query) !== -1;
				};

				$scope.chooseCommandCourse = function (course) {
					$scope.stopReading();
					$scope.selectedCourse = course;
					setPage("courseDetail");
					$scope.closeCommandBar();
				};

				$scope.goToCommandView = function (view) {
					$scope.setView(view);
					$scope.closeCommandBar();
				};

				$scope.submitCommand = function (event) {
					if (event.key !== "Enter") return;
					var matches = $scope.courses.filter($scope.commandMatches);
					if (matches.length) $scope.chooseCommandCourse(matches[0]);
					else {
						$scope.courseQuery = $scope.commandQuery;
						$scope.setView("courses");
						$scope.closeCommandBar();
					}
				};

				function handleGlobalKeydown(event) {
					if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
						event.preventDefault();
						$scope.$applyAsync($scope.openCommandBar);
					} else if (event.key === "Escape" && $scope.commandBarOpen) {
						$scope.$applyAsync($scope.closeCommandBar);
					}
				}

			$window.document.addEventListener("keydown", handleGlobalKeydown);
			$scope.$on("$destroy", function () {
				$window.document.removeEventListener("keydown", handleGlobalKeydown);
				$window.document.removeEventListener("fieldnote:botpress-ready", botpressReadyHandler);
				$window.document.removeEventListener("fieldnote:botpress-error", botpressErrorHandler);
				if ($window.speechSynthesis) $window.speechSynthesis.cancel();
				cleanupPlatformLab();
			});

				function showToast(message) {
					$scope.toastMessage = message;
					if (toastTimer) $timeout.cancel(toastTimer);
					toastTimer = $timeout(function () { $scope.toastMessage = ""; }, 2600);
				}

				function setPage(view) {
					$scope.view = view;
					$scope.viewTemplate = "views/" + view + ".html";
				}

				$scope.setView = function (view) {
					if (view === "learning" && (!$scope.authUser || $scope.authUser.role !== "student")) {
						$scope.authMode = "login";
						view = "account";
						showToast("Sign in with a student account to view learning progress.");
					}
					if (view === "instructorStudio" && (!$scope.authUser || $scope.authUser.role !== "instructor")) {
						$scope.authMode = "login";
						view = "account";
						showToast("Sign in with an instructor account to open Instructor Studio.");
					}
					if (view !== "lesson") $scope.stopReading();
					if (view !== "platform") cleanupPlatformLab();
					setPage(view);
					$scope.mobileMenuOpen = false;
					$scope.formError = "";
					if (view === "account") {
						$scope.studentForm = $scope.student ? angular.copy($scope.student) : { role: "student", teachingSubjects: [] };
						$scope.studentForm.confirmEducationBackground = false;
					}
					if (view === "instructorStudio") $scope.loadInstructorCourses();
				};

				$scope.addInstructorModule = function () {
					var module = $scope.newInstructorModule;
					var questions = module.assessmentQuestions || [];
					if (!module.title.trim() || !module.objective.trim() || !module.content.trim() || !questions.length || questions.length > 20 || questions.some(function (question) {
						return !question.prompt.trim() || question.options.length < 2 || question.options.some(function (option) { return !option.trim(); }) || question.answerIndex < 0 || question.answerIndex >= question.options.length;
					})) {
						$scope.instructorStudioError = "Complete the module and each question, answer option, and correct answer.";
						return;
					}
					if (module.videoUrl && !normalizeYouTubeEmbedUrl(module.videoUrl)) {
						$scope.instructorStudioError = "Enter a valid YouTube video URL or leave the video field blank.";
						return;
					}
					$scope.instructorModuleDrafts.push({
						title: module.title.trim(),
						objective: module.objective.trim(),
						content: module.content.trim(),
						videoUrl: module.videoUrl.trim(),
						assessmentQuestions: questions.map(function (question) {
							return { prompt: question.prompt.trim(), options: question.options.map(function (option) { return option.trim(); }), answerIndex: Number(question.answerIndex) };
						})
					});
					$scope.newInstructorModule = createInstructorModuleDraft();
					$scope.instructorStudioError = "";
				};

				$scope.addInstructorQuestion = function () {
					if ($scope.newInstructorModule.assessmentQuestions.length >= 20) {
						$scope.instructorStudioError = "A module can have up to 20 questions.";
						return;
					}
					$scope.newInstructorModule.assessmentQuestions.push(createAssessmentQuestionDraft());
				};

				$scope.removeInstructorQuestion = function (index) {
					if ($scope.newInstructorModule.assessmentQuestions.length > 1) $scope.newInstructorModule.assessmentQuestions.splice(index, 1);
				};

				$scope.downloadInstructorModule = function (module) {
					var content = JSON.stringify({ format: "fieldnote-module-v1", module: module }, null, 2);
					var blob = new $window.Blob([content], { type: "application/json" });
					var downloadUrl = $window.URL.createObjectURL(blob);
					var link = $window.document.createElement("a");
					link.href = downloadUrl;
					link.download = (module.title || "fieldnote-module").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".json";
					link.click();
					$timeout(function () { $window.URL.revokeObjectURL(downloadUrl); }, 1000);
				};

				$scope.importInstructorModule = function (files) {
					var file = files && files[0];
					if (!file) return;
					var input = $window.document.getElementById("moduleImportFile");
					if (input) input.value = "";
					if (file.size > 1024 * 1024) {
						$scope.instructorStudioError = "Module JSON files must be 1 MB or smaller.";
						return;
					}
					var reader = new $window.FileReader();
					reader.onload = function (event) {
						$scope.$applyAsync(function () {
							try {
								var parsed = JSON.parse(event.target.result);
								var module = parsed.format === "fieldnote-module-v1" ? parsed.module : parsed;
								if (!module || typeof module.title !== "string" || typeof module.objective !== "string" || typeof module.content !== "string" || !Array.isArray(module.assessmentQuestions) || module.assessmentQuestions.length < 1 || module.assessmentQuestions.length > 20) throw new Error();
								$scope.newInstructorModule = {
									title: module.title,
									objective: module.objective,
									content: module.content,
									videoUrl: typeof module.videoUrl === "string" ? module.videoUrl : "",
									assessmentQuestions: module.assessmentQuestions.map(function (question) {
										if (!question || typeof question.prompt !== "string" || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || !Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.options.length) throw new Error();
										return { prompt: question.prompt, options: question.options.map(String), answerIndex: question.answerIndex };
									})
								};
								$scope.instructorStudioError = "";
							} catch (error) {
								$scope.instructorStudioError = "Choose a valid Fieldnote module JSON file.";
							}
						});
					};
					reader.onerror = function () { $scope.$applyAsync(function () { $scope.instructorStudioError = "The module file could not be read."; }); };
					reader.readAsText(file);
				};

				$scope.removeInstructorModule = function (index) {
					$scope.instructorModuleDrafts.splice(index, 1);
				};

				$scope.publishInstructorCourse = function () {
					if (!$scope.newInstructorCourse.title.trim() || !$scope.newInstructorCourse.category || !$scope.newInstructorCourse.description.trim() || !$scope.instructorModuleDrafts.length) {
						$scope.instructorStudioError = "Add a course title, subject, description, and at least one complete module.";
						return;
					}
					$scope.instructorStudioError = "";
					authRequest("/api/instructor/courses", "POST", {
						title: $scope.newInstructorCourse.title.trim(),
						category: $scope.newInstructorCourse.category,
						description: $scope.newInstructorCourse.description.trim(),
						modules: $scope.instructorModuleDrafts
					}).then(function (result) {
						$scope.instructorCourses.unshift(result.course);
						mergePublishedCourses([result.course].concat($scope.courses.filter(function (course) { return course.instructorCreated; })));
						$scope.newInstructorCourse = { title: "", category: "", description: "" };
						$scope.instructorModuleDrafts = [];
						showToast("Course and assessment published to the catalog.");
					}).catch(function (error) { $scope.instructorStudioError = error.message; });
				};

				$scope.effectiveStreamQuality = function () {
					if ($scope.platformState.streamQuality !== "Auto") return $scope.platformState.streamQuality;
					var profile = $scope.networkProfiles.filter(function (item) { return item.id === $scope.platformState.network; })[0];
					return profile ? profile.rendition : "720p";
				};
				function stopMediaStream(stream) {
					if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
				}
				function cleanupClassroomMedia() {
					stopMediaStream(platformCameraStream);
					stopMediaStream(platformScreenStream);
					platformCameraStream = null;
					platformScreenStream = null;
					$scope.platformState.cameraActive = false;
					$scope.platformState.screenSharing = false;
					$scope.platformState.cameraStatus = "";
					$scope.platformState.screenStatus = "";
				}
				function cleanupPlatformLab() {
					cleanupClassroomMedia();
					var video = $window.document.getElementById("platformVideoPreview");
					if (video) {
						video.pause();
						video.removeAttribute("src");
						video.load();
					}
					if (platformVideoUrl) $window.URL.revokeObjectURL(platformVideoUrl);
					platformVideoUrl = "";
					$scope.platformState.videoLoaded = false;
					$scope.platformState.videoName = "";
				}
				function mediaErrorMessage(error, mediaName) {
					if (error && error.name === "NotAllowedError") return mediaName + " permission was denied. Allow access in your browser and try again.";
					if (error && error.name === "AbortError") return mediaName + " request was canceled.";
					if (error && (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")) return "No " + mediaName.toLowerCase() + " device was found.";
					if (error && error.name === "NotReadableError") return mediaName + " is already in use by another application.";
					return "Could not start " + mediaName.toLowerCase() + ". Check browser permissions and try again.";
				}
				function bindPreview(videoId, stream) {
					$timeout(function () {
						var video = $window.document.getElementById(videoId);
						if (video) video.srcObject = stream;
					});
				}
				$scope.selectPlatformTab = function (tab) {
					if (tab !== "cohorts") cleanupClassroomMedia();
					if (tab !== "video") {
						var video = $window.document.getElementById("platformVideoPreview");
						if (video) video.pause();
					}
					$scope.platformState.tab = tab;
				};
				$scope.loadPlatformVideo = function (files) {
					var file = files && files[0];
					if (!file) return;
					if (!/^video\//i.test(file.type) || file.size > 500 * 1024 * 1024) {
						$scope.platformState.videoStatus = "Choose a video file smaller than 500 MB.";
						return;
					}
					var currentVideo = $window.document.getElementById("platformVideoPreview");
					if (currentVideo) currentVideo.pause();
					if (platformVideoUrl) $window.URL.revokeObjectURL(platformVideoUrl);
					platformVideoUrl = $window.URL.createObjectURL(file);
					$scope.platformState.videoLoaded = true;
					$scope.platformState.videoName = file.name;
					$scope.platformState.videoStatus = "Loaded locally. Video data is not uploaded.";
					$timeout(function () {
						var video = $window.document.getElementById("platformVideoPreview");
						if (!video) return;
						video.src = platformVideoUrl;
						video.load();
					});
				};
				$scope.clearPlatformVideo = function () {
					var video = $window.document.getElementById("platformVideoPreview");
					if (video) {
						video.pause();
						video.removeAttribute("src");
						video.load();
					}
					if (platformVideoUrl) $window.URL.revokeObjectURL(platformVideoUrl);
					platformVideoUrl = "";
					$scope.platformState.videoLoaded = false;
					$scope.platformState.videoName = "";
					$scope.platformState.videoStatus = "Video removed from the player.";
				};
				$scope.selectTranscriptLine = function (line) {
					$scope.platformState.activeTranscript = line.time;
					var video = $window.document.getElementById("platformVideoPreview");
					if (video && $scope.platformState.videoLoaded) {
						var timestamp = line.time.split(":").map(Number);
						video.currentTime = timestamp.length === 2 ? timestamp[0] * 60 + timestamp[1] : 0;
					}
				};
				$scope.toggleCamera = function () {
					if (platformCameraStream) {
						stopMediaStream(platformCameraStream);
						platformCameraStream = null;
						$scope.platformState.cameraActive = false;
						$scope.platformState.cameraStatus = "Camera is off.";
						return;
					}
					var mediaDevices = $window.navigator.mediaDevices;
					if (!mediaDevices || !mediaDevices.getUserMedia) {
						$scope.platformState.cameraStatus = "Camera access requires a supported browser on HTTPS or localhost.";
						return;
					}
					mediaDevices.getUserMedia({ video: true, audio: false }).then(function (stream) {
						$scope.$applyAsync(function () {
							if ($scope.$$destroyed || !$scope.platformState.inRoom) {
								stopMediaStream(stream);
								return;
							}
							platformCameraStream = stream;
							$scope.platformState.cameraActive = true;
							$scope.platformState.cameraStatus = "On. This preview is only visible in your browser.";
							bindPreview("platformCameraPreview", stream);
							stream.getVideoTracks()[0].addEventListener("ended", function () {
								$scope.$applyAsync(function () {
									platformCameraStream = null;
									$scope.platformState.cameraActive = false;
									$scope.platformState.cameraStatus = "Camera is off.";
								});
							});
						});
					}, function (error) {
						$scope.$applyAsync(function () { $scope.platformState.cameraStatus = mediaErrorMessage(error, "Camera"); });
					});
				};
				$scope.toggleScreenShare = function () {
					if (platformScreenStream) {
						stopMediaStream(platformScreenStream);
						platformScreenStream = null;
						$scope.platformState.screenSharing = false;
						$scope.platformState.screenStatus = "Screen sharing stopped.";
						return;
					}
					var mediaDevices = $window.navigator.mediaDevices;
					if (!mediaDevices || !mediaDevices.getDisplayMedia) {
						$scope.platformState.screenStatus = "Screen sharing is not supported in this browser.";
						return;
					}
					mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
						$scope.$applyAsync(function () {
							if ($scope.$$destroyed || !$scope.platformState.inRoom) {
								stopMediaStream(stream);
								return;
							}
							platformScreenStream = stream;
							$scope.platformState.screenSharing = true;
							$scope.platformState.screenStatus = "Sharing a local preview. No meeting participants can see it.";
							bindPreview("platformScreenPreview", stream);
							stream.getVideoTracks()[0].addEventListener("ended", function () {
								$scope.$applyAsync(function () {
									platformScreenStream = null;
									$scope.platformState.screenSharing = false;
									$scope.platformState.screenStatus = "Screen sharing stopped.";
								});
							});
						});
					}, function (error) {
						$scope.$applyAsync(function () { $scope.platformState.screenStatus = mediaErrorMessage(error, "Screen sharing"); });
					});
				};
				$scope.toggleVideoPreview = function () {
					var video = $window.document.getElementById("platformVideoPreview");
					if (!video) return;
					if (video.paused) video.play().catch(function () {});
					else video.pause();
				};
				$scope.prefetchVideoSegment = function () { $scope.platformState.prefetched = true; };
				$scope.simulateLtiLaunch = function () {
					$scope.platformState.ltiLaunched = true;
					$scope.recordXapiDemo("launched", "LTI course placement");
				};
				$scope.recordXapiDemo = function (verb, objectName) {
					var slug = objectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
					var statement = { actor: { objectType: "Agent", name: "Demo learner" }, verb: { id: "https://w3id.org/xapi/adl/verbs/" + verb, display: { "en-US": verb } }, object: { objectType: "Activity", id: "https://example.org/fieldnote/activities/" + slug, definition: { name: { "en-US": objectName } } }, timestamp: new Date().toISOString() };
					$scope.xapiEvents.unshift({ id: statement.timestamp + slug, verb: verb, objectName: objectName, time: new Date().toLocaleTimeString(), statement: statement });
					if ($scope.xapiEvents.length > 8) $scope.xapiEvents.pop();
				};
				$scope.riskScore = function (learner) { return Math.min(100, Math.round(learner.inactiveDays * 7 + (100 - learner.completion) * 0.35 + learner.missedChecks * 8)); };
				$scope.riskBand = function (learner) { var score = $scope.riskScore(learner); return score >= 65 ? "High" : (score >= 40 ? "Moderate" : "Low"); };
				$scope.toggleDemoRoom = function () {
					$scope.platformState.inRoom = !$scope.platformState.inRoom;
					if (!$scope.platformState.inRoom) cleanupClassroomMedia();
				};
				$scope.startDemoQuiz = function () {
					if (liveQuizTimer) $interval.cancel(liveQuizTimer);
					$scope.platformState.quizActive = true;
					$scope.platformState.quizSeconds = 30;
					$scope.platformState.quizAnswer = "";
					$scope.platformState.quizResult = "";
					liveQuizTimer = $interval(function () {
						$scope.platformState.quizSeconds -= 1;
						if ($scope.platformState.quizSeconds <= 0) {
							$interval.cancel(liveQuizTimer);
							liveQuizTimer = null;
							$scope.platformState.quizActive = false;
							$scope.platformState.quizResult = "Time is up. Start another demo round to try again.";
						}
					}, 1000);
				};
				$scope.submitDemoQuiz = function () {
					if (!$scope.platformState.quizActive || !$scope.platformState.quizAnswer) return;
					if (liveQuizTimer) $interval.cancel(liveQuizTimer);
					liveQuizTimer = null;
					$scope.platformState.quizActive = false;
					$scope.platformState.quizResult = $scope.platformState.quizAnswer === "specific" ? "Correct. Specific feedback helps learners understand what to do next." : "Not quite. Useful feedback explains the answer, not only the score.";
				};
				$scope.resetDemoQuiz = function () { $scope.platformState.quizResult = ""; $scope.platformState.quizAnswer = ""; };
				$scope.scheduleDemoCohort = function () {
					var start = new Date();
					start.setDate(start.getDate() + 7);
					start.setHours(17, 0, 0, 0);
					$scope.cohortSessions.unshift({ id: "cohort-demo-" + start.getTime(), name: "New weekly cohort", starts: start.toLocaleString(), seats: "3 / 12 learners", note: "Created locally" });
					$scope.platformState.scheduleNotice = "Demo cohort grouped locally. Calendar invites and reminders were not sent.";
				};

				$scope.uploadCertificate = function (files) {
					var file = files && files[0];
					if (!file) return;
					$scope.certificateError = "";
					var validationError = validateImageUpload(file);
					if (validationError) {
						$scope.certificateError = validationError;
						return;
					}
					var reader = new $window.FileReader();
					reader.onload = function (event) {
						$scope.$applyAsync(function () {
							$scope.studentForm.certificateImage = event.target.result;
							$scope.certificateError = "";
						});
					};
					reader.onerror = function () {
						$scope.$applyAsync(function () { $scope.certificateError = "The image could not be read. Try another file."; });
					};
					reader.readAsDataURL(file);
				};
				$scope.uploadProfilePhoto = function (files) {
					var file = files && files[0];
					if (!file) return;
					$scope.profilePhotoError = "";
					var input = $window.document.getElementById("profilePhoto");
					var validationError = validateImageUpload(file);
					if (validationError) {
						$scope.profilePhotoError = validationError;
						if (input) input.value = "";
						return;
					}
					var reader = new $window.FileReader();
					reader.onload = function (event) {
						var image = new $window.Image();
						image.onload = function () {
							try {
								var maxDimension = 512;
								var scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
								var canvas = $window.document.createElement("canvas");
								canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
								canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
								var context = canvas.getContext("2d");
								if (!context) throw new Error("Image processing is unavailable.");
								context.drawImage(image, 0, 0, canvas.width, canvas.height);
								var photo = canvas.toDataURL("image/jpeg", 0.82);
								$scope.$applyAsync(function () {
									$scope.studentForm.profilePhoto = photo;
									$scope.profilePhotoError = "";
								});
							} catch (error) {
								$scope.$applyAsync(function () { $scope.profilePhotoError = "The picture could not be processed. Try another image."; });
							}
						};
						image.onerror = function () {
							$scope.$applyAsync(function () { $scope.profilePhotoError = "This image could not be opened. Choose a valid PNG, JPG, or WebP file."; });
						};
						image.src = event.target.result;
					};
					reader.onerror = function () {
						$scope.$applyAsync(function () { $scope.profilePhotoError = "The image could not be read. Try another file."; });
					};
					reader.readAsDataURL(file);
					if (input) input.value = "";
				};

				$scope.removeProfilePhoto = function () {
					$scope.studentForm.profilePhoto = "";
					$scope.profilePhotoError = "";
					var profilePhotoInput = $window.document.getElementById("profilePhoto");
					if (profilePhotoInput) profilePhotoInput.value = "";
				};

				$scope.removeCertificateImage = function () {
					$scope.studentForm.certificateImage = "";
					$scope.certificateError = "";
				};

				$scope.initials = function (name) {
					return (name || "?").split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
				};

				$scope.instructorById = function (id) {
					var instructor = $scope.instructors.filter(function (item) { return item.id === id; })[0];
					if (instructor) return instructor;
					var course = $scope.courses.filter(function (item) { return item.instructorId === id && item.instructorName; })[0];
					var registeredInstructor = $scope.registeredInstructors.filter(function (item) { return item.id === id; })[0];
					if (course) return { id: id, name: course.instructorName, role: "Registered instructor", image: registeredInstructor && registeredInstructor.profilePhoto || "assets/writing-with-clarity.svg" };
					return $scope.instructors[0];
				};

				$scope.courseById = function (id) {
					return $scope.courses.filter(function (course) { return course.id === id; })[0];
				};

				$scope.viewCourse = function (course) {
					$scope.stopReading();
					$scope.selectedCourse = course;
					setPage("courseDetail");
				};

				$scope.openLesson = function (index) {
					$scope.stopReading();
					$scope.selectedLessonIndex = index;
					var lesson = $scope.selectedCourse.curriculum[index];
					$scope.codeDraft = lesson.codeExample || "";
					$scope.runnerVisible = false;
					$scope.copilotQuestion = "";
					$scope.copilotResponse = "";
					$scope.copilotSummary = "";
					$scope.copilotQuestions = [];
					$scope.lessonCommentDraft = "";
					$scope.lessonNotes = [];
					$scope.lessonTest = null;
					$scope.scenarioNodeId = lesson.scenario ? lesson.scenario.start : "";
					setPage("lesson");
					$scope.refreshLessonNotes();
				};

				$scope.youtubeEmbedUrl = function (videoUrl) {
					var embedUrl = normalizeYouTubeEmbedUrl(videoUrl);
					return embedUrl ? $sce.trustAsResourceUrl(embedUrl) : null;
				};

				$scope.continueCourse = function (course) {
					if (!course.curriculum || !course.curriculum.length) return;
					$scope.selectedCourse = course;
					var nextIndex = course.curriculum.findIndex(function (lesson) { return !$scope.lessonIsComplete(course, lesson); });
					$scope.openLesson(nextIndex === -1 ? 0 : nextIndex);
				};

				$scope.currentScenarioNode = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					return lesson.scenario.nodes[$scope.scenarioNodeId];
				};

				$scope.chooseScenario = function (choice) {
					$scope.scenarioNodeId = choice.next;
				};

				$scope.restartScenario = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					$scope.scenarioNodeId = lesson.scenario.start;
				};

				function createLessonTest(course, lesson) {
					function shuffle(items) {
						for (var index = items.length - 1; index > 0; index -= 1) {
							var swapIndex = Math.floor(Math.random() * (index + 1));
							var item = items[index];
							items[index] = items[swapIndex];
							items[swapIndex] = item;
						}
						return items;
					}
					if (lesson.assessmentQuestions && lesson.assessmentQuestions.length) {
						return shuffle(lesson.assessmentQuestions.map(function (question) {
							return { prompt: question.prompt, options: question.options.slice(), answer: question.options[question.answerIndex] };
						}));
					}
					var answerPool = lesson.keyPoints && lesson.keyPoints.length ? lesson.keyPoints.slice() : [];
					if (lesson.objective && answerPool.indexOf(lesson.objective) === -1) answerPool.push(lesson.objective);
					if (!answerPool.length) answerPool.push(lesson.objective || lesson.title);
					var answers = shuffle(answerPool.slice()).slice(0, Math.min(2, answerPool.length));
					var factBank = [];
					seed.courses.forEach(function (item) {
						(item.curriculum || []).forEach(function (itemLesson) {
							[itemLesson.objective].concat(itemLesson.keyPoints || []).forEach(function (fact) {
								if (fact && answerPool.indexOf(fact) === -1 && factBank.indexOf(fact) === -1) factBank.push(fact);
							});
						});
					});
					return answers.slice(0, 3).map(function (answer, questionIndex) {
						var options = [answer].concat(shuffle(factBank.slice()).slice(0, 3));
						var fallbackOptions = ["This does not describe a lesson objective.", "This is unrelated to the lesson's key ideas.", "This describes a different subject."];
						while (options.length < 4) options.push(fallbackOptions[options.length - 1]);
						shuffle(options);
						return {
							prompt: answer === lesson.objective ? "What is the main objective of this lesson?" : "Which statement is a key idea from this lesson?",
							answer: answer,
							options: options
						};
					});
				}

				$scope.startLessonTest = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					$scope.lessonTest = { questions: createLessonTest($scope.selectedCourse, lesson), submitted: false, score: 0, total: 0, passed: false };
				};

				$scope.lessonTestReady = function () {
					return $scope.lessonTest && $scope.lessonTest.questions.every(function (question) { return !!question.selectedAnswer; });
				};

				$scope.submitLessonTest = function () {
					if (!$scope.lessonTestReady()) return;
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var score = $scope.lessonTest.questions.filter(function (question) { return question.selectedAnswer === question.answer; }).length;
					var total = $scope.lessonTest.questions.length;
					var passed = score / total >= 0.7;
					$scope.lessonTest.score = score;
					$scope.lessonTest.total = total;
					$scope.lessonTest.passed = passed;
					$scope.lessonTest.submitted = true;
					$scope.quizResults[$scope.selectedCourse.id + ":" + lesson.id] = { score: score, total: total, passed: passed, completedAt: new Date().toISOString() };
					persist();
				};

				$scope.lessonQuizResult = function (course, lesson) {
					return $scope.quizResults[course.id + ":" + lesson.id];
				};

				$scope.lessonCount = function (course) {
					return course.curriculum ? course.curriculum.length : course.lessons;
				};

				$scope.courseOutcomes = function (course) {
					var outcomes = [];
					(course && course.curriculum || []).forEach(function (lesson) {
						var outcome = (lesson.objective || "").trim();
						if (outcome && outcomes.indexOf(outcome) === -1) outcomes.push(outcome);
					});
					return outcomes;
				};

				$scope.resetLessonCode = function () {
					$scope.codeDraft = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex].codeExample || "";
					$scope.runnerVisible = false;
				};

				$scope.runLessonCode = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var source = $scope.codeDraft || "";
					var documentSource;
					if (lesson.codeLanguage === "javascript") {
						var scriptClose = "<" + "/script>";
						var safeScript = source.split(scriptClose).join("<\\" + "/script>");
						documentSource = "<!doctype html><html><body><button id=\"demoButton\" type=\"button\">Try the example</button><p id=\"status\" role=\"status\">Ready</p><pre id=\"output\">Run the example to see output.</pre><script>var output=document.getElementById('output');console.log=function(){output.textContent=Array.prototype.join.call(arguments,' ')};try{" + safeScript + "}catch(error){output.textContent=error.message}<" + "/script></body></html>";
					} else {
						documentSource = source;
					}
					$scope.runnerVisible = true;
					$timeout(function () {
						var frame = $window.document.getElementById("lessonCodeOutput");
						if (frame) frame.srcdoc = documentSource;
					});
				};

				$scope.askStudyCopilot = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var words = ($scope.copilotQuestion || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
					var sentences = (lesson.content || "").match(/[^.!?]+[.!?]?/g) || [];
					var matches = sentences.filter(function (sentence) {
						return words.some(function (word) { return sentence.toLowerCase().indexOf(word) !== -1; });
					});
					if (!words.length) {
						$scope.copilotResponse = "Enter a question or topic to search this lesson.";
					} else if (matches.length) {
						$scope.copilotResponse = matches.slice(0, 2).join(" ").trim();
					} else {
						$scope.copilotResponse = "I couldn't find that in this lesson. Review the key ideas below: " + (lesson.keyPoints || []).join(" ");
					}
				};

				$scope.summarizeCurrentLesson = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var sentences = (lesson.content || "").match(/[^.!?]+[.!?]?/g) || [];
					$scope.copilotSummary = sentences.slice(0, 3).join(" ").trim() || lesson.objective;
				};

				$scope.createReviewQuestions = function () {
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var keyPoints = lesson.keyPoints && lesson.keyPoints.length ? lesson.keyPoints : [lesson.objective];
					$scope.copilotQuestions = keyPoints.map(function (point) {
						return { prompt: "Explain this idea in your own words: " + point, answer: point, revealed: false };
					});
				};

				function coachLesson() {
					return $scope.view === "lesson" && $scope.selectedCourse && $scope.selectedCourse.curriculum ? $scope.selectedCourse.curriculum[$scope.selectedLessonIndex] : null;
				}

				function coachFacts() {
					var lesson = coachLesson();
					var facts = [];
					if ($scope.view === "overview") {
						facts.push("The dashboard summarizes enrolled courses, lessons completed, and average course progress.");
						facts.push("The daily learning goal tracks completed lessons and your learning streak.");
						facts.push("Use the course catalog to explore subjects and enroll in courses.");
					} else if ($scope.view === "courses") {
						facts.push("The course catalog can be searched by course, topic, or instructor and filtered by subject.");
						$scope.courses.forEach(function (course) { facts.push(course.title + " (" + course.category + "): " + course.description); });
					} else if ($scope.view === "courseDetail" && $scope.selectedCourse) {
						facts.push($scope.selectedCourse.title + ": " + $scope.selectedCourse.description);
						facts.push("Subject: " + $scope.selectedCourse.category + ". Duration: " + $scope.selectedCourse.duration + ".");
						facts.push("This course contains " + $scope.lessonCount($scope.selectedCourse) + " lessons. Use the lesson list to open a lesson, or enroll to track progress.");
						($scope.selectedCourse.curriculum || []).forEach(function (item) { facts.push(item.title + ": " + item.objective); });
					} else if (lesson) {
						facts.push("Lesson: " + lesson.title + ". Course: " + $scope.selectedCourse.title + ".");
						facts.push("Learning objective: " + lesson.objective);
						facts = facts.concat((lesson.content || "").match(/[^.!?]+[.!?]?/g) || []);
						(lesson.keyPoints || []).forEach(function (point) { facts.push("Key idea: " + point); });
						if (lesson.practice) facts.push("Practice: " + lesson.practice);
					} else if ($scope.view === "learning") {
						facts.push("My learning shows your enrolled courses and completion progress.");
						$scope.enrollments.forEach(function (enrollment) {
							var course = $scope.courseById(enrollment.courseId);
							if (course) facts.push(course.title + ": " + enrollment.completed + " of " + $scope.lessonCount(course) + " lessons completed (" + $scope.progressFor(course.id) + "%).");
						});
					} else if ($scope.view === "instructors") {
						$scope.instructors.forEach(function (instructor) { facts.push(instructor.name + ", " + instructor.role + ": " + instructor.bio); });
					} else if ($scope.view === "account") {
						facts.push("Student Profile lets you update your name, email, program, school, certificate score, address, education background, and profile picture.");
						facts.push("Profile information is stored in this browser. Use Save changes to keep edits.");
					}
					return facts;
				}

				$scope.coachContextLabel = function () {
					var lesson = coachLesson();
					if (lesson) return $scope.selectedCourse.title + " · " + lesson.title;
					if ($scope.view === "courseDetail" && $scope.selectedCourse) return $scope.selectedCourse.title;
					return { overview: "Dashboard", courses: "Course catalog", learning: "My learning", instructors: "Instructors", account: "Student profile" }[$scope.view] || "Learning space";
				};

				$scope.coachLoading = false;

				function askGeminiCoach(question) {
					if (!question || $scope.coachLoading) return;
					$scope.coachMessages.push({ role: "user", text: question });
					$scope.coachLoading = true;
					return $q.when($window.fetch("/api/coach", {
						method: "POST",
						credentials: "same-origin",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							question: question,
							title: $scope.coachContextLabel(),
							context: coachFacts().slice(0, 20).join("\n").slice(0, 8000)
						})
					})).then(function (response) {
						return response.json().catch(function () { return {}; }).then(function (payload) {
							if (!response.ok) throw new Error(payload.error || "The Learning Coach could not answer (HTTP " + response.status + ").");
							if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("The Learning Coach returned an empty answer. Please try again.");
							$scope.coachMessages.push({ role: "assistant", text: payload.answer.trim() });
						});
					}, function () {
						throw new Error("Could not reach the Learning Coach. Check your connection and API deployment.");
					}).catch(function (error) {
						$scope.coachMessages.push({ role: "assistant", text: error.message || "The Learning Coach could not answer. Please try again." });
					}).finally(function () {
						$scope.coachLoading = false;
					});
				}

				$scope.sendCoachMessage = function () {
					var question = ($scope.coachState.draft || "").trim();
					if (!question) return;
					$scope.coachState.draft = "";
					return askGeminiCoach(question);
				};

				$scope.teachCurrentPage = function () {
					return askGeminiCoach("Teach me this part.");
				};

				$scope.summarizeCurrentPage = function () {
					return askGeminiCoach("Summarize this part.");
				};

				$scope.currentLessonDiscussion = function () {
					if (!$scope.selectedCourse || !$scope.selectedCourse.curriculum[$scope.selectedLessonIndex]) return [];
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var discussionKey = $scope.selectedCourse.id + ":" + lesson.id;
					return $scope.lessonDiscussions[discussionKey] || [];
				};

				$scope.refreshLessonNotes = function () {
					$scope.lessonNotes = $scope.currentLessonDiscussion().slice();
				};

				$scope.postLessonComment = function () {
					if (!$scope.authUser || $scope.authUser.role !== "student") {
						showToast("Sign in with a student account to save lesson notes.");
						return;
					}
					var text = ($scope.lessonCommentDraft || "").trim();
					if (!text) return;
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var discussionKey = $scope.selectedCourse.id + ":" + lesson.id;
					if (!$scope.lessonDiscussions[discussionKey]) $scope.lessonDiscussions[discussionKey] = [];
					var note = { id: Date.now() + Math.random(), author: $scope.student ? $scope.student.name : "Learner", date: new Date().toLocaleString(), text: text };
					$scope.lessonDiscussions[discussionKey].push(note);
					$scope.lessonNotes = $scope.lessonDiscussions[discussionKey].slice();
					$scope.lessonCommentDraft = "";
					persist().then(function (savedToDatabase) {
						if (savedToDatabase) showToast("Note saved for this lesson.");
					});
				};

				$scope.lessonIsComplete = function (course, lesson) {
					var enrollment = $scope.enrollmentFor(course.id);
					if (!enrollment) return false;
					if (enrollment.completedLessonIds) return enrollment.completedLessonIds.indexOf(lesson.id) !== -1;
					return enrollment.completed > course.curriculum.indexOf(lesson);
				};

				$scope.completeCurrentLesson = function () {
					if (!$scope.authUser || $scope.authUser.role !== "student") {
						showToast("Sign in with a student account to record lesson progress.");
						return;
					}
					var lesson = $scope.selectedCourse.curriculum[$scope.selectedLessonIndex];
					var enrollment = $scope.enrollmentFor($scope.selectedCourse.id);
					if (!enrollment || $scope.lessonIsComplete($scope.selectedCourse, lesson)) return;
					if (!enrollment.completedLessonIds) {
						enrollment.completedLessonIds = $scope.selectedCourse.curriculum.slice(0, Math.min(enrollment.completed, $scope.selectedCourse.curriculum.length)).map(function (item) { return item.id; });
					}
					enrollment.completedLessonIds.push(lesson.id);
					enrollment.completed = enrollment.completedLessonIds.length;
					var streak = recordStudyActivity();
					persist();
					var courseComplete = $scope.isCourseComplete(enrollment, $scope.selectedCourse);
					showToast(lessonCompletionMessage(streak, courseComplete));
					if (courseComplete) $scope.downloadCourseCertificate($scope.selectedCourse);
				};

				$scope.downloadCourseCertificate = function (course) {
					var enrollment = $scope.enrollmentFor(course.id);
					if (!$scope.student || !$scope.isCourseComplete(enrollment, course)) return;
					var printWindow = $window.open("", "_blank");
					if (!printWindow) {
						showToast("Allow pop-ups to print or save your certificate.");
						return;
					}
					var certificateInstructor = $scope.instructorById(course.instructorId);
					var certificateDetails = {
						studentName: $scope.student.name,
						courseTitle: course.title,
						instructorName: certificateInstructor.name,
						instructorRole: certificateInstructor.role,
						instructorSpecialty: certificateInstructor.specialty,
						issuedDate: new Date().toLocaleDateString()
					};
					printWindow.document.open();
					printWindow.document.write(buildCourseCertificateMarkup(certificateDetails));
					printWindow.document.close();
					printWindow.focus();
					$timeout(function () { printWindow.print(); }, 250);
				};

				$scope.downloadGuide = function (course) {
					var lines = [course.title, "COMPLETE STUDY GUIDE", "", "Course overview", course.description, "", "Instructor: " + $scope.instructorById(course.instructorId).name, "Lessons"];
					(course.curriculum || []).forEach(function (lesson, index) {
						lines.push("Lesson " + (index + 1) + ": " + lesson.title, "Objective: " + lesson.objective, "", lesson.content, "");
						(lesson.keyPoints || []).forEach(function (point) { lines.push("Key idea: " + point); });
						if (lesson.teachingTip) lines.push("Instructor note: " + lesson.teachingTip);
						if (lesson.codeExample) lines.push("Code example (" + lesson.codeLanguage + "):", lesson.codeExample);
						lines.push("Practice: " + lesson.practice, "");
					});
					var wrappedLines = [];
					lines.forEach(function (line) {
						var words = line.replace(/[^\x20-\x7E]/g, "").split(/\s+/);
						var currentLine = "";
						words.forEach(function (word) {
							if (currentLine && (currentLine + " " + word).length > 82) {
								wrappedLines.push(currentLine);
								currentLine = word;
							} else {
								currentLine = currentLine ? currentLine + " " + word : word;
							}
						});
						wrappedLines.push(currentLine);
					});
					var pageLines = [];
					for (var lineIndex = 0; lineIndex < wrappedLines.length; lineIndex += 48) pageLines.push(wrappedLines.slice(lineIndex, lineIndex + 48));
					var objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
					var pageReferences = [];
					pageLines.forEach(function (page, pageIndex) {
						var pageNumber = objects.length + 1;
						var contentNumber = pageNumber + 1;
						pageReferences.push(pageNumber + " 0 R");
						var stream = "BT\n/F1 11 Tf\n50 750 Td\n14 TL\n";
						page.forEach(function (line) {
							var safeLine = line.replace(/([\\()])/g, "\\$1");
							stream += "(" + safeLine + ") Tj\nT*\n";
						});
						stream += "ET";
						objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + contentNumber + " 0 R >>");
						objects.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
					});
					objects[1] = "<< /Type /Pages /Kids [" + pageReferences.join(" ") + "] /Count " + pageReferences.length + " >>";
					var pdf = "%PDF-1.4\n";
					var offsets = [0];
					objects.forEach(function (object, index) {
						offsets.push(pdf.length);
						pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n";
					});
					var xrefOffset = pdf.length;
					pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
					offsets.slice(1).forEach(function (offset) { pdf += ("0000000000" + offset).slice(-10) + " 00000 n \n"; });
					pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";
					var pdfBlob = new $window.Blob([pdf], { type: "application/pdf" });
					var downloadUrl = $window.URL.createObjectURL(pdfBlob);
					var link = $window.document.createElement("a");
					link.href = downloadUrl;
					link.download = course.id + "-study-guide.pdf";
					link.click();
					$timeout(function () { $window.URL.revokeObjectURL(downloadUrl); }, 1000);
				};

				$scope.courseTitlesFor = function (instructorId) {
					return $scope.courses.filter(function (course) { return course.instructorId === instructorId; }).map(function (course) { return course.title; }).join(", ");
				};

				$scope.courseMatches = function (course) {
					var instructor = $scope.instructorById(course.instructorId);
					var query = ($scope.courseQuery || "").toLowerCase().trim();
					return !query || [course.title, course.category, course.description, instructor.name].join(" ").toLowerCase().indexOf(query) !== -1;
				};

				$scope.enrollmentFor = function (courseId) {
					return $scope.enrollments.filter(function (enrollment) { return enrollment.courseId === courseId; })[0];
				};

				$scope.progressFor = function (courseId) {
					var enrollment = $scope.enrollmentFor(courseId);
					var course = $scope.courseById(courseId);
					return enrollment && course ? Math.round(Math.min(enrollment.completed, $scope.lessonCount(course)) / $scope.lessonCount(course) * 100) : 0;
				};

				$scope.isCourseComplete = function (enrollment, course) {
					return !!course && hasCompletedCourse(enrollment, $scope.lessonCount(course));
				};

				$scope.completedLessons = function () {
					return $scope.enrollments.reduce(function (total, enrollment) { return total + enrollment.completed; }, 0);
				};

				$scope.averageProgress = function () {
					if (!$scope.enrollments.length) return 0;
					var total = $scope.enrollments.reduce(function (sum, enrollment) { return sum + $scope.progressFor(enrollment.courseId); }, 0);
					return Math.round(total / $scope.enrollments.length);
				};

				$scope.skillPassport = function () {
					return $scope.enrollments.map(function (enrollment) {
						var course = $scope.courseById(enrollment.courseId);
						if (!course) return null;
						var resultPrefix = course.id + ":";
						var results = Object.keys($scope.quizResults).filter(function (key) { return key.indexOf(resultPrefix) === 0; }).map(function (key) { return $scope.quizResults[key]; });
						return {
							courseId: course.id,
							courseTitle: course.title,
							category: course.category,
							lessonsCompleted: Math.min(enrollment.completed, $scope.lessonCount(course)),
							lessonsTotal: $scope.lessonCount(course),
							completionPercent: $scope.progressFor(course.id),
							testsAttempted: results.length,
							testsPassed: results.filter(function (result) { return result.passed; }).length
						};
					}).filter(function (item) { return !!item; });
				};

				$scope.downloadSkillPassport = function () {
					if (!$scope.student || $scope.student.role !== "student" || !$scope.enrollments.length) return;
					var passport = {
						format: "fieldnote-skill-passport-v1",
						verification: "local progress export; not issuer-signed",
						generatedAt: new Date().toISOString(),
						learner: { name: $scope.student.name, studentId: $scope.student.id },
						competencies: $scope.skillPassport()
					};
					var blob = new $window.Blob([JSON.stringify(passport, null, 2)], { type: "application/json" });
					var downloadUrl = $window.URL.createObjectURL(blob);
					var link = $window.document.createElement("a");
					link.href = downloadUrl;
					link.download = "fieldnote-skill-passport.json";
					link.click();
					$timeout(function () { $window.URL.revokeObjectURL(downloadUrl); }, 1000);
				};

				function dateKey(date) {
					return date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2);
				}

				$scope.lessonsToday = function () {
					var todayKey = dateKey(new Date());
					return $scope.learningActivity.filter(function (activityDate) { return activityDate === todayKey; }).length;
				};

				$scope.learningStreak = function () {
					var activeDates = $scope.learningActivity.filter(function (activityDate, index, dates) { return dates.indexOf(activityDate) === index; });
					var cursor = new Date();
					if (activeDates.indexOf(dateKey(cursor)) === -1) cursor.setDate(cursor.getDate() - 1);
					var streak = 0;
					while (activeDates.indexOf(dateKey(cursor)) !== -1) {
						streak += 1;
						cursor.setDate(cursor.getDate() - 1);
					}
					return streak;
				};

				$scope.streakEncouragement = function () {
					var streak = $scope.learningStreak();
					if (streak >= 7) return "A full week of learning. Keep it going.";
					if (streak >= 3) return "Three days in a row. You're building a habit.";
					return streak ? "Come back tomorrow to keep it alive." : "Complete a lesson today to start one.";
				};

				$scope.saveDailyGoal = function () {
					$scope.dailyGoal = Number($scope.dailyGoal) || 1;
					persist();
				};

				function recordStudyActivity() {
					var todayKey = dateKey(new Date());
					if ($scope.learningActivity.indexOf(todayKey) !== -1) return 0;
					$scope.learningActivity.push(todayKey);
					return $scope.learningStreak();
				}

				function lessonCompletionMessage(streak, courseComplete) {
					if (courseComplete && streak && [1, 3, 7, 14, 30].indexOf(streak) !== -1) return "Course complete and a " + streak + "-day streak! Your certificate is ready.";
					if (courseComplete) return "Course complete. Your certificate is ready.";
					if (streak && [1, 3, 7, 14, 30].indexOf(streak) !== -1) return streak + "-day learning streak! Come back tomorrow to keep it alive.";
					if (streak) return "Lesson complete. Your " + streak + "-day learning streak is alive.";
					return "Lesson marked complete.";
				}

				$scope.saveStudent = function (registrationForm) {
					$scope.submitAttempted = true;
					if (registrationForm && registrationForm.$invalid) {
						$scope.formError = "Correct the highlighted fields before saving.";
						return;
					}
					var name = ($scope.studentForm.name || "").trim();
					var email = ($scope.studentForm.email || "").trim();
					var role = $scope.authUser.role;
					var program = role === "instructor" ? "Instructor" : role === "admin" ? "Administrator" : $scope.studentForm.program;
					var educationBackground = role === "instructor" ? $scope.studentForm.instructorEducation : $scope.studentForm.educationBackground;
					var teachingSubjects = role === "instructor" ? $scope.studentForm.teachingSubjects.slice() : [];
					var otherSubject = ($scope.studentForm.otherTeachingSubject || "").trim();
					if (role === "instructor" && otherSubject && teachingSubjects.indexOf(otherSubject) === -1) teachingSubjects.push(otherSubject);
					if (!name || !email || (role === "student" && (!program || !educationBackground))) {
						$scope.formError = "Complete each field to save your student profile.";
						return;
					}
					var matricScore = role === "instructor" || $scope.studentForm.matricScore === "" || $scope.studentForm.matricScore === undefined ? "" : Number($scope.studentForm.matricScore);
					if (role === "student" && !isValidMatricScore(matricScore)) {
						$scope.formError = "Enter an Ethiopian Grade 12 matric score from 2.00 to 6.00.";
						return;
					}
					if (role === "instructor" && !isValidInstructorProfile(educationBackground, teachingSubjects)) {
						$scope.formError = "Choose your education level and at least one subject you teach.";
						return;
					}
					if (role === "student" && !$scope.studentForm.confirmEducationBackground) {
						$scope.formError = "Confirm that your education background is accurate before saving.";
						return;
					}
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
						$scope.formError = "Enter a valid email address.";
						return;
					}
					if ($scope.certificateError) {
						$scope.formError = "Choose a supported certificate image or remove the current image.";
						return;
					}
					if ($scope.profilePhotoError) {
						$scope.formError = "Choose a supported profile picture or remove the current image.";
						return;
					}
					var existingId = $scope.student && $scope.student.id;
					var updatedStudent = { id: $scope.authUser.id, role: role, name: name, email: email, program: program, school: ($scope.studentForm.school || "").trim(), matricScore: matricScore, address: ($scope.studentForm.address || "").trim(), educationBackground: role === "student" ? educationBackground : "", confirmEducationBackground: role === "student", instructorEducation: role === "instructor" ? educationBackground : "", teachingSubjects: teachingSubjects, certificateImage: $scope.studentForm.certificateImage || "", profilePhoto: $scope.studentForm.profilePhoto || "" };
					authRequest("/api/auth/profile", "PUT", { name: updatedStudent.name, profile: profileFromStudent(updatedStudent) }).then(function (result) {
						$scope.authUser = result.user;
						$scope.student = updatedStudent;
						$scope.studentForm = angular.copy(updatedStudent);
						$scope.formError = "";
						$scope.submitAttempted = false;
						persist();
						showToast("Profile updated.");
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.setProfileRole = function () {
					$scope.formError = "";
					if ($scope.studentForm.role === "instructor") {
						$scope.studentForm.instructorEducation = $scope.studentForm.instructorEducation || "";
						$scope.studentForm.teachingSubjects = angular.isArray($scope.studentForm.teachingSubjects) ? $scope.studentForm.teachingSubjects : [];
					} else {
						$scope.studentForm.program = "";
						$scope.studentForm.educationBackground = "";
						$scope.studentForm.matricScore = "";
						$scope.studentForm.confirmEducationBackground = false;
					}
				};

				$scope.toggleTeachingSubject = function (subject) {
					if (!angular.isArray($scope.studentForm.teachingSubjects)) $scope.studentForm.teachingSubjects = [];
					var index = $scope.studentForm.teachingSubjects.indexOf(subject);
					if (index === -1) $scope.studentForm.teachingSubjects.push(subject);
					else $scope.studentForm.teachingSubjects.splice(index, 1);
				};

				function profileFromStudent(student) {
					var profile = angular.copy(student);
					["id", "name", "email", "role", "certificateScore"].forEach(function (key) { delete profile[key]; });
					return profile;
				}

				$scope.setAuthMode = function (mode) {
					$scope.authMode = ["login", "register", "reset-request", "reset-verify", "reset-confirm"].indexOf(mode) !== -1 ? mode : "register";
					$scope.authForm.password = "";
					$scope.authForm.resetCode = "";
					$scope.authForm.newPassword = "";
					$scope.showPassword = false;
					$scope.formError = "";
					$scope.resetNotice = "";
					$scope.submitAttempted = false;
				};

				$scope.togglePasswordVisibility = function () {
					$scope.showPassword = !$scope.showPassword;
				};

				$scope.signInWithGoogle = function () {
					$window.location.assign("/api/auth/google/start");
				};

				$scope.requestPasswordReset = function () {
					var email = ($scope.authForm.email || "").trim();
					if (!email) {
						$scope.formError = "Enter the email address for your account.";
						return;
					}
					authRequest("/api/auth/password-reset/request", "POST", { email: email }).then(function (result) {
						$scope.authMode = "reset-verify";
						$scope.resetNotice = result.message;
						$scope.formError = "";
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.verifyPasswordReset = function () {
					var code = ($scope.authForm.resetCode || "").trim();
					if (!/^\d{6}$/.test(code)) {
						$scope.formError = "Enter the six-digit verification code from your email.";
						return;
					}
					authRequest("/api/auth/password-reset/verify", "POST", {
						email: ($scope.authForm.email || "").trim(),
						code: code
					}).then(function (result) {
						$scope.authMode = "reset-confirm";
						$scope.authForm.resetCode = "";
						$scope.resetNotice = result.message;
						$scope.formError = "";
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.confirmPasswordReset = function () {
					authRequest("/api/auth/password-reset/confirm", "POST", {
						password: $scope.authForm.newPassword
					}).then(function (result) {
						$scope.setAuthMode("login");
						$scope.resetNotice = result.message;
						$scope.authForm.password = "";
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.register = function (registrationForm) {
					$scope.submitAttempted = true;
					var role = $scope.studentForm.role === "instructor" ? "instructor" : "student";
					var name = ($scope.studentForm.name || "").trim();
					var email = ($scope.studentForm.email || "").trim();
					var subjects = role === "instructor" ? $scope.studentForm.teachingSubjects.slice() : [];
					var otherSubject = ($scope.studentForm.otherTeachingSubject || "").trim();
					if (role === "instructor" && otherSubject && subjects.indexOf(otherSubject) === -1) subjects.push(otherSubject);
					if (role === "instructor" && !$scope.studentForm.instructorEducation) {
						$scope.formError = "";
						return;
					}
					if (role === "instructor" && !subjects.length) {
						$scope.formError = "";
						return;
					}
					if (registrationForm && registrationForm.$invalid) {
						$scope.formError = "Complete the required fields before creating your account.";
						return;
					}
					var profile = {
						program: role === "student" ? $scope.studentForm.program : "Instructor",
						school: ($scope.studentForm.school || "").trim(),
						matricScore: role === "student" ? $scope.studentForm.matricScore : "",
						address: ($scope.studentForm.address || "").trim(),
						educationBackground: role === "student" ? $scope.studentForm.educationBackground : "",
						confirmEducationBackground: role === "student" && $scope.studentForm.confirmEducationBackground === true,
						instructorEducation: role === "instructor" ? $scope.studentForm.instructorEducation : "",
						teachingSubjects: subjects,
						certificateImage: $scope.studentForm.certificateImage || "",
						profilePhoto: $scope.studentForm.profilePhoto || ""
					};
					authRequest("/api/auth/register", "POST", { name: name, email: email, password: $scope.authForm.password, role: role, profile: profile }).then(function (result) {
						$scope.authForm.password = "";
						if (result.confirmationRequired) {
							$scope.authMode = "login";
							$scope.authForm.email = email;
							$scope.formError = "";
							$scope.resetNotice = result.message;
							return;
						}
						$scope.submitAttempted = false;
						$scope.formError = "";
						loadAuthenticatedUser(result.user);
						showToast("Account created and signed in.");
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.login = function (loginForm) {
					$scope.submitAttempted = true;
					if (loginForm && loginForm.$invalid) {
						$scope.formError = "Enter your email and password.";
						return;
					}
					authRequest("/api/auth/login", "POST", { email: $scope.authForm.email, password: $scope.authForm.password }).then(function (result) {
						$scope.authForm.password = "";
						$scope.formError = "";
						loadAuthenticatedUser(result.user);
						showToast("Signed in successfully.");
					}).catch(function (error) { $scope.formError = error.message; });
				};

				$scope.logout = function () {
					persist().then(function () { return authRequest("/api/auth/logout", "POST"); }).then(function () {
						stateChangedDuringLoad = true;
						$scope.$applyAsync(function () {
							$scope.authUser = null;
							$scope.student = null;
							$scope.enrollments = [];
							$scope.lessonDiscussions = {};
							$scope.learningActivity = [];
							$scope.quizResults = {};
							$scope.studentForm = { role: "student", teachingSubjects: [] };
							$scope.authMode = "login";
							$scope.authForm.password = "";
							setPage("overview");
						});
						showToast("You have signed out.");
					}).catch(function (error) { showToast(error.message); });
				};

				$scope.enroll = function (course) {
					if (!$scope.authUser) {
						$scope.setAuthMode("register");
						$scope.setView("account");
						showToast("Create a student account to enroll and track your progress.");
						return;
					}
					if (!$scope.student || $scope.student.role !== "student") {
						$scope.setView("account");
						showToast("Sign in with a student account to enroll.");
						return;
					}
					var existing = $scope.enrollmentFor(course.id);
					if (existing) {
						$scope.setView("learning");
						return;
					}
						$scope.enrollments.push({ courseId: course.id, completed: 0, completedLessonIds: course.curriculum ? [] : undefined });
					persist();
					showToast("Enrolled in " + course.title + ".");
				};

				$scope.completeLesson = function (course) {
					if (!$scope.student || $scope.student.role !== "student") return;
					var enrollment = $scope.enrollmentFor(course.id);
					if (!enrollment || enrollment.completed >= course.lessons) return;
					enrollment.completed += 1;
					var streak = recordStudyActivity();
					persist();
					var courseComplete = enrollment.completed === course.lessons;
					showToast(lessonCompletionMessage(streak, courseComplete));
					if (courseComplete) $scope.downloadCourseCertificate(course);
				};

				$scope.clearData = function () {
					if (!$window.confirm("Delete this profile, enrollments, saved progress, lesson notes, and learning activity from this browser?")) return;
					authRequest("/api/auth/profile", "DELETE").then(function () {
						$scope.stopReading();
						return LearningDatabase.remove(storageKey).catch(function () { });
					}).then(function () {
						$window.localStorage.removeItem(storageKey);
						$scope.authUser = null;
						$scope.student = null;
						$scope.studentForm = { role: "student", teachingSubjects: [] };
						$scope.enrollments = [];
						$scope.lessonDiscussions = {};
						$scope.learningActivity = [];
						$scope.quizResults = {};
						$scope.authMode = "register";
						$scope.authForm.email = "";
						$scope.authForm.password = "";
						$scope.certificateError = "";
						$scope.formError = "";
						$scope.submitAttempted = false;
						showToast("Account and saved learning data deleted.");
					}).catch(function (error) { showToast(error.message); });
				};
			});
		}());
	
}
