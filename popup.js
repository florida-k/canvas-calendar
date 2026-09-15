document
  .getElementById("loadAssignments")
  .addEventListener("click", async () => {
    const output = document.getElementById("output");

    output.textContent = "Loading assignments...";

    try {
      // 1. Get the user's active Canvas courses
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

      // 2. Get assignments for every active course
      const assignmentRequests = courses.map(async (course) => {
        const response = await fetch(
          `https://ufl.instructure.com/api/v1/courses/${course.id}/assignments?per_page=100`,
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

        // Add the course name to each assignment
        return assignments.map((assignment) => ({
          ...assignment,
          course_name: course.name
        }));
      });

      // 3. Wait for all course requests
      const assignmentsByCourse = await Promise.all(
        assignmentRequests
      );

      // 4. Combine them into one array
      const allAssignments = assignmentsByCourse.flat();

      console.log("All assignments:", allAssignments);

      // 5. Display the assignments
      output.innerHTML = "";

      if (allAssignments.length === 0) {
        output.textContent = "No assignments found.";
        return;
      }

      allAssignments.forEach((assignment) => {
        const item = document.createElement("p");

        item.textContent =
          `${assignment.course_name}: ${assignment.name} - ` +
          `${assignment.due_at ?? "No due date"}`;

        output.appendChild(item);
      });
    } catch (error) {
      console.error(error);
      output.textContent = `Error: ${error.message}`;
    }
  });