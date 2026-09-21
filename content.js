console.log("Canvas Calendar Power Tool loaded!");


// --------------------------------------------------
// TEMPORARY Power Tool metadata
// Later this comes from Spring Boot / PostgreSQL.
// --------------------------------------------------

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


// --------------------------------------------------
// Chrome local storage
// --------------------------------------------------

function getStorageKey(assignment) {
  return `powerTool_${assignment.course_id}_${assignment.id}`;
}


async function getSavedMetadata(assignment) {
  const key = getStorageKey(assignment);

  const result =
    await chrome.storage.local.get(key);

  return result[key] || null;
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

function openPowerToolEditor(
  event,
  assignment,
  metadata
) {

  // Remove an existing editor
  document
    .querySelector(
      ".power-tool-editor"
    )
    ?.remove();


  // --------------------------------------------------
  // Format Canvas due date
  // --------------------------------------------------

  let dueDateText =
    "No due date";


  if (assignment.due_at) {

    const dueDate =
      new Date(
        assignment.due_at
      );


    dueDateText =
      dueDate.toLocaleString(
        [],
        {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      );
  }


  // --------------------------------------------------
  // Parse existing estimated time
  //
  // "2h"  -> 2 + Hours
  // "45m" -> 45 + Minutes
  // --------------------------------------------------

  let initialTimeValue = "";
  let initialTimeUnit = "hours";


  const timeMatch =
    metadata.estimatedTime
      ?.match(
        /^([\d.]+)(h|m)$/
      );


  if (timeMatch) {

    initialTimeValue =
      timeMatch[1];


    initialTimeUnit =
      timeMatch[2] === "m"
        ? "minutes"
        : "hours";
  }


  // --------------------------------------------------
  // Create editor
  // --------------------------------------------------

  const editor =
    document.createElement(
      "div"
    );


  editor.className =
    "power-tool-editor";


  editor.innerHTML = `
    <div style="
      position: fixed;
      top: 120px;
      right: 30px;
      width: 330px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 20px;
      z-index: 99999;
      box-shadow: 0 6px 22px rgba(0,0,0,0.18);
      font-family: Arial, sans-serif;
    ">

      <!-- HEADER -->

      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      ">

        <div style="
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #777;
        ">
          CANVAS POWER TOOL
        </div>

        <button
          id="powerToolClose"
          type="button"
          style="
            border: none;
            background: transparent;
            font-size: 21px;
            line-height: 1;
            color: #777;
            cursor: pointer;
            padding: 2px 5px;
          "
        >
          ×
        </button>

      </div>


      <!-- CANVAS ASSIGNMENT INFORMATION -->

      <h3 style="
        margin: 0 0 6px 0;
        font-size: 18px;
        line-height: 1.3;
      ">
        ${assignment.name}
      </h3>

      <div style="
        font-size: 13px;
        color: #666;
        margin-bottom: 4px;
      ">
        ${assignment.course_name}
      </div>

      <div style="
        font-size: 13px;
        color: #777;
        margin-bottom: 18px;
      ">
        Due ${dueDateText}
      </div>


      <hr style="
        border: none;
        border-top: 1px solid #eee;
        margin: 0 0 18px 0;
      ">


      <!-- PRIORITY -->

      <div style="
        display: block;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      ">
        PRIORITY
      </div>


      <div
        id="powerToolPriorityButtons"
        style="
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        "
      >

        <button
          type="button"
          data-priority="low"
          style="
            flex: 1;
            padding: 8px 5px;
            border-radius: 7px;
            cursor: pointer;
            background: white;
          "
        >
          🟢 Low
        </button>


        <button
          type="button"
          data-priority="medium"
          style="
            flex: 1;
            padding: 8px 5px;
            border-radius: 7px;
            cursor: pointer;
            background: white;
          "
        >
          🟡 Medium
        </button>


        <button
          type="button"
          data-priority="high"
          style="
            flex: 1;
            padding: 8px 5px;
            border-radius: 7px;
            cursor: pointer;
            background: white;
          "
        >
          🔴 High
        </button>

      </div>


      <!-- ESTIMATED TIME -->

      <div style="
        display: block;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      ">
        ESTIMATED TIME
      </div>


      <div style="
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
      ">

        <input
          id="powerToolTime"
          type="number"
          min="0"
          step="0.5"
          placeholder="2"
          style="
            width: 35%;
            box-sizing: border-box;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 6px;
          "
        />


        <select
          id="powerToolTimeUnit"
          style="
            flex: 1;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 6px;
            background: white;
          "
        >

          <option value="minutes">
            Minutes
          </option>

          <option value="hours">
            Hours
          </option>

        </select>

      </div>


      <!-- ACTIONS -->

      <div style="
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      ">

        <button
          id="powerToolCancel"
          type="button"
          style="
            padding: 7px 13px;
            cursor: pointer;
          "
        >
          Cancel
        </button>


        <button
          id="powerToolSave"
          type="button"
          style="
            padding: 7px 15px;
            cursor: pointer;
            font-weight: 600;
          "
        >
          Save
        </button>

      </div>

    </div>
  `;


  document.body.appendChild(
    editor
  );


  // --------------------------------------------------
  // Current priority
  // --------------------------------------------------

  let selectedPriority =
    metadata.priority ||
    "medium";


  // --------------------------------------------------
  // Estimated time inputs
  // --------------------------------------------------

  const timeInput =
    editor.querySelector(
      "#powerToolTime"
    );


  const timeUnitInput =
    editor.querySelector(
      "#powerToolTimeUnit"
    );


  timeInput.value =
    initialTimeValue;


  timeUnitInput.value =
    initialTimeUnit;


  // --------------------------------------------------
  // Priority buttons
  // --------------------------------------------------

  const priorityButtons =
    editor.querySelectorAll(
      "[data-priority]"
    );


  function updatePriorityButtons() {

    priorityButtons.forEach(
      (button) => {

        const isSelected =
          button.dataset.priority ===
          selectedPriority;


        if (isSelected) {

          button.style.border =
            "2px solid #444";

          button.style.fontWeight =
            "700";

          button.style.background =
            "#f5f5f5";

        } else {

          button.style.border =
            "1px solid #ccc";

          button.style.fontWeight =
            "400";

          button.style.background =
            "white";
        }

      }
    );
  }


  // Highlight saved priority
  updatePriorityButtons();


  // Change priority when clicked
  priorityButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          selectedPriority =
            button.dataset.priority;

          updatePriorityButtons();
        }
      );

    }
  );


  // --------------------------------------------------
  // Close
  // --------------------------------------------------

  editor
    .querySelector(
      "#powerToolClose"
    )
    .addEventListener(
      "click",
      () => {

        editor.remove();

      }
    );


  // --------------------------------------------------
  // Cancel
  // --------------------------------------------------

  editor
    .querySelector(
      "#powerToolCancel"
    )
    .addEventListener(
      "click",
      () => {

        editor.remove();

      }
    );


  // --------------------------------------------------
  // Save
  // --------------------------------------------------

  editor
    .querySelector(
      "#powerToolSave"
    )
    .addEventListener(
      "click",
      async () => {

        const newPriority =
          selectedPriority;


        const timeValue =
          timeInput.value;


        const timeUnit =
          timeUnitInput.value;


        // Don't save an empty estimated time
        if (!timeValue) {

          alert(
            "Please enter an estimated time."
          );

          return;
        }


        // Convert UI value back into our
        // existing compact storage format.
        //
        // 2 + Hours   -> "2h"
        // 45 + Minutes -> "45m"

        const newTime =
          timeUnit === "minutes"
            ? `${timeValue}m`
            : `${timeValue}h`;


        // Persist metadata
        await saveMetadata(
          assignment,
          {
            priority:
              newPriority,

            estimatedTime:
              newTime
          }
        );


        // Update current metadata object
        metadata.priority =
          newPriority;

        metadata.estimatedTime =
          newTime;


        // --------------------------------------------------
        // Update calendar badge immediately
        // --------------------------------------------------

        const badge =
          event.querySelector(
            ".power-tool-badge"
          );


        const priorityIcons = {
          high: "🔴",
          medium: "🟡",
          low: "🟢"
        };


        if (badge) {

          badge.textContent =
            `${priorityIcons[newPriority]} ` +
            `${newPriority.toUpperCase()} · ` +
            `⏱ ${newTime}`;

        }


        editor.remove();
      }
    );
}


