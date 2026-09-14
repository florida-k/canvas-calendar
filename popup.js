document
  .getElementById("loadAssignments")
  .addEventListener("click", async () => {
    const output = document.getElementById("output");

    output.textContent = "Loading...";

    try {
      const response = await fetch(
        "https://ufl.instructure.com/api/v1/courses/542201/assignments?per_page=50",
        {
          credentials: "include"
        }
      );

      console.log("Status:", response.status);

      const assignments = await response.json();

      console.log(assignments);

      output.innerHTML = "";

      assignments.forEach((assignment) => {
        const item = document.createElement("p");

        item.textContent =
          `${assignment.name}:  ${assignment.due_at ?? "No due date"}`;

        output.appendChild(item);
      });

    } catch (error) {
      console.error(error);
      output.textContent = `Error: ${error.message}`;
    }
  });
