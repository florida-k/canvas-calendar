console.log("Canvas Calendar Power Tool loaded!");


// --------------------------------------------------
// Chrome local storage
// --------------------------------------------------

function getStorageKey(assignment) {
  return `powerTool_${assignment.course_id}_${assignment.id}`;
}



async function getSavedMetadata(assignment) {
  const key = getStorageKey(assignment);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "MYCAL_GET_METADATA",
      courseId: String(assignment.course_id),
      assignmentId: String(assignment.id)
    });

    if (response?.ok && response.data) {
      const backendData = response.data;

      // Convert Spring Boot's format into the format
      // your existing MyCal editor expects.
      const metadata = {
        priority: backendData.priority?.toLowerCase() || null,
        estimatedTime: backendData.estimatedMinutes != null
          ? formatEstimatedTime(backendData.estimatedMinutes)
          : null,
        notes: backendData.notes || ""
      };

      // Keep Chrome storage synchronized with PostgreSQL.
      await chrome.storage.local.set({
        [key]: metadata
      });

      return metadata;
    }

    if (response?.ok && response.data === null) {
      // No database record yet. Preserve older local plans.
      const local = await chrome.storage.local.get(key);
      return local[key] || null;
    }

    console.warn("MyCal backend loading failed:", response?.error);

  } catch (error) {
    console.warn("MyCal backend unavailable:", error.message);
  }

  // Fallback if Spring Boot is offline.
  const local = await chrome.storage.local.get(key);
  return local[key] || null;
}

// Convert minutes from PostgreSQL to MyCal's display format.
function formatEstimatedTime(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value) || value < 0) return null;

  if (value >= 60 && value % 60 === 0) {
    return `${value / 60}h`;
  }

  return `${value}m`;
}



async function saveMetadata(assignment, metadata) {
  const key = getStorageKey(assignment);

  await chrome.storage.local.set({
    [key]: metadata
  });

  console.log(
    "Saved Power Tool metadata:",
    key,
    metadata
  );
}


// --------------------------------------------------
// Load real Canvas assignments through Canvas API
// --------------------------------------------------

async function loadCanvasAssignments() {

  const coursesResponse = await fetch(
    "/api/v1/courses?enrollment_state=active&per_page=100",
    {
      credentials: "include"
    }
  );


  if (!coursesResponse.ok) {
    throw new Error(
      `Failed to load courses: ${coursesResponse.status}`
    );
  }


  const courses =
    await coursesResponse.json();

  console.log(
    "Canvas courses:",
    courses
  );


  // Get assignments for every active course
  const requests =
    courses.map(async (course) => {

      const response = await fetch(
        `/api/v1/courses/${course.id}/assignments?per_page=100`,
        {
          credentials: "include"
        }
      );


      if (!response.ok) {

        console.warn(
          `Could not load assignments for ${course.name}`
        );

        return [];
      }


      const assignments =
        await response.json();


      return assignments.map(
        (assignment) => ({
          ...assignment,

          // Keep course information
          // with each assignment
          course_id: course.id,
          course_name: course.name
        })
      );
    });


  const assignmentsByCourse =
    await Promise.all(requests);


  return assignmentsByCourse.flat();
}


// --------------------------------------------------
// Extract Canvas course ID from calendar DOM event
// --------------------------------------------------

function getCourseIdFromEvent(event) {

  const courseClass =
    [...event.classList].find(
      (className) =>
        className.startsWith(
          "group_course_"
        )
    );


  if (!courseClass) {
    return null;
  }


  return courseClass.replace(
    "group_course_",
    ""
  );
}


// --------------------------------------------------
// Power Tool assignment editor
// --------------------------------------------------

