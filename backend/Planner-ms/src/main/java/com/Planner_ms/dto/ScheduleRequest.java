package com.Planner_ms.dto;

public class ScheduleRequest {
    private String startTime;
    private double dailyMaxHours;
    private int breakEveryMinutes;
    private int breakDurationMinutes;

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public double getDailyMaxHours() { return dailyMaxHours; }
    public void setDailyMaxHours(double dailyMaxHours) { this.dailyMaxHours = dailyMaxHours; }

    public int getBreakEveryMinutes() { return breakEveryMinutes; }
    public void setBreakEveryMinutes(int breakEveryMinutes) { this.breakEveryMinutes = breakEveryMinutes; }

    public int getBreakDurationMinutes() { return breakDurationMinutes; }
    public void setBreakDurationMinutes(int breakDurationMinutes) { this.breakDurationMinutes = breakDurationMinutes; }
}