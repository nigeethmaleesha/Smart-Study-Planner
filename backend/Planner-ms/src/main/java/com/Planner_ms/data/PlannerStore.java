package com.Planner_ms.data;

import com.Planner_ms.ds.CircularLinkedList;
import com.Planner_ms.ds.MaxHeap;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class PlannerStore {
    public final CircularLinkedList cll = new CircularLinkedList();
    public final MaxHeap heap = new MaxHeap();
    public final List<String> missed = new ArrayList<>();
}
