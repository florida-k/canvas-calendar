package com.canvascalendar.backend.controller;

import com.canvascalendar.backend.model.AssignmentMetadata;
import com.canvascalendar.backend.repository.AssignmentMetadataRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments")
public class AssignmentMetadataController {

    private final AssignmentMetadataRepository repository;

    public AssignmentMetadataController(
            AssignmentMetadataRepository repository) {
        this.repository = repository;
    }

    @PutMapping("/{courseId}/{assignmentId}")
    public AssignmentMetadata updateMetadata(
            @PathVariable String courseId,
            @PathVariable String assignmentId,
            @RequestBody AssignmentMetadata metadata) {

        AssignmentMetadata saved = repository
                .findByCourseIdAndAssignmentId(courseId, assignmentId)
                .orElseGet(AssignmentMetadata::new);

        saved.setCourseId(courseId);
        saved.setAssignmentId(assignmentId);
        saved.setPriority(metadata.getPriority());
        saved.setEstimatedMinutes(metadata.getEstimatedMinutes());
        saved.setNotes(metadata.getNotes());

        return repository.save(saved);
    }

    @GetMapping("/{courseId}/{assignmentId}")
    public ResponseEntity<AssignmentMetadata> getMetadata(
            @PathVariable String courseId,
            @PathVariable String assignmentId) {

        return repository
                .findByCourseIdAndAssignmentId(courseId, assignmentId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
