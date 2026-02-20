package com.Planner_ms.services;

import com.Planner_ms.data.PlannerStore;
import com.Planner_ms.dto.ScheduleRequest;
import com.Planner_ms.model.ScheduleItem;
import com.Planner_ms.model.Subject;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PlannerService {

    private final PlannerStore store;

    public PlannerService(PlannerStore store) {
        this.store = store;
    }

    // ---- SUBJECTS (CLL) ----
    public Subject addSubject(Subject s) {
        if (s.getId() == null || s.getId().isBlank()) {
            s.setId(UUID.randomUUID().toString());
        }
        store.cll.add(s);
        return s;
    }

    public List<Subject> listSubjects() {
        return store.cll.toList();
    }

    public boolean deleteSubject(String id) {
        return store.cll.removeById(id);
    }

    public Subject updateSubject(String id, Subject patch) {
        Subject s = store.cll.findById(id);
        if (s == null) return null;

        s.setName(patch.getName());
        s.setDurationMinutes(patch.getDurationMinutes());
        s.setPriority(patch.getPriority());
        s.setTotalTopics(patch.getTotalTopics());
        s.setCompletedTopics(patch.getCompletedTopics());
        s.setTargetDate(patch.getTargetDate());
        return s;
    }

    // ---- TRANSFER CLL -> HEAP ----
    public List<Subject> transferToHeapArray() {
        store.heap.clear();
        for (Subject s : store.cll.toList()) {
            store.heap.insert(s);
        }
        return store.heap.asArray();
    }

    public List<Subject> heapArray() {
        return store.heap.asArray();
    }

    // ---- SCHEDULE GENERATION (Heap priority + breaks) ----
    public List<ScheduleItem> generateSchedule(ScheduleRequest req) {

        // ✅ SAFETY DEFAULTS (prevents empty schedule / infinite loops)
        String startTime = (req.getStartTime() == null || req.getStartTime().isBlank()) ? "08:00" : req.getStartTime();

        double dailyMaxHours = req.getDailyMaxHours();
        if (dailyMaxHours <= 0) dailyMaxHours = 2; // default 2 hours

        int breakEvery = req.getBreakEveryMinutes();
        if (breakEvery < 15) breakEvery = 50; // default 50 mins

        int breakDuration = req.getBreakDurationMinutes();
        if (breakDuration < 5) breakDuration = 10; // default 10 mins

        // ✅ if no subjects in backend, return empty
        if (store.cll.isEmpty()) return new ArrayList<>();

        // build heap fresh each time (transfer)
        transferToHeapArray();

        int totalMinutes = (int) Math.round(dailyMaxHours * 60.0);
        int remaining = totalMinutes;

        int sinceBreak = 0;
        String timeCursor = startTime;

        List<ScheduleItem> out = new ArrayList<>();

        // ✅ HARD GUARD: prevent infinite loop
        int guard = 0;
        int guardMax = 2000;

        while (remaining > 0 && !store.heap.isEmpty()) {

            if (guard++ > guardMax) break;

            // break rule
            if (sinceBreak >= breakEvery && remaining > 0) {
                int bd = Math.min(breakDuration, remaining);

                // ✅ must reduce time
                if (bd <= 0) bd = 5;

                out.add(ScheduleItem.brk(timeCursor, bd));
                timeCursor = addMinutes(timeCursor, bd);
                remaining -= bd;
                sinceBreak = 0;
                continue;
            }

            Subject top = store.heap.extractMax();
            if (top == null) break;

            int subjectDuration = top.getDurationMinutes();
            if (subjectDuration <= 0) subjectDuration = 30; // default

            int study = Math.min(subjectDuration, remaining);

            // ✅ must reduce time
            if (study <= 0) break;

            out.add(ScheduleItem.study(timeCursor, study, top));
            timeCursor = addMinutes(timeCursor, study);
            remaining -= study;
            sinceBreak += study;

            // put back into heap to allow repeating (tool behavior)
            store.heap.insert(top);
        }

        return out;
    }

    private String addMinutes(String hhmm, int mins) {
        String[] p = hhmm.split(":");
        int h = Integer.parseInt(p[0]);
        int m = Integer.parseInt(p[1]);
        int total = h * 60 + m + mins;
        int nh = (total / 60) % 24;
        int nm = total % 60;
        return String.format("%02d:%02d", nh, nm);
    }

    // ---- MISSED (simple) ----
    public void markMissed(String subjectId) {
        store.missed.add(subjectId);
    }

    public List<String> missedList() {
        return store.missed;
    }
}