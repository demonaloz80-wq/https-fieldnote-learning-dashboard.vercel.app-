import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { createApp } from "../src/server.js";
import { updateSm2Schedule, validateConceptGraph } from "../src/adaptive-learning.js";

const ISSUER_ID = "https://issuer.example.test/issuers/fieldnote";
const ADMIN_TOKEN = "test-admin-token-with-more-than-32-characters";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privateJwk = privateKey.export({ format: "jwk" });
const publicJwk = publicKey.export({ format: "jwk" });
const config = {
	publicBaseUrl: "https://issuer.example.test",
	issuerId: ISSUER_ID,
	issuerName: "Fieldnote Test Issuer",
	adminToken: ADMIN_TOKEN,
	privateJwk: privateJwk,
	publicJwk: publicJwk,
	trustProxy: true
};

let app;
let baseUrl;
let temporaryDirectory;
const sentResetEmails = [];

before(async () => {
	temporaryDirectory = await mkdtemp(join(tmpdir(), "fieldnote-credentials-"));
	app = await createApp({ config: config, databasePath: join(temporaryDirectory, "test.sqlite"), mailTransport: { sendMail: async message => sentResetEmails.push(message) } });
	await new Promise(resolveListen => app.server.listen(0, "127.0.0.1", resolveListen));
	baseUrl = "http://127.0.0.1:" + app.server.address().port;
});

after(async () => {
	if (app) await app.close();
	if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

test("publishes the issuer's public key without exposing private key material", async () => {
	const response = await fetch(baseUrl + new URL(ISSUER_ID).pathname);
	assert.equal(response.status, 200);
	const document = await response.json();
	assert.equal(document.id, ISSUER_ID);
	assert.deepEqual(document.assertionMethod, [ISSUER_ID + "#signing-key-1"]);
	assert.equal(document.verificationMethod[0].publicKeyJwk.d, undefined);
	assert.equal(document.verificationMethod[0].publicKeyJwk.x, publicJwk.x);
});

test("requires authorization before issuing a credential", async () => {
	const response = await fetch(baseUrl + "/api/credentials", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ subjectName: "Alex", achievementName: "Web Basics", description: "Completed the course.", criteria: "Passed the final assessment." })
	});
	assert.equal(response.status, 401);
});

test("registers student and instructor accounts with server-controlled roles and sessions", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Student One", email: "STUDENT@example.test", password: "long-test-password-1", role: "student", profile: { program: "Web Development", educationBackground: "Ethiopian Grade 12 Matric", confirmEducationBackground: true, matricScore: 4.25 } })
	});
	assert.equal(registration.status, 201);
	const studentResponse = await registration.json();
	const student = studentResponse.user;
	assert.equal(student.email, "student@example.test");
	assert.equal(student.role, "student");
	assert.equal(student.profile.program, "Web Development");
	assert.equal(student.password, undefined);
	const studentCookie = registration.headers.get("set-cookie").split(";")[0];
	assert.match(registration.headers.get("set-cookie"), /HttpOnly/i);
	assert.match(registration.headers.get("set-cookie"), /SameSite=Strict/i);
	assert.match(registration.headers.get("set-cookie"), /Secure/i);

	const studentSession = await fetch(baseUrl + "/api/auth/me", { headers: { Cookie: studentCookie } });
	assert.equal(studentSession.status, 200);
	const restoredStudent = (await studentSession.json()).user;
	assert.equal(restoredStudent.id, student.id);
	assert.equal(restoredStudent.profile.matricScore, 4.25);
	assert.equal((await fetch(baseUrl + "/api/instructor/overview", { headers: { Cookie: studentCookie } })).status, 403);
	assert.equal((await fetch(baseUrl + "/api/student/overview", { headers: { Cookie: studentCookie } })).status, 200);

	const logout = await fetch(baseUrl + "/api/auth/logout", { method: "POST", headers: { Cookie: studentCookie } });
	assert.equal(logout.status, 200);
	assert.equal((await fetch(baseUrl + "/api/auth/me", { headers: { Cookie: studentCookie } })).status, 401);

	const instructorRegistration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Instructor One", email: "teacher@example.test", password: "long-test-password-2", role: "instructor", profile: { instructorEducation: "Master's degree", teachingSubjects: ["Web Development"] } })
	});
	assert.equal(instructorRegistration.status, 201);
	const instructorCookie = instructorRegistration.headers.get("set-cookie").split(";")[0];
	assert.equal((await fetch(baseUrl + "/api/instructor/overview", { headers: { Cookie: instructorCookie } })).status, 200);
	assert.equal((await fetch(baseUrl + "/api/student/overview", { headers: { Cookie: instructorCookie } })).status, 403);
});

