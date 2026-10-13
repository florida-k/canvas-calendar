package com.canvascalendar.backend.model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "assignment_metadata",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"course_id", "assignment_id"})
    }
)
public class AssignmentMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "course_id", nullable = false)
    private String courseId;

    @Column(name = "assignment_id", nullable = false)
    private String assignmentId;

    private String priority;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    private String notes;

    // Required by JPA/Hibernate
    public AssignmentMetadata() {
    }

    public AssignmentMetadata(
            String courseId,
            String assignmentId,
            String priority,
            Integer estimatedMinutes,
            String notes) {

        this.courseId = courseId;
        this.assignmentId = assignmentId;
        this.priority = priority;
        this.estimatedMinutes = estimatedMinutes;
        this.notes = notes;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCourseId() {
        return courseId;
    }

    public void setCourseId(String courseId) {
        this.courseId = courseId;
    }

    public String getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(String assignmentId) {
        this.assignmentId = assignmentId;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public void setEstimatedMinutes(Integer estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}