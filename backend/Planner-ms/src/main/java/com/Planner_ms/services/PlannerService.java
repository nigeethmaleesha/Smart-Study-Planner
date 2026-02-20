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

    // ✅ Score based on priority + remaining + completion ratio
    private double score(Subject s) {
        int remaining = s.remainingTopics();
        int total = Math.max(1, s.getTotalTopics());
        double completionRatio = (double) s.getCompletedTopics() / total; // 0..1

        // weights you can tune
        double wPriority = 100.0;
        double wRemaining = 10.0;
        double wNotDone = 80.0; // encourages subjects not yet completed

        return (s.getPriority() * wPriority)
                + (remaining * wRemaining)
                + ((1.0 - completionRatio) * wNotDone);
    }

    // ---- SCHEDULE GENERATION (CLL fairness + Heap selection) ----
    public List<ScheduleItem> generateSchedule(ScheduleRequest req) {

        String startTime = (req.getStartTime() == null || req.getStartTime().isBlank()) ? "08:00" : req.getStartTime();

        double dailyMaxHours = req.getDailyMaxHours();
        if (dailyMaxHours <= 0) dailyMaxHours = 2;

        int breakEvery = req.getBreakEveryMinutes();
        if (breakEvery < 15) breakEvery = 50;

        int breakDuration = req.getBreakDurationMinutes();
        if (breakDuration < 5) breakDuration = 10;

        if (store.cll.isEmpty()) return new ArrayList<>();

        int totalMinutes = (int) Math.round(dailyMaxHours * 60.0);
        int remainingMinutes = totalMinutes;

        int sinceBreak = 0;
        String timeCursor = startTime;

        List<ScheduleItem> out = new ArrayList<>();

        // window size (how many rotating subjects to consider each study block)
        int windowSize = Math.min(3, Math.max(1, store.cll.size()));

        int guard = 0;
        int guardMax = 3000;

        while (remainingMinutes > 0) {
            if (guard++ > guardMax) break;

            // breaks
            if (sinceBreak >= breakEvery && remainingMinutes > 0) {
                int bd = Math.min(breakDuration, remainingMinutes);
                if (bd <= 0) bd = 5;
                out.add(ScheduleItem.brk(timeCursor, bd));
                timeCursor = addMinutes(timeCursor, bd);
                remainingMinutes -= bd;
                sinceBreak = 0;
                continue;
            }

            // ✅ pick next study subject fairly:
            // 1) get rotating window from CLL
            // 2) push window into heap
            // 3) extract best by score
            store.heap.clear();
            List<Subject> window = store.cll.nextSubjectsWindow(windowSize);

            // insert only subjects with remaining topics
            for (Subject s : window) {
                if (s.remainingTopics() > 0) store.heap.insert(s);
            }

            Subject chosen = null;
            Subject best = null;

            // extract max by our custom logic: we will manually scan heap array by score
            // (since heap comparator is by priority; we want score now)
            List<Subject> candidates = store.heap.asArray();
            if (!candidates.isEmpty()) {
                best = candidates.get(0);
                double bestScore = score(best);
                for (Subject c : candidates) {
                    double sc = score(c);
                    if (sc > bestScore) {
                        bestScore = sc;
                        best = c;
                    }
                }
                chosen = best;
            }

            if (chosen == null) break;

            int subjectDuration = chosen.getDurationMinutes();
            if (subjectDuration <= 0) subjectDuration = 30;

            int study = Math.min(subjectDuration, remainingMinutes);
            if (study <= 0) break;

            out.add(ScheduleItem.study(timeCursor, study, chosen));
            timeCursor = addMinutes(timeCursor, study);
            remainingMinutes -= study;
            sinceBreak += study;

            // ✅ move CLL current close to next after chosen (better rotation)
            store.cll.setCurrentById(chosen.getId());
            store.cll.next(); // advance once after chosen
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

    // ---- MISSED ----
    public void markMissed(String subjectId) {
        store.missed.add(subjectId);
    }

    public List<String> missedList() {
        return store.missed;
    }
}