package com.Planner_ms.data;

import com.Planner_ms.ds.CircularLinkedList;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

@Component
public class PlannerStore {
    public final CircularLinkedList cll = new CircularLinkedList();

    // keeps missed IDs without duplicates (in insertion order)
    public final Set<String> missed = new LinkedHashSet<>();
}