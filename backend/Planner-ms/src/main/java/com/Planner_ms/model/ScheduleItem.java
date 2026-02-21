package com.Planner_ms.model;

public class ScheduleItem {
    private String type; // "study" or "break"
    private String startTime;
    private int durationMinutes;

    // study-only fields
    private String subjectId;
    private String subjectName;
    private int priority;

    public static ScheduleItem study(String startTime, int duration, Subject s) {
        ScheduleItem item = new ScheduleItem();
        item.type = "study";
        item.startTime = startTime;
        item.durationMinutes = duration;
        item.subjectId = s.getId();
        item.subjectName = s.getName();
        item.priority = s.getPriority();
        return item;
    }

    public static ScheduleItem brk(String startTime, int duration) {
        ScheduleItem item = new ScheduleItem();
        item.type = "break";
        item.startTime = startTime;
        item.durationMinutes = duration;
        return item;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public String getSubjectId() { return subjectId; }
    public void setSubjectId(String subjectId) { this.subjectId = subjectId; }

    public String getSubjectName() { return subjectName; }
    public void setSubjectName(String subjectName) { this.subjectName = subjectName; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
}