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


async function loadCanvasAssignments() {

  // Get active Canvas courses
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

  const courses = await coursesResponse.json();

  console.log("Canvas courses:", courses);


  // Get assignments for every course
  const requests = courses.map(async (course) => {

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

    const assignments = await response.json();

    return assignments.map((assignment) => ({
      ...assignment,

      // Keep the course information with each assignment
      course_id: course.id,
      course_name: course.name
    }));
  });


  const assignmentsByCourse =
    await Promise.all(requests);

  return assignmentsByCourse.flat();
}



// --------------------------------------------------
// Extract Canvas course ID from a calendar DOM event
// --------------------------------------------------

function getCourseIdFromEvent(event) {

  const courseClass = [...event.classList].find(
    className =>
      className.startsWith("group_course_")
  );

  if (!courseClass) {
    return null;
  }

  return courseClass.replace(
    "group_course_",
    ""
  );
}

function openPowerToolEditor(event, assignment, metadata) {

  // Remove an existing editor if one is already open
  document.querySelector(".power-tool-editor")?.remove();

  const editor = document.createElement("div");
  editor.className = "power-tool-editor";

  editor.innerHTML = `
    <div style="
      position: fixed;
      top: 120px;
      right: 30px;
      width: 300px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 10px;
      padding: 18px;
      z-index: 99999;
      box-shadow: 0 4px 18px rgba(0,0,0,0.18);
      font-family: Arial, sans-serif;
    ">

      <div style="
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      ">
        CANVAS POWER TOOL
      </div>

      <h3 style="margin: 0 0 6px 0;">
        ${assignment.name}
      </h3>

      <div style="
        font-size: 13px;
        color: #666;
        margin-bottom: 18px;
      ">
        ${assignment.course_name}
      </div>


      <label style="font-weight: 600;">
        Priority
      </label>

      <select id="powerToolPriority"
              style="
                width: 100%;
                margin-top: 6px;
                margin-bottom: 16px;
                padding: 7px;
              ">
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>


      <label style="font-weight: 600;">
        Estimated Time
      </label>

      <input
        id="powerToolTime"
        type="text"
        placeholder="e.g. 2h"
        style="
          width: 100%;
          box-sizing: border-box;
          margin-top: 6px;
          margin-bottom: 18px;
          padding: 7px;
        "
      />


      <div style="
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      ">

        <button id="powerToolCancel">
          Cancel
        </button>

        <button id="powerToolSave">
          Save
        </button>

      </div>

    </div>
  `;

  document.body.appendChild(editor);


  // Fill editor with current values
  const priorityInput =
    editor.querySelector("#powerToolPriority");

  const timeInput =
    editor.querySelector("#powerToolTime");

  priorityInput.value = metadata.priority;
  timeInput.value = metadata.estimatedTime;


  // CANCEL
  editor
    .querySelector("#powerToolCancel")
    .addEventListener("click", () => {

      editor.remove();

    });


  // SAVE
  editor
    .querySelector("#powerToolSave")
    .addEventListener("click", () => {

      const newPriority =
        priorityInput.value;

      const newTime =
        timeInput.value;


      // Update our temporary Power Tool data
      metadata.priority = newPriority;
      metadata.estimatedTime = newTime;


      // Update the indicator immediately
      const badge =
        event.querySelector(".power-tool-badge");

      const priorityIcons = {
        high: "🔴",
        medium: "🟡",
        low: "🟢"
      };

      badge.textContent =
        `${priorityIcons[newPriority]} ` +
        `${newPriority.toUpperCase()} · ` +
        `⏱ ${newTime}`;


      editor.remove();

    });

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


    const events = document.querySelectorAll(
      ".fc-day-grid-event.assignment"
    );

    console.log(
      `Found ${events.length} assignment events in calendar`
    );


    events.forEach(event => {

      const title =
        event.getAttribute("title");

      const courseId =
        getCourseIdFromEvent(event);


      console.log(
        "Calendar event:",
        title,
        "Course:",
        courseId
      );


      // Match DOM event with REAL Canvas API assignment
      const canvasAssignment =
        assignments.find(assignment =>

          String(assignment.course_id) ===
            String(courseId)

          &&

          assignment.name === title

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


      // Do we have Power Tool metadata?
      const metadata =
        powerToolData[canvasAssignment.name];

      if (!metadata) {
        return;
      }


      // Don't add duplicate indicators
      if (
        event.querySelector(
          ".power-tool-badge"
        )
      ) {
        return;
      }


      const content =
        event.querySelector(".fc-content");

      if (!content) {
        return;
      }


      const priorityIcons = {
        high: "🔴",
        medium: "🟡",
        low: "🟢"
      };


      const badge =
        document.createElement("div");

      badge.className =
        "power-tool-badge";


      badge.textContent =
        `${priorityIcons[metadata.priority]} ` +
        `${metadata.priority.toUpperCase()} · ` +
        `⏱ ${metadata.estimatedTime}`;


      badge.style.fontSize = "10px";
      badge.style.fontWeight = "600";
      badge.style.padding = "1px 3px";
      badge.style.whiteSpace = "nowrap";

      badge.style.cursor = "pointer";
      
      badge.addEventListener("click", (clickEvent) => {

        // Prevent Canvas itself from handling this click
        clickEvent.preventDefault();
        clickEvent.stopPropagation();

        openPowerToolEditor(
            event,
            canvasAssignment,
            metadata
        );
    });
      
      content.appendChild(badge);

    });


  } catch (error) {

    console.error(
      "Canvas Power Tool error:",
      error
    );

  }

}


// Give Canvas time to render its calendar
setTimeout(enhanceCalendar, 2000);

// didn't like last commit msg