test("supports credentialed requests from a locally opened file", async () => {
	const preflight = await fetch(baseUrl + "/api/auth/register", {
		method: "OPTIONS",
		headers: { Origin: "null", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }
	});
	assert.equal(preflight.status, 204);
	assert.equal(preflight.headers.get("access-control-allow-origin"), "null");
	assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
	assert.match(preflight.headers.get("access-control-allow-methods"), /POST/);

	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { Origin: "null", "Content-Type": "application/json" },
		body: JSON.stringify({ name: "File Student", email: "file-student@example.test", password: "long-file-password-1", role: "student", profile: { program: "Web Development", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(registration.status, 201);
	assert.equal(registration.headers.get("access-control-allow-origin"), "null");
	assert.match(registration.headers.get("set-cookie"), /SameSite=None/i);
	assert.match(registration.headers.get("set-cookie"), /Secure/i);
});

test("returns a clear configuration error when Copilot is not configured", async () => {
	const response = await fetch(baseUrl + "/api/coach", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ question: "Explain semantic HTML." })
	});
	assert.equal(response.status, 503);
	assert.match((await response.json()).error, /COPILOT_GITHUB_TOKEN/);
});

test("sends learning context through the authenticated Copilot SDK", async () => {
	const calls = {};
	class MockCopilotClient {
		constructor(options) {
			calls.clientOptions = options;
		}

		async start() {
			calls.started = true;
		}

		async createSession(options) {
			calls.sessionOptions = options;
			return {
				async sendAndWait(options) {
					calls.prompt = options.prompt;
					return { data: { content: "Semantic HTML describes meaning." } };
				},
				async disconnect() {
					calls.disconnected = true;
				}
			};
		}

		async stop() {
			calls.stopped = true;
		}
	}
	const copilotSdk = {
		CopilotClient: MockCopilotClient,
	};
	const coachApp = await createApp({
		config: {
			...config,
			copilotGithubToken: "test-copilot-token",
			copilotModel: "auto"
		},
		databasePath: ":memory:",
		copilotSdk: copilotSdk
	});
	await new Promise(resolveListen => coachApp.server.listen(0, "127.0.0.1", resolveListen));
	try {
		const coachUrl = "http://127.0.0.1:" + coachApp.server.address().port + "/api/coach";
		const response = await fetch(coachUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ question: "What is semantic HTML?", title: "HTML foundations", context: "HTML elements communicate structure and meaning." })
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { answer: "Semantic HTML describes meaning." });
		assert.equal(calls.clientOptions.gitHubToken, "test-copilot-token");
		assert.equal(calls.clientOptions.useLoggedInUser, false);
		assert.equal(calls.clientOptions.mode, "empty");
		assert.equal(calls.sessionOptions.model, "auto");
		assert.match(calls.prompt, /HTML foundations/);
		assert.match(calls.prompt, /What is semantic HTML\?/);
		assert.equal(calls.disconnected, true);
		assert.equal(calls.stopped, true);
	} finally {
		await coachApp.close();
	}
});