// --------------------------------------------------
// Enhance Canvas Calendar
// --------------------------------------------------

async function enhanceCalendar() {

  try {

    const assignments =
      await loadCanvasAssignments();


    console.log(
      `Loaded ${assignments.length} real Canvas assignments`
    );


    const events =
      document.querySelectorAll(
        ".fc-day-grid-event.assignment"
      );


    console.log(
      `Found ${events.length} assignment events in calendar`
    );


    events.forEach(
      async (event) => {

        const title =
          event.getAttribute(
            "title"
          );


        const courseId =
          getCourseIdFromEvent(
            event
          );


        console.log(
          "Calendar event:",
          title,
          "Course:",
          courseId
        );


        // --------------------------------------------------
        // Match DOM event with real Canvas API assignment
        // --------------------------------------------------

        const canvasAssignment =
          assignments.find(
            (assignment) =>
              String(
                assignment.course_id
              ) ===
                String(courseId) &&
              assignment.name ===
                title
          );


        if (!canvasAssignment) {

          console.log(
            "No API match:",
            title
          );

          return;
        }


        console.log(
          "MATCHED:",
          canvasAssignment.id,
          canvasAssignment.name
        );


        // --------------------------------------------------
        // Load saved metadata
        // --------------------------------------------------

        let metadata =
          await getSavedMetadata(
            canvasAssignment
          );


        // If user has never saved anything,
        // use temporary mock data.
        if (!metadata) {

          metadata =
            powerToolData[
              canvasAssignment.name
            ];

        }


        if (!metadata) {
          return;
        }


        // --------------------------------------------------
        // Don't add duplicate indicators
        // --------------------------------------------------

        if (
          event.querySelector(
            ".power-tool-badge"
          )
        ) {

          return;
        }


        const content =
          event.querySelector(
            ".fc-content"
          );


        if (!content) {
          return;
        }


        const priorityIcons = {
          high: "🔴",
          medium: "🟡",
          low: "🟢"
        };


        // --------------------------------------------------
        // Create Power Tool calendar badge
        // --------------------------------------------------

        const badge =
          document.createElement(
            "div"
          );


        badge.className =
          "power-tool-badge";


        badge.textContent =
          `${priorityIcons[metadata.priority]} ` +
          `${metadata.priority.toUpperCase()} · ` +
          `⏱ ${metadata.estimatedTime}`;


        badge.style.fontSize =
          "10px";

        badge.style.fontWeight =
          "600";

        badge.style.padding =
          "1px 3px";

        badge.style.whiteSpace =
          "nowrap";

        badge.style.cursor =
          "pointer";


        // --------------------------------------------------
        // Open editor when badge clicked
        // --------------------------------------------------

        badge.addEventListener(
          "click",
          (clickEvent) => {

            // Prevent Canvas itself
            // from handling this click
            clickEvent.preventDefault();

            clickEvent.stopPropagation();


            openPowerToolEditor(
              event,
              canvasAssignment,
              metadata
            );

          }
        );


        content.appendChild(
          badge
        );

      }
    );

  } catch (error) {

    console.error(
      "Canvas Power Tool error:",
      error
    );

  }
}


// --------------------------------------------------
// Give Canvas time to render its calendar
// --------------------------------------------------

setTimeout(
  enhanceCalendar,
  2000
);