function openPowerToolEditor(event, assignment, metadata = {}) {
  document.querySelector(".power-tool-editor")?.remove();

  const editor = document.createElement("div");
  editor.className = "power-tool-editor";
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "true");
  editor.setAttribute("aria-label", "MyCal assignment planner");

  const dueDateText = assignment.due_at
    ? new Date(assignment.due_at).toLocaleString([], {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
      })
    : "No due date";

  const existingTime = metadata.estimatedTime || "";
  const timeMatch = existingTime.match(/^([\d.]+)(h|m)$/);
  const initialTimeValue = timeMatch ? timeMatch[1] : "";
  const initialTimeUnit = timeMatch?.[2] === "m" ? "minutes" : "hours";

  editor.innerHTML = `
    <div class="mycal-editor-panel">
      <header class="mycal-editor-header">
        <div class="mycal-editor-brand">
          <span class="mycal-editor-brand-icon" aria-hidden="true">✦</span>
          <div><strong>MyCal</strong><span>Assignment planner</span></div>
        </div>
        <button id="powerToolClose" class="mycal-icon-button" type="button" aria-label="Close editor">×</button>
      </header>
      <section class="mycal-editor-assignment">
        <h3 class="mycal-assignment-title"></h3>
        <p class="mycal-course-name"></p>
        <p class="mycal-due-date"></p>
      </section>
      <div class="mycal-editor-fields">
        <div class="mycal-field">
          <label class="mycal-field-label">Priority</label>
          <div id="powerToolPriorityButtons" class="mycal-priority-group" role="group" aria-label="Priority">
            <button type="button" data-priority="low"><span class="mycal-dot mycal-dot-low"></span>Low</button>
            <button type="button" data-priority="medium"><span class="mycal-dot mycal-dot-medium"></span>Medium</button>
            <button type="button" data-priority="high"><span class="mycal-dot mycal-dot-high"></span>High</button>
          </div>
        </div>
        <div class="mycal-field">
          <label class="mycal-field-label" for="powerToolTime">Estimated time</label>
          <div class="mycal-time-row">
            <input id="powerToolTime" type="number" min="0.01" step="any" placeholder="e.g. 2" />
            <select id="powerToolTimeUnit" aria-label="Time unit">
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
        <div class="mycal-field">
          <label class="mycal-field-label" for="powerToolNotes">Notes <span class="mycal-optional">optional</span></label>
          <textarea id="powerToolNotes" rows="3" placeholder="Add details, reminders, or a study plan..."></textarea>
        </div>
      </div>
      <p class="mycal-save-status" role="status" aria-live="polite"></p>
      <footer class="mycal-editor-actions">
        <button id="powerToolCancel" type="button">Cancel</button>
        <button id="powerToolSave" type="button">Save changes</button>
      </footer>
    </div>`;

  // Canvas assignment text is untrusted: assign textContent rather than HTML.
  editor.querySelector(".mycal-assignment-title").textContent = assignment.name || "Assignment";
  editor.querySelector(".mycal-course-name").textContent = assignment.course_name || "Canvas course";
  editor.querySelector(".mycal-due-date").textContent = `Due ${dueDateText}`;
  document.body.appendChild(editor);

  const timeInput = editor.querySelector("#powerToolTime");
  const timeUnitInput = editor.querySelector("#powerToolTimeUnit");
  const notesInput = editor.querySelector("#powerToolNotes");
  const saveButton = editor.querySelector("#powerToolSave");
  const status = editor.querySelector(".mycal-save-status");
  const priorityButtons = [...editor.querySelectorAll("[data-priority]")];
  let selectedPriority = metadata.priority || "medium";

  timeInput.value = initialTimeValue;
  timeUnitInput.value = initialTimeUnit;
  notesInput.value = metadata.notes || "";

  function updatePriorityButtons() {
    priorityButtons.forEach(button => {
      const selected = button.dataset.priority === selectedPriority;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  priorityButtons.forEach(button => button.addEventListener("click", () => {
    selectedPriority = button.dataset.priority;
    updatePriorityButtons();
  }));
  updatePriorityButtons();

  const closeEditor = () => editor.remove();
  editor.querySelector("#powerToolClose").addEventListener("click", closeEditor);
  editor.querySelector("#powerToolCancel").addEventListener("click", closeEditor);

  saveButton.addEventListener("click", async () => {
    const timeValue = Number(timeInput.value);
    if (!timeInput.value || !Number.isFinite(timeValue) || timeValue <= 0) {
      status.textContent = "Enter an estimated time greater than zero.";
      timeInput.focus();
      return;
    }

    const estimatedMinutes = Math.round(timeValue * (timeUnitInput.value === "hours" ? 60 : 1));
    if (estimatedMinutes < 1) {
      status.textContent = "Estimated time must be at least one minute.";
      timeInput.focus();
      return;
    }

    const newTime = formatEstimatedTime(estimatedMinutes);
    const newMetadata = {
      priority: selectedPriority,
      estimatedTime: newTime,
      notes: notesInput.value
    };

    saveButton.disabled = true;
    status.textContent = "Saving...";
    try {
      // Preserve the existing local fallback while syncing to Spring Boot.
      await saveMetadata(assignment, newMetadata);
      try {
        const result = await chrome.runtime.sendMessage({
          type: "MYCAL_SAVE_METADATA",
          courseId: String(assignment.course_id),
          assignmentId: String(assignment.id),
          metadata: {
            priority: selectedPriority.toUpperCase(),
            estimatedMinutes,
            notes: newMetadata.notes || null
          }
        });
        if (!result?.ok) console.warn("MyCal backend unavailable; saved locally:", result?.error);
      } catch (error) {
        console.warn("MyCal backend unavailable; saved locally:", error);
      }

      // Mutate the same object captured by the calendar badge/editor handlers.
      Object.assign(metadata, newMetadata);
      if (typeof event.mycalUpdatePlan === "function") event.mycalUpdatePlan();
      closeEditor();
    } catch (error) {
      console.error("MyCal save failed:", error);
      status.textContent = "Could not save. Please try again.";
      saveButton.disabled = false;
    }
  });
}


// Canvas event matching: prefer an actual assignment ID from the event/link.
// A title is NOT a unique identifier. If no ID exists, only use a title when
// it identifies exactly one API assignment within the course.
function decodeCanvasText(value) {
  const element = document.createElement("textarea");
  element.innerHTML = value || "";
  return element.value.replace(/\s+/g, " ").trim();
}


function getAssignmentIdFromEvent(event) {
  const nodes = [
    event,
    ...event.querySelectorAll("*")
  ];

  for (const node of nodes) {
    // Check Canvas data attributes
    for (const attr of [
      "data-assignment-id",
      "data-assignment_id",
      "data-assignmentid"
    ]) {
      const value = node.getAttribute(attr);

      if (value && /^\d+$/.test(value)) {
        return value;
      }
    }

    // Check links to actual Canvas assignments
    for (const attr of ["href", "data-url"]) {
      const value = node.getAttribute(attr) || "";

      const match = value.match(
        /\/assignments\/(\d+)(?:[/?#]|$)/
      );

      if (match) {
        return match[1];
      }
    }
  }

  return null;
}


function matchCanvasAssignment(event, assignments) {
  const courseId = getCourseIdFromEvent(event);
  if (!courseId) return null;
  const inCourse = assignments.filter(a => String(a.course_id) === String(courseId));
  const assignmentId = getAssignmentIdFromEvent(event);
  if (assignmentId) {
    return inCourse.find(a => String(a.id) === assignmentId) || null;
  }
  // Compatibility fallback for Canvas event DOMs without exposed assignment IDs.
  const title = decodeCanvasText(event.getAttribute("title") || event.querySelector(".fc-title")?.textContent);
  const candidates = inCourse.filter(a => decodeCanvasText(a.name) === title);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) console.warn("MyCal: ambiguous assignment title; skipping", title);
  return null;
}

let cachedAssignments = null;
let calendarEnhancementRunning = false;
let calendarRefreshTimer = null;

async function enhanceCalendar() {
  if (calendarEnhancementRunning) return;
  calendarEnhancementRunning = true;
  try {
    if (!cachedAssignments) cachedAssignments = await loadCanvasAssignments();
    const events = document.querySelectorAll(".fc-day-grid-event.assignment");
    for (const event of events) {
      if (event.dataset.mycalEnhanced === "true") continue;
      const assignment = matchCanvasAssignment(event, cachedAssignments);
      if (!assignment) continue;
      const content = event.querySelector(".fc-content");
      if (!content) continue;
      event.dataset.mycalEnhanced = "true";
      const metadata = (await getSavedMetadata(assignment)) || {};
      if (!event.isConnected) continue;

      // A small edit control exists for EVERY matched assignment, not just saved ones.
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mycal-event-edit";
      // Compact icon button with a larger click target.
      edit.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>`;
      edit.title = "Customize in MyCal";
      edit.setAttribute("aria-label", `Customize ${assignment.name} in MyCal`);
      edit.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        openPowerToolEditor(event, assignment, metadata);
      });
      content.appendChild(edit);

      // Priority dot appears BEFORE the title, not after it.
      const titleNode = content.querySelector(".fc-title");
      const priorityDot = document.createElement("span");
      priorityDot.className = "mycal-priority-dot";
      priorityDot.setAttribute("aria-hidden", "true");
      if (titleNode) titleNode.prepend(priorityDot);
      else content.prepend(priorityDot);

      // Keep effort and a text priority label visible beneath the title.
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "power-tool-badge";
      function updateEventPlan() {
        const priority = String(metadata.priority || "").toLowerCase();
        const hasPlan = Boolean(priority || metadata.estimatedTime);
        priorityDot.dataset.priority = priority;
        priorityDot.hidden = !priority;
        badge.hidden = !hasPlan;
        badge.textContent = [priority ? priority.toUpperCase() : null,
          metadata.estimatedTime ? `⏱ ${metadata.estimatedTime}` : null]
          .filter(Boolean).join(" · ");
      }
      updateEventPlan();
      // Let the editor's save handler update this event without rebuilding it.
      event.mycalUpdatePlan = updateEventPlan;
      badge.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        openPowerToolEditor(event, assignment, metadata);
      });
      content.appendChild(badge);
    }
  } catch (error) {
    console.error("MyCal calendar enhancement failed:", error);
    // Retry API loading on the next calendar update.
    cachedAssignments = null;
  } finally {
    calendarEnhancementRunning = false;
  }
}

function scheduleCalendarEnhancement() {
  clearTimeout(calendarRefreshTimer);
  calendarRefreshTimer = setTimeout(enhanceCalendar, 180);
}

// Canvas dynamically replaces events when navigating months/weeks.
// Watch only calendar changes; avoid reacting to MyCal's own controls.
const calendarObserver = new MutationObserver(mutations => {
  const changedCalendarEvents = mutations.some(m =>
    [...m.addedNodes].some(node => node.nodeType === 1 &&
      (node.matches?.(".fc-day-grid-event.assignment, .fc-day-grid, .fc-view") ||
       node.querySelector?.(".fc-day-grid-event.assignment")))
  );
  if (changedCalendarEvents) scheduleCalendarEnhancement();
});
calendarObserver.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(enhanceCalendar, 2000);