test("instructors publish owned lesson modules and assessments to the public catalog", async () => {
	const instructorRegistration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Course Author", email: "course-author@example.test", password: "long-author-password-1", role: "instructor", profile: { instructorEducation: "Master's degree", teachingSubjects: ["Web Development"], profilePhoto: "data:image/png;base64,dGVzdA==" } })
	});
	assert.equal(instructorRegistration.status, 201);
	const instructor = (await instructorRegistration.json()).user;
	const instructorCookie = instructorRegistration.headers.get("set-cookie").split(";")[0];
	const courseBody = {
		title: "Accessible Web Basics",
		category: "Web Development",
		description: "Build accessible pages with semantic HTML.",
		modules: [{
			title: "Semantic structure",
			objective: "Choose meaningful page landmarks.",
			content: "Use header, main, and footer landmarks to describe a page.",
			videoUrl: "https://www.youtube.com/watch?v=UB1O30fR-EE",
			assessmentQuestions: [
				{ prompt: "Which element identifies primary page content?", options: ["main", "aside"], answerIndex: 0 },
				{ prompt: "Which element groups navigation links?", options: ["nav", "footer"], answerIndex: 0 }
			]
		}]
	};
	const unauthorized = await fetch(baseUrl + "/api/instructor/courses", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(courseBody)
	});
	assert.equal(unauthorized.status, 401);

	const published = await fetch(baseUrl + "/api/instructor/courses", {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: instructorCookie },
		body: JSON.stringify(courseBody)
	});
	assert.equal(published.status, 201);
	const course = (await published.json()).course;
	assert.equal(course.instructorId, instructor.id);
	assert.equal(course.curriculum[0].assessmentQuestions[0].answerIndex, 0);
	assert.equal(course.curriculum[0].assessmentQuestions.length, 2);
	assert.equal(course.curriculum[0].videoUrl, courseBody.modules[0].videoUrl);
	const publicInstructors = await fetch(baseUrl + "/api/instructors");
	const publicInstructor = (await publicInstructors.json()).instructors.find(item => item.id === instructor.id);
	assert.equal(publicInstructor.profilePhoto, "data:image/png;base64,dGVzdA==");
	assert.deepEqual(publicInstructor.teachingSubjects, ["Web Development"]);
	assert.equal("email" in publicInstructor, false);
	const invalidVideo = await fetch(baseUrl + "/api/instructor/courses", {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: instructorCookie },
		body: JSON.stringify({ ...courseBody, modules: [{ ...courseBody.modules[0], videoUrl: "https://example.com/video" }] })
	});
	assert.equal(invalidVideo.status, 400);

	const ownCourses = await fetch(baseUrl + "/api/instructor/courses", { headers: { Cookie: instructorCookie } });
	assert.equal((await ownCourses.json()).courses[0].id, course.id);
	const catalog = await fetch(baseUrl + "/api/courses");
	assert.equal((await catalog.json()).courses[0].id, course.id);

	const studentRegistration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Course Learner", email: "course-learner@example.test", password: "long-learner-password-1", role: "student", profile: { program: "Web Development", educationBackground: "High school", confirmEducationBackground: true } })
	});
	const studentCookie = studentRegistration.headers.get("set-cookie").split(";")[0];
	const forbidden = await fetch(baseUrl + "/api/instructor/courses", {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: studentCookie },
		body: JSON.stringify(courseBody)
	});
	assert.equal(forbidden.status, 403);
});

test("rejects duplicate or privileged public registrations and authenticates login", async () => {
	const payload = { name: "Account Owner", email: "owner@example.test", password: "long-test-password-3", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } };
	const first = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
	assert.equal(first.status, 201);

	const duplicate = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload)
	});
	assert.equal(duplicate.status, 409);

	const privilegeEscalation = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ ...payload, email: "admin@example.test", role: "admin" })
	});
	assert.equal(privilegeEscalation.status, 400);

	const badLogin = await fetch(baseUrl + "/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: payload.email, password: "wrong-password" })
	});
	assert.equal(badLogin.status, 401);

	const login = await fetch(baseUrl + "/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: payload.email, password: payload.password })
	});
	assert.equal(login.status, 200);
	assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
});

