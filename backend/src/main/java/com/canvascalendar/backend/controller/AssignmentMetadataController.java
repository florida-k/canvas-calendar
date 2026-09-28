package com.canvascalendar.backend.controller;

import com.canvascalendar.backend.model.AssignmentMetadata;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentMetadataController {

    @PutMapping("/{courseId}/{assignmentId}")
    public AssignmentMetadata updateMetadata(
            @PathVariable String courseId,
            @PathVariable String assignmentId,
            @RequestBody AssignmentMetadata metadata) {

        metadata.setCourseId(courseId);
        metadata.setAssignmentId(assignmentId);

        return metadata;
    }
}