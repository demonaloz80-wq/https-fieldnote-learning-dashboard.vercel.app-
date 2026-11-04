const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(path.join(outputDirectory, "assets"), { recursive: true });

for (const [source, destination] of [
	["index3.html", "index.html"],
	["script.js", "script.js"],
	["style.css", "style.css"],
]) {
	fs.copyFileSync(path.join(projectRoot, source), path.join(outputDirectory, destination));
}

fs.cpSync(path.join(projectRoot, "assets"), path.join(outputDirectory, "assets"), {
	recursive: true,
});

fs.cpSync(path.join(projectRoot, "views"), path.join(outputDirectory, "views"), {
	recursive: true,
});
