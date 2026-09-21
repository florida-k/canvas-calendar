console.log("Canvas Calendar Power Tool content script loaded!");

// TEMPORARY mock Power Tool data.
// Later this will come from the backend/database.
const powerToolData = {
  "Homework 1 - Submission": {
    priority: "high",
    estimatedTime: "2h"
  },

  "Homework 2 - Inference for Linear Regression": {
    priority: "medium",
    estimatedTime: "1h"
  },

  "Homework 3 - Diagnostics and Remedial Measures": {
    priority: "low",
    estimatedTime: "45m"
  }
};


function enhanceCalendar() {

  // Find ALL Canvas assignments currently displayed
  const events = document.querySelectorAll(
    ".fc-day-grid-event.assignment"
  );

  console.log(`Found ${events.length} Canvas assignments`);

  events.forEach(event => {

    const assignmentTitle = event.getAttribute("title");

    console.log("Found assignment:", assignmentTitle);

    // Check whether we have Power Tool data for this assignment
    const metadata = powerToolData[assignmentTitle];

    if (!metadata) {
      return;
    }

    // Prevent duplicate badges
    if (event.querySelector(".power-tool-badge")) {
      return;
    }

    const content = event.querySelector(".fc-content");

    if (!content) {
      return;
    }

    const badge = document.createElement("div");

    badge.className = "power-tool-badge";

    const priorityIcons = {
      high: "🔴",
      medium: "🟡",
      low: "🟢"
    };

    badge.textContent =
      `${priorityIcons[metadata.priority]} ${metadata.priority.toUpperCase()} · ⏱ ${metadata.estimatedTime}`;

    // TEMPORARY styling
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "600";
    badge.style.padding = "1px 3px";
    badge.style.whiteSpace = "nowrap";

    content.appendChild(badge);
  });
}


// Canvas takes a moment to render its calendar
setTimeout(enhanceCalendar, 2000);