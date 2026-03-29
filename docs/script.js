const heroWords = ["events", "hackathons", "programs", "courses", "campaigns"];
const heroWord = document.getElementById("hero-word");
let heroIndex = 0;

if (heroWord) {
  setInterval(() => {
    heroIndex = (heroIndex + 1) % heroWords.length;
    heroWord.textContent = heroWords[heroIndex];
  }, 2200);
}

const flowData = {
  qr: {
    filename: "verify-qr.ts",
    label: "Dynamic QR proof",
    footer: "qr flow ready",
    code: `const scope = await fetch('/api/events/conf-2026')
const qr = await fetch('/api/events/conf-2026/qr')

// participant scans
// backend checks freshness + hmac
// participant signs mint
await mintBadge(scope, address)`,
  },
  claim: {
    filename: "issue-claim.ts",
    label: "Signed claim flow",
    footer: "claim flow ready",
    code: `const message = buildSignedClaimMessage({
  scopeId: 'hack-2026',
  recipientAddress: 'ckt1winner...',
  claimId: 'claim-1',
  proofDriver: 'signed-claim',
  proofRef: 'submission-42',
  issuerAddress: 'ckt1organizer...',
  issuedAt: Date.now(),
})

const token = encodeSignedClaimToken({ ...claim, issuerSignature })`,
  },
  submission: {
    filename: "submission-review.ts",
    label: "Submission proof flow",
    footer: "submission flow ready",
    code: `const result = await reviewSubmission(submissionId)

if (result.approved) {
  const token = encodeSignedClaimToken({
    scopeId: 'course-2026',
    recipientAddress: result.address,
    proofDriver: 'submission-proof',
    proofRef: submissionId,
    issuerSignature,
  })
}`,
  }
};

const workflowButtons = Array.from(document.querySelectorAll(".workflow-step"));
const flowFilename = document.getElementById("flow-filename");
const flowLabel = document.getElementById("flow-label");
const flowCode = document.querySelector("#flow-code code");
const flowFooter = document.getElementById("flow-footer");

function setFlow(flow) {
  const selected = flowData[flow];
  if (!selected || !flowCode || !flowFilename || !flowLabel || !flowFooter) return;
  workflowButtons.forEach((button) => button.classList.toggle("active", button.dataset.flow === flow));
  flowFilename.textContent = selected.filename;
  flowLabel.textContent = selected.label;
  flowCode.textContent = selected.code;
  flowFooter.textContent = selected.footer;
}

workflowButtons.forEach((button) => {
  button.addEventListener("click", () => setFlow(button.dataset.flow));
});

setFlow("qr");

const integrationData = {
  hackathon: {
    title: "Hackathon completion flow",
    code: `const completedHackers = await getCompletedHackers()

for (const hacker of completedHackers) {
  const message = buildSignedClaimMessage({
    scopeId: 'hack-2026',
    recipientAddress: hacker.address,
    claimId: hacker.completionId,
    proofDriver: 'signed-claim',
    proofRef: hacker.submissionId,
    issuerAddress: organizerAddress,
    issuedAt: Date.now(),
  })

  // organizer signs, platform sends token
}`,
    points: [
      "Your backend decides completion status in its own system.",
      "Your backend signs the claim using the organizer or issuer key.",
      "The hacker still signs the final mint transaction.",
      "The badge stays unique for the hackathon scope and the hacker address."
    ]
  },
  program: {
    title: "Course and program completion",
    code: `if (lesson.completed && capstone.approved) {
  const token = encodeSignedClaimToken({
    scopeId: 'program-2026',
    recipientAddress: learner.address,
    claimId: learner.id,
    proofDriver: 'submission-proof',
    proofRef: capstone.id,
    issuerAddress: instructorAddress,
    issuedAt: Date.now(),
    issuerSignature,
  })
}`,
    points: [
      "Use \`program\` or \`course\` as the scope kind.",
      "Use `async` or `online` as the participation mode.",
      "Use `submission-proof` when completion depends on reviewed deliverables.",
      "Send claim links directly to the learner’s wallet flow."
    ]
  },
  community: {
    title: "Community campaign flow",
    code: `const winners = await evaluateCampaign()

const token = encodeSignedClaimToken({
  scopeId: 'campaign-2026',
  recipientAddress: winners[0].address,
  claimId: winners[0].id,
  proofDriver: 'signed-claim',
  proofRef: winners[0].activityRef,
  issuerAddress: communityOperator,
  issuedAt: Date.now(),
  issuerSignature,
})`,
    points: [
      "Use `campaign` or `membership` scopes for non-event community work.",
      "Attach the internal activity reference as the proof ref.",
      "Let the participant claim only after the operator attests eligibility.",
      "Keep the on-chain primitive the same even when the social logic changes."
    ]
  }
};

const integrationButtons = Array.from(document.querySelectorAll(".integration-tab"));
const integrationTitle = document.getElementById("integration-title");
const integrationCode = document.querySelector("#integration-code code");
const integrationPoints = document.getElementById("integration-points");

function setIntegration(name) {
  const selected = integrationData[name];
  if (!selected || !integrationTitle || !integrationCode || !integrationPoints) return;
  integrationButtons.forEach((button) => button.classList.toggle("active", button.dataset.integration === name));
  integrationTitle.textContent = selected.title;
  integrationCode.textContent = selected.code;
  integrationPoints.innerHTML = selected.points.map((point) => `<li>${point}</li>`).join("");
}

integrationButtons.forEach((button) => {
  button.addEventListener("click", () => setIntegration(button.dataset.integration));
});

setIntegration("hackathon");

const copyButtons = Array.from(document.querySelectorAll(".copy-btn"));

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const successful = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!successful) {
    throw new Error("Clipboard unavailable");
  }
}

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target");
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    const text = target.innerText;
    try {
      await writeClipboard(text);
      button.classList.add("copied");
      button.classList.remove("copy-error");
      window.setTimeout(() => {
        button.classList.remove("copied");
      }, 1800);
    } catch {
      button.classList.add("copy-error");
      window.setTimeout(() => {
        button.classList.remove("copy-error");
      }, 1800);
    }
  });
});
