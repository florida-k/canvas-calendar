package com.canvascalendar.backend.model;

public class AssignmentMetadata {

    private String courseId;
    private String assignmentId;
    private String priority;
    private Integer estimatedMinutes;
    private String notes;

    public AssignmentMetadata() {
    }

    public AssignmentMetadata(String courseId, String assignmentId,
                              String priority, Integer estimatedMinutes,
                              String notes) {
        this.courseId = courseId;
        this.assignmentId = assignmentId;
        this.priority = priority;
        this.estimatedMinutes = estimatedMinutes;
        this.notes = notes;
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