export function validateConceptGraph(nodes) {
	if (!Array.isArray(nodes) || nodes.length === 0 || nodes.length > 500) {
		throw new Error("Concept graph must contain between 1 and 500 nodes.");
	}
	const byId = new Map();
	const normalized = nodes.map(node => {
		if (!node || typeof node.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(node.id)) {
			throw new Error("Each concept needs a valid id.");
		}
		if (byId.has(node.id)) throw new Error("Concept ids must be unique.");
		if (typeof node.title !== "string" || !node.title.trim() || node.title.length > 160) {
			throw new Error("Each concept needs a title no longer than 160 characters.");
		}
		const prerequisites = node.prerequisites === undefined ? [] : node.prerequisites;
		if (!Array.isArray(prerequisites) || prerequisites.some(item => typeof item !== "string" || item === node.id)) {
			throw new Error("Concept prerequisites must be a list of other concept ids.");
		}
		const minimumMastery = node.minimumMastery === undefined ? 0.7 : node.minimumMastery;
		if (typeof minimumMastery !== "number" || !Number.isFinite(minimumMastery) || minimumMastery < 0 || minimumMastery > 1) {
			throw new Error("minimumMastery must be a number between 0 and 1.");
		}
		const area = node.area === undefined ? "General" : node.area;
		if (typeof area !== "string" || !area.trim() || area.length > 80) throw new Error("Concept area must be a non-empty string up to 80 characters.");
		const description = node.description === undefined ? "" : node.description;
		if (typeof description !== "string" || description.length > 1000) throw new Error("Concept description must be no longer than 1000 characters.");
		const result = { id: node.id, title: node.title.trim(), description: description.trim(), area: area.trim(), prerequisites: [...new Set(prerequisites)], minimumMastery: minimumMastery };
		byId.set(result.id, result);
		return result;
	});

	for (const node of normalized) {
		for (const prerequisite of node.prerequisites) {
			if (!byId.has(prerequisite)) throw new Error("Unknown prerequisite " + prerequisite + " for concept " + node.id + ".");
		}
	}

	const visited = new Set();
	const active = new Set();
	function visit(conceptId) {
		if (active.has(conceptId)) throw new Error("Concept prerequisites cannot contain cycles.");
		if (visited.has(conceptId)) return;
		active.add(conceptId);
		byId.get(conceptId).prerequisites.forEach(visit);
		active.delete(conceptId);
		visited.add(conceptId);
	}
	normalized.forEach(node => visit(node.id));
	return normalized;
}

export function updateSm2Schedule(previous, quality, reviewedAt = new Date()) {
	if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error("SM-2 quality must be an integer from 0 to 5.");
	const repetitions = previous ? previous.repetitions : 0;
	const previousInterval = previous ? (previous.intervalDays ?? previous.interval_days) : 0;
	const previousEase = previous ? (previous.easeFactor ?? previous.ease_factor) : 2.5;
	const easeFactor = Math.max(1.3, previousEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
	let nextRepetitions;
	let intervalDays;
	if (quality < 3) {
		nextRepetitions = 0;
		intervalDays = 1;
	} else if (repetitions === 0) {
		nextRepetitions = 1;
		intervalDays = 1;
	} else if (repetitions === 1) {
		nextRepetitions = 2;
		intervalDays = 6;
	} else {
		nextRepetitions = repetitions + 1;
		intervalDays = Math.max(1, Math.round(previousInterval * easeFactor));
	}
	const reviewedAtDate = new Date(reviewedAt);
	if (Number.isNaN(reviewedAtDate.getTime())) throw new Error("reviewedAt must be a valid date.");
	const nextDue = new Date(reviewedAtDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
	return {
		repetitions: nextRepetitions,
		intervalDays: intervalDays,
		easeFactor: Math.round(easeFactor * 100) / 100,
		lastReviewedAt: reviewedAtDate.toISOString(),
		nextDueAt: nextDue.toISOString(),
		lastQuality: quality
	};
}

export function calculateLearningPath(nodes, masteryById) {
	const mastery = masteryById || {};
	const unlocked = nodes.filter(node => node.prerequisites.every(id => (mastery[id] || 0) >= (nodes.find(item => item.id === id)?.minimumMastery ?? 0.7)));
	const recommended = unlocked.filter(node => (mastery[node.id] || 0) < node.minimumMastery);
	const areas = new Map();
	for (const node of nodes) {
		const areaState = areas.get(node.area) || { area: node.area, total: 0, count: 0, concepts: [] };
		const score = Math.round((mastery[node.id] || 0) * 100);
		areaState.total += score;
		areaState.count += 1;
		areaState.concepts.push({ id: node.id, title: node.title, mastery: score });
		areas.set(node.area, areaState);
	}
	return {
		recommended: recommended.map(node => ({ id: node.id, title: node.title, area: node.area, mastery: Math.round((mastery[node.id] || 0) * 100) })),
		locked: nodes.filter(node => !unlocked.includes(node)).map(node => ({ id: node.id, title: node.title, prerequisites: node.prerequisites.filter(id => (mastery[id] || 0) < (nodes.find(item => item.id === id)?.minimumMastery ?? 0.7)) })),
		skillMatrix: Array.from(areas.values()).map(area => ({ area: area.area, mastery: Math.round(area.total / area.count), concepts: area.concepts }))
	};
}