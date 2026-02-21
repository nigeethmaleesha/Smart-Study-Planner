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

    // ---------------- SUBJECTS ----------------

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

    public Subject updateSubject(String id, Subject patch) {
        Subject s = store.cll.findById(id);
        if (s == null) return null;

        if (patch.getName() != null) s.setName(patch.getName());
        s.setDurationMinutes(patch.getDurationMinutes());
        s.setPriority(patch.getPriority());
        s.setTotalTopics(patch.getTotalTopics());
        s.setCompletedTopics(patch.getCompletedTopics());
        s.setTargetDate(patch.getTargetDate());

        // if completed, remove from missed list
        if (s.remainingTopics() <= 0) {
            store.missed.remove(id);
        }

        return s;
    }

    public boolean deleteSubject(String id) {
        store.missed.remove(id);
        return store.cll.removeById(id);
    }

    // ---------------- MISSED ----------------

    public void markMissed(String subjectId) {
        Subject s = store.cll.findById(subjectId);
        if (s == null) return;
        if (s.remainingTopics() <= 0) return; // don’t mark completed as missed

        store.missed.add(subjectId);
    }

    public List<String> missedList() {
        return new ArrayList<>(store.missed);
    }

    // ---------------- SCHEDULE (CLL ONLY) ----------------

    public List<ScheduleItem> generateSchedule(ScheduleRequest req) {
        if (store.cll.isEmpty()) return new ArrayList<>();

        // Defaults + validation
        String startTime = (req.getStartTime() == null || req.getStartTime().isBlank())
                ? "08:00" : req.getStartTime();

        double dailyMaxHours = req.getDailyMaxHours();
        if (dailyMaxHours <= 0) dailyMaxHours = 2;

        int breakEvery = req.getBreakEveryMinutes();
        if (breakEvery < 15) breakEvery = 50;

        int breakDuration = req.getBreakDurationMinutes();
        if (breakDuration < 5) breakDuration = 10;

        // Clean missed list (remove deleted/completed subjects)
        store.missed.removeIf(id -> {
            Subject x = store.cll.findById(id);
            return x == null || x.remainingTopics() <= 0;
        });

        int remainingMinutes = (int) Math.round(dailyMaxHours * 60.0);
        String timeCursor = startTime;
        int sinceBreak = 0;

        List<ScheduleItem> out = new ArrayList<>();

        // Guard prevents infinite loop
        int guard = 0;
        int guardMax = 3000;

        while (remainingMinutes > 0 && guard++ < guardMax) {

            // Add break if needed
            if (sinceBreak >= breakEvery) {
                int bd = Math.min(breakDuration, remainingMinutes);
                out.add(ScheduleItem.brk(timeCursor, bd));
                timeCursor = addMinutes(timeCursor, bd);
                remainingMinutes -= bd;
                sinceBreak = 0;
                continue;
            }

            Subject chosen = pickNextSubjectCLL();
            if (chosen == null) break;

            int dur = chosen.getDurationMinutes();
            if (dur <= 0) dur = 30;

            int study = Math.min(dur, remainingMinutes);
            if (study <= 0) break;

            out.add(ScheduleItem.study(timeCursor, study, chosen));

            timeCursor = addMinutes(timeCursor, study);
            remainingMinutes -= study;
            sinceBreak += study;

            // Once scheduled, remove from missed (so it doesn’t keep repeating forever)
            store.missed.remove(chosen.getId());

            // Rotate circular list forward
            store.cll.next();
        }

        return out;
    }

    /**
     * Practical CLL picker:
     * 1) Missed subjects first (reinsert soon)
     * 2) Otherwise follow normal circular rotation
     * 3) Skip completed subjects
     */
    private Subject pickNextSubjectCLL() {
        List<Subject> all = store.cll.toList();
        if (all.isEmpty()) return null;

        // 1) missed first
        for (String id : store.missed) {
            Subject m = store.cll.findById(id);
            if (m != null && m.remainingTopics() > 0) {
                store.cll.setCurrentById(id);
                return m;
            }
        }

        // 2) normal rotation
        Subject current = store.cll.getCurrent(); // ✅ your CLL method name
        int tries = 0;

        while (current != null && current.remainingTopics() <= 0 && tries++ < all.size()) {
            store.cll.next();
            current = store.cll.getCurrent();
        }

        return current;
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
}