test("supports direct-file bearer sessions for profile, logout, and deletion", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { Origin: "null", "Content-Type": "application/json" },
		body: JSON.stringify({ name: "File Learner", email: "file@example.test", password: "long-file-password-1", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(registration.status, 201);
	const sessionToken = (await registration.json()).sessionToken;
	assert.equal(typeof sessionToken, "string");

	const preflight = await fetch(baseUrl + "/api/auth/me", {
		method: "OPTIONS",
		headers: { Origin: "null", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" }
	});
	assert.equal(preflight.status, 204);
	assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/i);

	const profile = await fetch(baseUrl + "/api/auth/me", { headers: { Origin: "null", Authorization: "Bearer " + sessionToken } });
	assert.equal(profile.status, 200);
	assert.equal((await profile.json()).user.email, "file@example.test");

	const logout = await fetch(baseUrl + "/api/auth/logout", { method: "POST", headers: { Origin: "null", Authorization: "Bearer " + sessionToken } });
	assert.equal(logout.status, 200);
	const afterLogout = await fetch(baseUrl + "/api/auth/me", { headers: { Origin: "null", Authorization: "Bearer " + sessionToken } });
	assert.equal(afterLogout.status, 401);

	const secondRegistration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { Origin: "null", "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Delete Learner", email: "delete-file@example.test", password: "long-file-password-2", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	const secondToken = (await secondRegistration.json()).sessionToken;
	const deletion = await fetch(baseUrl + "/api/auth/profile", { method: "DELETE", headers: { Origin: "null", Authorization: "Bearer " + secondToken } });
	assert.equal(deletion.status, 200);
	const afterDeletion = await fetch(baseUrl + "/api/auth/me", { headers: { Origin: "null", Authorization: "Bearer " + secondToken } });
	assert.equal(afterDeletion.status, 401);
});

test("supports the file URL origin serialization used by embedded browsers", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { Origin: "file://", "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Embedded File Learner", email: "embedded-file@example.test", password: "long-embedded-file-password", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(registration.status, 201);
	assert.equal(registration.headers.get("access-control-allow-origin"), "file://");
	const sessionToken = (await registration.json()).sessionToken;
	assert.equal(typeof sessionToken, "string");

	const profile = await fetch(baseUrl + "/api/auth/me", { headers: { Origin: "file://", Authorization: "Bearer " + sessionToken } });
	assert.equal(profile.status, 200);
	assert.equal((await profile.json()).user.email, "embedded-file@example.test");
});

test("supports direct-file auth clients when Origin is omitted", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "X-Fieldnote-File-Client": "true", "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Headerless File Learner", email: "headerless-file@example.test", password: "long-headerless-file-password", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(registration.status, 201);
	const sessionToken = (await registration.json()).sessionToken;
	assert.equal(typeof sessionToken, "string");

	const profile = await fetch(baseUrl + "/api/auth/me", { headers: { "X-Fieldnote-File-Client": "true", Authorization: "Bearer " + sessionToken } });
	assert.equal(profile.status, 200);
	assert.equal((await profile.json()).user.email, "headerless-file@example.test");
});

test("emails a short-lived password reset code and revokes sessions after reset", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Reset Learner", email: "reset@example.test", password: "long-original-password", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	const sessionCookie = registration.headers.get("set-cookie").split(";")[0];
	const insecureRequest = await fetch(baseUrl + "/api/auth/password-reset/request", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset@example.test" })
	});
	assert.equal(insecureRequest.status, 426);
	const requestReset = await fetch(baseUrl + "/api/auth/password-reset/request", {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
		body: JSON.stringify({ email: "RESET@example.test" })
	});
	assert.equal(requestReset.status, 200);
	assert.match((await requestReset.json()).message, /If an account matches/);
	const sentEmail = sentResetEmails.at(-1);
	assert.equal(sentEmail.to, "reset@example.test");
	const code = sentEmail.text.match(/\b\d{6}\b/)[0];
	const incorrectCode = await fetch(baseUrl + "/api/auth/password-reset/confirm", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset@example.test", code: "000000", password: "long-replacement-password" })
	});
	assert.equal(incorrectCode.status, 400);

	const reset = await fetch(baseUrl + "/api/auth/password-reset/confirm", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset@example.test", code: code, password: "long-replacement-password" })
	});
	assert.equal(reset.status, 200);
	assert.equal((await fetch(baseUrl + "/api/auth/me", { headers: { Cookie: sessionCookie } })).status, 401);
	assert.equal((await fetch(baseUrl + "/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset@example.test", password: "long-original-password" })
	})).status, 401);
	assert.equal((await fetch(baseUrl + "/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset@example.test", password: "long-replacement-password" })
	})).status, 200);

	const instructorRegistration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Reset Instructor", email: "reset-instructor@example.test", password: "long-instructor-password", role: "instructor", profile: { instructorEducation: "Master's degree", teachingSubjects: ["Web Development"] } })
	});
	assert.equal(instructorRegistration.status, 201);
	const instructorRequest = await fetch(baseUrl + "/api/auth/password-reset/request", {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
		body: JSON.stringify({ email: "reset-instructor@example.test" })
	});
	assert.equal(instructorRequest.status, 200);
	const instructorCode = sentResetEmails.at(-1).text.match(/\b\d{6}\b/)[0];
	const instructorReset = await fetch(baseUrl + "/api/auth/password-reset/confirm", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "reset-instructor@example.test", code: instructorCode, password: "new-instructor-password" })
	});
	assert.equal(instructorReset.status, 200);
});

