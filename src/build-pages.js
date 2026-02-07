import { Octokit } from "octokit";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import Mustache from "mustache";
import dotenv from "dotenv";

dotenv.config();

const owner = process.env.OWNER;
const repo = process.env.REPO;
const targetIssueId = process.env.TARGET_ISSUE_ID;

if (!owner || !repo || !targetIssueId) {
	throw new Error(
		"Missing required env vars. Set OWNER, REPO, and TARGET_ISSUE_ID (and optionally GITHUB_TOKEN)."
	);
}

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

const shortDate = (isoString) => {
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};


// Build
octokit.rest.issues.listForRepo({
	owner,
	repo,
})
.then(issues => {
	issues.owner = owner
	issues.repo = repo

	// Format issue object
	issues.data.map(issue => issue.updated_at_short = shortDate(issue.updated_at))
	console.log("issues: ", issues)

	// Build index
	const index_template = readFileSync("template/index.template.html", "utf8").toString();
	const index_html = Mustache.render(index_template, issues)
	writeFileSync("index.html", index_html, "utf8");

	// Build post
	let target_issue = issues.data.filter((ti) => {
		return ti.id == targetIssueId
	});
	target_issue = target_issue[0]
	if (!target_issue) {
		throw new Error(`Target issue not found: ${targetIssueId}`);
	}

	const markdown = target_issue.body
	const issue_template = readFileSync("template/post.template.html", "utf8").toString();
	octokit.rest.markdown.render({"text": markdown, "mode": "gfm"})
	.then(issue_html => {
		target_issue.issue_html = issue_html
		console.log("target_issue: ", target_issue)

		try {
			mkdirSync("posts", { recursive: true });
		} catch (err) {
			throw new Error(`Failed to ensure posts directory: ${err.message}`);
		}

		const issue_page = Mustache.render(issue_template, target_issue)
		writeFileSync(`posts/${targetIssueId}.html`, issue_page, "utf8");
	})

});