package com.Planner_ms.model;

public class ScheduleItem {
    private String type;            // "study" or "break"
    private String startTime;       // "HH:mm"
    private int durationMinutes;

    // study fields
    private String subjectId;
    private String subjectName;
    private int priority;

    public ScheduleItem() {}

    public static ScheduleItem study(String startTime, int duration, Subject s) {
        ScheduleItem it = new ScheduleItem();
        it.type = "study";
        it.startTime = startTime;
        it.durationMinutes = duration;
        it.subjectId = s.getId();
        it.subjectName = s.getName();
        it.priority = s.getPriority();
        return it;
    }

    public static ScheduleItem brk(String startTime, int duration) {
        ScheduleItem it = new ScheduleItem();
        it.type = "break";
        it.startTime = startTime;
        it.durationMinutes = duration;
        return it;
    }

    // getters/setters
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