test("admin account management requires the server admin token", async () => {
	const unauthorized = await fetch(baseUrl + "/api/admin/users");
	assert.equal(unauthorized.status, 401);

	const createAdmin = await fetch(baseUrl + "/api/admin/users", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({ name: "System Admin", email: "admin@example.test", password: "long-admin-password-1" })
	});
	assert.equal(createAdmin.status, 201);
	assert.equal((await createAdmin.json()).role, "admin");

	const users = await fetch(baseUrl + "/api/admin/users", { headers: { Authorization: "Bearer " + ADMIN_TOKEN } });
	assert.equal(users.status, 200);
	const registeredUsers = (await users.json()).users;
	assert.ok(registeredUsers.length >= 1);
	assert.ok(registeredUsers.some(user => user.email === "admin@example.test" && user.role === "admin"));
});

test("issues and verifies a VC-JWT Open Badge, provides a QR, and checks revocation", async () => {
	const response = await fetch(baseUrl + "/api/credentials", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({
			subjectName: "Alex Morgan",
			achievementName: "Web Development Foundations",
			description: "Completed the core web development course.",
			criteria: "Completed all lessons and passed the final assessment."
		})
	});
	assert.equal(response.status, 201);
	const issued = await response.json();
	assert.equal(issued.mediaType, "application/vc+jwt");
	assert.match(issued.token, /^[^.]+\.[^.]+\.[^.]+$/);

	const verifiedJwt = await jwtVerify(issued.token, await importJWK(publicJwk, "EdDSA"), { issuer: ISSUER_ID, algorithms: ["EdDSA"] });
	assert.equal(decodeProtectedHeader(issued.token).typ, "vc+jwt");
	assert.deepEqual(verifiedJwt.payload.type, ["VerifiableCredential", "OpenBadgeCredential"]);
	assert.equal(verifiedJwt.payload.credentialSubject.achievement.name, "Web Development Foundations");
	assert.equal(verifiedJwt.payload.credentialSubject.name, "Alex Morgan");

	const verification = await fetch(baseUrl + "/api/verify/" + issued.id);
	assert.equal(verification.status, 200);
	const verificationResult = await verification.json();
	assert.equal(verificationResult.valid, true);
	assert.equal(verificationResult.credential.subjectName, "Alex Morgan");

	const qr = await fetch(baseUrl + "/api/credentials/" + issued.id + "/qr.svg");
	assert.equal(qr.status, 200);
	assert.match(qr.headers.get("content-type"), /image\/svg\+xml/);
	assert.match(await qr.text(), /<svg/);

	const criteria = await fetch(baseUrl + "/issuers/fieldnote/criteria/" + issued.id);
	assert.equal(criteria.status, 200);
	assert.equal((await criteria.json()).narrative, "Completed all lessons and passed the final assessment.");

	const revoke = await fetch(baseUrl + "/api/credentials/" + issued.id + "/revoke", {
		method: "POST",
		headers: { Authorization: "Bearer " + ADMIN_TOKEN }
	});
	assert.equal(revoke.status, 200);
	const revokedVerification = await fetch(baseUrl + "/api/verify/" + issued.id);
	const revokedResult = await revokedVerification.json();
	assert.equal(revokedResult.valid, false);
	assert.equal(revokedResult.revoked, true);
	assert.ok(revokedResult.revokedAt);
});

