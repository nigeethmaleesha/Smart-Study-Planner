package com.Planner_ms.controller;

import com.Planner_ms.dto.ScheduleRequest;
import com.Planner_ms.model.ScheduleItem;
import com.Planner_ms.model.Subject;
import com.Planner_ms.services.PlannerService;
import org.springframework.http.ResponseEntity;
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

    // -------- Subjects --------
    @GetMapping("/subjects")
    public List<Subject> getSubjects() {
        return service.listSubjects();
    }

    @PostMapping("/subjects")
    public Subject addSubject(@RequestBody Subject s) {
        return service.addSubject(s);
    }

    @PutMapping("/subjects/{id}")
    public ResponseEntity<Subject> update(@PathVariable String id, @RequestBody Subject s) {
        Subject updated = service.updateSubject(id, s);
        if (updated == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/subjects/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        boolean ok = service.deleteSubject(id);
        return ok ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    // -------- Schedule --------
    @PostMapping("/schedule/generate")
    public List<ScheduleItem> generate(@RequestBody ScheduleRequest req) {
        return service.generateSchedule(req);
    }

    // -------- Missed --------
    @PostMapping("/missed/{id}")
    public ResponseEntity<Void> missed(@PathVariable String id) {
        service.markMissed(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/missed")
    public List<String> missedList() {
        return service.missedList();
    }
}