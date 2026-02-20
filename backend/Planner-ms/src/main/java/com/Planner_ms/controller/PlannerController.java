package com.Planner_ms.controller;

import com.Planner_ms.dto.ScheduleRequest;
import com.Planner_ms.model.ScheduleItem;
import com.Planner_ms.model.Subject;
import com.Planner_ms.services.PlannerService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class PlannerController {

    private final PlannerService service;

    public PlannerController(PlannerService service) {
        this.service = service;
    }

    // ---- Subjects ----
    @PostMapping("/subjects")
    public Subject addSubject(@RequestBody Subject s) {
        return service.addSubject(s);
    }

    @GetMapping("/subjects")
    public List<Subject> listSubjects() {
        return service.listSubjects();
    }

    @PutMapping("/subjects/{id}")
    public Subject updateSubject(@PathVariable String id, @RequestBody Subject patch) {
        return service.updateSubject(id, patch);
    }

    @DeleteMapping("/subjects/{id}")
    public String delete(@PathVariable String id) {
        return service.deleteSubject(id) ? "Deleted" : "Not found";
    }

    // ---- Transfer / Heap ----
    @PostMapping("/transfer/cll-to-heap")
    public List<Subject> transferToHeapArray() {
        return service.transferToHeapArray();
    }

    @GetMapping("/heap")
    public List<Subject> heapArray() {
        return service.heapArray();
    }

    // ---- Schedule ----
    @PostMapping("/schedule/generate")
    public List<ScheduleItem> generate(@RequestBody ScheduleRequest req) {
        return service.generateSchedule(req);
    }

    // ---- Missed ----
    @PostMapping("/missed/{subjectId}")
    public String missed(@PathVariable String subjectId) {
        service.markMissed(subjectId);
        return "Marked missed";
    }

    @GetMapping("/missed")
    public List<String> missedList() {
        return service.missedList();
    }
}