test("rejects incomplete badge claims", async () => {
	const response = await fetch(baseUrl + "/api/credentials", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({ subjectName: "Alex" })
	});
	assert.equal(response.status, 400);
});

test("validates a directed acyclic concept graph", () => {
	const nodes = validateConceptGraph([
		{ id: "joins", title: "Relational Joins", prerequisites: ["tables"] },
		{ id: "tables", title: "Database Tables" }
	]);
	assert.equal(nodes.length, 2);
	assert.throws(() => validateConceptGraph([
		{ id: "first", title: "First", prerequisites: ["second"] },
		{ id: "second", title: "Second", prerequisites: ["first"] }
	]), /cycles/);
});

test("schedules SM-2 reviews and resets failed recall", () => {
	const start = new Date("2026-01-01T12:00:00.000Z");
	const first = updateSm2Schedule(null, 4, start);
	assert.equal(first.intervalDays, 1);
	const second = updateSm2Schedule({ repetitions: 1, interval_days: first.intervalDays, ease_factor: first.easeFactor }, 4, first.nextDueAt);
	assert.equal(second.intervalDays, 6);
	const third = updateSm2Schedule(second, 4, second.nextDueAt);
	assert.ok(third.intervalDays > second.intervalDays);
	const failed = updateSm2Schedule(third, 1, third.nextDueAt);
	assert.equal(failed.repetitions, 0);
	assert.equal(failed.intervalDays, 1);
});

