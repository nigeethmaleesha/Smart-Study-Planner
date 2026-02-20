package com.Planner_ms.ds;

import com.Planner_ms.model.Subject;

import java.util.ArrayList;
import java.util.List;

public class CircularLinkedList {
    private CLLNode head, tail, current;
    private int size = 0;

    public boolean isEmpty() { return head == null; }
    public int size() { return size; }

    public void add(Subject s) {
        CLLNode n = new CLLNode(s);
        if (isEmpty()) {
            head = tail = n;
            n.next = head;
            current = head;
        } else {
            tail.next = n;
            tail = n;
            tail.next = head;
        }
        size++;
    }

    public Subject getCurrent() {
        return current == null ? null : current.data;
    }

    public Subject next() {
        if (current == null) return null;
        current = current.next;
        return current.data;
    }

    public Subject findById(String id) {
        if (isEmpty()) return null;
        CLLNode t = head;
        do {
            if (t.data.getId().equals(id)) return t.data;
            t = t.next;
        } while (t != head);
        return null;
    }

    public boolean removeById(String id) {
        if (isEmpty()) return false;
        CLLNode prev = tail;
        CLLNode t = head;

        do {
            if (t.data.getId().equals(id)) {
                if (t == head && t == tail) {
                    head = tail = current = null;
                    size = 0;
                    return true;
                }
                if (t == head) {
                    head = head.next;
                    tail.next = head;
                } else if (t == tail) {
                    tail = prev;
                    tail.next = head;
                } else {
                    prev.next = t.next;
                }
                if (current == t) current = t.next;
                size--;
                return true;
            }
            prev = t;
            t = t.next;
        } while (t != head);

        return false;
    }

    public List<Subject> toList() {
        List<Subject> out = new ArrayList<>();
        if (isEmpty()) return out;
        CLLNode t = head;
        do {
            out.add(t.data);
            t = t.next;
        } while (t != head);
        return out;
    }
}
