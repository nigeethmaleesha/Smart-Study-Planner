package com.Planner_ms.ds;

import com.Planner_ms.model.Subject;

import java.util.ArrayList;
import java.util.List;

public class MaxHeap {
    private final List<Subject> heap = new ArrayList<>();

    public void clear() { heap.clear(); }
    public boolean isEmpty() { return heap.isEmpty(); }
    public int size() { return heap.size(); }
    public List<Subject> asArray() { return new ArrayList<>(heap); }

    private int parent(int i) { return (i - 1) / 2; }
    private int left(int i) { return 2 * i + 1; }
    private int right(int i) { return 2 * i + 2; }

    // Higher = bigger priority, tie-break = remaining topics
    private boolean higher(Subject a, Subject b) {
        if (a.getPriority() != b.getPriority()) return a.getPriority() > b.getPriority();
        return a.remainingTopics() > b.remainingTopics();
    }

    public void insert(Subject s) {
        heap.add(s);
        siftUp(heap.size() - 1);
    }

    public Subject peekMax() {
        return heap.isEmpty() ? null : heap.get(0);
    }

    public Subject extractMax() {
        if (heap.isEmpty()) return null;
        Subject max = heap.get(0);
        Subject last = heap.remove(heap.size() - 1);
        if (!heap.isEmpty()) {
            heap.set(0, last);
            siftDown(0);
        }
        return max;
    }

    private void siftUp(int i) {
        while (i > 0 && higher(heap.get(i), heap.get(parent(i)))) {
            swap(i, parent(i));
            i = parent(i);
        }
    }

    private void siftDown(int i) {
        while (true) {
            int l = left(i), r = right(i);
            int best = i;

            if (l < heap.size() && higher(heap.get(l), heap.get(best))) best = l;
            if (r < heap.size() && higher(heap.get(r), heap.get(best))) best = r;

            if (best == i) break;
            swap(i, best);
            i = best;
        }
    }

    private void swap(int i, int j) {
        Subject tmp = heap.get(i);
        heap.set(i, heap.get(j));
        heap.set(j, tmp);
    }
}