test("stores an acyclic course graph and routes a failed assessment back to prerequisites", async () => {
	const graphUrl = baseUrl + "/api/adaptive/web-basics/graph";
	const unauthorized = await fetch(graphUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nodes: [{ id: "joins", title: "Relational Joins" }] }) });
	assert.equal(unauthorized.status, 401);

	const graph = [
		{ id: "tables", title: "Database Tables", area: "Data Modeling", prerequisites: [] },
		{ id: "joins", title: "Relational Joins", area: "Query Design", prerequisites: ["tables"] },
		{ id: "advanced-queries", title: "Advanced Queries", area: "Query Design", prerequisites: ["joins"] }
	];
	const savedGraph = await fetch(graphUrl, {
		method: "PUT",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({ nodes: graph })
	});
	assert.equal(savedGraph.status, 200);
	assert.equal((await savedGraph.json()).nodeCount, 3);

	const cyclicGraph = await fetch(graphUrl, {
		method: "PUT",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({ nodes: [{ id: "one", title: "One", prerequisites: ["two"] }, { id: "two", title: "Two", prerequisites: ["one"] }] })
	});
	assert.equal(cyclicGraph.status, 400);
	assert.equal((await (await fetch(graphUrl)).json()).nodes.length, 3);

	const assessmentUrl = baseUrl + "/api/adaptive/web-basics/learners/learner-01/assessments";
	async function submitAssessment(conceptId, correct, score) {
		return fetch(assessmentUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
			body: JSON.stringify({ conceptId: conceptId, correct: correct, score: score })
		});
	}

	const lockedAssessment = await submitAssessment("advanced-queries", true, 1);
	assert.equal(lockedAssessment.status, 409);
	assert.deepEqual((await lockedAssessment.json()).lockedPrerequisites, ["joins"]);

	for (let attempt = 0; attempt < 3; attempt += 1) assert.equal((await submitAssessment("tables", true, 1)).status, 201);
	for (let attempt = 0; attempt < 3; attempt += 1) assert.equal((await submitAssessment("joins", true, 1)).status, 201);

	const failedAssessment = await submitAssessment("advanced-queries", false, 0.25);
	assert.equal(failedAssessment.status, 201);
	const result = await failedAssessment.json();
	assert.equal(result.remediationRequired, true);
	assert.equal(result.path.remediationFor, "advanced-queries");
	assert.deepEqual(result.path.recommended.map(concept => concept.id), ["joins"]);
	assert.equal(result.path.skillMatrix.find(area => area.area === "Query Design").mastery, 41);

	const learnerPath = await fetch(baseUrl + "/api/adaptive/web-basics/learners/learner-01/path", { headers: { Authorization: "Bearer " + ADMIN_TOKEN } });
	assert.equal(learnerPath.status, 200);
	const path = await learnerPath.json();
	assert.equal(path.dueReviews.length, 0);
	assert.ok(Date.parse(result.nextReviewAt) > Date.now());

	const review = await fetch(baseUrl + "/api/adaptive/web-basics/learners/learner-01/reviews/advanced-queries", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: "Bearer " + ADMIN_TOKEN },
		body: JSON.stringify({ quality: 4 })
	});
	assert.equal(review.status, 201);
	assert.equal((await review.json()).intervalDays, 1);
});

test("serves the existing dashboard assets from the API origin", async () => {
	const page = await fetch(baseUrl + "/");
	assert.equal(page.status, 200);
	assert.match(page.headers.get("content-type"), /text\/html/);
	assert.match(await page.text(), /href="style.css"/);
	const script = await fetch(baseUrl + "/script.js");
	assert.equal(script.status, 200);
	assert.match(script.headers.get("content-type"), /javascript/);
	const angularBundle = await fetch(baseUrl + "/vendor/angular.min.js");
	assert.equal(angularBundle.status, 200);
	assert.match(angularBundle.headers.get("content-type"), /javascript/);
	assert.match(await angularBundle.text(), /angular/i);
	assert.equal((await fetch(baseUrl + "/assets/../credentials-api/.env")).status, 404);
});

test("updates and deletes only the authenticated user's own account", async () => {
	const registration = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Profile Owner", email: "profile-owner@example.test", password: "profile-owner-password", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(registration.status, 201);
	const cookie = registration.headers.get("set-cookie").split(";")[0];

	const update = await fetch(baseUrl + "/api/auth/profile", {
		method: "PUT",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ name: "Updated Learner", role: "admin", profile: { program: "Web Development", educationBackground: "Ethiopian Grade 12 Matric", confirmEducationBackground: true, matricScore: 5.25 } })
	});
	assert.equal(update.status, 200);
	const updatedUser = (await update.json()).user;
	assert.equal(updatedUser.name, "Updated Learner");
	assert.equal(updatedUser.role, "student");
	assert.equal(updatedUser.profile.matricScore, 5.25);

	const deletion = await fetch(baseUrl + "/api/auth/profile", { method: "DELETE", headers: { Cookie: cookie } });
	assert.equal(deletion.status, 200);
	assert.equal((await fetch(baseUrl + "/api/auth/me", { headers: { Cookie: cookie } })).status, 401);
});

test("requires a 12-character password and valid profile at registration", async () => {
	const response = await fetch(baseUrl + "/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "Weak Password", email: "weak@example.test", password: "short", role: "student", profile: { program: "General studies", educationBackground: "High school", confirmEducationBackground: true } })
	});
	assert.equal(response.status, 400);
});