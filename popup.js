document
  .getElementById("loadAssignments")
  .addEventListener("click", async () => {
    const output = document.getElementById("output");

    output.textContent = "Loading assignments...";

    try {
      // 1. Get active Canvas courses
      const coursesResponse = await fetch(
        "https://ufl.instructure.com/api/v1/courses?enrollment_state=active&per_page=100",
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

      console.log("Active courses:", courses);

      // 2. Get assignments + submission information for every course
      const assignmentRequests = courses.map(async (course) => {
        const response = await fetch(
          `https://ufl.instructure.com/api/v1/courses/${course.id}/assignments?per_page=100&include[]=submission`,
          {
            credentials: "include"
          }
        );

        if (!response.ok) {
          console.warn(
            `Could not load assignments for ${course.name}:`,
            response.status
          );

          return [];
        }

        const assignments = await response.json();

        return assignments.map((assignment) => ({
          ...assignment,
          course_name: course.name
        }));
      });

      // 3. Wait for all course requests
      const assignmentsByCourse = await Promise.all(
        assignmentRequests
      );

      // 4. Combine assignments
      const allAssignments = assignmentsByCourse.flat();

      console.log("All assignments:", allAssignments);

      // IMPORTANT:
      // Inspect this in the console and verify that assignments
      // contain a "submission" object.
      console.log(
        "Assignment submission examples:",
        allAssignments.slice(0, 5).map((assignment) => ({
          name: assignment.name,
          due_at: assignment.due_at,
          submission: assignment.submission
        }))
      );

      const now = new Date();

      const upcoming = [];
      const overdue = [];
      const completed = [];

      // 5. Categorize assignments
      allAssignments.forEach((assignment) => {
        // Ignore assignments without due dates for now
        if (!assignment.due_at) {
          return;
        }

        const dueDate = new Date(assignment.due_at);

        const submissionState =
          assignment.submission?.workflow_state;

        /*
          Common useful states include:
          - unsubmitted
          - submitted
          - graded
          - pending_review
        */

        const isCompleted =
          submissionState === "submitted" ||
          submissionState === "graded" ||
          submissionState === "pending_review";

        if (isCompleted) {
          completed.push(assignment);
        } else if (dueDate < now) {
          overdue.push(assignment);
        } else {
          upcoming.push(assignment);
        }
      });

      // 6. Sort each category chronologically
      upcoming.sort(
        (a, b) =>
          new Date(a.due_at) - new Date(b.due_at)
      );

      overdue.sort(
        (a, b) =>
          new Date(b.due_at) - new Date(a.due_at)
      );

      completed.sort(
        (a, b) =>
          new Date(b.due_at) - new Date(a.due_at)
      );

      console.log("Upcoming:", upcoming);
      console.log("Overdue:", overdue);
      console.log("Completed:", completed);

      // 7. Clear loading message
      output.innerHTML = "";

      // 8. Display each section
      renderSection("Upcoming", upcoming, output);
      renderSection("Overdue", overdue, output);
      renderSection("Completed", completed, output);

    } catch (error) {
      console.error(error);

      output.textContent = `Error: ${error.message}`;
    }
  });


function renderSection(title, assignments, output) {
  const heading = document.createElement("h3");

  heading.textContent =
    `${title} (${assignments.length})`;

  output.appendChild(heading);

  if (assignments.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.textContent =
      `No ${title.toLowerCase()} assignments.`;

    output.appendChild(emptyMessage);

    return;
  }

  assignments.forEach((assignment) => {
    const item = document.createElement("p");

    const dueDate =
      new Date(assignment.due_at);

    const formattedDate =
      dueDate.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });

    item.textContent =
      `${assignment.course_name}: ` +
      `${assignment.name} — ` +
      `${formattedDate}`;

    output.appendChild(item);
  });
}