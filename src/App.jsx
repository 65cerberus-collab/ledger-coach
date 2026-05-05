import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, X, Users, Dumbbell, Calendar, ChevronRight, ChevronLeft,
  Check, Circle, AlertTriangle, Filter, Trash2, GripVertical, Edit3,
  Activity, Target, LayoutGrid, BookOpen, Clock, ArrowUpRight,
  MoreHorizontal, Copy, FileText, TrendingUp, ArrowRight, Minus,
  Archive, ArchiveRestore, HelpCircle, LogOut
} from "lucide-react";
import { load, save, SCHEMA_VERSION } from "./storageService";
import { supabase } from './lib/supabase.js';
import { useSession } from './auth/useSession.js';
import { useCoaches } from './hooks/useCoaches.js';

/* ============================================================
   STYLES — injected once at mount
   ============================================================ */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,400..700&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --paper: #F4EFE6;
      --paper-2: #EDE6D8;
      --card: #FFFFFF;
      --ink: #16140F;
      --ink-2: #3B342A;
      --muted: #8A7F6F;
      --line: #D9CFBC;
      --line-2: #E6DDCB;
      --accent: #D9401C;
      --accent-soft: #F9E3DB;
      --good: #2E6F48;
      --warn: #B7791F;
      --danger: #B43D2F;
    }
    html, body, #root { height: 100%; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: 'Instrument Sans', system-ui, sans-serif;
      font-feature-settings: "ss01", "cv11";
      -webkit-font-smoothing: antialiased;
      letter-spacing: -0.005em;
    }
    .display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.022em; }
    .mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: "ss01"; }
    .tabular { font-variant-numeric: tabular-nums; }

    .hover-lift { transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease; }
    .hover-lift:hover { transform: translateY(-1px); }

    .dot { width: 6px; height: 6px; border-radius: 999px; display: inline-block; }

    /* subtle paper texture */
    .paper-grain {
      background-image:
        radial-gradient(rgba(22,20,15,0.025) 1px, transparent 1px),
        radial-gradient(rgba(22,20,15,0.018) 1px, transparent 1px);
      background-size: 3px 3px, 7px 7px;
      background-position: 0 0, 1px 2px;
    }

    /* custom scrollbar */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #D9CFBC; border-radius: 999px; border: 2px solid var(--paper); }
    ::-webkit-scrollbar-thumb:hover { background: #B8AD96; }

    input, textarea, select, button { font-family: inherit; }
    input:focus, textarea:focus, select:focus { outline: none; }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 10px; font-weight: 500;
      font-size: 14px; transition: all .15s ease; cursor: pointer;
      border: 1px solid transparent; user-select: none;
    }
    .btn-primary { background: var(--ink); color: var(--paper); }
    .btn-primary:hover { background: #2A2619; }
    .btn-accent { background: var(--accent); color: #fff; }
    .btn-accent:hover { background: #BA3315; }
    .btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
    .btn-ghost:hover { background: var(--paper-2); }
    .btn-sm { padding: 6px 11px; font-size: 13px; border-radius: 8px; }

    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 999px; font-size: 12px;
      background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--line-2);
      font-weight: 500; letter-spacing: 0.01em;
    }
    .chip-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
    .chip-warn { background: #FBEAC7; color: #7A5313; border-color: #EED59A; }
    .chip-accent { background: var(--accent-soft); color: var(--accent); border-color: #EBBEAF; }

    .field {
      width: 100%; padding: 10px 12px; border-radius: 9px;
      background: #fff; border: 1px solid var(--line);
      font-size: 14px; color: var(--ink);
    }
    .field:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(22,20,15,0.08); }

    .card {
      background: var(--card); border: 1px solid var(--line-2);
      border-radius: 16px;
    }

    .divider { height: 1px; background: var(--line-2); border: 0; }

    .tag-dot-push   { background: #C14A36; }
    .tag-dot-pull   { background: #2F6B7A; }
    .tag-dot-squat  { background: #7A5213; }
    .tag-dot-hinge  { background: #3A5F2A; }
    .tag-dot-core   { background: #6B4A7E; }
    .tag-dot-cardio { background: #8A3D5E; }
    .tag-dot-mobility { background: #497A88; }
    .tag-dot-stretch { background: #9B6D2F; }

    .ring-focus:focus { box-shadow: 0 0 0 3px rgba(217,64,28,0.18); }

    .slide-in { animation: slide 220ms cubic-bezier(.2,.7,.2,1); }
    @keyframes slide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    .grow-in { animation: grow 200ms ease; }
    @keyframes grow { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: scale(1); } }

    .tick { animation: tick 240ms cubic-bezier(.3,1.4,.5,1); }
    @keyframes tick { 0% { transform: scale(.6); opacity: .3; } 100% { transform: scale(1); opacity: 1; } }
  `}</style>
);

const uid = (p = "id") => p + "_" + Math.random().toString(36).slice(2, 9);

/* ============================================================
   UNIT HELPERS — internal canonical storage is lb (weight) and in (length)
   ============================================================ */
const LB_PER_KG = 2.20462;
const toDisplay = (lb, unit) => {
  if (lb == null || lb === "" || isNaN(Number(lb))) return "";
  const n = Number(lb);
  if (unit === "kg") return Math.round((n / LB_PER_KG) * 10) / 10;
  return Math.round(n * 10) / 10;
};
const fromDisplay = (value, unit) => {
  if (value == null || value === "" || isNaN(Number(value))) return 0;
  const n = Number(value);
  if (unit === "kg") return Math.round(n * LB_PER_KG * 100) / 100;
  return Math.round(n * 100) / 100;
};
const unitLabel = (unit) => unit === "lb" ? "lbs" : "kg";

const CM_PER_IN = 2.54;
const toDisplayLen = (inches, unit) => {
  if (inches == null || inches === "" || isNaN(Number(inches))) return "";
  const n = Number(inches);
  if (unit === "cm") return Math.round(n * CM_PER_IN * 10) / 10;
  return Math.round(n * 10) / 10;
};
const fromDisplayLen = (value, unit) => {
  if (value == null || value === "" || isNaN(Number(value))) return 0;
  const n = Number(value);
  if (unit === "cm") return Math.round((n / CM_PER_IN) * 100) / 100;
  return Math.round(n * 100) / 100;
};
const lenLabel = (unit) => unit === "in" ? "in" : "cm";

/* ============================================================
   SEED DATA
   ============================================================ */
const E = (name, movement, muscles, equipment, difficulty, tags, contraindications, defSets, defReps, defRest, notes = "") =>
  ({ id: uid("ex"), name, movement, muscles, equipment, difficulty, tags, contraindications, defSets, defReps, defRest, notes });

const SEED_EXERCISES = [
  // ── SQUAT ────────────────────────────────────────────────
  E("Back Squat", "squat", ["quads","glutes"], ["barbell","rack"], "intermediate", ["compound","lower"], ["knee injury"], 4, "5", 180, "Brace, depth to parallel."),
  E("Front Squat", "squat", ["quads","core"], ["barbell","rack"], "advanced", ["compound","lower"], ["wrist injury","knee injury"], 4, "5", 180, "Elbows up, upright torso."),
  E("Goblet Squat", "squat", ["quads","glutes"], ["dumbbell","kettlebell"], "beginner", ["compound","lower","beginner-friendly"], [], 3, "10", 90, "Elbows inside knees."),
  E("Box Squat", "squat", ["quads","glutes"], ["barbell","rack"], "intermediate", ["compound","lower"], [], 4, "5", 180, "Sit back to box, no collapse."),
  E("Pause Squat", "squat", ["quads","glutes"], ["barbell","rack"], "advanced", ["compound","lower"], ["knee injury"], 4, "4", 210, "3-count pause at bottom."),
  E("Safety Bar Squat", "squat", ["quads","glutes","upper-back"], ["safety-bar","rack"], "intermediate", ["compound","lower"], [], 4, "6", 180, "Shoulder-friendly alternative."),
  E("Zercher Squat", "squat", ["quads","glutes","core"], ["barbell"], "advanced", ["compound","lower"], ["elbow injury"], 3, "6", 150, "Bar in crooks of elbows."),
  E("Hack Squat (Machine)", "squat", ["quads"], ["machine"], "beginner", ["lower"], [], 3, "10", 90),
  E("Leg Press", "squat", ["quads","glutes"], ["machine"], "beginner", ["lower","beginner-friendly"], [], 3, "12", 90),
  E("Walking Lunge", "squat", ["quads","glutes"], ["dumbbell","bodyweight"], "beginner", ["unilateral","lower"], ["knee injury"], 3, "12/leg", 75),
  E("Reverse Lunge", "squat", ["quads","glutes"], ["dumbbell","bodyweight"], "beginner", ["unilateral","lower"], [], 3, "10/leg", 75, "Knee-friendly lunge variant."),
  E("Lateral Lunge", "squat", ["adductors","glutes"], ["dumbbell","bodyweight"], "beginner", ["unilateral","lower"], [], 3, "8/leg", 60),
  E("Curtsy Lunge", "squat", ["glutes","adductors"], ["dumbbell","bodyweight"], "intermediate", ["unilateral","lower"], ["knee injury"], 3, "10/leg", 60),
  E("Bulgarian Split Squat", "squat", ["quads","glutes"], ["dumbbell","bench"], "intermediate", ["unilateral","lower"], ["knee injury"], 3, "8/leg", 90),
  E("Split Squat", "squat", ["quads","glutes"], ["dumbbell","bodyweight"], "beginner", ["unilateral","lower"], [], 3, "10/leg", 75),
  E("Step-up", "squat", ["quads","glutes"], ["dumbbell","bench"], "beginner", ["unilateral","lower"], [], 3, "10/leg", 60),
  E("Pistol Squat", "squat", ["quads","glutes"], ["bodyweight"], "advanced", ["unilateral","bodyweight"], ["knee injury"], 3, "5/leg", 90),
  E("Cossack Squat", "squat", ["quads","adductors"], ["bodyweight","kettlebell"], "intermediate", ["unilateral","mobility"], [], 3, "6/side", 60),
  E("Wall Sit", "squat", ["quads"], ["bodyweight"], "beginner", ["isometric","lower"], ["knee injury"], 3, "45s", 60),
  E("Jump Squat", "squat", ["quads","glutes"], ["bodyweight"], "intermediate", ["power","lower"], ["knee injury"], 3, "8", 90),

  // ── HINGE ────────────────────────────────────────────────
  E("Conventional Deadlift", "hinge", ["hamstrings","glutes","back"], ["barbell"], "advanced", ["compound","posterior"], ["low back injury","disc issue"], 4, "5", 180),
  E("Sumo Deadlift", "hinge", ["glutes","quads","back"], ["barbell"], "advanced", ["compound","posterior"], ["low back injury","hip injury"], 4, "5", 180),
  E("Romanian Deadlift", "hinge", ["hamstrings","glutes"], ["barbell","dumbbell"], "intermediate", ["posterior","hinge"], ["low back injury"], 3, "8", 120),
  E("Stiff-Leg Deadlift", "hinge", ["hamstrings"], ["barbell","dumbbell"], "intermediate", ["posterior"], ["low back injury"], 3, "8", 120),
  E("Single-Leg RDL", "hinge", ["hamstrings","glutes"], ["dumbbell","kettlebell"], "intermediate", ["unilateral","posterior"], [], 3, "8/leg", 75),
  E("Trap Bar Deadlift", "hinge", ["hamstrings","glutes","quads"], ["trap-bar"], "intermediate", ["compound","posterior","beginner-friendly"], [], 4, "6", 150, "Easier on lower back."),
  E("Deficit Deadlift", "hinge", ["hamstrings","glutes"], ["barbell"], "advanced", ["posterior"], ["low back injury"], 3, "5", 180),
  E("Rack Pull", "hinge", ["back","glutes"], ["barbell","rack"], "intermediate", ["posterior","accessory"], [], 3, "6", 150),
  E("Good Morning", "hinge", ["hamstrings","low-back"], ["barbell"], "intermediate", ["posterior"], ["low back injury"], 3, "8", 120),
  E("Back Extension", "hinge", ["hamstrings","glutes","low-back"], ["ghd"], "beginner", ["posterior","accessory"], [], 3, "12", 60),
  E("Reverse Hyper", "hinge", ["glutes","hamstrings","low-back"], ["reverse-hyper"], "beginner", ["posterior","accessory"], [], 3, "12", 60),
  E("Hip Thrust", "hinge", ["glutes","hamstrings"], ["barbell","bench"], "beginner", ["glute","posterior"], [], 4, "10", 90),
  E("Barbell Glute Bridge", "hinge", ["glutes","hamstrings"], ["barbell"], "beginner", ["glute","posterior"], [], 3, "10", 75),
  E("Single-Leg Hip Thrust", "hinge", ["glutes"], ["bench","bodyweight"], "intermediate", ["unilateral","glute"], [], 3, "10/leg", 60),
  E("Kettlebell Swing", "hinge", ["glutes","hamstrings","back"], ["kettlebell"], "intermediate", ["power","conditioning"], ["low back injury"], 4, "15", 60),
  E("Kettlebell Clean", "hinge", ["full body"], ["kettlebell"], "advanced", ["power","conditioning"], ["low back injury"], 4, "6/side", 90),
  E("Nordic Curl", "hinge", ["hamstrings"], ["bodyweight"], "advanced", ["posterior","isolation"], ["hamstring injury"], 3, "6", 90, "Eccentric-only to start — lower slowly, use hands to push up."),
  E("B-Stance RDL", "hinge", ["hamstrings","glutes"], ["dumbbell","kettlebell","barbell"], "intermediate", ["unilateral","posterior"], ["low back injury"], 3, "8/leg", 75, "Back foot kickstand, ~70% load on front leg."),
  E("B-Stance Hip Thrust", "hinge", ["glutes"], ["barbell","bench"], "intermediate", ["unilateral","glute","posterior"], [], 3, "10/leg", 75),
  E("Banded Lateral Walk", "hinge", ["glutes"], ["band"], "beginner", ["glute","warmup","isolation"], [], 3, "15/side", 30),
  E("Clamshell", "hinge", ["glutes"], ["band","bodyweight"], "beginner", ["glute","warmup","prenatal-safe"], [], 3, "15/side", 30),
  E("Hip Airplane", "hinge", ["glutes","hips"], ["bodyweight"], "intermediate", ["unilateral","stability","glute"], [], 3, "6/side", 45),
  E("Power Clean", "hinge", ["full body"], ["barbell"], "advanced", ["power","compound","posterior"], ["low back injury","wrist injury"], 5, "3", 180, "Triple extension, catch in quarter squat."),
  E("Hang Clean", "hinge", ["full body"], ["barbell"], "advanced", ["power","compound"], ["low back injury"], 5, "3", 180, "From mid-thigh."),

  // ── PUSH: HORIZONTAL ─────────────────────────────────────
  E("Bench Press", "push", ["chest","triceps","shoulders"], ["barbell","bench"], "intermediate", ["compound","upper"], ["shoulder injury"], 4, "6", 150),
  E("Close-Grip Bench Press", "push", ["triceps","chest"], ["barbell","bench"], "intermediate", ["compound","upper"], ["elbow injury"], 4, "8", 120, "Shoulder-width grip."),
  E("Incline Bench Press", "push", ["upper-chest","shoulders"], ["barbell","bench"], "intermediate", ["compound","upper"], ["shoulder injury"], 4, "8", 120),
  E("Decline Bench Press", "push", ["lower-chest","triceps"], ["barbell","bench"], "intermediate", ["upper"], [], 3, "8", 120),
  E("Dumbbell Bench Press", "push", ["chest","triceps"], ["dumbbell","bench"], "beginner", ["upper"], [], 3, "10", 90),
  E("Dumbbell Incline Press", "push", ["upper-chest"], ["dumbbell","bench"], "beginner", ["upper"], ["shoulder injury"], 3, "10", 90),
  E("Floor Press", "push", ["chest","triceps"], ["barbell","dumbbell"], "intermediate", ["upper"], [], 3, "8", 120, "Shoulder-friendly press."),
  E("Push-up", "push", ["chest","triceps","core"], ["bodyweight"], "beginner", ["bodyweight","upper"], ["wrist injury"], 3, "10", 60),
  E("Incline Push-up", "push", ["chest","triceps"], ["bodyweight","bench"], "beginner", ["bodyweight","upper","beginner-friendly"], [], 3, "12", 60),
  E("Decline Push-up", "push", ["upper-chest"], ["bodyweight","bench"], "intermediate", ["bodyweight","upper"], ["shoulder injury"], 3, "10", 75),
  E("Diamond Push-up", "push", ["triceps","chest"], ["bodyweight"], "intermediate", ["bodyweight","upper"], ["wrist injury"], 3, "8", 60),
  E("Archer Push-up", "push", ["chest","triceps"], ["bodyweight"], "advanced", ["bodyweight","unilateral"], ["shoulder injury"], 3, "5/side", 75),
  E("Dumbbell Fly", "push", ["chest"], ["dumbbell","bench"], "beginner", ["isolation","upper"], ["shoulder injury"], 3, "12", 60),
  E("Cable Chest Fly", "push", ["chest"], ["cable"], "beginner", ["isolation","upper"], ["shoulder injury"], 3, "12", 60),
  E("Pec Deck", "push", ["chest"], ["machine"], "beginner", ["isolation","upper"], ["shoulder injury"], 3, "12", 60),
  E("Landmine Press", "push", ["chest","shoulders"], ["barbell"], "beginner", ["upper","shoulder-friendly"], [], 3, "10", 90, "Great for shoulder rehab."),
  E("Dips", "push", ["chest","triceps"], ["dip-station","bodyweight"], "advanced", ["bodyweight","upper"], ["shoulder injury"], 3, "8", 120),

  // ── PUSH: VERTICAL ───────────────────────────────────────
  E("Overhead Press", "push", ["shoulders","triceps"], ["barbell"], "intermediate", ["upper","compound"], ["shoulder injury"], 4, "6", 120),
  E("Push Press", "push", ["shoulders","triceps","legs"], ["barbell"], "intermediate", ["power","upper"], ["shoulder injury"], 4, "5", 150),
  E("Z Press", "push", ["shoulders","core"], ["barbell","dumbbell"], "advanced", ["upper","core"], ["low back injury"], 3, "6", 120),
  E("Seated DB Press", "push", ["shoulders"], ["dumbbell","bench"], "beginner", ["upper"], ["shoulder injury"], 3, "10", 90),
  E("Arnold Press", "push", ["shoulders"], ["dumbbell"], "intermediate", ["upper"], ["shoulder injury"], 3, "10", 75),
  E("Single-Arm DB Press", "push", ["shoulders","core"], ["dumbbell"], "intermediate", ["upper","unilateral"], ["shoulder injury"], 3, "8/side", 75),
  E("Pike Push-up", "push", ["shoulders","triceps"], ["bodyweight"], "intermediate", ["bodyweight","upper"], ["shoulder injury","wrist injury"], 3, "8", 75),
  E("Handstand Push-up", "push", ["shoulders","triceps"], ["bodyweight"], "advanced", ["bodyweight","upper"], ["shoulder injury","wrist injury"], 3, "5", 120),
  E("Lateral Raise", "push", ["shoulders"], ["dumbbell","cable"], "beginner", ["isolation","upper"], [], 3, "12", 45),
  E("Front Raise", "push", ["shoulders"], ["dumbbell","plate"], "beginner", ["isolation","upper"], [], 3, "10", 45),
  E("Cable Lateral Raise", "push", ["shoulders"], ["cable"], "beginner", ["isolation","upper"], [], 3, "12", 45),
  E("Single-Arm Cable Lateral Raise", "push", ["shoulders"], ["cable"], "beginner", ["isolation","upper","unilateral"], [], 3, "12/side", 45),
  E("Single-Arm Landmine Press", "push", ["shoulders","core"], ["barbell"], "intermediate", ["upper","unilateral","shoulder-friendly"], [], 3, "8/side", 75),
  E("Push Jerk", "push", ["shoulders","triceps","legs"], ["barbell"], "advanced", ["power","upper","compound"], ["shoulder injury","low back injury"], 4, "3", 180, "Dip-drive-punch under."),
  E("Clean & Press", "push", ["full body"], ["barbell","kettlebell"], "advanced", ["power","compound","upper"], ["shoulder injury","low back injury"], 4, "5", 150),

  // ── PULL: HORIZONTAL ─────────────────────────────────────
  E("Barbell Row", "pull", ["back","biceps"], ["barbell"], "intermediate", ["compound","upper"], ["low back injury"], 4, "8", 120),
  E("Pendlay Row", "pull", ["back","biceps"], ["barbell"], "advanced", ["compound","upper"], ["low back injury"], 4, "5", 150, "Dead-stop from floor."),
  E("Dumbbell Row", "pull", ["back","biceps"], ["dumbbell","bench"], "beginner", ["upper"], [], 3, "10", 75),
  E("Chest-Supported Row", "pull", ["back"], ["dumbbell","bench"], "beginner", ["upper","beginner-friendly"], [], 3, "10", 75, "Low-back friendly."),
  E("Seal Row", "pull", ["back"], ["barbell","bench"], "intermediate", ["upper"], [], 3, "8", 90),
  E("T-Bar Row", "pull", ["back"], ["barbell","t-bar"], "intermediate", ["compound","upper"], ["low back injury"], 3, "8", 90),
  E("Meadows Row", "pull", ["lats","rear-delts"], ["barbell"], "advanced", ["upper","unilateral"], [], 3, "8/side", 75),
  E("Cable Row", "pull", ["back"], ["cable"], "beginner", ["upper","beginner-friendly"], [], 3, "10", 75),
  E("Inverted Row", "pull", ["back","biceps"], ["bar","bodyweight"], "beginner", ["bodyweight","upper"], [], 3, "10", 75),
  E("Face Pull", "pull", ["rear-delts","upper-back"], ["cable","band"], "beginner", ["accessory","shoulder-health"], [], 3, "15", 45),
  E("Band Pull-Apart", "pull", ["rear-delts","upper-back"], ["band"], "beginner", ["warmup","shoulder-health"], [], 3, "15", 30),
  E("Reverse Fly", "pull", ["rear-delts"], ["dumbbell","cable"], "beginner", ["isolation","shoulder-health"], [], 3, "12", 45),
  E("Single-Arm Cable Row", "pull", ["back","biceps"], ["cable"], "beginner", ["upper","unilateral"], [], 3, "10/side", 60),
  E("Single-Arm Dumbbell Row", "pull", ["back","biceps","lats"], ["dumbbell","bench"], "beginner", ["upper","unilateral"], [], 3, "10/side", 60),
  E("Kroc Row", "pull", ["back","lats","grip"], ["dumbbell","bench"], "advanced", ["upper","unilateral"], ["low back injury"], 3, "20/side", 90, "High-rep heavy row, some body english permitted."),
  E("Chest-Supported DB Row", "pull", ["back","rear-delts"], ["dumbbell","bench"], "beginner", ["upper","beginner-friendly","low-back-safe"], [], 3, "10", 60),

  // ── PULL: VERTICAL ───────────────────────────────────────
  E("Pull-up", "pull", ["lats","biceps","back"], ["pullup-bar"], "advanced", ["bodyweight","upper"], ["elbow injury"], 4, "6", 120),
  E("Chin-up", "pull", ["biceps","back"], ["pullup-bar"], "intermediate", ["bodyweight","upper"], ["elbow injury"], 4, "6", 120),
  E("Neutral-Grip Pull-up", "pull", ["lats","biceps"], ["pullup-bar"], "intermediate", ["bodyweight","upper"], ["elbow injury"], 4, "6", 120, "Easier on shoulders."),
  E("Weighted Pull-up", "pull", ["lats","biceps"], ["pullup-bar","dip-belt"], "advanced", ["upper"], ["elbow injury","shoulder injury"], 4, "5", 150),
  E("Assisted Pull-up", "pull", ["lats","biceps"], ["machine","band"], "beginner", ["upper","beginner-friendly"], [], 3, "8", 90),
  E("Lat Pulldown", "pull", ["lats","biceps"], ["machine","cable"], "beginner", ["upper","beginner-friendly"], [], 3, "10", 90),
  E("Straight-Arm Pulldown", "pull", ["lats"], ["cable"], "beginner", ["isolation","upper"], [], 3, "12", 60),
  E("Kneeling Cable Pulldown", "pull", ["lats","core"], ["cable"], "intermediate", ["upper","core"], [], 3, "10", 60),
  E("Reverse-Grip Lat Pulldown", "pull", ["lats","biceps"], ["machine","cable"], "beginner", ["upper"], [], 3, "10", 75, "Supinated grip — a.k.a. front pulldown. Elbows drive down."),
  E("Single-Arm Lat Pulldown", "pull", ["lats"], ["cable"], "intermediate", ["upper","unilateral","isolation"], [], 3, "10/side", 60),
  E("Scapular Pull-up", "pull", ["lats","upper-back"], ["pullup-bar"], "beginner", ["mobility","shoulder-health","bodyweight"], [], 3, "8", 45, "Hang, depress shoulders without bending elbows."),
  E("Dumbbell Pullover", "pull", ["lats","chest"], ["dumbbell","bench"], "intermediate", ["upper","isolation"], ["shoulder injury"], 3, "10", 75),

  // ── ARMS ─────────────────────────────────────────────────
  E("Barbell Curl", "pull", ["biceps"], ["barbell"], "beginner", ["isolation","arms"], ["elbow injury"], 3, "10", 60),
  E("Dumbbell Curl", "pull", ["biceps"], ["dumbbell"], "beginner", ["isolation","arms"], ["elbow injury"], 3, "10", 60),
  E("Hammer Curl", "pull", ["biceps","forearms"], ["dumbbell"], "beginner", ["isolation","arms"], [], 3, "10", 45),
  E("Preacher Curl", "pull", ["biceps"], ["barbell","dumbbell","bench"], "beginner", ["isolation","arms"], ["elbow injury"], 3, "10", 60),
  E("Incline DB Curl", "pull", ["biceps"], ["dumbbell","bench"], "intermediate", ["isolation","arms"], ["shoulder injury"], 3, "10", 60),
  E("Cable Curl", "pull", ["biceps"], ["cable"], "beginner", ["isolation","arms"], [], 3, "12", 45),
  E("Concentration Curl", "pull", ["biceps"], ["dumbbell","bench"], "beginner", ["isolation","arms"], [], 3, "12", 45),
  E("Tricep Pushdown", "push", ["triceps"], ["cable"], "beginner", ["isolation","arms"], ["elbow injury"], 3, "12", 45),
  E("Overhead Tricep Extension", "push", ["triceps"], ["dumbbell","cable"], "beginner", ["isolation","arms"], ["shoulder injury","elbow injury"], 3, "12", 60),
  E("Skullcrusher", "push", ["triceps"], ["barbell","dumbbell","bench"], "intermediate", ["isolation","arms"], ["elbow injury"], 3, "10", 60),
  E("Close-Grip Push-up", "push", ["triceps","chest"], ["bodyweight"], "beginner", ["bodyweight","arms"], ["wrist injury"], 3, "10", 60),
  E("Tricep Kickback", "push", ["triceps"], ["dumbbell"], "beginner", ["isolation","arms"], [], 3, "12", 45),
  E("DB Skullcrusher", "push", ["triceps"], ["dumbbell","bench"], "beginner", ["isolation","arms"], ["elbow injury"], 3, "10", 60, "Elbow-friendlier than barbell."),
  E("Cable Overhead Tricep Extension", "push", ["triceps"], ["cable","rope"], "beginner", ["isolation","arms"], ["shoulder injury"], 3, "12", 45),

  // ── CORE ─────────────────────────────────────────────────
  E("Plank", "core", ["core"], ["bodyweight"], "beginner", ["isometric","core"], [], 3, "45s", 45),
  E("Side Plank", "core", ["obliques","core"], ["bodyweight"], "beginner", ["isometric","core"], [], 3, "30s/side", 45),
  E("RKC Plank", "core", ["core"], ["bodyweight"], "intermediate", ["isometric","core"], [], 3, "20s", 60, "Maximum tension plank."),
  E("Dead Bug", "core", ["core"], ["bodyweight"], "beginner", ["core","beginner-friendly","low-back-safe"], [], 3, "8/side", 45),
  E("Bird Dog", "core", ["core","glutes"], ["bodyweight"], "beginner", ["core","stability","low-back-safe"], [], 3, "8/side", 45),
  E("Pallof Press", "core", ["core","obliques"], ["cable","band"], "beginner", ["anti-rotation","core"], [], 3, "10/side", 45),
  E("Suitcase Carry", "core", ["core","obliques","grip"], ["kettlebell","dumbbell"], "beginner", ["carry","anti-lateral-flexion"], [], 3, "30m/side", 60),
  E("Farmer Carry", "cardio", ["grip","core","traps"], ["dumbbell","kettlebell"], "beginner", ["conditioning","grip"], [], 3, "40m", 75),
  E("Ab Wheel Rollout", "core", ["core","lats"], ["ab-wheel"], "advanced", ["core"], ["low back injury"], 3, "8", 75),
  E("Hanging Leg Raise", "core", ["core","hip-flexors"], ["pullup-bar"], "advanced", ["core","bodyweight"], ["low back injury"], 3, "8", 75),
  E("Hanging Knee Raise", "core", ["core","hip-flexors"], ["pullup-bar"], "intermediate", ["core","bodyweight"], [], 3, "10", 60),
  E("Cable Crunch", "core", ["core"], ["cable"], "beginner", ["core","isolation"], ["low back injury"], 3, "12", 45),
  E("Russian Twist", "core", ["obliques","core"], ["dumbbell","plate","bodyweight"], "beginner", ["core"], ["low back injury"], 3, "12/side", 45),
  E("V-Up", "core", ["core"], ["bodyweight"], "intermediate", ["core","bodyweight"], ["low back injury"], 3, "12", 60),
  E("Hollow Hold", "core", ["core"], ["bodyweight"], "intermediate", ["isometric","core"], [], 3, "30s", 60),
  E("GHD Sit-up", "core", ["core","hip-flexors"], ["ghd"], "advanced", ["core"], ["low back injury","neck injury"], 3, "10", 75),
  E("Copenhagen Plank", "core", ["adductors","core"], ["bench","bodyweight"], "advanced", ["isometric","adductor"], [], 3, "20s/side", 60),
  E("Reverse Crunch", "core", ["core"], ["bodyweight","bench"], "beginner", ["core","bodyweight","low-back-safe"], [], 3, "12", 45),
  E("Dragon Flag", "core", ["core"], ["bench","bodyweight"], "advanced", ["core","bodyweight"], ["low back injury"], 3, "5", 90),
  E("Windmill", "core", ["obliques","core","shoulders"], ["kettlebell"], "intermediate", ["core","anti-lateral-flexion"], ["low back injury","shoulder injury"], 3, "5/side", 60),
  E("Turkish Get-Up", "core", ["full body","core","shoulders"], ["kettlebell","dumbbell"], "advanced", ["core","stability","unilateral"], [], 3, "3/side", 90, "Slow, controlled full sequence."),

  // ── CONDITIONING / CARRIES ───────────────────────────────
  E("Sled Push", "cardio", ["quads","full body"], ["sled"], "intermediate", ["conditioning","power"], [], 4, "20m", 90),
  E("Sled Drag (Backward)", "cardio", ["quads"], ["sled"], "beginner", ["conditioning","knee-friendly"], [], 4, "20m", 75, "Rehab-friendly."),
  E("Prowler Sprint", "cardio", ["full body"], ["sled"], "advanced", ["conditioning","power"], [], 5, "15m", 90),
  E("Rowing (Erg)", "cardio", ["full body"], ["rower"], "beginner", ["conditioning"], [], 1, "20min", 0),
  E("Assault Bike", "cardio", ["full body"], ["bike"], "beginner", ["conditioning","low-impact"], [], 1, "15min", 0),
  E("Burpee", "cardio", ["full body"], ["bodyweight"], "intermediate", ["conditioning","bodyweight"], ["low back injury","wrist injury"], 4, "10", 60),
  E("Mountain Climber", "cardio", ["core","legs"], ["bodyweight"], "beginner", ["conditioning","bodyweight"], ["wrist injury"], 3, "30s", 45),
  E("Box Jump", "cardio", ["quads","glutes"], ["box"], "intermediate", ["power","plyometric"], ["knee injury"], 4, "5", 90),
  E("Broad Jump", "cardio", ["quads","glutes"], ["bodyweight"], "intermediate", ["power","plyometric"], ["knee injury"], 4, "5", 90),
  E("Skipping Rope", "cardio", ["calves","full body"], ["rope"], "beginner", ["conditioning"], [], 3, "60s", 45),

  // ── CALVES / ACCESSORY ───────────────────────────────────
  E("Standing Calf Raise", "squat", ["calves"], ["machine","dumbbell"], "beginner", ["isolation","lower"], [], 3, "15", 45),
  E("Seated Calf Raise", "squat", ["calves"], ["machine"], "beginner", ["isolation","lower"], [], 3, "15", 45),
  E("Single-Leg Calf Raise", "squat", ["calves"], ["bodyweight","dumbbell"], "beginner", ["isolation","unilateral"], [], 3, "12/leg", 45),
  E("Tibialis Raise", "squat", ["tibialis"], ["bodyweight","plate"], "beginner", ["isolation","knee-health"], [], 3, "15", 45),
  E("Reverse Nordic", "squat", ["quads"], ["bodyweight"], "intermediate", ["isolation","knee-health","flexibility"], ["knee injury"], 3, "8", 60, "Lean back from knees, keep hips extended."),

  // ── MOBILITY / WARMUP ────────────────────────────────────
  E("Cat-Cow", "mobility", ["spine"], ["bodyweight"], "beginner", ["mobility","warmup","prenatal-safe"], [], 2, "8", 0),
  E("90/90 Hip Switch", "mobility", ["hips"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "6/side", 0),
  E("Thoracic Rotation", "mobility", ["thoracic"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "8/side", 0),
  E("Wall Slide", "mobility", ["shoulders","thoracic"], ["bodyweight"], "beginner", ["mobility","shoulder-health","warmup"], [], 2, "10", 0),
  E("Scap Push-up", "mobility", ["serratus","scapula"], ["bodyweight"], "beginner", ["mobility","warmup"], ["wrist injury"], 2, "10", 0),
  E("Hip CAR", "mobility", ["hips"], ["bodyweight"], "beginner", ["mobility","joint-health"], [], 2, "5/side", 0),
  E("Shoulder CAR", "mobility", ["shoulders"], ["bodyweight"], "beginner", ["mobility","joint-health","warmup"], [], 2, "5/side", 0),
  E("Leg Swing", "mobility", ["hips"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "10/side", 0),
  E("Cossack Reach", "mobility", ["hips","adductors"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "6/side", 0),
  E("Spiderman Lunge", "mobility", ["hips","hip-flexors","thoracic"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "5/side", 0),
  E("Inchworm", "mobility", ["hamstrings","shoulders","core"], ["bodyweight"], "beginner", ["mobility","warmup"], ["wrist injury"], 2, "6", 0),
  E("Adductor Rockback", "mobility", ["adductors","hips"], ["bodyweight"], "beginner", ["mobility","warmup"], [], 2, "8/side", 0),

  // ── STRETCHES ────────────────────────────────────────────
  E("Child's Pose", "stretch", ["hips","back"], ["bodyweight"], "beginner", ["flexibility","recovery","prenatal-safe"], [], 2, "60s", 0),
  E("Pigeon Pose", "stretch", ["hips","glutes"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "60s/side", 0),
  E("Downward Dog", "stretch", ["hamstrings","shoulders"], ["bodyweight"], "beginner", ["flexibility","warmup"], ["wrist injury"], 2, "30s", 0),
  E("Couch Stretch", "stretch", ["hip-flexors","quads"], ["bodyweight"], "beginner", ["flexibility"], [], 2, "60s/side", 0),
  E("Jefferson Curl", "stretch", ["hamstrings","spine"], ["dumbbell","kettlebell","bodyweight"], "intermediate", ["flexibility"], ["low back injury","disc issue"], 3, "8", 60, "Slow, light, sequential spinal flexion."),
  E("Figure-4 Stretch", "stretch", ["glutes","hips"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "45s/side", 0, "Supine — helpful for low-back tightness and sciatica."),
  E("Supine Hamstring Stretch", "stretch", ["hamstrings"], ["bodyweight","band"], "beginner", ["flexibility"], [], 2, "45s/side", 0, "Strap-assisted if tight."),
  E("Half-Kneeling Hip Flexor Stretch", "stretch", ["hip-flexors","quads"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "45s/side", 0, "Desk workers, runners."),
  E("Standing Quad Stretch", "stretch", ["quads","hip-flexors"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "30s/side", 0),
  E("90/90 Hip Stretch", "stretch", ["hips","glutes"], ["bodyweight"], "beginner", ["flexibility"], [], 2, "45s/side", 0, "Static hold — distinct from the dynamic switch drill."),
  E("Butterfly Stretch", "stretch", ["adductors","hips"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "60s", 0),
  E("Happy Baby", "stretch", ["hips","low-back"], ["bodyweight"], "beginner", ["flexibility"], [], 2, "45s", 0, "Supine — avoid in late pregnancy."),
  E("Frog Stretch", "stretch", ["adductors","hips"], ["bodyweight"], "beginner", ["flexibility"], ["knee injury"], 2, "60s", 0, "Hip internal-rotation opener."),
  E("Doorway Pec Stretch", "stretch", ["chest","shoulders"], ["bodyweight"], "beginner", ["flexibility","shoulder-health","prenatal-safe"], [], 2, "30s/side", 0),
  E("Sleeper Stretch", "stretch", ["shoulders"], ["bodyweight"], "intermediate", ["flexibility","shoulder-health"], ["shoulder injury"], 2, "30s/side", 0, "Posterior capsule — throwers, swimmers."),
  E("Thread the Needle", "stretch", ["thoracic","shoulders"], ["bodyweight"], "beginner", ["flexibility"], [], 2, "30s/side", 0),
  E("Puppy Pose", "stretch", ["chest","shoulders","lats"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "45s", 0),
  E("Wrist Flexor/Extensor Stretch", "stretch", ["forearms"], ["bodyweight"], "beginner", ["flexibility","joint-health"], [], 2, "30s each", 0, "Both directions — desk worker essential."),
  E("Supine Spinal Twist", "stretch", ["back","obliques"], ["bodyweight"], "beginner", ["flexibility"], [], 2, "45s/side", 0, "Supine — avoid in late pregnancy."),
  E("Wall Calf Stretch (Gastroc)", "stretch", ["calves"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "30s/side", 0, "Straight back leg."),
  E("Soleus Stretch (Bent Knee)", "stretch", ["calves"], ["bodyweight"], "beginner", ["flexibility","prenatal-safe"], [], 2, "30s/side", 0, "Bent back knee — Achilles health."),

  // ── MACHINE: LOWER BODY ──────────────────────────────────
  E("45° Leg Press", "squat", ["quads","glutes"], ["machine","leg-press"], "beginner", ["lower","machine"], [], 3, "10", 90, "Keep lower back against pad."),
  E("Horizontal Leg Press", "squat", ["quads","glutes"], ["machine","leg-press"], "beginner", ["lower","machine","beginner-friendly"], [], 3, "12", 90),
  E("Vertical Leg Press", "squat", ["quads","glutes"], ["machine","leg-press"], "intermediate", ["lower","machine"], ["low back injury","knee injury"], 3, "10", 90),
  E("Single-Leg Leg Press", "squat", ["quads","glutes"], ["machine","leg-press"], "intermediate", ["unilateral","lower","machine"], [], 3, "10/leg", 75),
  E("Belt Squat", "squat", ["quads","glutes"], ["machine"], "intermediate", ["lower","machine","spine-friendly"], [], 3, "10", 90, "Loads legs without spinal compression."),
  E("Smith Machine Squat", "squat", ["quads","glutes"], ["smith-machine"], "beginner", ["lower","machine"], [], 3, "10", 90),
  E("Smith Machine Lunge", "squat", ["quads","glutes"], ["smith-machine"], "beginner", ["unilateral","lower","machine"], [], 3, "10/leg", 75),
  E("Leg Extension", "squat", ["quads"], ["machine"], "beginner", ["isolation","lower","machine"], ["knee injury"], 3, "12", 60),
  E("Single-Leg Leg Extension", "squat", ["quads"], ["machine"], "beginner", ["isolation","unilateral","lower","machine"], ["knee injury"], 3, "12/leg", 45),
  E("Seated Leg Curl", "hinge", ["hamstrings"], ["machine"], "beginner", ["isolation","lower","machine"], [], 3, "12", 60),
  E("Lying Leg Curl", "hinge", ["hamstrings"], ["machine"], "beginner", ["isolation","lower","machine"], [], 3, "12", 60),
  E("Single-Leg Lying Leg Curl", "hinge", ["hamstrings"], ["machine"], "beginner", ["isolation","unilateral","lower","machine"], [], 3, "12/leg", 45),
  E("Standing Leg Curl", "hinge", ["hamstrings"], ["machine"], "beginner", ["isolation","unilateral","lower","machine"], [], 3, "12/leg", 60),
  E("Hip Abduction Machine", "squat", ["glutes"], ["machine"], "beginner", ["isolation","lower","machine","glute"], [], 3, "15", 45),
  E("Hip Adduction Machine", "squat", ["adductors"], ["machine"], "beginner", ["isolation","lower","machine"], [], 3, "15", 45),
  E("Glute Kickback Machine", "hinge", ["glutes"], ["machine"], "beginner", ["isolation","glute","machine","unilateral"], [], 3, "12/leg", 45),

  // ── MACHINE: UPPER BODY PUSH ─────────────────────────────
  E("Chest Press Machine", "push", ["chest","triceps"], ["machine"], "beginner", ["upper","machine","beginner-friendly"], [], 3, "10", 75),
  E("Incline Chest Press Machine", "push", ["upper-chest"], ["machine"], "beginner", ["upper","machine"], [], 3, "10", 75),
  E("Decline Chest Press Machine", "push", ["lower-chest"], ["machine"], "beginner", ["upper","machine"], [], 3, "10", 75),
  E("Hammer Strength Chest Press", "push", ["chest","triceps"], ["machine"], "intermediate", ["upper","machine"], [], 3, "8", 90),
  E("Shoulder Press Machine", "push", ["shoulders","triceps"], ["machine"], "beginner", ["upper","machine","beginner-friendly"], ["shoulder injury"], 3, "10", 75),
  E("Smith Machine Bench Press", "push", ["chest","triceps"], ["smith-machine","bench"], "intermediate", ["upper","machine"], ["shoulder injury"], 4, "8", 120),
  E("Smith Machine Overhead Press", "push", ["shoulders"], ["smith-machine"], "intermediate", ["upper","machine"], ["shoulder injury"], 3, "8", 90),
  E("Lateral Raise Machine", "push", ["shoulders"], ["machine"], "beginner", ["isolation","upper","machine"], [], 3, "12", 45),

  // ── MACHINE: UPPER BODY PULL ─────────────────────────────
  E("Hammer Strength Row", "pull", ["back","biceps"], ["machine"], "intermediate", ["upper","machine"], [], 3, "8", 90),
  E("Seated Row Machine", "pull", ["back","biceps"], ["machine"], "beginner", ["upper","machine","beginner-friendly"], [], 3, "10", 75),
  E("Rear Delt Machine", "pull", ["rear-delts"], ["machine"], "beginner", ["isolation","shoulder-health","machine"], [], 3, "12", 45),
  E("Assisted Dip Machine", "push", ["chest","triceps"], ["machine"], "beginner", ["upper","machine","beginner-friendly"], [], 3, "8", 90),
  E("Pullover Machine", "pull", ["lats"], ["machine"], "intermediate", ["upper","machine","isolation"], [], 3, "10", 75),

  // ── MACHINE: ARMS ────────────────────────────────────────
  E("Preacher Curl Machine", "pull", ["biceps"], ["machine"], "beginner", ["isolation","arms","machine"], ["elbow injury"], 3, "10", 60),
  E("Biceps Curl Machine", "pull", ["biceps"], ["machine"], "beginner", ["isolation","arms","machine"], [], 3, "12", 45),
  E("Tricep Press Machine", "push", ["triceps"], ["machine"], "beginner", ["isolation","arms","machine"], [], 3, "12", 45),
  E("Tricep Extension Machine", "push", ["triceps"], ["machine"], "beginner", ["isolation","arms","machine"], [], 3, "12", 45),

  // ── MACHINE: CORE ────────────────────────────────────────
  E("Ab Crunch Machine", "core", ["core"], ["machine"], "beginner", ["core","machine","isolation"], ["low back injury","neck injury"], 3, "15", 45),
  E("Rotary Torso Machine", "core", ["obliques"], ["machine"], "beginner", ["core","machine","isolation"], ["low back injury"], 3, "12/side", 45),
  E("Roman Chair Sit-up", "core", ["core","hip-flexors"], ["machine"], "intermediate", ["core","machine"], ["low back injury"], 3, "12", 60),

  // ── ADDITIONAL CABLE ─────────────────────────────────────
  E("Cable Woodchopper", "core", ["obliques","core"], ["cable"], "intermediate", ["core","anti-rotation","cable"], [], 3, "10/side", 45),
  E("Cable Pull-Through", "hinge", ["glutes","hamstrings"], ["cable"], "beginner", ["posterior","cable","glute"], [], 3, "12", 60),
  E("Cable Kickback", "hinge", ["glutes"], ["cable"], "beginner", ["isolation","glute","cable","unilateral"], [], 3, "12/leg", 45),
  E("Cable Crossover", "push", ["chest"], ["cable"], "beginner", ["isolation","upper","cable"], [], 3, "12", 60),
];

/* ============================================================
   MODALITY (derived from equipment)
   ============================================================ */
const MODALITIES = [
  { id: "free-weight", label: "Free weight" },
  { id: "machine",     label: "Machine" },
  { id: "cable",       label: "Cable" },
  { id: "bodyweight",  label: "Bodyweight" },
  { id: "band",        label: "Band" },
  { id: "cardio",      label: "Cardio" },
];

const modalityOf = (ex) => {
  const eq = ex.equipment || [];
  if (eq.some(e => ["machine","smith-machine","leg-press","ghd","reverse-hyper"].includes(e))) return "machine";
  if (eq.includes("cable")) return "cable";
  if (eq.some(e => ["barbell","dumbbell","kettlebell","trap-bar","safety-bar","plate","t-bar"].includes(e))) return "free-weight";
  if (eq.some(e => ["sled","rower","bike","rope"].includes(e))) return "cardio";
  if (eq.includes("band")) return "band";
  return "bodyweight";
};


// Returns YYYY-MM-DD in the user's local timezone.
// Using toISOString() returned UTC, causing "today" to flip at UTC midnight
// rather than local midnight (e.g. 8 PM on US East Coast).
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => {
  const x = new Date(d + "T00:00:00");  // parse as local midnight, not UTC
  x.setDate(x.getDate() + n);
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, "0");
  const da = String(x.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
};

const SEED_COACHES = [
  { id: "coach_alex", name: "Alex Keaton" },
  { id: "coach_sam",  name: "Sam Ortega" },
];

const SEED_CLIENTS = [
  { id: uid("c"), coachId: "coach_alex", name: "Maya Okafor", age: 34, goals: "Build strength, run 10K under 52min", injuries: [], equipment: ["barbell","dumbbell","kettlebell","machine"], level: "intermediate", notes: "Trains 3x/week. Prefers morning sessions." , since: "2024-08-15", bodyweight: [{date: addDays(today(),-45), lb: 141.5},{date: addDays(today(),-30), lb: 141.1},{date: addDays(today(),-15), lb: 140.2},{date: today(), lb: 139.8}] },
  { id: uid("c"), coachId: "coach_alex", name: "Daniel Kaur", age: 47, goals: "Maintain mobility, reduce back stiffness", injuries: ["low back injury"], equipment: ["dumbbell","bodyweight"], level: "beginner", notes: "Desk job. Avoid heavy spinal loading.", since: "2025-01-10", bodyweight: [{date: addDays(today(),-30), lb: 181.0},{date: today(), lb: 179.5}] },
  { id: uid("c"), coachId: "coach_alex", name: "Serafina Liu", age: 29, goals: "Prenatal strength — 2nd trimester", injuries: [], equipment: ["dumbbell","bodyweight","band"], level: "intermediate", notes: "Focus on pelvic floor and posterior chain. No supine after week 16.", since: "2024-11-02", bodyweight: [{date: today(), lb: 129.6}] },
  { id: uid("c"), coachId: "coach_alex", name: "Jonah Reeves", age: 22, goals: "Add 8kg of muscle, first powerlifting meet", injuries: [], equipment: ["barbell","dumbbell","rack","bench","machine"], level: "advanced", notes: "Aggressive training volume. Loves heavy.", since: "2024-06-01", bodyweight: [{date: addDays(today(),-60), lb: 168.7},{date: addDays(today(),-30), lb: 172.2},{date: today(), lb: 175.1}] },
  { id: uid("c"), coachId: "coach_alex", name: "Priya Shah", age: 38, goals: "Rebuild after shoulder surgery", injuries: ["shoulder injury"], equipment: ["dumbbell","band","bodyweight"], level: "beginner", notes: "Cleared for light pressing. No overhead yet.", since: "2025-03-20", bodyweight: [{date: today(), lb: 134.5}] },
];

/* ============================================================
   HELPERS
   ============================================================ */
const initials = (name="") => name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
const movementClass = (m) => ({ push:"tag-dot-push", pull:"tag-dot-pull", squat:"tag-dot-squat", hinge:"tag-dot-hinge", core:"tag-dot-core", cardio:"tag-dot-cardio", mobility:"tag-dot-mobility", stretch:"tag-dot-stretch" }[m] || "tag-dot-core");
const prettyDate = (iso) => new Date(iso+"T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const shortDate = (iso) => new Date(iso+"T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/* ============================================================
   MAIN APP
   ============================================================ */
export default function CoachApp() {
  const { session } = useSession();
  const { coaches: dbCoaches, loading: coachesLoading, error: coachesError } = useCoaches(session);

  const [loaded, setLoaded] = useState(false);
  const [coaches, setCoaches] = useState([]);
  const [currentCoachId, setCurrentCoachId] = useState(null);
  const [allClients, setAllClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]); // { id, coachId, name, clientId?, date?, isTemplate, blocks }
  const [allLogs, setAllLogs] = useState([]); // { id, workoutId, exId, setIdx, weight, reps, notes, source, date }
  const [allAttendance, setAllAttendance] = useState([]); // { id, workoutId, status, date }
  // unitPref is now a constant — per-block unit overrides live on each block/log.
  // Kept as a named value so existing display code (bodyweight, PRs, etc.) stays unchanged.
  const unitPref = "lb";

  const [view, setView] = useState("dashboard");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [builderCtx, setBuilderCtx] = useState(null);
  const [toast, setToast] = useState(null);

  // Load
  useEffect(() => {
    (async () => {
      const version = await load("coach:version", 0);
      const stale = version < SCHEMA_VERSION;

      const [coachList, curCoach, c, e, w, l, a, legacyUnitPref] = await Promise.all([
        load("coach:coaches", null),
        load("coach:currentCoachId", null),
        load("coach:clients", null),
        load("coach:exercises", null),
        load("coach:workouts", null),
        load("coach:logs", null),
        load("coach:attendance", null),
        load("coach:unitPref", null),  // read legacy value for migration only
      ]);

      // Unit migration seed — for existing blocks/logs that lack a unit field.
      // If the coach had previously toggled to kg, preserve that. Otherwise default lb.
      const migrationUnit = legacyUnitPref === "kg" ? "kg" : "lb";

      const coachesInit = coachList || SEED_COACHES;
      // If the persisted current coach is archived (shouldn't happen since we
      // block archiving the active coach, but just in case after a restore),
      // fall back to the first non-archived coach.
      const isCoachActive = (id) => coachesInit.some(c => c.id === id && !c.archived);
      const firstActive = coachesInit.find(c => !c.archived);
      const currentInit = (curCoach && isCoachActive(curCoach)) ? curCoach : (firstActive?.id || coachesInit[0]?.id || "coach_alex");

      const clientsInit = c ? c.map(cl => ({ ...cl, coachId: cl.coachId || currentInit })) : SEED_CLIENTS;

      // Exercise library: on stale or empty use full seed, otherwise merge new seed entries by name
      let exercisesInit;
      if (!e) {
        exercisesInit = SEED_EXERCISES;
      } else {
        const existingNames = new Set(e.map(ex => ex.name.toLowerCase()));
        const newOnes = SEED_EXERCISES.filter(ex => !existingNames.has(ex.name.toLowerCase()));
        exercisesInit = newOnes.length > 0 ? [...e, ...newOnes] : e;
      }

      // Workouts: preserve, ensure coachId tagged, add planned weight field, and tag each block with unit
      const rawWorkouts = w
        ? w.map(wo => ({
            ...wo,
            coachId: wo.coachId || (wo.clientId ? (clientsInit.find(cl => cl.id === wo.clientId)?.coachId || currentInit) : currentInit),
            blocks: (wo.blocks || []).map(b => ({ weight: null, unit: migrationUnit, ...b }))  // default unit if missing
          }))
        : seedDemoWorkouts(clientsInit, exercisesInit);
      // Also ensure seeded demo blocks carry a unit (the seed itself doesn't set one)
      const workoutsInit = rawWorkouts.map(wo => ({
        ...wo,
        blocks: (wo.blocks || []).map(b => ({ unit: "lb", ...b }))
      }));

      // One-shot kg→lb / cm→in migration. Guarded by version so it runs at most
      // once per device — on save, version is bumped to 7 and this branch is
      // skipped on every subsequent load. Pre-v7 data was stored in kg-canonical
      // (weights) and cm-canonical (lengths); v7 stores lb and inches. Fresh
      // installs (version=0) land on lb/in seed data and skip the flip.
      const needsUnitFlip = version > 0 && version < 7;
      let logsInit = l || [];
      let clientsAfterFlip = clientsInit;
      let workoutsAfterFlip = workoutsInit;
      if (needsUnitFlip) {
        const KG_TO_LB = 2.20462;
        const CM_PER_INCH = 2.54;
        const round2 = (n) => Math.round(n * 100) / 100;
        const kgToLb = (v) => v == null ? v : round2(Number(v) * KG_TO_LB);
        const cmToIn = (v) => v == null ? v : round2(Number(v) / CM_PER_INCH);

        // Only convert sources that actually came from storage. Seed data
        // (used when storage was null) is already authored in lb/in canonical.
        if (w) {
          workoutsAfterFlip = workoutsInit.map(wo => ({
            ...wo,
            blocks: (wo.blocks || []).map(b => ({
              ...b,
              weight: b.weight == null ? null : kgToLb(b.weight),
            })),
          }));
        }

        logsInit = logsInit.map(lg => ({
          ...lg,
          actualWeight: lg.actualWeight == null ? null : kgToLb(lg.actualWeight),
          perSet: Array.isArray(lg.perSet)
            ? lg.perSet.map(s => ({
                ...s,
                weight: s.weight == null ? null : kgToLb(s.weight),
              }))
            : lg.perSet,
        }));

        if (c) {
          clientsAfterFlip = clientsInit.map(cl => {
            const next = { ...cl };
            if (Array.isArray(cl.bodyweight)) {
              next.bodyweight = cl.bodyweight.map(b => {
                if (b == null || b.kg === undefined) return b;
                const { kg, ...rest } = b;
                return { ...rest, lb: kgToLb(kg) };
              });
            }
            if (Array.isArray(cl.measurements)) {
              next.measurements = cl.measurements.map(m => {
                if (m == null) return m;
                const out = { ...m };
                if (m.valueKg !== undefined) {
                  out.valueLb = kgToLb(m.valueKg);
                  delete out.valueKg;
                }
                if (m.valueCm !== undefined) {
                  out.valueIn = cmToIn(m.valueCm);
                  delete out.valueCm;
                }
                return out;
              });
            }
            return next;
          });
        }
      }

      // Logs: migrate per-set logs → single-entry-per-exercise (if schema stale)
      if (stale && logsInit.length > 0 && logsInit[0] && !("mode" in logsInit[0])) {
        // Old format: many logs per workout/exercise (one per set)
        // New format: one log per workout/exercise with mode+perSet
        const grouped = {};
        logsInit.forEach(log => {
          const key = log.workoutId + "|" + log.exId;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(log);
        });
        logsInit = Object.entries(grouped).map(([key, sets]) => {
          const first = sets[0];
          // Find the workout block to get planned values
          const wo = workoutsAfterFlip.find(x => x.id === first.workoutId);
          const block = wo?.blocks.find(bl => bl.exId === first.exId);
          const planned = block ? { sets: block.sets, reps: block.reps, weight: block.weight } : null;

          // Check if all sets had consistent weight/reps
          const weights = sets.map(s => s.weight);
          const allSameWeight = weights.every(w => w === weights[0]);
          const repsArr = sets.map(s => String(s.reps));
          const allSameReps = repsArr.every(r => r === repsArr[0]);

          const mode = (allSameWeight && allSameReps && (!planned || (planned.weight == null || Number(planned.weight) === Number(weights[0])))) ? "asPlanned" : "modified";

          return {
            id: uid("log"),
            workoutId: first.workoutId,
            exId: first.exId,
            date: first.date,
            source: first.source || "coach",
            notes: sets.map(s => s.notes).filter(Boolean).join(" · ") || "",
            completed: true,
            mode,
            actualSets: sets.length,
            actualReps: allSameReps ? repsArr[0] : repsArr.join(", "),
            actualWeight: allSameWeight ? weights[0] : null,
            perSet: mode === "modified" ? sets.map(s => ({ reps: s.reps, weight: s.weight })) : null,
            unit: block?.unit || migrationUnit,
          };
        });
      } else {
        // Ensure every existing log has a unit field
        logsInit = logsInit.map(lg => {
          if (lg.unit) return lg;
          const wo = workoutsAfterFlip.find(x => x.id === lg.workoutId);
          const block = wo?.blocks.find(bl => bl.exId === lg.exId);
          return { ...lg, unit: block?.unit || migrationUnit };
        });
      }

      // coaches state now derives from Supabase (see effect below). The
      // localStorage value (coachList) is still read for currentInit fallback.
      setCurrentCoachId(currentInit);
      setAllClients(clientsAfterFlip);
      setExercises(exercisesInit);
      setAllWorkouts(workoutsAfterFlip);
      setAllLogs(logsInit);
      setAllAttendance(a || []);

      if (stale) await save("coach:version", SCHEMA_VERSION);
      // Legacy unitPref key no longer read on future loads — clear it to keep storage tidy.
      if (legacyUnitPref !== null) await save("coach:unitPref", null);
      setLoaded(true);
    })();
  }, []);

  // Populate coaches from Supabase. SEED_COACHES is used only as a transitional
  // fallback when the Supabase fetch has finished and returned no rows. While
  // the fetch is in flight, coaches stays at whatever it was (typically []).
  useEffect(() => {
    if (coachesLoading) return;
    if (dbCoaches.length > 0) {
      setCoaches(dbCoaches);
    } else {
      setCoaches(SEED_COACHES);
    }
  }, [coachesLoading, dbCoaches]);

  // Reconcile currentCoachId against the loaded coaches array. If the persisted
  // value (from localStorage via setCurrentCoachId initializer earlier) does not
  // match any coach in the loaded array — for example because the user signed in
  // as a different auth identity, or because DB-backed coaches replaced seeded
  // ones — fall back to the first coach. If currentCoachId is already valid, do
  // nothing (preserves the user's last selection across sessions).
  useEffect(() => {
    if (coaches.length === 0) return;
    const validIds = new Set(coaches.map(c => c.id));
    if (!currentCoachId || !validIds.has(currentCoachId)) {
      setCurrentCoachId(coaches[0].id);
    }
  }, [coaches, currentCoachId]);

  // Save
  useEffect(() => { if (loaded) save("coach:coaches", coaches); }, [coaches, loaded]);
  useEffect(() => { if (loaded && currentCoachId) save("coach:currentCoachId", currentCoachId); }, [currentCoachId, loaded]);
  useEffect(() => { if (loaded) save("coach:clients", allClients); }, [allClients, loaded]);
  useEffect(() => { if (loaded) save("coach:exercises", exercises); }, [exercises, loaded]);
  useEffect(() => { if (loaded) save("coach:workouts", allWorkouts); }, [allWorkouts, loaded]);
  useEffect(() => { if (loaded) save("coach:logs", allLogs); }, [allLogs, loaded]);
  useEffect(() => { if (loaded) save("coach:attendance", allAttendance); }, [allAttendance, loaded]);

  // ── Coach-scoped views — each coach only sees their own ──
  const clients = useMemo(() => allClients.filter(c => c.coachId === currentCoachId), [allClients, currentCoachId]);
  const workouts = useMemo(() => allWorkouts.filter(w => w.coachId === currentCoachId), [allWorkouts, currentCoachId]);
  const workoutIdsForCoach = useMemo(() => new Set(workouts.map(w => w.id)), [workouts]);
  const logs = useMemo(() => allLogs.filter(l => workoutIdsForCoach.has(l.workoutId)), [allLogs, workoutIdsForCoach]);
  const attendance = useMemo(() => allAttendance.filter(a => workoutIdsForCoach.has(a.workoutId)), [allAttendance, workoutIdsForCoach]);

  // Scoped setters — mutate only current-coach data, leave other coaches untouched
  const setClients = (next) => {
    const resolved = typeof next === "function" ? next(clients) : next;
    const others = allClients.filter(c => c.coachId !== currentCoachId);
    setAllClients([...others, ...resolved.map(c => ({ ...c, coachId: c.coachId || currentCoachId }))]);
  };
  const setWorkouts = (next) => {
    const resolved = typeof next === "function" ? next(workouts) : next;
    const others = allWorkouts.filter(w => w.coachId !== currentCoachId);
    setAllWorkouts([...others, ...resolved.map(w => ({ ...w, coachId: w.coachId || currentCoachId }))]);
  };
  const setLogs = (next) => {
    const resolved = typeof next === "function" ? next(logs) : next;
    const others = allLogs.filter(l => !workoutIdsForCoach.has(l.workoutId));
    setAllLogs([...others, ...resolved]);
  };
  const setAttendance = (next) => {
    const resolved = typeof next === "function" ? next(attendance) : next;
    const others = allAttendance.filter(a => !workoutIdsForCoach.has(a.workoutId));
    setAllAttendance([...others, ...resolved]);
  };

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const currentCoach = coaches.find(c => c.id === currentCoachId);

  const switchCoach = (id) => {
    setCurrentCoachId(id);
    setSelectedClientId(null);
    setBuilderCtx(null);
    setView("dashboard");
    const c = coaches.find(x => x.id === id);
    if (c) notify(`Switched to ${c.name}`);
  };
  const addCoach = (coach) => {
    setCoaches([...coaches, coach]);
    switchCoach(coach.id);
  };

  // Archive a coach. Their active (non-archived) clients are passed in as
  // resolutions: each entry is { clientId, action: "archive" | "transfer", targetCoachId? }.
  // If `force === true`, the resolutions array can be empty/incomplete and any
  // remaining active clients keep their existing coachId (orphaned to the archived coach).
  const archiveCoach = (coachId, resolutions = [], force = false) => {
    if (coachId === currentCoachId) {
      notify("Switch to a different coach before archiving this one");
      return false;
    }
    const target = coaches.find(c => c.id === coachId);
    if (!target) return false;

    // Apply client resolutions
    const resMap = Object.fromEntries(resolutions.map(r => [r.clientId, r]));
    const updatedClients = allClients.map(cl => {
      const r = resMap[cl.id];
      if (!r) return cl;
      if (r.action === "archive") return { ...cl, archived: true, archivedAt: today() };
      if (r.action === "transfer" && r.targetCoachId) return { ...cl, coachId: r.targetCoachId };
      return cl;
    });

    // Strict guardrail: if not force, every active client must be resolved
    if (!force) {
      const stillActive = updatedClients.filter(cl => cl.coachId === coachId && !cl.archived);
      if (stillActive.length > 0) {
        notify(`${stillActive.length} active client${stillActive.length === 1 ? "" : "s"} still assigned`);
        return false;
      }
    }

    setAllClients(updatedClients);
    setCoaches(coaches.map(c => c.id === coachId ? { ...c, archived: true, archivedAt: today() } : c));
    notify(`Archived ${target.name}`);
    return true;
  };

  const restoreCoach = (coachId) => {
    const target = coaches.find(c => c.id === coachId);
    if (!target) return;
    setCoaches(coaches.map(c => c.id === coachId ? { ...c, archived: false, archivedAt: undefined } : c));
    notify(`Restored ${target.name}`);
  };

  // ── Backup / Restore ─────────────────────────────────────
  const exportData = () => {
    const snapshot = {
      appName: "Ledger",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      coaches,
      currentCoachId,
      clients: allClients,
      exercises,
      workouts: allWorkouts,
      logs: allLogs,
      attendance: allAttendance,
    };
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = today();
    a.href = url;
    a.download = `ledger-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("Backup downloaded");
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.appName || data.appName !== "Ledger") {
          notify("Not a valid Ledger backup file");
          return;
        }
        // Restore everything. For legacy backups (schemaVersion < 5), use the backup's
        // unitPref to seed unit fields on any block/log that doesn't have one yet.
        const backupUnit = data.unitPref === "kg" ? "kg" : "lb";
        if (data.coaches) setCoaches(data.coaches);
        if (data.currentCoachId) setCurrentCoachId(data.currentCoachId);
        if (data.clients) setAllClients(data.clients);
        if (data.exercises) setExercises(data.exercises);
        if (data.workouts) {
          setAllWorkouts(data.workouts.map(wo => ({
            ...wo,
            blocks: (wo.blocks || []).map(b => ({ unit: backupUnit, ...b }))
          })));
        }
        if (data.logs) {
          setAllLogs(data.logs.map(lg => ({ unit: backupUnit, ...lg })));
        }
        if (data.attendance) setAllAttendance(data.attendance);
        setSelectedClientId(null);
        setBuilderCtx(null);
        setView("dashboard");
        notify(`Restored from ${shortDate(data.exportedAt?.slice(0,10) || today())}`);
      } catch (err) {
        notify("Couldn't read that file");
      }
    };
    reader.readAsText(file);
  };

  if (!loaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center paper-grain" style={{background:"var(--paper)"}}>
        <div className="display text-3xl tracking-tight" style={{color:"var(--ink)"}}>loading…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden paper-grain" style={{background:"var(--paper)"}}>
      <GlobalStyles />
      {view !== "clientView" && <TopBar coaches={coaches} currentCoach={currentCoach} clients={allClients} onSwitch={switchCoach} onAddCoach={addCoach} onArchive={archiveCoach} onRestore={restoreCoach} onExport={exportData} onImport={importData}/>}
      <div className="flex-1 flex overflow-hidden">
        {view !== "builder" && view !== "clientView" && (
          <Sidebar
            view={view} setView={setView}
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={(id) => { setSelectedClientId(id); setView("client"); }}
            onAddClient={(c) => { setClients([...clients, c]); notify("Client added"); }}
          />
        )}
        <main className="flex-1 overflow-y-auto">
          {view === "dashboard" && (
            <Dashboard
              clients={clients} workouts={workouts} logs={logs} attendance={attendance}
              onOpenClient={(id) => { setSelectedClientId(id); setView("client"); }}
              onBuild={(ctx) => { setBuilderCtx(ctx); setView("builder"); }}
            />
          )}
          {view === "client" && selectedClient && (
            <ClientDetail
              client={selectedClient}
              workouts={workouts} exercises={exercises} logs={logs} attendance={attendance} unitPref={unitPref}
              onUpdate={(patch) => setClients(clients.map(c => c.id === selectedClient.id ? {...c, ...patch} : c))}
              onBuild={(ctx) => { setBuilderCtx({clientId: selectedClient.id, ...ctx}); setView("builder"); }}
              onViewAsClient={() => setView("clientView")}
              onApplyTemplate={(template, date, mode) => {
                const cloned = {
                  ...template,
                  id: uid("w"),
                  clientId: selectedClient.id,
                  coachId: currentCoachId,
                  date,
                  isTemplate: false,
                  blocks: template.blocks.map(b => ({...b})), // deep-copy
                };
                if (mode === "quick") {
                  setWorkouts([...workouts, cloned]);
                  notify(`"${template.name}" assigned to ${selectedClient.name.split(" ")[0]}`);
                } else {
                  // Edit-first: open builder pre-filled, save adds it
                  setBuilderCtx({ workoutId: cloned.id, clientId: selectedClient.id, date, prefill: cloned });
                  setView("builder");
                }
              }}
              onLog={(log) => { setLogs([...logs, {...log, id: uid("log")}]); notify("Logged"); }}
              onAttendance={(rec) => { setAttendance([...attendance.filter(a => a.workoutId !== rec.workoutId), {...rec, id: uid("att")}]); notify(`Marked ${rec.status}`); }}
              onDeleteLog={(id) => setLogs(logs.filter(l => l.id !== id))}
            />
          )}
          {view === "library" && (
            <ExerciseLibrary
              exercises={exercises} clients={clients}
              onAdd={(ex) => { setExercises([...exercises, ex]); notify("Exercise added"); }}
              onUpdate={(ex) => setExercises(exercises.map(x => x.id === ex.id ? ex : x))}
              onDelete={(id) => setExercises(exercises.filter(x => x.id !== id))}
            />
          )}
          {view === "templates" && (
            <TemplatesView
              workouts={workouts} exercises={exercises} clients={clients}
              onBuild={(ctx) => { setBuilderCtx(ctx); setView("builder"); }}
              onDelete={(id) => { setWorkouts(workouts.filter(w => w.id !== id)); notify("Template deleted"); }}
              onAssign={(template, clientId, date) => {
                const cloned = {
                  ...template,
                  id: uid("w"),
                  clientId,
                  coachId: currentCoachId,
                  date,
                  isTemplate: false,
                  blocks: template.blocks.map(b => ({...b})),
                };
                setWorkouts([...workouts, cloned]);
                const c = clients.find(cl => cl.id === clientId);
                notify(`"${template.name}" assigned to ${c?.name.split(" ")[0] || "client"}`);
              }}
            />
          )}
          {view === "builder" && (
            <WorkoutBuilder
              ctx={builderCtx} exercises={exercises} clients={clients} workouts={workouts} logs={logs}
              notify={notify} unitPref={unitPref}
              onCancel={() => { setView(builderCtx?.clientId ? "client" : "dashboard"); }}
              onSave={(workout) => {
                const existing = workouts.find(w => w.id === workout.id);
                if (existing) setWorkouts(workouts.map(w => w.id === workout.id ? workout : w));
                else setWorkouts([...workouts, workout]);
                notify(workout.isTemplate ? "Template saved" : "Workout saved");
                setView(builderCtx?.clientId ? "client" : "dashboard");
              }}
            />
          )}
          {view === "clientView" && selectedClient && (
            <ClientView
              client={selectedClient}
              workouts={workouts.filter(w => w.clientId === selectedClient.id && !w.isTemplate)}
              exercises={exercises}
              logs={logs.filter(l => workouts.some(w => w.id === l.workoutId && w.clientId === selectedClient.id))}
              unitPref={unitPref}
              onExit={() => setView("client")}
              onLog={(log) => { setLogs([...logs, {...log, id: uid("log"), source: "client"}]); notify("Logged"); }}
              onCreateSelfDirected={(workout) => {
                const w = { ...workout, id: uid("w"), coachId: currentCoachId, clientId: selectedClient.id, isTemplate: false, isSelfDirected: true };
                setWorkouts([...workouts, w]);
                notify("Session created");
                return w.id;
              }}
              onUpdateClient={(patch) => setClients(clients.map(c => c.id === selectedClient.id ? {...c, ...patch} : c))}
            />
          )}
        </main>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full grow-in"
          style={{background:"var(--ink)", color:"var(--paper)", fontSize:"13px", boxShadow:"0 10px 40px rgba(22,20,15,0.25)"}}>
          <Check size={14} className="inline mr-2" style={{verticalAlign:"-2px"}}/>{toast}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TOP BAR
   ============================================================ */
function TopBar({ coaches, currentCoach, clients, onSwitch, onAddCoach, onArchive, onRestore, onExport, onImport }) {
  const [time, setTime] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmImport, setConfirmImport] = useState(null); // holds File
  const [archiveTarget, setArchiveTarget] = useState(null); // coach being archived
  const [showArchived, setShowArchived] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const ref = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const dateStr = time.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });

  const activeCoaches = coaches.filter(c => !c.archived);
  const archivedCoaches = coaches.filter(c => c.archived);
  return (
    <header className="flex items-center justify-between px-5 py-3.5" style={{borderBottom:"1px solid var(--line)"}}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"var(--ink)"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h2M19 12h2M7 8h2M15 8h2M7 16h2M15 16h2M10 12h4" stroke="#F4EFE6" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="display text-xl font-medium tracking-tight">Ledger</span>
          <span className="text-xs mono uppercase" style={{color:"var(--muted)", letterSpacing:"0.08em"}}>coach</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs mono uppercase hidden md:inline" style={{color:"var(--muted)", letterSpacing:"0.08em"}}>{dateStr}</span>
        <button onClick={() => setShowHelp(true)}
          className="p-2 rounded-full hover-lift"
          style={{color:"var(--ink-2)"}}
          title="User guide">
          <HelpCircle size={18}/>
        </button>
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-1.5 rounded-full hover-lift"
            style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{background:"var(--ink)",color:"var(--paper)"}}>
              {initials(currentCoach?.name || "")}
            </div>
            <span className="text-sm font-medium">{currentCoach?.name || "—"}</span>
            <ChevronRight size={13} style={{transform: open ? "rotate(90deg)" : "rotate(0)", transition:"transform .15s", color:"var(--muted)"}}/>
          </button>
          {open && (
            <div className="absolute top-full right-0 mt-2 z-40 grow-in min-w-[240px] rounded-xl overflow-hidden"
              style={{background:"#fff", border:"1px solid var(--line)", boxShadow:"0 16px 40px rgba(22,20,15,0.15)"}}>
              {coaches.length >= 2 && (
              <>
              <div className="px-3 pt-3 pb-2">
                <div className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Switch coach</div>
              </div>
              <div className="px-1 pb-1">
                {activeCoaches.map(c => (
                  <div key={c.id}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left group"
                    style={c.id === currentCoach?.id ? {background:"var(--paper-2)"} : {}}>
                    <button onClick={() => { onSwitch(c.id); setOpen(false); }} className="flex items-center gap-2.5 flex-1 text-left hover-lift rounded">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                        style={{background: c.id === currentCoach?.id ? "var(--ink)" : "var(--paper-2)", color: c.id === currentCoach?.id ? "var(--paper)" : "var(--ink)"}}>
                        {initials(c.name)}
                      </div>
                      <span className="flex-1 text-sm font-medium">{c.name}</span>
                      {c.id === currentCoach?.id && <Check size={13} style={{color:"var(--accent)"}}/>}
                    </button>
                    {c.id !== currentCoach?.id && activeCoaches.length > 1 && (
                      <button onClick={() => { setArchiveTarget(c); setOpen(false); }}
                        className="p-1 rounded hover-lift opacity-0 group-hover:opacity-100"
                        style={{color:"var(--muted)"}} title="Archive coach">
                        <Archive size={13}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {archivedCoaches.length > 0 && (
                <>
                  <div className="divider mx-2"/>
                  <button onClick={() => setShowArchived(!showArchived)}
                    className="w-full flex items-center justify-between px-3 py-2 hover-lift text-left text-xs mono uppercase tracking-widest" style={{color:"var(--muted)"}}>
                    <span>Archived ({archivedCoaches.length})</span>
                    <ChevronRight size={11} style={{transform: showArchived ? "rotate(90deg)" : "rotate(0)", transition:"transform .15s"}}/>
                  </button>
                  {showArchived && (
                    <div className="px-1 pb-1">
                      {archivedCoaches.map(c => (
                        <div key={c.id} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                            style={{background:"var(--paper-2)", color:"var(--muted)"}}>
                            {initials(c.name)}
                          </div>
                          <span className="flex-1 text-sm" style={{color:"var(--muted)"}}>{c.name}</span>
                          <button onClick={() => onRestore?.(c.id)} className="text-[11px] mono uppercase tracking-wider hover-lift px-2 py-1 rounded" style={{color:"var(--ink-2)"}}>Restore</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="divider mx-2"/>
              <button onClick={() => { setAdding(true); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover-lift text-left text-sm" style={{color:"var(--ink-2)"}}>
                <Plus size={14}/> Add new coach
              </button>
              <div className="divider mx-2"/>
              <div className="px-3 pt-2 pb-1">
                <div className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Backup</div>
              </div>
              <button onClick={() => { onExport?.(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover-lift text-left text-sm" style={{color:"var(--ink-2)"}}>
                <ArrowUpRight size={14}/> Download backup (.json)
              </button>
              <button onClick={() => { fileRef.current?.click(); }}
                className="w-full flex items-center gap-2 px-3 py-2 pb-2.5 hover-lift text-left text-sm" style={{color:"var(--ink-2)"}}>
                <ArchiveRestore size={14}/> Restore from backup…
              </button>
              <div style={{borderTop:"1px solid var(--line-2)"}}/>
              </>
              )}
              <button onClick={() => { supabase.auth.signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover-lift text-left text-sm" style={{color:"var(--ink-2)"}}>
                <LogOut size={14}/> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" style={{display:"none"}}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setConfirmImport(f);
          e.target.value = "";
          setOpen(false);
        }}/>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)}/>}
      {adding && <AddCoachModal existing={coaches} onClose={() => setAdding(false)} onSave={(c) => { onAddCoach(c); setAdding(false); }}/>}
      {archiveTarget && (
        <ArchiveCoachModal
          coach={archiveTarget}
          activeCoaches={activeCoaches.filter(c => c.id !== archiveTarget.id)}
          activeClients={clients.filter(cl => cl.coachId === archiveTarget.id && !cl.archived)}
          onClose={() => setArchiveTarget(null)}
          onConfirm={(resolutions, force) => {
            const ok = onArchive?.(archiveTarget.id, resolutions, force);
            if (ok) setArchiveTarget(null);
          }}
        />
      )}
      {confirmImport && (
        <Modal onClose={() => setConfirmImport(null)} title="Restore from backup?">
          <div className="space-y-3 text-sm" style={{color:"var(--ink-2)"}}>
            <p>This will <b>replace everything currently in the app</b> — all coaches, clients, workouts, logs, exercise library, and attendance records — with the contents of:</p>
            <div className="card p-3 mono text-xs" style={{background:"var(--paper-2)"}}>
              {confirmImport.name} <span style={{color:"var(--muted)"}}>· {(confirmImport.size / 1024).toFixed(1)} KB</span>
            </div>
            <p>If you haven't backed up your current state, cancel and export first.</p>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
            <button onClick={() => setConfirmImport(null)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => { onImport?.(confirmImport); setConfirmImport(null); }} className="btn btn-primary">
              <ArchiveRestore size={14}/> Restore
            </button>
          </div>
        </Modal>
      )}
    </header>
  );
}

function AddCoachModal({ existing, onClose, onSave }) {
  const [name, setName] = useState("");
  const nameTaken = existing.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
  const canSave = name.trim() && !nameTaken;
  return (
    <Modal onClose={onClose} title="Add a coach">
      <div className="space-y-3">
        <p className="text-sm" style={{color:"var(--ink-2)"}}>
          Each coach has their own isolated clients, workouts, and logs. The exercise library is shared across all coaches.
        </p>
        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Coach name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Jordan Blake" autoFocus/>
          {nameTaken && <div className="text-xs mt-1.5" style={{color:"var(--accent)"}}>A coach with this name already exists.</div>}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => canSave && onSave({ id: "coach_" + uid(""), name: name.trim() })}
          disabled={!canSave}
          style={!canSave ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-primary"><Check size={14}/> Create & switch</button>
      </div>
    </Modal>
  );
}

/**
 * Archive a coach. Lists every active client and forces the user to choose
 * "Archive client" or "Transfer to <other coach>" for each one. A force-archive
 * escape hatch at the bottom requires typing ARCHIVE to confirm.
 */
function ArchiveCoachModal({ coach, activeCoaches, activeClients, onClose, onConfirm }) {
  // Per-client resolution state: { clientId: { action, targetCoachId? } }
  const [resolutions, setResolutions] = useState(() =>
    Object.fromEntries(activeClients.map(cl => [cl.id, { action: null, targetCoachId: null }]))
  );
  const [forceMode, setForceMode] = useState(false);
  const [forceText, setForceText] = useState("");

  const setRes = (clientId, patch) =>
    setResolutions({ ...resolutions, [clientId]: { ...resolutions[clientId], ...patch } });

  const allResolved = activeClients.every(cl => {
    const r = resolutions[cl.id];
    return r?.action === "archive" || (r?.action === "transfer" && r.targetCoachId);
  });

  const forceConfirmed = forceText.trim().toUpperCase() === "ARCHIVE";

  const canProceed = activeClients.length === 0 || allResolved || (forceMode && forceConfirmed);

  const handleConfirm = () => {
    if (!canProceed) return;
    const list = forceMode && !allResolved
      ? activeClients
          .map(cl => ({ clientId: cl.id, ...resolutions[cl.id] }))
          .filter(r => r.action === "archive" || (r.action === "transfer" && r.targetCoachId))
      : activeClients.map(cl => ({ clientId: cl.id, ...resolutions[cl.id] }));
    onConfirm(list, forceMode && !allResolved);
  };

  return (
    <Modal onClose={onClose} title={`Archive ${coach.name}?`}>
      <div className="space-y-4">
        <p className="text-sm" style={{color:"var(--ink-2)"}}>
          Archived coaches don't appear in the main switcher and can't be assigned new clients. You can restore them later.
        </p>

        {activeClients.length === 0 ? (
          <div className="card p-3 text-sm" style={{color:"var(--muted)"}}>
            No active clients to reassign. Ready to archive.
          </div>
        ) : (
          <div>
            <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{color:"var(--muted)"}}>
              Resolve {activeClients.length} active client{activeClients.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {activeClients.map(cl => {
                const r = resolutions[cl.id];
                return (
                  <div key={cl.id} className="card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{cl.name}</span>
                      <div className="flex gap-1 p-0.5 rounded-lg" style={{background:"var(--paper-2)"}}>
                        <button onClick={() => setRes(cl.id, { action: "archive", targetCoachId: null })}
                          className="px-2.5 py-1 rounded text-[11px] font-medium mono uppercase tracking-wide"
                          style={r?.action === "archive" ? {background:"var(--ink)", color:"var(--paper)"} : {background:"transparent", color:"var(--muted)"}}>
                          Archive
                        </button>
                        <button onClick={() => setRes(cl.id, { action: "transfer" })}
                          className="px-2.5 py-1 rounded text-[11px] font-medium mono uppercase tracking-wide"
                          style={r?.action === "transfer" ? {background:"var(--ink)", color:"var(--paper)"} : {background:"transparent", color:"var(--muted)"}}
                          disabled={activeCoaches.length === 0}>
                          Transfer
                        </button>
                      </div>
                    </div>
                    {r?.action === "transfer" && (
                      activeCoaches.length === 0 ? (
                        <div className="text-xs" style={{color:"var(--accent)"}}>No other active coaches available. Add one first or archive instead.</div>
                      ) : (
                        <select value={r.targetCoachId || ""} onChange={e => setRes(cl.id, { targetCoachId: e.target.value })}
                          className="field text-sm">
                          <option value="">Transfer to…</option>
                          {activeCoaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeClients.length > 0 && !allResolved && (
          <details className="text-xs" style={{color:"var(--muted)"}}>
            <summary className="cursor-pointer hover-lift inline-block py-1" onClick={() => setForceMode(!forceMode)}>
              {forceMode ? "Cancel force archive" : "Force archive without resolving all clients…"}
            </summary>
            {forceMode && (
              <div className="mt-2 p-3 rounded-lg" style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
                <p className="mb-2" style={{color:"var(--ink-2)"}}>
                  Unresolved clients will remain assigned to <b>{coach.name}</b> after archiving. They won't appear in the active client list and you'll need to handle them later. Type <b>ARCHIVE</b> to confirm.
                </p>
                <input value={forceText} onChange={e => setForceText(e.target.value)}
                  placeholder="ARCHIVE" className="field text-sm tabular"/>
              </div>
            )}
          </details>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={handleConfirm} disabled={!canProceed}
          style={!canProceed ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-primary">
          <Archive size={14}/> Archive coach
        </button>
      </div>
    </Modal>
  );
}

/* ============================================================
   HELP / USER GUIDE
   ============================================================ */

// Each section is { id, title, audience: ["coach"|"client"], keywords, body }
// `body` is a small subset of markdown rendered by MiniMarkdown below:
//   - # / ## / ### headings
//   - paragraphs separated by blank lines
//   - - bullet lists
//   - **bold** and *italic*
//   - `inline code`
//   - [text](#anchor-id) links to other sections
const HELP_CONTENT = [
  {
    id: "getting-started",
    title: "Getting started",
    audience: ["coach", "client"],
    keywords: ["intro","install","pwa","ipad","launch","first","date","navigation","calendar"],
    body: `## What Ledger is

Ledger is a coach-centric personal training app. The coach is the primary user — planning workouts, logging sessions, tracking progress for each client. Clients have a separate, simpler view (Today / History / Log Solo / Notes).

The aesthetic is intentionally calm — paper backgrounds, ink-dark text, a single warm-red accent. Numbers use tabular figures so columns line up. The design gets out of your way.

## Installing on iPad or iPhone

Open the Ledger URL in Safari, tap the **Share** icon, then **Add to Home Screen**. The app installs as a PWA and runs full-screen without browser chrome.

## First launch

If this is your first time, Ledger comes pre-loaded with a small set of demo coaches and clients so you can explore. Once you start adding your own data, you can either delete the demo records or just leave them — they don't affect anything.

If you're starting fresh on a new device, see [Restoring on a new device](#backup-restore).

## Date navigation

The home screen shows a 7-day strip with today highlighted. Tap any day to switch dates. The chevron arrows step a week at a time, and the date label opens a full date picker for jumping further.

"Today" is determined by your device's local timezone — it rolls over at local midnight, not UTC midnight.`
  },

  {
    id: "coaches",
    title: "Coaches",
    audience: ["coach"],
    keywords: ["coach","switch","add","archive","transfer","multi"],
    body: `Ledger supports multiple coaches on a single device. Each coach has their own isolated clients, workouts, logs, and attendance. The exercise library is **shared** across all coaches.

## Adding a coach

Tap your coach badge in the top right, then **Add new coach**. Pick a name. The new coach is created and you're switched to them.

## Switching coaches

Tap the coach badge to open the coach menu. Tap any coach to switch. Switching takes you back to the dashboard.

## Archiving a coach

To archive a coach who's no longer active, hover (or long-press on iPad) over their entry in the coach menu and tap the archive icon. **You cannot archive the currently-active coach** — switch to a different one first.

When you archive a coach, you have to decide what happens to each of their active clients. The archive dialog lists them and asks you to either:

- **Archive** the client, or
- **Transfer** the client to another active coach.

Once every client is resolved, the **Archive coach** button activates.

If you need to archive without resolving everything, expand **Force archive without resolving all clients…** at the bottom of the dialog and type \`ARCHIVE\` to confirm. Unresolved clients stay assigned to the archived coach and won't show up in active client lists — you can fix them later by restoring the coach.

## Restoring an archived coach

Archived coaches appear in a collapsible section at the bottom of the coach menu. Tap **Restore** to bring them back as an active coach.`
  },

  {
    id: "clients",
    title: "Clients",
    audience: ["coach"],
    keywords: ["client","add","profile","goals","injuries","equipment","level","archive"],
    body: `## Adding a client

Use the **+** in the Clients section of the sidebar. Required: a name. Optional but useful: age, level (beginner / intermediate / advanced), goals, injuries, available equipment.

The injury and equipment fields drive the **"Filter for [client]'s limitations & equipment"** toggle in the workout builder, so it's worth filling them in.

## Profile fields

Open a client and go to the **Profile** tab to edit:

- **Goals** — free text. What the client is working toward.
- **Injuries** — comma-separated list. Used to filter exercises with matching contraindications.
- **Equipment** — comma-separated list of what they have access to.
- **Level** — beginner / intermediate / advanced. Used for default filtering.

## Archiving and reactivating

Clients aren't deleted — they're archived. From the Profile tab, tap **Archive client**. Archived clients move to the bottom of the client list under a collapsible section.

To reactivate, expand the archived list and tap **Restore** on the client.`
  },

  {
    id: "exercise-library",
    title: "Exercise library",
    audience: ["coach", "client"],
    keywords: ["exercise","library","movement","push","pull","squat","hinge","core","mobility","stretch","cardio","filter","custom","duplicate"],
    body: `Ledger ships with around 230 exercises covering bodyweight, dumbbell, barbell, machine, cable, kettlebell, band, and bodyweight movements.

## Movement categories

Every exercise belongs to one of eight movement patterns:

- **push** — chest, shoulders, triceps
- **pull** — back, biceps, rear delts
- **squat** — knee-dominant lower body
- **hinge** — hip-dominant lower body, posterior chain, Olympic lifts
- **core** — trunk
- **cardio** — conditioning
- **mobility** — active drills, CARs, warm-up movements
- **stretch** — passive holds, flexibility work

Each category has its own dot color so you can scan a workout at a glance.

## Filtering

The library has filters for movement, equipment, and difficulty. The filter chips at the top toggle on and off — tap one to filter, tap again to clear.

## "Filter for [client]'s limitations & equipment"

When building a workout for a specific client, this toggle hides exercises that conflict with the client's listed injuries or require equipment they don't have. Off by default; turn it on once the client's profile is filled in.

## Adding a custom exercise

In Exercise Library, tap **+ New exercise**. Fill in the name, movement category, target muscles, equipment, difficulty, default sets/reps/rest, and any tags or contraindications. Custom exercises live in the same shared library as the seeded ones.

## Why duplicate names are blocked

Two exercises with the same name break logging and progress tracking. Ledger refuses to create one. If you need a variant, name it distinctly (e.g., "Romanian Deadlift — Trap Bar").`
  },

  {
    id: "building-workouts",
    title: "Building workouts",
    audience: ["coach"],
    keywords: ["workout","build","blocks","sets","reps","weight","rest","template","kg","lb","balance"],
    body: `## Creating a workout

From a client's **Program** tab, tap **+ Build new** to start from scratch or **From template** to start from an existing template.

## Blocks

Each exercise in a workout is a **block**. A block has:

- **Sets** — number of working sets
- **Reps** — text field, accepts patterns like \`8\`, \`8-10\`, \`30s\`, \`12/leg\`
- **Weight** — planned working weight (optional)
- **Rest** — seconds between sets
- **Notes** — anything the coach or client should remember mid-set

Drag blocks to reorder. The arrows on the left side of each block also move it up or down.

## Per-block lb/kg toggle

Each block has its own little **lb / kg** toggle next to the delete button. Toggling it changes the display unit — the canonical weight is preserved, so flipping a 100 lb block to kg shows 45.4 kg, the same load. Default is lb.

## Balance suggestion

Below the workout, a banner suggests missing movement patterns ("This workout is missing: pull, hinge"). Quick-add chips below let you drop in suggested exercises.

*Note: this banner will be removed in a future version in favor of a different approach.*

## Saving the workout

Tap **Save workout**. The workout appears on the client's program for the date you set.

## Saving as a template

Check **Save as template** before saving. The workout becomes available under Templates, where it can be applied to any client on any date — see [Templates](#templates).`
  },

  {
    id: "templates",
    title: "Templates",
    audience: ["coach"],
    keywords: ["template","save","reuse","apply"],
    body: `Templates are reusable workout blueprints. Use them when:

- You program the same session for multiple clients
- A client repeats a workout structure across weeks
- You have go-to "Day 1 / Day 2 / Day 3" splits you reuse

## Saving a workout as a template

In the workout builder, check **Save as template** before saving. Templates aren't tied to a client or date.

## Applying a template

From a client's **Program** tab, tap **From template**, choose the template, set the date, and tap apply. The template is copied to that client's program — edits to the copy don't affect the original template.

## Editing a template

Open Templates from the sidebar. Tap a template to open it in the builder. Save to update the template itself (this won't change any workouts that were previously created from it).`
  },

  {
    id: "logging",
    title: "Logging sessions",
    audience: ["coach", "client"],
    keywords: ["log","session","attendance","present","missed","cancelled","modified","per-set","undo","edit"],
    body: `## The single-entry-per-exercise model

Ledger uses **one log per exercise**, not one log per set. Most of the time, all sets of an exercise are the same — same weight, same reps. Logging a single entry covers the whole exercise.

When sets diverge — different weights, dropped reps, an injury mid-set — check the **Modified** box on the log card. The card expands to show one row per set, each editable individually.

This keeps logging fast for the common case while still letting you record exactly what happened when it matters.

## Attendance

Each scheduled workout has three states:

- **Present** — client showed up
- **Missed** — client didn't show
- **Cancelled** — session was cancelled (different from missed)

Attendance is separate from logging. You can mark a session present without logging exercises (useful for technique-only sessions).

## Logging "as planned"

If the client did the workout exactly as written, just tap **Mark done** on each block. Fill in actual sets / reps / weight if anything differed.

## Logging "Modified"

Tap **Modified** to expand to per-set entry. Each set has its own reps and weight inputs. Add or remove rows as needed.

## Editing or undoing a log

A logged exercise shows as a green card. Tap the **×** to undo the log entirely. To edit details, undo first, then re-log.`
  },

  {
    id: "progress-measurements",
    title: "Progress & measurements",
    audience: ["coach", "client"],
    keywords: ["progress","prs","records","bodyweight","measurements","waist","hips","chest","arm","thigh","body fat"],
    body: `## Progress tab

The Progress tab shows:

- **PRs** — best logged set per exercise across all sessions
- **Bodyweight chart** — sparkline of recent bodyweight entries

## Measurements tab

The Measurements tab tracks dated entries for:

- **Bodyweight** (lb / kg)
- **Body fat %**
- **Waist, hips, chest** circumferences (in / cm)
- **Arm L / Arm R** — bilateral
- **Thigh L / Thigh R** — bilateral

Each input has its own inline lb/kg or in/cm toggle. The canonical storage is imperial (lb, in) — toggling units doesn't change the underlying value, just how it's displayed.

## Adding a measurement

Tap **+ Add measurement**. Pick a date (defaults to today), fill in any subset of metrics (skip the ones you didn't measure), and save. Each metric becomes its own dated entry.

## Editing or deleting

Each metric card lists its history newest-first. Tap the pencil icon to edit a row inline (date, value, unit). Tap the × to delete.

## Bodyweight in two places

Bodyweight appears in both the Progress tab (as the bodyweight chart) and the Measurements tab (as one of the metrics). They share data — the Measurements tab is the authoritative source going forward.`
  },

  {
    id: "client-view",
    title: "Client-facing view",
    audience: ["coach", "client"],
    keywords: ["client view","today","history","log solo","notes","self-directed"],
    body: `Coaches can switch into a client-facing view to see what the client sees, or to hand the iPad to a client mid-session.

## Switching to client view

From a client's profile, tap **View as client** in the Profile tab. To exit, tap the back arrow.

## The four client tabs

- **Today** — the workout scheduled for today, ready to log
- **History** — past sessions with expandable detail
- **Log solo** — start a self-directed workout (no scheduled plan; client picks exercises and logs as they go)
- **Notes** — free-form notes the client can read or add to

## Self-directed sessions

If a client wants to do a workout that wasn't planned, **Log solo** lets them build one on the fly. Pick exercises from the library, set sets/reps/weight as you go, and log normally. The session appears in history flagged as self-directed.`
  },

  {
    id: "backup-restore",
    title: "Backup & restore",
    audience: ["coach"],
    keywords: ["backup","restore","export","import","json","new device","data loss","schema","migration"],
    body: `Ledger stores all data in your device's localStorage. There's no cloud sync — moving between devices, or recovering after data loss, requires manual backup files.

## What's in a backup

A backup is a single JSON file containing:

- All coaches (active and archived)
- All clients (across all coaches)
- The exercise library (shared, including custom exercises)
- All planned workouts and templates
- All logs and attendance records

Display preferences (per-block units, etc.) are included.

## When to back up

- Before any major change to your data
- Before installing app updates
- Once a week as routine practice
- Before switching devices

## Creating a backup

Coach badge menu → **Download backup (.json)**. The file downloads with today's date in the filename: \`ledger-backup-YYYY-MM-DD.json\`.

## Restoring on a new device

1. Install Ledger on the new device.
2. Coach badge menu → **Restore from backup…**
3. Select the JSON file.
4. Confirm the warning. **Restore replaces everything in the app** — coaches, clients, workouts, logs, library.

## Schema versions

Each backup carries a \`schemaVersion\` number. When the app updates and the data shape changes, older backups are migrated forward automatically on import. Backups from newer versions can't be imported into older app builds.`
  },

  {
    id: "troubleshooting",
    title: "Troubleshooting & tips",
    audience: ["coach", "client"],
    keywords: ["troubleshoot","tips","numeric","input","loading","stuck"],
    body: `## Numeric input fields

Weight, sets, rest, and other number fields:

- Reject letters as you type — only digits (and a single decimal point for weights) are accepted
- Don't snap to 0 when cleared — the field stays empty until you type or tab away
- Bring up the numeric keyboard automatically on iPad / iPhone

The reps field is the exception. It stays free-text because reps can be patterns like \`8-10\`, \`30s\`, or \`12/leg\`.

## Per-block lb/kg toggle behavior

Toggling lb ↔ kg on a block doesn't change the actual weight — only how it's displayed. The underlying storage is always lb. A 100 lb plan toggled to kg shows as 45.4 kg, the same load.

## App stuck on "loading…"

The load screen showing for more than a few seconds usually means localStorage is corrupted or unreadable. Try:

1. Closing and reopening the app
2. If that fails, your most recent backup is your fallback — see [Backup & restore](#backup-restore)

## Lost data

There's no recovery short of a backup. localStorage is per-device, per-browser, per-domain. Clearing browser data, uninstalling the PWA, or factory-resetting the device wipes Ledger data with it. Back up regularly.`
  },

  {
    id: "about",
    title: "About",
    audience: ["coach", "client"],
    keywords: ["about","privacy","storage","developer","version"],
    body: `## Storage model

All data lives in your device's localStorage. Ledger does not send data to any server. There is no account system, no cloud sync, no analytics, no telemetry.

## Privacy

Your client data — names, goals, injuries, measurements, logs — never leaves your device unless you export a backup file and share it yourself.

## Schema version

The current data schema version is 7. The app handles migrations automatically when loading older data. Canonical storage is lb (weight) and in (length); display units (lb/kg, in/cm) are a per-input toggle.

## Credits

Developed and maintained by Robert Overman.`
  },
];

// Render a small subset of markdown into JSX. Supports headings (## ###),
// paragraphs, bullet lists (- item), **bold**, *italic*, \`inline code\`, and
// [text](#anchor) intra-guide links.
function MiniMarkdown({ source, onLink }) {
  const renderInline = (text, keyBase) => {
    // Process in passes: links → bold → italic → code. Each pass returns an
    // array of strings/elements that the next pass operates on.
    let parts = [text];
    const transform = (regex, build) => {
      const out = [];
      parts.forEach((part, i) => {
        if (typeof part !== "string") { out.push(part); return; }
        let last = 0; let m; const re = new RegExp(regex, "g");
        while ((m = re.exec(part)) !== null) {
          if (m.index > last) out.push(part.slice(last, m.index));
          out.push(build(m, `${keyBase}-${i}-${m.index}`));
          last = m.index + m[0].length;
        }
        if (last < part.length) out.push(part.slice(last));
      });
      parts = out;
    };
    transform(/\[([^\]]+)\]\(#([a-z0-9-]+)\)/, (m, k) => (
      <a key={k} href={`#${m[2]}`} onClick={(e) => { e.preventDefault(); onLink?.(m[2]); }}
         style={{color:"var(--accent)", textDecoration:"underline"}}>{m[1]}</a>
    ));
    transform(/\*\*([^*]+)\*\*/, (m, k) => <strong key={k}>{m[1]}</strong>);
    transform(/\*([^*]+)\*/, (m, k) => <em key={k}>{m[1]}</em>);
    transform(/`([^`]+)`/, (m, k) => <code key={k} className="mono" style={{background:"var(--paper-2)", padding:"1px 5px", borderRadius:"3px", fontSize:"0.9em"}}>{m[1]}</code>);
    return parts.map((p, i) => typeof p === "string" ? <span key={`s${i}`}>{p}</span> : p);
  };

  // Block-level: split on blank lines, classify each block.
  const lines = source.split("\n");
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.length) { blocks.push(buf); buf = []; } };
  for (const line of lines) {
    if (line.trim() === "") flush();
    else buf.push(line);
  }
  flush();

  return (
    <div className="space-y-3 leading-relaxed" style={{color:"var(--ink-2)", fontSize:"14px"}}>
      {blocks.map((blockLines, bi) => {
        const first = blockLines[0];
        // Headings
        if (/^#{1,3}\s/.test(first)) {
          const level = first.match(/^(#+)\s/)[1].length;
          const text = first.replace(/^#+\s/, "");
          if (level === 1) return <h2 key={bi} className="display text-2xl tracking-tight mt-2" style={{color:"var(--ink)"}}>{renderInline(text, `h-${bi}`)}</h2>;
          if (level === 2) return <h3 key={bi} className="display text-lg tracking-tight mt-4" style={{color:"var(--ink)"}}>{renderInline(text, `h-${bi}`)}</h3>;
          return <h4 key={bi} className="font-semibold text-sm mt-3" style={{color:"var(--ink)"}}>{renderInline(text, `h-${bi}`)}</h4>;
        }
        // Bullet list
        if (blockLines.every(l => /^-\s/.test(l))) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1.5">
              {blockLines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^-\s/, ""), `li-${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        // Paragraph (join lines with spaces)
        return <p key={bi}>{renderInline(blockLines.join(" "), `p-${bi}`)}</p>;
      })}
    </div>
  );
}

function HelpModal({ onClose, audience = "coach" }) {
  const visibleSections = HELP_CONTENT.filter(s => s.audience.includes(audience));
  const [activeId, setActiveId] = useState(visibleSections[0]?.id);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleSections;
    return visibleSections.filter(s => {
      const hay = (s.title + " " + s.keywords.join(" ") + " " + s.body).toLowerCase();
      return hay.includes(q);
    });
  }, [search, visibleSections]);

  const active = visibleSections.find(s => s.id === activeId);
  const goTo = (id) => {
    if (visibleSections.some(s => s.id === id)) setActiveId(id);
  };

  // Close on escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(22,20,15,0.45)"}}>
      <div className="grow-in w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col"
        style={{background:"var(--paper)", border:"1px solid var(--line)", height:"min(90vh, 720px)", boxShadow:"0 24px 60px rgba(22,20,15,0.25)"}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:"1px solid var(--line)"}}>
          <div className="flex items-center gap-2.5">
            <HelpCircle size={18} style={{color:"var(--accent)"}}/>
            <span className="display text-xl tracking-tight">User guide</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover-lift" style={{color:"var(--muted)"}}><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* TOC */}
          <aside className="w-60 flex-shrink-0 flex flex-col" style={{borderRight:"1px solid var(--line)", background:"var(--paper-2)"}}>
            <div className="p-3" style={{borderBottom:"1px solid var(--line-2)"}}>
              <div className="relative">
                <Search size={13} style={{position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)", color:"var(--muted)"}}/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="field text-sm" style={{paddingLeft:"30px", padding:"7px 10px 7px 30px", fontSize:"13px"}}/>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="text-xs px-2 py-3" style={{color:"var(--muted)"}}>No matches</div>
              )}
              {filtered.map(s => (
                <button key={s.id} onClick={() => setActiveId(s.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded text-sm hover-lift block"
                  style={s.id === activeId
                    ? {background:"var(--ink)", color:"var(--paper)"}
                    : {color:"var(--ink-2)"}}>
                  {s.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {active ? (
              <>
                <div className="mb-4">
                  <h1 className="display text-3xl tracking-tight" style={{color:"var(--ink)"}}>{active.title}</h1>
                  <div className="mt-1.5 flex gap-1.5">
                    {active.audience.map(a => (
                      <span key={a} className="chip" style={{fontSize:"10px", padding:"2px 8px"}}>{a}</span>
                    ))}
                  </div>
                </div>
                <MiniMarkdown source={active.body} onLink={goTo}/>
              </>
            ) : (
              <div className="text-sm" style={{color:"var(--muted)"}}>Select a section.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar({ view, setView, clients, selectedClientId, onSelectClient, onAddClient }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = clients.filter(c => !c.archived);
  const archived = clients.filter(c => c.archived);
  const q = search.toLowerCase();
  const filteredActive = active.filter(c => c.name.toLowerCase().includes(q));
  const filteredArchived = archived.filter(c => c.name.toLowerCase().includes(q));

  // auto-expand archive when searching and there are matches
  useEffect(() => { if (search && filteredArchived.length > 0) setShowArchived(true); }, [search, filteredArchived.length]);

  const navItem = (key, label, Icon) => (
    <button
      onClick={() => setView(key)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover-lift text-left"
      style={view === key
        ? { background: "var(--ink)", color: "var(--paper)" }
        : { background: "transparent", color: "var(--ink)" }}
    >
      <Icon size={16} strokeWidth={view===key?2.2:1.8}/>
      <span className="text-[14px] font-medium">{label}</span>
    </button>
  );

  return (
    <aside className="w-[240px] flex flex-col flex-shrink-0" style={{background:"var(--paper-2)", borderRight:"1px solid var(--line)"}}>
      <div className="px-4 pt-4 pb-2 space-y-1">
        {navItem("dashboard", "Home", LayoutGrid)}
        {navItem("library", "Exercise Library", BookOpen)}
        {navItem("templates", "Templates", FileText)}
      </div>

      <div className="mx-4 my-3 divider"/>

      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="display text-xs uppercase tracking-widest" style={{color:"var(--muted)"}}>Clients</span>
          <span className="mono tabular text-xs" style={{color:"var(--ink-2)"}}>{active.length}</span>
        </div>
        <button onClick={() => setAdding(true)} className="p-1 rounded hover-lift" style={{color:"var(--ink-2)"}} aria-label="Add client">
          <Plus size={15}/>
        </button>
      </div>

      <div className="px-4 pb-2 relative">
        <Search size={14} className="absolute top-1/2 -translate-y-1/2" style={{color:"var(--muted)", left: '22px'}}/>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients"
          className="w-full pl-8 pr-3 py-2 rounded-lg text-sm ring-focus"
          style={{background:"#fff", border:"1px solid var(--line)"}}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {filteredActive.map(c => (
          <ClientRow key={c.id} client={c} active={c.id === selectedClientId && view === "client"} onClick={() => onSelectClient(c.id)}/>
        ))}
        {filteredActive.length === 0 && active.length > 0 && (
          <div className="px-3 py-4 text-sm text-center" style={{color:"var(--muted)"}}>No matches.</div>
        )}
        {active.length === 0 && (
          <div className="px-3 py-4 text-sm text-center" style={{color:"var(--muted)"}}>No active clients.</div>
        )}

        {archived.length > 0 && (
          <>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="w-full flex items-center justify-between px-3 py-2 mt-3 rounded-lg hover-lift"
              style={{color:"var(--muted)"}}
            >
              <span className="flex items-center gap-2">
                <Archive size={13}/>
                <span className="display text-xs uppercase tracking-widest">Archived</span>
                <span className="mono tabular text-xs">{archived.length}</span>
              </span>
              <ChevronRight size={14} style={{transition:"transform .2s", transform: showArchived ? "rotate(90deg)":"rotate(0)"}}/>
            </button>
            {showArchived && (
              <div className="mt-1 slide-in">
                {filteredArchived.map(c => (
                  <ClientRow key={c.id} client={c} active={c.id === selectedClientId && view === "client"} onClick={() => onSelectClient(c.id)} archived/>
                ))}
                {filteredArchived.length === 0 && (
                  <div className="px-3 py-2 text-xs text-center" style={{color:"var(--muted)"}}>No archived matches.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {adding && <AddClientModal onClose={() => setAdding(false)} onSave={(c) => { onAddClient(c); setAdding(false); }}/>}
    </aside>
  );
}

function ClientRow({ client, active, onClick, archived }) {
  const flags = (client.injuries || []).length;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left hover-lift mb-0.5"
      style={active
        ? { background: "var(--ink)", color: "var(--paper)" }
        : { background: "transparent", opacity: archived ? 0.62 : 1 }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold display"
        style={active
          ? { background: "var(--paper)", color: "var(--ink)" }
          : { background: archived ? "var(--paper-2)" : "#fff", color: "var(--ink)", border: "1px solid var(--line)" }}>
        {initials(client.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium truncate flex items-center gap-1.5">
          {client.name}
          {archived && !active && <Archive size={10} style={{color:"var(--muted)", flexShrink:0}}/>}
        </div>
        <div className="text-[11px] truncate mono uppercase tracking-wide" style={{color: active ? "rgba(244,239,230,.6)" : "var(--muted)", letterSpacing:"0.06em"}}>
          {archived ? `archived ${client.archivedAt ? shortDate(client.archivedAt) : ""}` : `${client.level} · ${client.equipment.length} access`}
        </div>
      </div>
      {flags > 0 && !archived && <AlertTriangle size={13} style={{color: active ? "#F2A77D" : "var(--accent)"}}/>}
    </button>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ clients, workouts, logs, attendance, onOpenClient, onBuild }) {
  const t = today();
  const [selectedDate, setSelectedDate] = useState(t);
  const thisWeekStart = addDays(t, -new Date().getDay());
  const activeClients = clients.filter(c => !c.archived);
  const archivedIds = new Set(clients.filter(c => c.archived).map(c => c.id));
  const visibleWorkouts = workouts.filter(w => !w.clientId || !archivedIds.has(w.clientId));
  const dayWorkouts = visibleWorkouts.filter(w => !w.isTemplate && w.date === selectedDate);
  const upcoming = visibleWorkouts.filter(w => !w.isTemplate && w.date > selectedDate).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);
  const weekWorkouts = visibleWorkouts.filter(w => !w.isTemplate && w.date >= thisWeekStart && w.date <= addDays(thisWeekStart, 6));
  const attendanceRate = useMemo(() => {
    const past = visibleWorkouts.filter(w => !w.isTemplate && w.date <= t);
    if (!past.length) return 100;
    const hits = attendance.filter(a => a.status === "present").length;
    return Math.round((hits / past.length) * 100);
  }, [visibleWorkouts, attendance, t]);

  // Dates with any sessions (for the mini week strip indicators)
  const datesWithSessions = useMemo(() => {
    const set = new Set();
    visibleWorkouts.forEach(w => { if (!w.isTemplate && w.date) set.add(w.date); });
    return set;
  }, [visibleWorkouts]);

  const isToday = selectedDate === t;
  const dayOffset = Math.round((new Date(selectedDate+"T00:00:00") - new Date(t+"T00:00:00")) / (1000*60*60*24));
  const relLabel = dayOffset === 0 ? "Today" : dayOffset === -1 ? "Yesterday" : dayOffset === 1 ? "Tomorrow" : null;
  const selDate = new Date(selectedDate+"T00:00:00");

  // 7-day strip centered on selected date
  const weekStrip = useMemo(() => {
    return [-3,-2,-1,0,1,2,3].map(off => addDays(selectedDate, off));
  }, [selectedDate]);

  return (
    <div className="px-6 py-6 slide-in">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="mono text-xs uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>
            — {relLabel || selDate.toLocaleDateString(undefined, { weekday:'long' })}
          </div>
          <h1 className="display text-5xl font-light tracking-tight mt-1" style={{color:"var(--ink)"}}>
            {relLabel ? `${relLabel}.` : `${selDate.toLocaleDateString(undefined, { weekday:'long' })}.`}
          </h1>
          <div className="display text-xl italic mt-1" style={{color:"var(--ink-2)"}}>
            {selDate.toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onBuild({ date: selectedDate, isTemplate: false })} className="btn btn-primary"><Plus size={15}/> New workout</button>
        </div>
      </div>

      {/* Date navigation */}
      <div className="card p-3 mb-6 flex items-center gap-2 flex-wrap">
        <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="btn btn-ghost btn-sm" aria-label="Previous day">
          <ChevronLeft size={14}/>
        </button>
        <div className="flex items-center gap-1 flex-1 justify-center">
          {weekStrip.map(d => {
            const dd = new Date(d+"T00:00:00");
            const isSelected = d === selectedDate;
            const isTodayCell = d === t;
            const hasSession = datesWithSessions.has(d);
            return (
              <button key={d} onClick={() => setSelectedDate(d)}
                className="flex flex-col items-center justify-center rounded-lg hover-lift transition-all"
                style={{
                  width: "44px", height: "52px",
                  background: isSelected ? "var(--ink)" : isTodayCell ? "var(--paper-2)" : "transparent",
                  color: isSelected ? "var(--paper)" : "var(--ink)",
                  border: isTodayCell && !isSelected ? "1px solid var(--line)" : "1px solid transparent",
                }}>
                <span className="mono text-[9px] uppercase tracking-wider" style={{opacity: 0.7}}>
                  {dd.toLocaleDateString(undefined, { weekday: 'short' }).slice(0,2)}
                </span>
                <span className="display text-lg tabular leading-none mt-0.5">{dd.getDate()}</span>
                <span className="mt-0.5" style={{
                  width: "4px", height: "4px", borderRadius: "999px",
                  background: hasSession ? (isSelected ? "var(--paper)" : "var(--accent)") : "transparent"
                }}/>
              </button>
            );
          })}
        </div>
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="btn btn-ghost btn-sm" aria-label="Next day">
          <ChevronRight size={14}/>
        </button>
        <div className="w-px h-6 mx-1" style={{background:"var(--line-2)"}}/>
        {!isToday && (
          <button onClick={() => setSelectedDate(t)} className="btn btn-ghost btn-sm">Today</button>
        )}
        <label className="relative">
          <input type="date" value={selectedDate} onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="field tabular" style={{padding:"6px 10px", fontSize:"13px", width: "auto"}}/>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Active clients" value={activeClients.length} accent />
        <StatCard label="Sessions this week" value={weekWorkouts.length}/>
        <StatCard label="Attendance" value={`${attendanceRate}%`} suffix=""/>
      </div>

      <div>
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="display text-2xl tracking-tight">
              {isToday ? "Today's sessions" : dayOffset < 0 ? "Sessions that day" : "Scheduled"}
            </h2>
            <span className="mono text-xs uppercase tracking-wider" style={{color:"var(--muted)"}}>{dayWorkouts.length} {dayOffset < 0 ? "logged" : "scheduled"}</span>
          </div>
          {dayWorkouts.length === 0 ? (
            <EmptyBlock
              title={isToday ? "No sessions on the calendar." : dayOffset < 0 ? "No sessions that day." : "Nothing scheduled yet."}
              body={isToday ? "Assign a workout to a client or start a new one." : dayOffset < 0 ? "Either nothing was scheduled, or you hadn't started using Ledger yet." : `Use the button below to schedule a workout for ${selDate.toLocaleDateString(undefined, { month:'long', day:'numeric' })}.`}
              actions={dayOffset >= 0 ? <button onClick={() => onBuild({ date: selectedDate, isTemplate: false })} className="btn btn-primary"><Plus size={15}/> Build a workout</button> : null}
            />
          ) : (
            <div className="space-y-3">
              {dayWorkouts.map(w => (
                <TodaySessionCard key={w.id} workout={w} clients={clients} logs={logs} attendance={attendance} onOpen={onOpenClient}/>
              ))}
            </div>
          )}

          <div className="mt-10">
            <h2 className="display text-2xl tracking-tight mb-4">{isToday ? "Coming up" : dayOffset < 0 ? "After that day" : "Following days"}</h2>
            {upcoming.length === 0 ? (
              <div className="text-sm" style={{color:"var(--muted)"}}>Nothing scheduled.</div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map(w => {
                  const c = clients.find(cl => cl.id === w.clientId);
                  return (
                    <button key={w.id} onClick={() => c && onOpenClient(c.id)} className="w-full flex items-center gap-4 py-3 px-4 rounded-xl hover-lift text-left"
                      style={{background:"#fff", border:"1px solid var(--line-2)"}}>
                      <div className="text-center w-12 flex-shrink-0">
                        <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{weekday:'short'})}</div>
                        <div className="display text-xl tabular">{new Date(w.date+"T00:00:00").getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{w.name}</div>
                        <div className="text-xs truncate" style={{color:"var(--muted)"}}>{c?.name || "Unassigned"} · {w.blocks.length} exercises</div>
                      </div>
                      <ChevronRight size={16} style={{color:"var(--muted)"}}/>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4 hover-lift" style={accent ? {background:"var(--ink)", color:"var(--paper)", borderColor:"var(--ink)"} : {}}>
      <div className="mono text-[10px] uppercase tracking-[0.15em]" style={{color: accent ? "rgba(244,239,230,.55)" : "var(--muted)"}}>{label}</div>
      <div className="display text-4xl font-light tabular mt-1.5" style={{color: accent ? "var(--paper)" : "var(--ink)"}}>{value}</div>
    </div>
  );
}

function EmptyBlock({ title, body, actions }) {
  return (
    <div className="card p-8 text-center">
      <div className="display text-xl tracking-tight mb-1.5">{title}</div>
      <div className="text-sm mb-5" style={{color:"var(--muted)"}}>{body}</div>
      {actions}
    </div>
  );
}

function TodaySessionCard({ workout, clients, logs, attendance, onOpen }) {
  const c = clients.find(cl => cl.id === workout.clientId);
  const workoutLogs = logs.filter(l => l.workoutId === workout.id);
  const att = attendance.find(a => a.workoutId === workout.id);
  const completed = workoutLogs.length > 0;
  return (
    <button onClick={() => c && onOpen(c.id)} className="w-full card p-5 hover-lift text-left"
      style={{borderColor: completed ? "var(--good)" : "var(--line-2)"}}>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center display text-sm font-medium flex-shrink-0"
          style={{background:"var(--paper-2)", border:"1px solid var(--line)"}}>{c ? initials(c.name) : "—"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="display text-xl tracking-tight">{c?.name || "Unassigned"}</span>
            {att && <span className="chip" style={att.status==='present'?{background:"#E4F0E8",color:"var(--good)",borderColor:"#BFDCC9"}:{}}>{att.status}</span>}
          </div>
          <div className="text-sm mt-0.5" style={{color:"var(--ink-2)"}}>{workout.name}</div>
          <div className="text-xs mt-1 mono uppercase tracking-wider" style={{color:"var(--muted)"}}>
            {workout.blocks.length} exercises · {workoutLogs.length} sets logged
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completed ? <div className="chip" style={{background:"#E4F0E8",color:"var(--good)",borderColor:"#BFDCC9"}}><Check size={12}/> In progress</div> : <span className="chip">Ready</span>}
          <ArrowRight size={16}/>
        </div>
      </div>
    </button>
  );
}

function RecentActivity() { return null; } // deprecated — kept as empty stub to avoid stale references

/* ============================================================
   CLIENT DETAIL
   ============================================================ */
function ClientDetail({ client, workouts, exercises, logs, attendance, unitPref = "lb", onUpdate, onBuild, onApplyTemplate, onLog, onAttendance, onDeleteLog, onViewAsClient }) {
  const [tab, setTab] = useState("program"); // program | history | profile | progress
  const clientWorkouts = workouts.filter(w => w.clientId === client.id && !w.isTemplate);
  const clientLogs = logs.filter(l => clientWorkouts.some(w => w.id === l.workoutId));

  return (
    <div className="p-6 pb-20 slide-in">
      <div>
        {client.archived && (
          <div className="card mb-5 px-5 py-4 flex items-center justify-between flex-wrap gap-3 grow-in"
            style={{background:"var(--paper-2)", borderStyle:"dashed", borderColor:"var(--line)"}}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"#fff", border:"1px solid var(--line)"}}>
                <Archive size={15} style={{color:"var(--muted)"}}/>
              </div>
              <div>
                <div className="display text-lg tracking-tight">Archived client</div>
                <div className="text-xs mono uppercase tracking-wider" style={{color:"var(--muted)"}}>
                  Archived {client.archivedAt ? prettyDate(client.archivedAt) : ""} · historical data preserved
                </div>
              </div>
            </div>
            <button onClick={() => onUpdate({ archived: false, archivedAt: null })} className="btn btn-primary">
              <ArchiveRestore size={14}/> Reactivate
            </button>
          </div>
        )}
        <ClientHeader client={client} unitPref={unitPref}/>
        <div className="flex items-center gap-5 mb-6 mt-6" style={{borderBottom:"1px solid var(--line)"}}>
          {[
            ["program","Program"],
            ["history","History"],
            ["progress","Progress"],
            ["measurements","Measurements"],
            ["profile","Profile"],
          ].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="pb-3 text-sm font-medium relative"
              style={{color: tab===k?"var(--ink)":"var(--muted)"}}>
              {l}
              {tab===k && <div className="absolute -bottom-px left-0 right-0" style={{height:"2px", background:"var(--ink)"}}/>}
            </button>
          ))}
        </div>

        {tab === "program" && (
          <ProgramTab client={client} clientWorkouts={clientWorkouts} exercises={exercises} workouts={workouts}
            logs={logs} attendance={attendance} unitPref={unitPref}
            onBuild={onBuild} onApplyTemplate={onApplyTemplate} onLog={onLog} onAttendance={onAttendance} onDeleteLog={onDeleteLog}/>
        )}
        {tab === "history" && (
          <HistoryTab client={client} clientWorkouts={clientWorkouts} exercises={exercises} logs={logs} attendance={attendance} unitPref={unitPref}/>
        )}
        {tab === "progress" && (
          <ProgressTab client={client} logs={clientLogs} exercises={exercises} unitPref={unitPref} onUpdate={onUpdate}/>
        )}
        {tab === "measurements" && (
          <MeasurementsTab client={client} onUpdate={onUpdate}/>
        )}
        {tab === "profile" && (
          <ProfileTab client={client} onUpdate={onUpdate} onViewAsClient={onViewAsClient}/>
        )}
      </div>
    </div>
  );
}

function ClientHeader({ client, unitPref = "lb" }) {
  const flags = client.injuries || [];
  const latestBW = client.bodyweight?.slice(-1)[0];
  return (
    <div className="flex items-start gap-5">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center display text-xl font-medium flex-shrink-0"
        style={{background:"var(--ink)", color:"var(--paper)"}}>
        {initials(client.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mono text-xs uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>Client since {client.since}</div>
        <h1 className="display text-4xl font-light tracking-tight mt-1">{client.name}</h1>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="chip">{client.level}</span>
          {client.age && <span className="chip">age {client.age}</span>}
          {latestBW && <span className="chip tabular">{toDisplay(latestBW.lb, unitPref)}{unitLabel(unitPref)}</span>}
          {flags.map((f,i) => <span key={i} className="chip chip-warn"><AlertTriangle size={11}/> {f}</span>)}
        </div>
        <div className="mt-4 text-sm max-w-[580px]" style={{color:"var(--ink-2)"}}>
          <span className="mono text-[10px] uppercase tracking-widest block mb-1" style={{color:"var(--muted)"}}>Goals</span>
          {client.goals}
        </div>
      </div>
    </div>
  );
}

/* -----------------------------  PROGRAM TAB  ----------------------------- */
function ProgramTab({ client, clientWorkouts, exercises, workouts, logs, attendance, unitPref = "lb", onBuild, onApplyTemplate, onLog, onAttendance, onDeleteLog }) {
  const t = today();
  const upcoming = clientWorkouts.filter(w => w.date >= t).sort((a,b) => a.date.localeCompare(b.date));
  const past = clientWorkouts.filter(w => w.date < t).sort((a,b) => b.date.localeCompare(a.date));
  const [openId, setOpenId] = useState(upcoming[0]?.id || null);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  const templates = workouts.filter(w => w.isTemplate);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="display text-2xl tracking-tight">Schedule</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => onBuild({ date: t, isTemplate:false })} className="btn btn-ghost btn-sm"><Plus size={13}/> Build new</button>
          <button onClick={() => setPickingTemplate(true)} className="btn btn-ghost btn-sm"><Copy size={13}/> From template {templates.length > 0 && <span className="mono tabular" style={{opacity:0.6}}>({templates.length})</span>}</button>
        </div>
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyBlock title="No workouts scheduled." body={`${client.name} has no assigned workouts yet.`}
          actions={<button onClick={() => onBuild({date:t, isTemplate:false})} className="btn btn-primary"><Plus size={15}/> Build workout</button>}/>
      ) : (
        <div className="space-y-3">
          {upcoming.map(w => (
            <WorkoutRow key={w.id} workout={w} exercises={exercises} logs={logs} attendance={attendance} client={client} unitPref={unitPref}
              open={openId === w.id} onToggle={() => setOpenId(openId === w.id ? null : w.id)}
              onLog={onLog} onAttendance={onAttendance} onDeleteLog={onDeleteLog} onEdit={() => onBuild({workoutId: w.id, date: w.date})}/>
          ))}
          {past.length > 0 && (
            <>
              <div className="mono text-[10px] uppercase tracking-[0.2em] mt-8 mb-2" style={{color:"var(--muted)"}}>— Past</div>
              {past.slice(0, 10).map(w => (
                <WorkoutRow key={w.id} workout={w} exercises={exercises} logs={logs} attendance={attendance} client={client} unitPref={unitPref}
                  open={openId === w.id} onToggle={() => setOpenId(openId === w.id ? null : w.id)}
                  onLog={onLog} onAttendance={onAttendance} onDeleteLog={onDeleteLog} onEdit={() => onBuild({workoutId: w.id, date: w.date})} past/>
              ))}
            </>
          )}
        </div>
      )}

      {pickingTemplate && (
        <TemplatePickerModal
          templates={templates}
          exercises={exercises}
          onClose={() => setPickingTemplate(false)}
          onApply={(template, date, mode) => {
            onApplyTemplate(template, date, mode);
            setPickingTemplate(false);
          }}
        />
      )}
    </div>
  );
}

function TemplatePickerModal({ templates, exercises, onClose, onApply }) {
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(today());

  if (templates.length === 0) {
    return (
      <Modal onClose={onClose} title="No templates yet">
        <div className="text-sm space-y-3" style={{color:"var(--ink-2)"}}>
          <p>You haven't saved any workout templates yet.</p>
          <p>To create one: build a workout, check the "Save as template" box before saving, and it'll show up here for reuse across any client.</p>
        </div>
        <div className="flex justify-end mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
          <button onClick={onClose} className="btn btn-primary">Got it</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Assign from template" wide>
      <div className="space-y-4">
        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Choose a template</label>
          <div className="mt-2 space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {templates.map(tpl => {
              const isSel = selected?.id === tpl.id;
              return (
                <button key={tpl.id} onClick={() => setSelected(tpl)}
                  className="w-full text-left p-3 rounded-lg hover-lift"
                  style={{
                    background: isSel ? "var(--ink)" : "#fff",
                    color: isSel ? "var(--paper)" : "var(--ink)",
                    border: `1px solid ${isSel ? "var(--ink)" : "var(--line-2)"}`
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[14px]">{tpl.name}</span>
                    <span className="mono text-[10px] uppercase" style={{opacity: isSel ? 0.7 : 0.5}}>{tpl.blocks.length} exercises</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {tpl.blocks.slice(0, 6).map((b, i) => {
                      const ex = exercises.find(e => e.id === b.exId);
                      if (!ex) return null;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                          style={{background: isSel ? "rgba(244,239,230,0.12)" : "var(--paper-2)", color: isSel ? "rgba(244,239,230,0.85)" : "var(--ink-2)"}}>
                          <span className={`dot ${movementClass(ex.movement)}`} style={{width:"5px",height:"5px"}}/>
                          {ex.name}
                        </span>
                      );
                    })}
                    {tpl.blocks.length > 6 && <span className="text-[11px] px-1 py-0.5" style={{color: isSel ? "rgba(244,239,230,0.6)" : "var(--muted)"}}>+{tpl.blocks.length - 6} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Schedule for</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field mt-1.5 tabular"/>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => selected && onApply(selected, date, "assign")}
          disabled={!selected}
          style={!selected ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-ghost"><Edit3 size={13}/> Edit first</button>
        <button onClick={() => selected && onApply(selected, date, "quick")}
          disabled={!selected}
          style={!selected ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-primary"><Check size={14}/> Assign</button>
      </div>
    </Modal>
  );
}

function WorkoutRow({ workout, exercises, logs, attendance, client, unitPref = "lb", open, onToggle, onLog, onAttendance, onDeleteLog, onEdit, past }) {
  const workoutLogs = logs.filter(l => l.workoutId === workout.id);
  const att = attendance.find(a => a.workoutId === workout.id);
  return (
    <div className="card">
      <button onClick={onToggle} className="w-full flex items-center gap-4 p-4 text-left">
        <div className="text-center w-14 flex-shrink-0">
          <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(workout.date+"T00:00:00").toLocaleDateString(undefined,{weekday:'short'})}</div>
          <div className="display text-2xl tabular">{new Date(workout.date+"T00:00:00").getDate()}</div>
          <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(workout.date+"T00:00:00").toLocaleDateString(undefined,{month:'short'})}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[15px]">{workout.name}</span>
            {workout.isSelfDirected && <span className="chip chip-accent">Solo</span>}
            {att && <span className="chip" style={att.status==='present'?{background:"#E4F0E8",color:"var(--good)",borderColor:"#BFDCC9"}:att.status==='missed'?{background:"#F9E3DB",color:"var(--accent)",borderColor:"#EBBEAF"}:{}}>{att.status}</span>}
          </div>
          <div className="text-xs mono uppercase tracking-wide mt-0.5" style={{color:"var(--muted)"}}>
            {workout.blocks.length} exercises · {workoutLogs.length} sets logged{workout.isSelfDirected && " · client-directed"}
          </div>
        </div>
        <ChevronRight size={18} style={{transition:"transform .2s", transform: open ? "rotate(90deg)":"rotate(0)", color:"var(--muted)"}}/>
      </button>
      {open && (
        <div className="px-4 pb-4 slide-in">
          <div className="divider mb-4"/>
          <div className="flex items-center gap-2 mb-4">
            <span className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Attendance</span>
            {["present","missed","cancelled"].map(s => (
              <button key={s} onClick={() => onAttendance({ workoutId: workout.id, status: s, date: workout.date })}
                className="btn btn-sm" style={att?.status === s
                  ? {background:"var(--ink)", color:"var(--paper)", borderColor:"var(--ink)"}
                  : {background:"#fff", border:"1px solid var(--line)"}}>
                {s}
              </button>
            ))}
            <div className="flex-1"/>
            <button onClick={onEdit} className="btn btn-ghost btn-sm"><Edit3 size={12}/> Edit</button>
          </div>
          <div className="space-y-2">
            {workout.blocks.map((b, i) => {
              const ex = exercises.find(e => e.id === b.exId);
              const blockLog = workoutLogs.find(l => l.exId === b.exId);
              return (
                <ExerciseBlock key={i} block={b} ex={ex} blockLog={blockLog}
                  onLog={(log) => onLog({...log, workoutId: workout.id, exId: b.exId, date: workout.date})}
                  onDeleteLog={onDeleteLog}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ExerciseBlock({ block, ex, blockLog, onLog, onDeleteLog }) {
  if (!ex) return null;

  // If already logged, show summary card (tap to edit)
  if (blockLog) {
    return <LoggedExerciseCard block={block} ex={ex} log={blockLog} onDelete={() => onDeleteLog(blockLog.id)}/>;
  }

  // Not yet logged — show the quick-log card
  return (
    <LogCard block={block} ex={ex} onLog={onLog}/>
  );
}

/** Compact display of a completed exercise */
function LoggedExerciseCard({ block, ex, log, onDelete }) {
  const [showDetails, setShowDetails] = useState(false);
  const unit = log.unit || block?.unit || "lb";
  const actualW = log.actualWeight != null ? toDisplay(log.actualWeight, unit) : null;

  return (
    <div className="rounded-xl p-4 grow-in" style={{background:"#fff", border:"1px solid var(--good)"}}>
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"var(--good)"}}>
          <Check size={14} style={{color:"#fff"}} strokeWidth={3}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[15px]">{ex.name}</span>
            {log.mode === "modified" && <span className="chip chip-warn" style={{fontSize:"10px", padding:"2px 8px"}}>Modified</span>}
          </div>
          <div className="mono text-[11px] uppercase tracking-wide mt-0.5 tabular" style={{color:"var(--ink-2)"}}>
            {log.mode === "modified" && log.perSet ? (
              log.perSet.map(s => `${toDisplay(s.weight, unit) || "—"}${s.weight != null ? unitLabel(unit) : ""} × ${s.reps}`).join(" · ")
            ) : (
              `${log.actualSets ?? block.sets} × ${log.actualReps ?? block.reps}${actualW != null ? ` @ ${actualW}${unitLabel(unit)}` : ""}`
            )}
          </div>
          {log.notes && <div className="text-[12px] italic mt-1.5" style={{color:"var(--ink-2)"}}>{log.notes}</div>}
        </div>
        <button onClick={onDelete} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}} title="Undo log">
          <X size={13}/>
        </button>
      </div>
    </div>
  );
}

/** Pre-filled log card — one-tap "Mark done" with optional Modified expansion */
function LogCard({ block, ex, onLog }) {
  const unit = block.unit || "lb";
  const [actualSets, setActualSets] = useState(block.sets);
  const [actualReps, setActualReps] = useState(block.reps);
  const [actualWeight, setActualWeight] = useState(block.weight != null ? toDisplay(block.weight, unit) : "");
  const [modified, setModified] = useState(false);
  const [perSet, setPerSet] = useState([]);
  const [notes, setNotes] = useState("");

  // When "Modified" toggles on, initialize perSet rows from the plan
  const toggleModified = () => {
    if (!modified) {
      const rows = [];
      const nSets = Number(block.sets) || 1;
      for (let i = 0; i < nSets; i++) {
        rows.push({ reps: block.reps, weight: block.weight != null ? toDisplay(block.weight, unit) : "" });
      }
      setPerSet(rows);
    }
    setModified(!modified);
  };

  const updatePerSet = (i, patch) => setPerSet(perSet.map((s, idx) => idx === i ? {...s, ...patch} : s));
  const addRow = () => setPerSet([...perSet, { reps: block.reps, weight: block.weight != null ? toDisplay(block.weight, unit) : "" }]);
  const removeRow = (i) => setPerSet(perSet.filter((_, idx) => idx !== i));

  const markDone = () => {
    if (modified) {
      onLog({
        completed: true,
        mode: "modified",
        actualSets: perSet.length,
        actualReps: null,
        actualWeight: null,
        perSet: perSet.map(s => ({ reps: s.reps, weight: s.weight === "" ? null : fromDisplay(s.weight, unit) })),
        notes,
        source: "coach",
        unit,
      });
    } else {
      onLog({
        completed: true,
        mode: "asPlanned",
        actualSets: Number(actualSets) || block.sets,
        actualReps: actualReps,
        actualWeight: actualWeight === "" ? null : fromDisplay(actualWeight, unit),
        perSet: null,
        notes,
        source: "coach",
        unit,
      });
    }
  };

  const plannedW = block.weight != null ? toDisplay(block.weight, unit) : null;

  return (
    <div className="rounded-xl p-4" style={{background:"var(--paper)", border:"1px solid var(--line-2)"}}>
      <div className="flex items-start gap-3 mb-3">
        <span className={`dot mt-1.5 ${movementClass(ex.movement)}`} style={{width:"8px",height:"8px"}}/>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[15px]">{ex.name}</div>
          <div className="text-[11px] mono uppercase tracking-wide mt-0.5 tabular" style={{color:"var(--muted)"}}>
            planned: {block.sets} × {block.reps}{plannedW != null ? ` @ ${plannedW}${unitLabel(unit)}` : ""} · {block.rest}s rest
          </div>
          {block.notes && <div className="text-[11px] italic mt-1" style={{color:"var(--ink-2)"}}>{block.notes}</div>}
        </div>
      </div>

      {!modified ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Sets</label>
            <input type="text" inputMode="numeric" value={actualSets} onChange={e => setActualSets(filterNumericInput(e.target.value, true))} className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Reps</label>
            <input type="text" value={actualReps} onChange={e => setActualReps(e.target.value)} className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Weight ({unitLabel(unit)})</label>
            <input type="text" inputMode="decimal" value={actualWeight} onChange={e => setActualWeight(filterNumericInput(e.target.value))} placeholder="—" className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {perSet.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="mono text-[10px] uppercase tabular w-10" style={{color:"var(--muted)"}}>Set {i+1}</span>
              <input type="text" value={s.reps} onChange={e => updatePerSet(i, {reps: e.target.value})} placeholder="reps"
                className="field tabular" style={{padding:"6px 10px", fontSize:"13px", flex:1}}/>
              <input type="text" inputMode="decimal" value={s.weight} onChange={e => updatePerSet(i, {weight: filterNumericInput(e.target.value)})} placeholder={`${unitLabel(unit)}`}
                className="field tabular" style={{padding:"6px 10px", fontSize:"13px", flex:1}}/>
              <button onClick={() => removeRow(i)} className="p-1 rounded" style={{color:"var(--muted)"}}><X size={12}/></button>
            </div>
          ))}
          <button onClick={addRow} className="text-[11px] mono uppercase tracking-wider hover-lift px-2 py-1 rounded" style={{color:"var(--ink-2)"}}>+ Add set</button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <label className="flex items-center gap-1.5 text-[12px] cursor-pointer" style={{color:"var(--ink-2)"}}>
          <input type="checkbox" checked={modified} onChange={toggleModified}/>
          Modified
        </label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (form, RPE, pain, etc.)"
          className="field" style={{padding:"6px 10px", fontSize:"12px", flex:1}}/>
      </div>

      <button onClick={markDone} className="btn btn-accent w-full justify-center">
        <Check size={14}/> Mark done
      </button>
    </div>
  );
}

/* -----------------------------  HISTORY TAB  ----------------------------- */
function HistoryTab({ client, clientWorkouts, exercises, logs, attendance, unitPref = "lb" }) {
  const past = clientWorkouts.filter(w => w.date <= today()).sort((a,b) => b.date.localeCompare(a.date));
  const totalExercises = logs.filter(l => clientWorkouts.some(w => w.id === l.workoutId)).length;
  const attendedCount = attendance.filter(a => a.status === "present" && clientWorkouts.some(w => w.id === a.workoutId)).length;

  // Volume calculation — uses actualWeight * actualSets * actualReps, or per-set sum if modified
  const volumeFor = (log) => {
    if (log.mode === "modified" && log.perSet) {
      return log.perSet.reduce((acc, s) => acc + (Number(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    }
    const sets = Number(log.actualSets) || 0;
    const reps = parseInt(log.actualReps) || 0;
    const wt = Number(log.actualWeight) || 0;
    return sets * reps * wt;
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Workouts completed" value={attendedCount} />
        <StatCard label="Exercises logged" value={totalExercises} />
        <StatCard label="Weeks training" value={Math.max(1, Math.floor((Date.now() - new Date(client.since+"T00:00:00").getTime()) / (1000*60*60*24*7)))} />
      </div>

      <h2 className="display text-2xl tracking-tight mb-4">Full timeline</h2>
      {past.length === 0 ? (
        <div className="card p-6 text-sm" style={{color:"var(--muted)"}}>No completed workouts yet.</div>
      ) : (
        <div className="space-y-1.5">
          {past.map(w => {
            const wLogs = logs.filter(l => l.workoutId === w.id);
            const att = attendance.find(a => a.workoutId === w.id);
            const volumeLb = wLogs.reduce((acc, l) => acc + volumeFor(l), 0);
            const volumeDisplay = toDisplay(volumeLb, unitPref);
            return (
              <div key={w.id} className="card p-4 hover-lift flex items-center gap-4">
                <div className="text-center w-12 flex-shrink-0">
                  <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{month:'short'})}</div>
                  <div className="display text-xl tabular">{new Date(w.date+"T00:00:00").getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs mono uppercase tracking-wide" style={{color:"var(--muted)"}}>
                    {w.blocks.length} exercises · {wLogs.length} logged · {att?.status || "no attendance"}
                  </div>
                </div>
                {volumeLb > 0 && (
                  <div className="text-right">
                    <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>Volume</div>
                    <div className="display text-lg tabular">{Math.round(volumeDisplay).toLocaleString()}<span className="text-xs" style={{color:"var(--muted)"}}>{unitLabel(unitPref)}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -----------------------------  PROGRESS TAB  ----------------------------- */
function ProgressTab({ client, logs, exercises, unitPref = "lb", onUpdate }) {
  const prs = useMemo(() => {
    const byEx = {};
    logs.forEach(l => {
      // Determine max weight for this log entry — check perSet OR actualWeight
      let maxW = 0, reps = l.actualReps, date = l.date;
      if (l.mode === "modified" && l.perSet) {
        l.perSet.forEach(s => {
          const w = Number(s.weight) || 0;
          if (w > maxW) { maxW = w; reps = s.reps; }
        });
      } else {
        maxW = Number(l.actualWeight) || 0;
      }
      if (maxW > 0 && (!byEx[l.exId] || maxW > byEx[l.exId].weight)) {
        byEx[l.exId] = { weight: maxW, date, reps };
      }
    });
    return Object.entries(byEx).map(([exId, rec]) => ({ ex: exercises.find(e => e.id === exId), ...rec }))
      .filter(x => x.ex && x.weight > 0).sort((a,b) => b.weight - a.weight);
  }, [logs, exercises]);

  const [addingBW, setAddingBW] = useState(false);
  const [newBW, setNewBW] = useState("");

  const addBW = () => {
    if (!newBW) return;
    const lb = fromDisplay(newBW, unitPref);
    const bw = [...(client.bodyweight || []), { date: today(), lb }];
    onUpdate({ bodyweight: bw });
    setAddingBW(false); setNewBW("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="display text-2xl tracking-tight">Personal records</h2>
          <span className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>{prs.length} tracked</span>
        </div>
        {prs.length === 0 ? (
          <div className="card p-5 text-sm" style={{color:"var(--muted)"}}>Log weighted sets to track PRs.</div>
        ) : (
          <div className="card">
            {prs.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center gap-4 p-4" style={i>0?{borderTop:"1px solid var(--line-2)"}:{}}>
                <span className={`dot ${movementClass(p.ex.movement)}`} style={{width:"8px",height:"8px"}}/>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[14px] truncate">{p.ex.name}</div>
                  <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{shortDate(p.date)}</div>
                </div>
                <div className="text-right tabular">
                  <div className="display text-2xl font-light">{toDisplay(p.weight, unitPref)}<span className="text-xs" style={{color:"var(--muted)"}}>{unitLabel(unitPref)}</span></div>
                  <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>× {p.reps}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="display text-2xl tracking-tight">Bodyweight</h2>
          <button onClick={() => setAddingBW(true)} className="btn btn-ghost btn-sm"><Plus size={13}/> Add</button>
        </div>
        {addingBW && (
          <div className="card p-3 mb-3 grow-in flex items-center gap-2">
            <input type="text" inputMode="decimal" value={newBW} onChange={e => setNewBW(filterNumericInput(e.target.value))} className="field tabular" placeholder={unitLabel(unitPref)} autoFocus/>
            <button onClick={addBW} className="btn btn-primary btn-sm"><Check size={12}/></button>
            <button onClick={() => setAddingBW(false)} className="btn btn-ghost btn-sm"><X size={12}/></button>
          </div>
        )}
        <BodyweightChart data={client.bodyweight || []} unitPref={unitPref}/>

        <h2 className="display text-2xl tracking-tight mt-8 mb-4">Notes</h2>
        <div className="card p-4">
          <textarea
            value={client.notes || ""}
            onChange={e => onUpdate({ notes: e.target.value })}
            placeholder="Session feedback, mobility wins, pain reports, form cues…"
            className="w-full text-sm resize-none" style={{minHeight:"120px", border:"none", background:"transparent"}}/>
        </div>
      </section>
    </div>
  );
}

function BodyweightChart({ data, unitPref = "lb" }) {
  if (!data || data.length < 1) return <div className="card p-5 text-sm" style={{color:"var(--muted)"}}>No bodyweight entries yet.</div>;
  const W = 520, H = 180, PAD = 20;
  // Convert canonical lb → display unit for rendering
  const displayVals = data.map(d => toDisplay(d.lb, unitPref));
  const minV = Math.min(...displayVals) - 0.5, maxV = Math.max(...displayVals) + 0.5;
  const scaleX = (i) => data.length === 1 ? W/2 : PAD + (W - 2*PAD) * (i / (data.length - 1));
  const scaleY = (v) => PAD + (H - 2*PAD) * (1 - (v - minV) / (maxV - minV));
  const path = displayVals.map((v,i) => `${i===0?'M':'L'} ${scaleX(i)} ${scaleY(v)}`).join(" ");
  const latestDisplay = displayVals[displayVals.length-1];
  const firstDisplay = displayVals[0];
  const delta = (latestDisplay - firstDisplay).toFixed(1);
  const first = data[0];

  return (
    <div className="card p-5">
      <div className="flex items-baseline gap-3 mb-3">
        <div className="display text-4xl font-light tabular">{latestDisplay}<span className="text-base mono" style={{color:"var(--muted)"}}>{unitLabel(unitPref)}</span></div>
        {data.length > 1 && (
          <div className={`text-sm tabular`} style={{color: delta < 0 ? "var(--good)" : delta > 0 ? "var(--warn)" : "var(--muted)"}}>
            {delta > 0 ? "+" : ""}{delta}{unitLabel(unitPref)} <span style={{color:"var(--muted)"}}>since {shortDate(first.date)}</span>
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{overflow:"visible"}}>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {displayVals.map((v,i) => (
          <g key={i}>
            <circle cx={scaleX(i)} cy={scaleY(v)} r="3.5" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2"/>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* -----------------------------  MEASUREMENTS TAB  ----------------------------- */

// Metric definitions: each has a kind ("weight" stored in lb, "length" in inches, "pct" stored as %).
const METRIC_DEFS = [
  { id: "weight",   label: "Bodyweight",   kind: "weight",  default: "lb" },
  { id: "bodyFat",  label: "Body fat %",   kind: "pct" },
  { id: "waist",    label: "Waist",        kind: "length",  default: "in" },
  { id: "hips",     label: "Hips",         kind: "length",  default: "in" },
  { id: "chest",    label: "Chest",        kind: "length",  default: "in" },
  { id: "armL",     label: "Arm — left",   kind: "length",  default: "in" },
  { id: "armR",     label: "Arm — right",  kind: "length",  default: "in" },
  { id: "thighL",   label: "Thigh — left", kind: "length",  default: "in" },
  { id: "thighR",   label: "Thigh — right",kind: "length",  default: "in" },
];

// Render a stored canonical value to display string in given unit
const renderMetric = (entry, unit) => {
  if (entry == null) return "";
  const def = METRIC_DEFS.find(m => m.id === entry.type);
  if (!def) return "";
  if (def.kind === "weight") return toDisplay(entry.valueLb, unit);
  if (def.kind === "length") return toDisplayLen(entry.valueIn, unit);
  if (def.kind === "pct") return entry.valuePct == null ? "" : Math.round(entry.valuePct * 10) / 10;
  return "";
};

const metricUnitLabel = (def, unit) => {
  if (def.kind === "weight") return unitLabel(unit);
  if (def.kind === "length") return lenLabel(unit);
  if (def.kind === "pct") return "%";
  return "";
};

// Convert a display string + unit back to canonical storage object for an entry
const buildEntry = (def, displayValue, unit) => {
  if (displayValue === "" || displayValue == null) return null;
  if (def.kind === "weight") return { valueLb: fromDisplay(displayValue, unit) };
  if (def.kind === "length") return { valueIn: fromDisplayLen(displayValue, unit) };
  if (def.kind === "pct") {
    const n = Number(displayValue);
    return Number.isNaN(n) ? null : { valuePct: Math.round(n * 100) / 100 };
  }
  return null;
};

function MeasurementsTab({ client, onUpdate }) {
  // Migrate legacy bodyweight array on first read into the unified measurements format.
  // We don't write back until the coach actually adds something — keeps the migration lazy.
  const measurements = useMemo(() => {
    const m = client.measurements || [];
    if (m.length > 0) return m;
    const bw = client.bodyweight || [];
    return bw.map(b => ({
      id: uid("m"),
      date: b.date,
      type: "weight",
      valueLb: b.lb,
    }));
  }, [client.measurements, client.bodyweight]);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const saveMeasurements = (next) => {
    onUpdate({ measurements: next });
  };

  const addBatch = (batch) => {
    // batch: { date, entries: { metricId: { value: displayString, unit } } }
    const newEntries = [];
    for (const def of METRIC_DEFS) {
      const e = batch.entries[def.id];
      if (!e || e.value === "" || e.value == null) continue;
      const stored = buildEntry(def, e.value, e.unit);
      if (!stored) continue;
      newEntries.push({
        id: uid("m"),
        date: batch.date,
        type: def.id,
        unit: e.unit, // remember the unit used at entry time
        ...stored,
      });
    }
    if (newEntries.length === 0) { setAdding(false); return; }
    saveMeasurements([...measurements, ...newEntries]);
    setAdding(false);
  };

  const deleteEntry = (id) => {
    saveMeasurements(measurements.filter(m => m.id !== id));
  };

  const updateEntry = (id, patch) => {
    saveMeasurements(measurements.map(m => m.id === id ? { ...m, ...patch } : m));
    setEditingId(null);
  };

  // Group by metric type for charts/lists
  const byType = useMemo(() => {
    const out = {};
    for (const def of METRIC_DEFS) {
      out[def.id] = measurements
        .filter(m => m.type === def.id)
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    return out;
  }, [measurements]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-2xl tracking-tight">Measurements</h2>
        {!adding && <button onClick={() => setAdding(true)} className="btn btn-primary btn-sm"><Plus size={13}/> Add measurement</button>}
      </div>

      {adding && (
        <AddMeasurementForm
          onCancel={() => setAdding(false)}
          onSave={addBatch}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {METRIC_DEFS.map(def => {
          const entries = byType[def.id];
          if (entries.length === 0) return null;
          return (
            <MetricCard
              key={def.id}
              def={def}
              entries={entries}
              editingId={editingId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={updateEntry}
              onDelete={deleteEntry}
            />
          );
        })}
      </div>

      {measurements.length === 0 && !adding && (
        <div className="card p-6 text-center text-sm" style={{color:"var(--muted)"}}>
          No measurements yet. Add one to start tracking.
        </div>
      )}
    </div>
  );
}

function AddMeasurementForm({ onCancel, onSave }) {
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState(() => {
    const init = {};
    for (const def of METRIC_DEFS) {
      init[def.id] = { value: "", unit: def.default || "" };
    }
    return init;
  });

  const setField = (metricId, patch) =>
    setEntries({ ...entries, [metricId]: { ...entries[metricId], ...patch } });

  const anyValue = Object.values(entries).some(e => e.value !== "" && e.value != null);

  return (
    <div className="card p-4 grow-in">
      <div className="flex items-center gap-3 mb-4">
        <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field tabular" style={{maxWidth:"180px", padding:"6px 10px", fontSize:"13px"}}/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {METRIC_DEFS.map(def => {
          const e = entries[def.id];
          const showUnitToggle = def.kind === "weight" || def.kind === "length";
          const units = def.kind === "weight" ? ["lb","kg"] : def.kind === "length" ? ["in","cm"] : null;
          return (
            <div key={def.id} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>{def.label}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={e.value}
                  onChange={ev => setField(def.id, { value: filterNumericInput(ev.target.value) })}
                  placeholder={metricUnitLabel(def, e.unit)}
                  className="field mt-1 tabular"
                  style={{padding:"7px 10px", fontSize:"13px"}}
                />
              </div>
              {showUnitToggle && (
                <div className="flex gap-0.5 p-0.5 rounded-lg" style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
                  {units.map(u => (
                    <button key={u} type="button" onClick={() => setField(def.id, { unit: u })}
                      className="px-2 py-0.5 rounded text-[10px] font-medium mono uppercase tracking-wide"
                      style={e.unit === u ? {background:"var(--ink)", color:"var(--paper)"} : {background:"transparent", color:"var(--muted)"}}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
        <button onClick={() => onSave({ date, entries })} disabled={!anyValue}
          style={!anyValue ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-primary"><Check size={14}/> Save</button>
      </div>
    </div>
  );
}

function MetricCard({ def, entries, editingId, onStartEdit, onCancelEdit, onSaveEdit, onDelete }) {
  // Display unit defaults to the unit the most recent entry was recorded in.
  const [viewUnit, setViewUnit] = useState(entries[0]?.unit || def.default || "");
  const showToggle = def.kind === "weight" || def.kind === "length";
  const units = def.kind === "weight" ? ["lb","kg"] : def.kind === "length" ? ["in","cm"] : null;
  const latest = entries[0];

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>{def.label}</div>
          {latest && (
            <div className="display text-2xl font-light tabular mt-1">
              {renderMetric(latest, viewUnit)}<span className="text-xs ml-0.5" style={{color:"var(--muted)"}}>{metricUnitLabel(def, viewUnit)}</span>
            </div>
          )}
        </div>
        {showToggle && (
          <div className="flex gap-0.5 p-0.5 rounded-lg" style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
            {units.map(u => (
              <button key={u} onClick={() => setViewUnit(u)}
                className="px-2 py-0.5 rounded text-[10px] font-medium mono uppercase tracking-wide"
                style={viewUnit === u ? {background:"var(--ink)", color:"var(--paper)"} : {background:"transparent", color:"var(--muted)"}}>
                {u}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1 mt-3">
        {entries.map(entry => (
          <MetricRow
            key={entry.id}
            def={def}
            entry={entry}
            viewUnit={viewUnit}
            editing={editingId === entry.id}
            onStartEdit={() => onStartEdit(entry.id)}
            onCancelEdit={onCancelEdit}
            onSave={(patch) => onSaveEdit(entry.id, patch)}
            onDelete={() => onDelete(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ def, entry, viewUnit, editing, onStartEdit, onCancelEdit, onSave, onDelete }) {
  const [draftValue, setDraftValue] = useState(() => String(renderMetric(entry, entry.unit || viewUnit) ?? ""));
  const [draftUnit, setDraftUnit] = useState(entry.unit || viewUnit);
  const [draftDate, setDraftDate] = useState(entry.date);

  if (!editing) {
    return (
      <div className="flex items-center gap-3 py-1.5 px-2 rounded hover-lift">
        <span className="mono text-[10px] uppercase tracking-wider tabular" style={{color:"var(--muted)", minWidth:"68px"}}>{shortDate(entry.date)}</span>
        <span className="text-sm tabular flex-1">
          {renderMetric(entry, viewUnit)}
          <span className="text-[11px] ml-0.5" style={{color:"var(--muted)"}}>{metricUnitLabel(def, viewUnit)}</span>
        </span>
        <button onClick={onStartEdit} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}} title="Edit"><Edit3 size={11}/></button>
        <button onClick={onDelete} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}} title="Delete"><X size={12}/></button>
      </div>
    );
  }

  const showToggle = def.kind === "weight" || def.kind === "length";
  const units = def.kind === "weight" ? ["lb","kg"] : def.kind === "length" ? ["in","cm"] : null;

  const save = () => {
    const stored = buildEntry(def, draftValue, draftUnit);
    if (!stored) return;
    onSave({ date: draftDate, unit: draftUnit, ...stored });
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded grow-in" style={{background:"var(--paper-2)"}}>
      <input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} className="field tabular" style={{padding:"4px 8px", fontSize:"12px", maxWidth:"140px"}}/>
      <input type="text" inputMode="decimal" value={draftValue}
        onChange={e => setDraftValue(filterNumericInput(e.target.value))}
        className="field tabular" style={{padding:"4px 8px", fontSize:"12px", flex:1}}/>
      {showToggle && (
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{background:"#fff", border:"1px solid var(--line-2)"}}>
          {units.map(u => (
            <button key={u} type="button" onClick={() => setDraftUnit(u)}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium mono uppercase"
              style={draftUnit === u ? {background:"var(--ink)", color:"var(--paper)"} : {background:"transparent", color:"var(--muted)"}}>
              {u}
            </button>
          ))}
        </div>
      )}
      <button onClick={save} className="p-1 rounded hover-lift" style={{color:"var(--good)"}} title="Save"><Check size={13}/></button>
      <button onClick={onCancelEdit} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}} title="Cancel"><X size={12}/></button>
    </div>
  );
}

/* -----------------------------  PROFILE TAB  ----------------------------- */
function ProfileTab({ client, onUpdate, onViewAsClient }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <h3 className="display text-xl tracking-tight">Profile</h3>
          <Field label="Name" value={client.name} onChange={v => onUpdate({ name: v })}/>
          <NumericField label="Age" value={client.age || null} onChange={n => onUpdate({ age: n == null ? undefined : n })} integer/>
          <Field label="Goals" multi value={client.goals || ""} onChange={v => onUpdate({ goals: v })}/>
        </div>
        <div className="card p-5 space-y-4">
          <h3 className="display text-xl tracking-tight">Context</h3>
          <TagEditor label="Injuries / limitations" values={client.injuries || []}
            suggestions={["shoulder injury","knee injury","low back injury","wrist injury","prenatal caution","disc issue","elbow injury"]}
            onChange={v => onUpdate({ injuries: v })}/>
          <TagEditor label="Equipment access" values={client.equipment || []}
            suggestions={["barbell","dumbbell","kettlebell","bodyweight","rack","bench","machine","cable","band","pullup-bar"]}
            onChange={v => onUpdate({ equipment: v })}/>
          <div>
            <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Level</label>
            <div className="flex gap-1.5 mt-1.5">
              {["beginner","intermediate","advanced"].map(l => (
                <button key={l} onClick={() => onUpdate({ level: l })} className="btn btn-sm"
                  style={client.level === l ? {background:"var(--ink)", color:"var(--paper)", borderColor:"var(--ink)"} : {background:"#fff", border:"1px solid var(--line)"}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!client.archived && onViewAsClient && (
        <div className="card p-5 mt-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="display text-lg tracking-tight">See what {client.name.split(" ")[0]} sees</div>
            <div className="text-xs mt-1" style={{color:"var(--muted)"}}>
              Preview the app from the client's perspective — their next workout, past sessions, and independent logging.
            </div>
          </div>
          <button onClick={onViewAsClient} className="btn btn-primary">
            <ArrowUpRight size={14}/> View as client
          </button>
        </div>
      )}

      {!client.archived && (
        <div className="card p-5 mt-3 flex items-center justify-between flex-wrap gap-3" style={{borderStyle:"dashed"}}>
          <div>
            <div className="display text-lg tracking-tight">Archive client</div>
            <div className="text-xs mt-1" style={{color:"var(--muted)"}}>
              Removes {client.name.split(" ")[0]} from the active list. All history, logs, and notes are preserved and can be restored anytime.
            </div>
          </div>
          <button onClick={() => setConfirmArchive(true)} className="btn btn-ghost" style={{color:"var(--ink-2)"}}>
            <Archive size={14}/> Archive
          </button>
        </div>
      )}

      {confirmArchive && (
        <Modal onClose={() => setConfirmArchive(false)} title="Archive this client?">
          <div className="space-y-3">
            <p className="text-sm" style={{color:"var(--ink-2)"}}>
              <b>{client.name}</b> will be moved to the archived section. Their full history, logs, PRs, and notes will be preserved.
            </p>
            <p className="text-sm" style={{color:"var(--ink-2)"}}>
              You can reactivate them at any time from their profile.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
            <button onClick={() => setConfirmArchive(false)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => { onUpdate({ archived: true, archivedAt: today() }); setConfirmArchive(false); }} className="btn btn-primary">
              <Archive size={14}/> Archive client
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({ label, value, onChange, type="text", multi }) {
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>{label}</label>
      {multi ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} className="field mt-1.5" style={{minHeight:"80px"}}/>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="field mt-1.5"/>
      )}
    </div>
  );
}

function TagEditor({ label, values, suggestions, onChange }) {
  const add = (v) => { if (v && !values.includes(v)) onChange([...values, v]); };
  const rem = (v) => onChange(values.filter(x => x !== v));
  return (
    <div>
      <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {values.map(v => (
          <button key={v} onClick={() => rem(v)} className="chip chip-active hover-lift">
            {v} <X size={11}/>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {suggestions.filter(s => !values.includes(s)).map(s => (
          <button key={s} onClick={() => add(s)} className="chip hover-lift" style={{background:"transparent", borderStyle:"dashed"}}>+ {s}</button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   TEMPLATES VIEW
   ============================================================ */
function TemplatesView({ workouts, exercises, clients, onBuild, onDelete, onAssign }) {
  const templates = workouts.filter(w => w.isTemplate);
  const [assigning, setAssigning] = useState(null);
  const activeClients = clients.filter(c => !c.archived);

  return (
    <div className="px-6 py-6 slide-in">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="mono text-xs uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— Templates</div>
          <h1 className="display text-4xl font-light tracking-tight mt-1">Program templates</h1>
          <div className="mono text-xs uppercase tracking-wider mt-2" style={{color:"var(--muted)"}}>
            {templates.length} {templates.length === 1 ? "template" : "templates"}
          </div>
        </div>
        <button onClick={() => onBuild({ isTemplate: true })} className="btn btn-primary"><Plus size={15}/> New template</button>
      </div>

      {templates.length === 0 ? (
        <EmptyBlock
          title="No templates yet."
          body="Templates are reusable workout blueprints you can assign to any client. Build a workout and check 'Save as template' to create one."
          actions={<button onClick={() => onBuild({ isTemplate: true })} className="btn btn-primary"><Plus size={15}/> Build a template</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map(tpl => (
            <TemplateCard key={tpl.id} tpl={tpl} exercises={exercises}
              onEdit={() => onBuild({ workoutId: tpl.id })}
              onDelete={() => onDelete(tpl.id)}
              onAssign={() => setAssigning(tpl)}/>
          ))}
        </div>
      )}

      {assigning && (
        <AssignTemplateModal
          template={assigning}
          clients={activeClients}
          onClose={() => setAssigning(null)}
          onConfirm={(clientId, date) => { onAssign(assigning, clientId, date); setAssigning(null); }}
        />
      )}
    </div>
  );
}

function TemplateCard({ tpl, exercises, onEdit, onDelete, onAssign }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const movements = {};
  tpl.blocks.forEach(b => {
    const ex = exercises.find(e => e.id === b.exId);
    if (ex) movements[ex.movement] = (movements[ex.movement] || 0) + 1;
  });

  return (
    <div className="card p-4 hover-lift">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[15px] leading-tight">{tpl.name || "Untitled template"}</div>
          <div className="mono text-[10px] uppercase tracking-wider mt-1" style={{color:"var(--muted)"}}>
            {tpl.blocks.length} exercises
          </div>
        </div>
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}}>
            <MoreHorizontal size={15}/>
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 z-20 grow-in p-1 rounded-lg min-w-[140px]"
              style={{background:"#fff", border:"1px solid var(--line)", boxShadow:"0 12px 32px rgba(22,20,15,0.12)"}}>
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded text-sm hover-lift flex items-center gap-2"><Edit3 size={12}/> Edit</button>
              <button onClick={() => { setConfirmDelete(true); setMenuOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded text-sm hover-lift flex items-center gap-2" style={{color:"var(--danger)"}}><Trash2 size={12}/> Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2 mb-3">
        {Object.entries(movements).map(([m, count]) => (
          <span key={m} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded"
            style={{background:"var(--paper-2)", color:"var(--ink-2)"}}>
            <span className={`dot ${movementClass(m)}`} style={{width:"5px",height:"5px"}}/>
            {m} <span className="mono tabular" style={{opacity:0.6}}>{count}</span>
          </span>
        ))}
      </div>

      <div className="space-y-1 mt-3 pt-3" style={{borderTop:"1px solid var(--line-2)"}}>
        {tpl.blocks.slice(0, 4).map((b, i) => {
          const ex = exercises.find(e => e.id === b.exId);
          if (!ex) return null;
          return (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="mono tabular" style={{color:"var(--muted)", width:"20px"}}>{String(i+1).padStart(2,'0')}</span>
              <span className="flex-1 truncate" style={{color:"var(--ink-2)"}}>{ex.name}</span>
              <span className="mono text-[10px] tabular" style={{color:"var(--muted)"}}>{b.sets}×{b.reps}</span>
            </div>
          );
        })}
        {tpl.blocks.length > 4 && (
          <div className="text-[11px] mt-1" style={{color:"var(--muted)"}}>+{tpl.blocks.length - 4} more</div>
        )}
      </div>

      <button onClick={onAssign} className="btn btn-accent btn-sm w-full mt-4 justify-center">
        <ArrowRight size={13}/> Assign to client
      </button>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} title="Delete this template?">
          <p className="text-sm" style={{color:"var(--ink-2)"}}>
            "<b>{tpl.name}</b>" will be permanently removed. Workouts previously assigned from this template will not be affected.
          </p>
          <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
            <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="btn btn-primary" style={{background:"var(--danger)", borderColor:"var(--danger)"}}>
              <Trash2 size={13}/> Delete template
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AssignTemplateModal({ template, clients, onClose, onConfirm }) {
  const [clientId, setClientId] = useState(null);
  const [date, setDate] = useState(today());

  if (clients.length === 0) {
    return (
      <Modal onClose={onClose} title="No active clients">
        <p className="text-sm" style={{color:"var(--ink-2)"}}>You don't have any active clients to assign this template to. Add a client first, then come back here.</p>
        <div className="flex justify-end mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
          <button onClick={onClose} className="btn btn-primary">OK</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title={`Assign "${template.name}"`}>
      <div className="space-y-4">
        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Client</label>
          <div className="mt-2 space-y-1 max-h-[280px] overflow-y-auto pr-1">
            {clients.map(c => {
              const isSel = clientId === c.id;
              return (
                <button key={c.id} onClick={() => setClientId(c.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover-lift text-left"
                  style={{
                    background: isSel ? "var(--ink)" : "#fff",
                    color: isSel ? "var(--paper)" : "var(--ink)",
                    border: `1px solid ${isSel ? "var(--ink)" : "var(--line-2)"}`
                  }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold display"
                    style={{background: isSel ? "var(--paper)" : "var(--paper-2)", color: isSel ? "var(--ink)" : "var(--ink)"}}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{c.name}</div>
                    <div className="mono text-[10px] uppercase tracking-wide" style={{opacity: isSel ? 0.7 : 0.55}}>
                      {c.level} · {c.equipment.length} equipment
                    </div>
                  </div>
                  {isSel && <Check size={14}/>}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field mt-1.5 tabular"/>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => clientId && onConfirm(clientId, date)}
          disabled={!clientId}
          style={!clientId ? {opacity:0.45, cursor:"not-allowed"} : {}}
          className="btn btn-primary"><Check size={14}/> Assign</button>
      </div>
    </Modal>
  );
}

/* ============================================================
   EXERCISE LIBRARY
   ============================================================ */
function ExerciseLibrary({ exercises, clients, onAdd, onUpdate, onDelete }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ movement: null, equipment: null, difficulty: null, exclude: null, modality: null });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const filtered = exercises.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.movement && e.movement !== filters.movement) return false;
    if (filters.modality && modalityOf(e) !== filters.modality) return false;
    if (filters.equipment && !e.equipment.includes(filters.equipment)) return false;
    if (filters.difficulty && e.difficulty !== filters.difficulty) return false;
    if (filters.exclude) {
      const client = clients.find(c => c.id === filters.exclude);
      if (client && client.injuries.some(i => e.contraindications.includes(i))) return false;
    }
    return true;
  });

  // Counts per modality, respecting all other active filters
  const modalityCounts = useMemo(() => {
    const base = exercises.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.movement && e.movement !== filters.movement) return false;
      if (filters.equipment && !e.equipment.includes(filters.equipment)) return false;
      if (filters.difficulty && e.difficulty !== filters.difficulty) return false;
      if (filters.exclude) {
        const client = clients.find(c => c.id === filters.exclude);
        if (client && client.injuries.some(i => e.contraindications.includes(i))) return false;
      }
      return true;
    });
    const counts = { all: base.length };
    MODALITIES.forEach(m => { counts[m.id] = base.filter(e => modalityOf(e) === m.id).length; });
    return counts;
  }, [exercises, search, filters.movement, filters.equipment, filters.difficulty, filters.exclude, clients]);

  return (
    <div className="px-6 py-6 slide-in">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="mono text-xs uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— Library</div>
          <h1 className="display text-4xl font-light tracking-tight mt-1">Exercises</h1>
          <div className="mono text-xs uppercase tracking-wider mt-2" style={{color:"var(--muted)"}}>{filtered.length} of {exercises.length}</div>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-primary"><Plus size={15}/> Add exercise</button>
      </div>

      <div className="card p-3 mb-3 flex items-center gap-2 flex-wrap">
        <span className="mono text-[10px] uppercase tracking-widest px-1" style={{color:"var(--muted)"}}>Modality</span>
        <button onClick={() => setFilters({...filters, modality: null})} className="chip hover-lift"
          style={!filters.modality ? {background:"var(--ink)",color:"var(--paper)",borderColor:"var(--ink)"} : {}}>
          All <span className="mono tabular" style={{opacity:0.7, marginLeft: "2px"}}>{modalityCounts.all}</span>
        </button>
        {MODALITIES.map(m => (
          <button key={m.id} onClick={() => setFilters({...filters, modality: filters.modality === m.id ? null : m.id})}
            className="chip hover-lift"
            style={filters.modality === m.id ? {background:"var(--ink)",color:"var(--paper)",borderColor:"var(--ink)"} : {}}>
            {m.label} <span className="mono tabular" style={{opacity:0.7, marginLeft: "2px"}}>{modalityCounts[m.id] || 0}</span>
          </button>
        ))}
      </div>

      <div className="card p-3 mb-5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--muted)"}}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exercises…" className="field pl-9"/>
        </div>
        <FilterDropdown label="Movement" value={filters.movement} options={["push","pull","squat","hinge","core","cardio","mobility","stretch"]} onChange={v => setFilters({...filters, movement:v})}/>
        <FilterDropdown label="Equipment" value={filters.equipment} options={["barbell","dumbbell","kettlebell","bodyweight","bench","rack","machine","smith-machine","leg-press","cable","band","pullup-bar"]} onChange={v => setFilters({...filters, equipment:v})}/>
        <FilterDropdown label="Level" value={filters.difficulty} options={["beginner","intermediate","advanced"]} onChange={v => setFilters({...filters, difficulty:v})}/>
        <FilterDropdown label="Safe for…" value={filters.exclude} options={clients.filter(c => !c.archived).map(c => ({value:c.id,label:c.name}))} onChange={v => setFilters({...filters, exclude:v})}/>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(ex => (
          <ExerciseCard key={ex.id} ex={ex} onClick={() => setEditing(ex)}/>
        ))}
      </div>

      {editing && <ExerciseEditor ex={editing} existingExercises={exercises} onClose={() => setEditing(null)} onSave={(e) => { onUpdate(e); setEditing(null); }} onDelete={() => { onDelete(editing.id); setEditing(null); }}/>}
      {creating && <ExerciseEditor ex={null} existingExercises={exercises} onClose={() => setCreating(false)} onSave={(e) => { onAdd({...e, id: uid("ex")}); setCreating(false); }}/>}
    </div>
  );
}

function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const normalized = options.map(o => typeof o === "string" ? { value:o, label:o } : o);
  const current = normalized.find(o => o.value === value);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm"
        style={value ? {background:"var(--ink)", color:"var(--paper)", borderColor:"var(--ink)"} : {}}>
        <Filter size={12}/> {label}{current ? `: ${current.label}` : ""}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-20 grow-in p-1.5 rounded-lg min-w-[160px]"
          style={{background:"#fff", border:"1px solid var(--line)", boxShadow:"0 12px 32px rgba(22,20,15,0.12)"}}>
          <button onClick={() => { onChange(null); setOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded text-sm hover-lift" style={!value ? {background:"var(--paper-2)"} : {}}>Any</button>
          {normalized.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded text-sm hover-lift" style={value === o.value ? {background:"var(--paper-2)"} : {}}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ ex, onClick, compact }) {
  const mod = modalityOf(ex);
  return (
    <button onClick={onClick} className="card p-4 hover-lift text-left w-full">
      <div className="flex items-start justify-between mb-2">
        <span className={`dot ${movementClass(ex.movement)}`} style={{width:"9px",height:"9px",marginTop:"6px"}}/>
        {ex.contraindications.length > 0 && <AlertTriangle size={12} style={{color:"var(--warn)"}}/>}
      </div>
      <div className="font-medium text-[15px] leading-tight">{ex.name}</div>
      <div className="mono text-[10px] uppercase tracking-wider mt-1" style={{color:"var(--muted)"}}>{ex.movement} · {mod.replace("-"," ")} · {ex.difficulty}</div>
      <div className="flex flex-wrap gap-1 mt-2.5">
        {ex.equipment.slice(0,3).map(eq => <span key={eq} className="chip" style={{fontSize:"10px", padding:"2px 8px"}}>{eq}</span>)}
      </div>
      {!compact && (
        <div className="flex items-center gap-2 mt-3 pt-3" style={{borderTop:"1px solid var(--line-2)"}}>
          <span className="mono text-[10px] uppercase tabular" style={{color:"var(--ink-2)"}}>{ex.defSets}×{ex.defReps}</span>
          <span className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>· {ex.defRest}s</span>
        </div>
      )}
    </button>
  );
}

function ExerciseEditor({ ex, existingExercises = [], onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(ex || {
    name: "", movement: "push", muscles: [], equipment: [], difficulty: "beginner", tags: [], contraindications: [],
    defSets: 3, defReps: "10", defRest: 90, notes: ""
  });
  const upd = (k, v) => setDraft({...draft, [k]: v});

  // Check for duplicate name (case-insensitive, exclude self when editing)
  const trimmedName = (draft.name || "").trim().toLowerCase();
  const duplicateExists = trimmedName && existingExercises.some(e =>
    e.name.trim().toLowerCase() === trimmedName && e.id !== draft.id
  );
  const canSave = draft.name.trim() && !duplicateExists;

  return (
    <Modal onClose={onClose} title={ex ? "Edit exercise" : "New exercise"} wide>
      <div className="space-y-4">
        <div>
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Name</label>
          <input value={draft.name} onChange={e => upd("name", e.target.value)} className="field mt-1.5"
            style={duplicateExists ? {borderColor: "var(--accent)"} : {}}/>
          {duplicateExists && (
            <div className="text-xs mt-1.5 flex items-center gap-1.5" style={{color:"var(--accent)"}}>
              <AlertTriangle size={11}/>
              An exercise with this name already exists in the library.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Movement</label>
            <select value={draft.movement} onChange={e => upd("movement", e.target.value)} className="field mt-1.5">
              {["push","pull","squat","hinge","core","cardio","mobility","stretch"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Difficulty</label>
            <select value={draft.difficulty} onChange={e => upd("difficulty", e.target.value)} className="field mt-1.5">
              {["beginner","intermediate","advanced"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <TagEditor label="Equipment" values={draft.equipment} suggestions={["barbell","dumbbell","kettlebell","bodyweight","bench","rack","machine","cable","band","pullup-bar"]} onChange={v => upd("equipment", v)}/>
        <TagEditor label="Muscle groups" values={draft.muscles} suggestions={["chest","back","shoulders","biceps","triceps","quads","hamstrings","glutes","calves","core","lats","traps"]} onChange={v => upd("muscles", v)}/>
        <TagEditor label="Tags" values={draft.tags} suggestions={["compound","isolation","upper","lower","bodyweight","unilateral","posterior","power","conditioning","mobility","warmup","beginner-friendly","flexibility","prenatal-safe","shoulder-health"]} onChange={v => upd("tags", v)}/>
        <TagEditor label="Contraindications" values={draft.contraindications} suggestions={["shoulder injury","knee injury","low back injury","wrist injury","prenatal caution","disc issue","elbow injury"]} onChange={v => upd("contraindications", v)}/>
        <div className="grid grid-cols-3 gap-3">
          <NumericField label="Default sets" value={draft.defSets} onChange={n => upd("defSets", n)} integer/>
          <Field label="Default reps" value={draft.defReps} onChange={v => upd("defReps", v)}/>
          <NumericField label="Rest (sec)" value={draft.defRest} onChange={n => upd("defRest", n)} integer/>
        </div>
        <Field label="Notes" multi value={draft.notes || ""} onChange={v => upd("notes", v)}/>
      </div>
      <div className="flex items-center justify-between mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        {ex && onDelete && <button onClick={onDelete} className="btn btn-ghost" style={{color:"var(--danger)"}}><Trash2 size={14}/> Delete</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={() => canSave && onSave(draft)} disabled={!canSave}
            style={!canSave ? {opacity:0.45, cursor:"not-allowed"} : {}}
            className="btn btn-primary"><Check size={14}/> Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   WORKOUT BUILDER
   ============================================================ */
function WorkoutBuilder({ ctx, exercises, clients, workouts, logs = [], notify, unitPref = "lb", onCancel, onSave }) {
  const existing = ctx?.workoutId && !ctx?.prefill ? workouts.find(w => w.id === ctx.workoutId) : null;
  const client = ctx?.clientId ? clients.find(c => c.id === ctx.clientId) : null;

  const [workout, setWorkout] = useState(ctx?.prefill || existing || {
    id: uid("w"),
    name: "",
    clientId: ctx?.clientId || null,
    date: ctx?.date || today(),
    isTemplate: ctx?.isTemplate || false,
    blocks: []
  });
  const [showLib, setShowLib] = useState(true);
  const [search, setSearch] = useState("");
  const [libFilter, setLibFilter] = useState(null);
  const [modalityFilter, setModalityFilter] = useState(null);
  const [applyClientFilter, setApplyClientFilter] = useState(false);
  const [showRecent, setShowRecent] = useState(true);

  // Recent exercises: pull from this client's last 2 coach-built sessions
  // (excluding self-directed and excluding the workout currently being edited).
  // Sessions count whether or not anything has been logged yet — what matters
  // is what was planned, so the coach can see and avoid recent selections.
  const recentSessions = useMemo(() => {
    if (!client) return [];
    return workouts
      .filter(w =>
        w.clientId === client.id
        && !w.isTemplate
        && !w.isSelfDirected
        && w.id !== workout.id
        && (w.blocks || []).length > 0
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 2);
  }, [workouts, client, workout.id]);

  // Rule-based filtering
  const hidden = useMemo(() => {
    if (!client || !applyClientFilter) return { byInjury: 0, byEquipment: 0 };
    let byInjury = 0, byEquipment = 0;
    exercises.forEach(e => {
      if (client.injuries?.some(i => e.contraindications.includes(i))) byInjury++;
      else if (client.equipment?.length && !e.equipment.some(eq => client.equipment.includes(eq) || eq === "bodyweight")) byEquipment++;
    });
    return { byInjury, byEquipment };
  }, [exercises, client, applyClientFilter]);

  const libFiltered = useMemo(() => exercises.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (libFilter && e.movement !== libFilter) return false;
    if (modalityFilter && modalityOf(e) !== modalityFilter) return false;
    if (client && applyClientFilter && client.injuries?.some(i => e.contraindications.includes(i))) return false;
    if (client && applyClientFilter && client.equipment?.length && !e.equipment.some(eq => client.equipment.includes(eq) || eq === "bodyweight")) return false;
    return true;
  }), [exercises, search, libFilter, modalityFilter, client, applyClientFilter]);

  const suggested = useMemo(() => {
    if (!client) return [];
    const covered = new Set(workout.blocks.map(b => exercises.find(e => e.id === b.exId)?.movement).filter(Boolean));
    const missing = ["push","pull","hinge","squat","core"].filter(m => !covered.has(m));
    const candidates = exercises.filter(e =>
      missing.includes(e.movement) &&
      !workout.blocks.some(b => b.exId === e.id) &&
      (!applyClientFilter || !client.injuries?.some(i => e.contraindications.includes(i))) &&
      (!applyClientFilter || !client.equipment?.length || e.equipment.some(eq => client.equipment.includes(eq) || eq === "bodyweight")) &&
      (e.difficulty !== "advanced" || client.level === "advanced")
    );
    return candidates.slice(0, 4);
  }, [client, workout.blocks, exercises, applyClientFilter]);

  const addExercise = (ex) => {
    setWorkout({...workout, blocks: [...workout.blocks, { exId: ex.id, sets: ex.defSets, reps: ex.defReps, weight: null, unit: "lb", rest: ex.defRest, notes: ex.notes || "" }]});
    notify?.(`Added ${ex.name}`);
  };
  const removeBlock = (i) => setWorkout({...workout, blocks: workout.blocks.filter((_, idx) => idx !== i)});
  const updateBlock = (i, patch) => setWorkout({...workout, blocks: workout.blocks.map((b, idx) => idx === i ? {...b, ...patch} : b)});
  const moveBlock = (i, dir) => {
    const newBlocks = [...workout.blocks];
    const target = i + dir;
    if (target < 0 || target >= newBlocks.length) return;
    [newBlocks[i], newBlocks[target]] = [newBlocks[target], newBlocks[i]];
    setWorkout({...workout, blocks: newBlocks});
  };

  return (
    <div className="h-full flex slide-in">
      {/* Library panel */}
      {showLib && (
        <div className="w-[280px] flex flex-col flex-shrink-0" style={{background:"var(--paper-2)", borderRight:"1px solid var(--line)"}}>
          <div className="p-4 pb-3" style={{borderBottom:"1px solid var(--line)"}}>
            <div className="flex items-center justify-between mb-3">
              <div className="display text-xl tracking-tight">Library</div>
              <button onClick={() => setShowLib(false)} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}}><ChevronLeft size={16}/></button>
            </div>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--muted)"}}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="field pl-8"/>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {["push","pull","squat","hinge","core","cardio","mobility","stretch"].map(m => (
                <button key={m} onClick={() => setLibFilter(libFilter === m ? null : m)} className="chip hover-lift" style={libFilter === m ? {background:"var(--ink)",color:"var(--paper)",borderColor:"var(--ink)"} : {}}>
                  <span className={`dot ${movementClass(m)}`}/> {m}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {MODALITIES.map(m => (
                <button key={m.id} onClick={() => setModalityFilter(modalityFilter === m.id ? null : m.id)}
                  className="chip hover-lift"
                  style={modalityFilter === m.id ? {background:"var(--ink)",color:"var(--paper)",borderColor:"var(--ink)"} : {fontSize:"11px", padding:"3px 8px"}}>
                  {m.label}
                </button>
              ))}
            </div>
            {client && (
              <>
                <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer" style={{color:"var(--ink-2)"}}>
                  <input type="checkbox" checked={applyClientFilter} onChange={e => setApplyClientFilter(e.target.checked)}/>
                  Filter for {client.name.split(" ")[0]}'s limitations & equipment
                </label>
                {applyClientFilter && (hidden.byInjury + hidden.byEquipment) > 0 && (
                  <div className="mt-1.5 text-[11px] mono uppercase tracking-wider" style={{color:"var(--muted)"}}>
                    {hidden.byEquipment > 0 && `${hidden.byEquipment} hidden by equipment`}
                    {hidden.byEquipment > 0 && hidden.byInjury > 0 && " · "}
                    {hidden.byInjury > 0 && `${hidden.byInjury} by limitations`}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {libFiltered.map(ex => (
              <button key={ex.id} onClick={() => addExercise(ex)} className="w-full flex items-center gap-3 p-3 rounded-lg hover-lift text-left"
                style={{background:"#fff", border:"1px solid var(--line-2)"}}>
                <span className={`dot ${movementClass(ex.movement)}`} style={{width:"9px",height:"9px"}}/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ex.name}</div>
                  <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{ex.defSets}×{ex.defReps} · {ex.difficulty}</div>
                </div>
                <Plus size={14} style={{color:"var(--muted)"}}/>
              </button>
            ))}
            {libFiltered.length === 0 && (
              <div className="text-center py-8 px-4">
                <div className="text-sm mb-3" style={{color:"var(--muted)"}}>Nothing matches the current filters.</div>
                {(search || libFilter || modalityFilter || applyClientFilter) && (
                  <button onClick={() => { setSearch(""); setLibFilter(null); setModalityFilter(null); setApplyClientFilter(false); }} className="btn btn-ghost btn-sm">
                    <X size={12}/> Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Builder canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={onCancel} className="btn btn-ghost btn-sm"><ChevronLeft size={14}/> Back</button>
              {!showLib && <button onClick={() => setShowLib(true)} className="btn btn-ghost btn-sm"><BookOpen size={13}/> Library</button>}
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>{workout.isTemplate ? "New template" : "New workout"} {client && `· for ${client.name}`} · {workout.blocks.length} added</span>
          </div>
          <input
            value={workout.name} onChange={e => setWorkout({...workout, name: e.target.value})}
            placeholder="Name this workout…"
            className="display text-3xl font-light tracking-tight w-full mt-1 mb-5"
            style={{background:"transparent", border:"none", color: workout.name ? "var(--ink)" : "var(--muted)"}}
          />

          <div className="flex items-center gap-3 mb-6">
            {!workout.isTemplate && (
              <div>
                <label className="mono text-[10px] uppercase tracking-widest block mb-1" style={{color:"var(--muted)"}}>Date</label>
                <input type="date" value={workout.date} onChange={e => setWorkout({...workout, date: e.target.value})} className="field tabular" style={{width:"auto"}}/>
              </div>
            )}
            <div>
              <label className="mono text-[10px] uppercase tracking-widest block mb-1" style={{color:"var(--muted)"}}>Client</label>
              <select value={workout.clientId || ""} onChange={e => setWorkout({...workout, clientId: e.target.value || null})} className="field">
                <option value="">{workout.isTemplate ? "—" : "Unassigned"}</option>
                {clients.filter(c => !c.archived || c.id === workout.clientId).map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (archived)" : ""}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2.5 rounded-lg hover-lift" style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
                <input type="checkbox" checked={workout.isTemplate} onChange={e => setWorkout({...workout, isTemplate: e.target.checked})}/>
                Save as template
              </label>
            </div>
          </div>

          {recentSessions.length > 0 && (
            <div className="card mb-4 overflow-hidden" style={{background:"var(--paper-2)"}}>
              <button onClick={() => setShowRecent(!showRecent)}
                className="w-full flex items-center justify-between px-4 py-3 hover-lift text-left"
                style={{borderBottom: showRecent ? "1px solid var(--line-2)" : "none"}}>
                <div className="flex items-center gap-2">
                  <Clock size={13} style={{color:"var(--muted)"}}/>
                  <span className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Recent exercises</span>
                  <span className="text-[11px]" style={{color:"var(--muted)"}}>· last {recentSessions.length} session{recentSessions.length === 1 ? "" : "s"}</span>
                </div>
                <ChevronRight size={13} style={{transform: showRecent ? "rotate(90deg)" : "rotate(0)", transition:"transform .15s", color:"var(--muted)"}}/>
              </button>
              {showRecent && (
                <div className="p-4 space-y-3">
                  {recentSessions.map(w => {
                    // De-dupe exercises within a session and skip ones already added to current workout
                    const currentExIds = new Set(workout.blocks.map(b => b.exId));
                    const seen = new Set();
                    const items = (w.blocks || []).filter(b => {
                      if (seen.has(b.exId)) return false;
                      seen.add(b.exId);
                      return true;
                    });
                    return (
                      <div key={w.id}>
                        <div className="mono text-[10px] uppercase tracking-wider mb-2 tabular" style={{color:"var(--muted)"}}>
                          {shortDate(w.date)} · {w.name || "session"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map(b => {
                            const ex = exercises.find(e => e.id === b.exId);
                            if (!ex) return null;
                            const already = currentExIds.has(b.exId);
                            return (
                              <button key={b.exId} onClick={() => !already && addExercise(ex)}
                                disabled={already}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] hover-lift"
                                style={{
                                  background: already ? "var(--paper-2)" : "#fff",
                                  border: "1px solid var(--line-2)",
                                  color: already ? "var(--muted)" : "var(--ink)",
                                  opacity: already ? 0.55 : 1,
                                  cursor: already ? "not-allowed" : "pointer",
                                }}>
                                <span className={`dot ${movementClass(ex.movement)}`} style={{width:"7px",height:"7px"}}/>
                                <span>{ex.name}</span>
                                {already ? <Check size={11} style={{color:"var(--good)"}}/> : <Plus size={11} style={{color:"var(--muted)"}}/>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 mb-6">
            {workout.blocks.length === 0 && (
              <div className="card p-8 text-center">
                <div className="display text-xl tracking-tight mb-1.5">Start adding exercises</div>
                <div className="text-sm" style={{color:"var(--muted)"}}>Tap any exercise in the library to add it here.</div>
              </div>
            )}
            {workout.blocks.map((b, i) => {
              const ex = exercises.find(e => e.id === b.exId);
              return <BuilderBlock key={i} i={i} block={b} ex={ex} onUpdate={p => updateBlock(i, p)} onRemove={() => removeBlock(i)} onMove={(dir) => moveBlock(i, dir)} canMoveUp={i>0} canMoveDown={i<workout.blocks.length-1}/>;
            })}
          </div>

          {suggested.length > 0 && workout.blocks.length < 7 && (
            <div className="card p-4 mb-6" style={{background:"var(--paper-2)", borderStyle:"dashed"}}>
              <div className="mono text-[10px] uppercase tracking-widest mb-2" style={{color:"var(--accent)"}}>Balance suggestion</div>
              <div className="text-sm mb-3" style={{color:"var(--ink-2)"}}>This workout is missing: {["push","pull","hinge","squat","core"].filter(m => !new Set(workout.blocks.map(b => exercises.find(e => e.id === b.exId)?.movement)).has(m)).join(", ") || "balanced coverage"}.</div>
              <div className="grid grid-cols-2 gap-2">
                {suggested.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)} className="flex items-center gap-2 p-2 rounded-lg hover-lift text-left text-sm" style={{background:"#fff", border:"1px solid var(--line-2)"}}>
                    <span className={`dot ${movementClass(ex.movement)}`}/>
                    <span className="flex-1 truncate">{ex.name}</span>
                    <Plus size={13} style={{color:"var(--muted)"}}/>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 py-4" style={{background:"linear-gradient(transparent, var(--paper) 30%)"}}>
            <div className="flex items-center gap-3 justify-end">
              {(!workout.name || !workout.blocks.length) && (
                <span className="text-xs mono uppercase tracking-wider" style={{color:"var(--muted)"}}>
                  {!workout.name && !workout.blocks.length ? "Name + at least 1 exercise needed" :
                    !workout.name ? "Name required" : "Add at least 1 exercise"}
                </span>
              )}
              <button onClick={onCancel} className="btn btn-ghost">Cancel</button>
              <button
                onClick={() => workout.name && workout.blocks.length && onSave(workout)}
                disabled={!workout.name || !workout.blocks.length}
                className="btn btn-accent"
                style={(!workout.name || !workout.blocks.length) ? {opacity: 0.45, cursor: "not-allowed"} : {}}>
                <Check size={15}/> Save {workout.isTemplate ? "template" : "workout"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuilderBlock({ i, block, ex, onUpdate, onRemove, onMove, canMoveUp, canMoveDown }) {
  if (!ex) return null;
  const unit = block.unit || "lb";
  // Changing the unit toggle only changes the display unit — the canonical lb
  // weight is preserved, so flipping lb ↔ kg shows the same load in the new unit.
  const setUnit = (u) => onUpdate({ unit: u });
  return (
    <div className="card p-4 grow-in">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-1">
          <button onClick={() => onMove(-1)} disabled={!canMoveUp} className="p-0.5 rounded" style={{color: canMoveUp ? "var(--ink-2)" : "var(--line)"}}><ChevronLeft size={12} style={{transform:"rotate(90deg)"}}/></button>
          <span className="display text-xs tabular" style={{color:"var(--muted)"}}>{String(i+1).padStart(2,'0')}</span>
          <button onClick={() => onMove(1)} disabled={!canMoveDown} className="p-0.5 rounded" style={{color: canMoveDown ? "var(--ink-2)" : "var(--line)"}}><ChevronRight size={12} style={{transform:"rotate(90deg)"}}/></button>
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className={`dot ${movementClass(ex.movement)}`} style={{width:"8px",height:"8px"}}/>
                <span className="font-medium">{ex.name}</span>
              </div>
              <div className="mono text-[10px] uppercase tracking-wide mt-0.5" style={{color:"var(--muted)"}}>{ex.movement}</div>
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unit={unit} onChange={setUnit}/>
              <button onClick={onRemove} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}}><X size={14}/></button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <NumericField label="Sets" value={block.sets} onChange={n => onUpdate({sets: n})} integer mini/>
            <MiniField label="Reps" value={block.reps} onChange={v => onUpdate({reps: v})}/>
            <NumericField label={`Weight (${unitLabel(unit)})`} value={block.weight != null ? toDisplay(block.weight, unit) : null}
              onChange={n => onUpdate({weight: n == null ? null : fromDisplay(n, unit)})} placeholder="—" mini/>
            <NumericField label="Rest (s)" value={block.rest} onChange={n => onUpdate({rest: n})} integer mini/>
            <MiniField label="Notes" value={block.notes} onChange={v => onUpdate({notes: v})}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitToggle({ unit, onChange }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg" style={{background:"var(--paper-2)", border:"1px solid var(--line-2)"}}>
      {["lb","kg"].map(u => (
        <button key={u} onClick={() => onChange(u)}
          type="button"
          className="px-2 py-0.5 rounded text-[10px] font-medium mono uppercase tracking-wide"
          style={unit === u
            ? {background:"var(--ink)", color:"var(--paper)"}
            : {background:"transparent", color:"var(--muted)"}}>
          {u}
        </button>
      ))}
    </div>
  );
}

function MiniField({ label, value, onChange, type="text", placeholder }) {
  return (
    <div>
      <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
    </div>
  );
}

/**
 * Strip non-numeric characters from a raw input string. Use `integer=true` to
 * also reject decimal points.
 */
const filterNumericInput = (raw, integer=false) => {
  let cleaned = integer ? String(raw).replace(/[^0-9]/g, "") : String(raw).replace(/[^0-9.]/g, "");
  if (!integer) {
    const dot = cleaned.indexOf(".");
    if (dot !== -1) cleaned = cleaned.slice(0, dot+1) + cleaned.slice(dot+1).replace(/\./g, "");
  }
  return cleaned;
};

/**
 * Numeric input that filters non-digit characters as you type, keeps local text
 * state (so clearing the field doesn't force a "0"), and only pushes a valid
 * number (or null) to the parent. On blur, if still empty, syncs back to the
 * current parent value. Use `integer` to also reject decimal points.
 */
function NumericField({ label, value, onChange, placeholder, integer=false, mini=false }) {
  const toText = (v) => (v == null || v === "") ? "" : String(v);
  const [text, setText] = useState(toText(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(toText(value));
  }, [value]);

  const handleInput = (raw) => {
    const cleaned = filterNumericInput(raw, integer);
    setText(cleaned);
    // Only push valid numbers to parent; empty/partial stays local so the user
    // can mid-edit without the parent snapping back to 0.
    if (cleaned !== "" && cleaned !== ".") {
      const n = Number(cleaned);
      if (!Number.isNaN(n)) onChange(n);
    }
  };

  const handleBlur = () => {
    focusedRef.current = false;
    if (text === "" || text === ".") setText(toText(value));
  };

  const cls = mini ? "field mt-1 tabular" : "field mt-1.5 tabular";
  const style = mini ? {padding:"7px 10px", fontSize:"13px"} : undefined;
  const labelCls = mini
    ? "mono text-[9px] uppercase tracking-[0.15em]"
    : "mono text-[10px] uppercase tracking-widest";

  return (
    <div>
      <label className={labelCls} style={{color:"var(--muted)"}}>{label}</label>
      <input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={text}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={handleBlur}
        onChange={e => handleInput(e.target.value)}
        placeholder={placeholder}
        className={cls}
        style={style}
      />
    </div>
  );
}

/* ============================================================
   ADD CLIENT MODAL
   ============================================================ */
function AddClientModal({ onClose, onSave }) {
  const [draft, setDraft] = useState({
    id: uid("c"), name: "", age: undefined, goals: "",
    injuries: [], equipment: ["bodyweight","dumbbell"], level: "beginner",
    notes: "", since: today(), bodyweight: []
  });
  return (
    <Modal onClose={onClose} title="New client">
      <div className="space-y-4">
        <Field label="Name" value={draft.name} onChange={v => setDraft({...draft, name: v})}/>
        <div className="grid grid-cols-2 gap-3">
          <NumericField label="Age" value={draft.age || null} onChange={n => setDraft({...draft, age: n == null ? undefined : n})} integer/>
          <div>
            <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Level</label>
            <select value={draft.level} onChange={e => setDraft({...draft, level: e.target.value})} className="field mt-1.5">
              {["beginner","intermediate","advanced"].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <Field label="Goals" multi value={draft.goals} onChange={v => setDraft({...draft, goals: v})}/>
        <TagEditor label="Injuries / limitations" values={draft.injuries} suggestions={["shoulder injury","knee injury","low back injury","wrist injury","prenatal caution","disc issue","elbow injury"]} onChange={v => setDraft({...draft, injuries: v})}/>
        <TagEditor label="Equipment access" values={draft.equipment} suggestions={["barbell","dumbbell","kettlebell","bodyweight","rack","bench","machine","cable","band","pullup-bar"]} onChange={v => setDraft({...draft, equipment: v})}/>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4" style={{borderTop:"1px solid var(--line-2)"}}>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => draft.name && onSave(draft)} className="btn btn-primary"><Check size={14}/> Create</button>
      </div>
    </Modal>
  );
}

/* ============================================================
   MODAL
   ============================================================ */
function Modal({ onClose, title, children, wide }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6 grow-in" style={{background:"rgba(22,20,15,0.35)", backdropFilter:"blur(4px)"}}>
      <div className="card w-full overflow-hidden flex flex-col" style={{maxWidth: wide ? "640px" : "520px", maxHeight:"90vh", boxShadow:"0 32px 80px rgba(22,20,15,0.3)"}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:"1px solid var(--line-2)"}}>
          <h3 className="display text-xl tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover-lift" style={{color:"var(--muted)"}}><X size={16}/></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CLIENT VIEW — simplified interface for end-clients
   ============================================================ */
function ClientView({ client, workouts, exercises, logs, unitPref = "lb", onExit, onLog, onCreateSelfDirected, onUpdateClient }) {
  const [tab, setTab] = useState("today"); // today | history | log | notes
  const t = today();
  const nextWorkout = useMemo(() => {
    const future = workouts.filter(w => w.date >= t).sort((a,b) => a.date.localeCompare(b.date));
    return future[0] || null;
  }, [workouts, t]);
  const past = useMemo(() => workouts.filter(w => w.date < t).sort((a,b) => b.date.localeCompare(a.date)), [workouts, t]);

  return (
    <div className="h-full w-full flex flex-col slide-in" style={{background:"var(--paper)"}}>
      {/* Client header with preview banner */}
      <header className="px-5 py-3 flex items-center justify-between gap-3" style={{borderBottom:"1px solid var(--line)", background:"var(--paper-2)"}}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold display"
            style={{background:"var(--ink)", color:"var(--paper)"}}>
            {initials(client.name)}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{client.name.split(" ")[0]}</div>
            <div className="mono text-[10px] uppercase tracking-wider" style={{color:"var(--muted)"}}>Client view</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full" style={{background:"#fff", border:"1px dashed var(--line)"}}>
            <div className="dot" style={{background:"var(--accent)", width:"5px", height:"5px"}}/>
            <span className="mono text-[10px] uppercase tracking-wider" style={{color:"var(--ink-2)"}}>Coach preview</span>
          </div>
          <button onClick={onExit} className="btn btn-ghost btn-sm"><X size={13}/> Exit preview</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-5 py-6">
          {tab === "today" && <ClientTodayTab client={client} nextWorkout={nextWorkout} exercises={exercises} logs={logs} past={past} unitPref={unitPref} onGoLog={() => setTab("log")}/>}
          {tab === "history" && <ClientHistoryTab past={past} exercises={exercises} logs={logs} unitPref={unitPref}/>}
          {tab === "log" && <ClientLogTab client={client} exercises={exercises} logs={logs} unitPref={unitPref} onCreateSelfDirected={onCreateSelfDirected} onLog={onLog}/>}
          {tab === "notes" && <ClientNotesTab client={client} onUpdateClient={onUpdateClient}/>}
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav className="flex items-stretch justify-around" style={{borderTop:"1px solid var(--line)", background:"var(--paper-2)"}}>
        {[
          ["today", "Today", Activity],
          ["history", "History", Clock],
          ["log", "Log Solo", Plus],
          ["notes", "Notes", FileText],
        ].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 hover-lift"
            style={{
              color: tab === k ? "var(--ink)" : "var(--muted)",
              background: tab === k ? "var(--paper)" : "transparent",
              borderTop: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
            }}>
            <Icon size={18} strokeWidth={tab === k ? 2.2 : 1.7}/>
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ClientTodayTab({ client, nextWorkout, exercises, logs, past, unitPref = "lb", onGoLog }) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div>
      <div className="mb-7">
        <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— {greeting}</div>
        <h1 className="display text-4xl font-light tracking-tight mt-1">{client.name.split(" ")[0]}.</h1>
        <div className="display text-base italic mt-1" style={{color:"var(--ink-2)"}}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {nextWorkout ? (
        <section>
          <div className="mono text-[10px] uppercase tracking-[0.2em] mb-2" style={{color:"var(--accent)"}}>
            {nextWorkout.date === today() ? "— Today's workout" : "— Next workout"}
          </div>
          <div className="card p-5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="display text-2xl tracking-tight">{nextWorkout.name}</h2>
              <span className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>
                {nextWorkout.date === today() ? "Today" :
                 nextWorkout.date === addDays(today(), 1) ? "Tomorrow" :
                 prettyDate(nextWorkout.date)}
              </span>
            </div>
            <div className="mono text-[10px] uppercase tracking-wider mb-4" style={{color:"var(--muted)"}}>
              {nextWorkout.blocks.length} exercises · with your coach
            </div>
            <div className="space-y-2">
              {nextWorkout.blocks.map((b, i) => {
                const ex = exercises.find(e => e.id === b.exId);
                if (!ex) return null;
                const bUnit = b.unit || "lb";
                const plannedW = b.weight != null ? toDisplay(b.weight, bUnit) : null;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{background:"var(--paper)"}}>
                    <span className="display text-sm tabular" style={{color:"var(--muted)", width:"22px"}}>{String(i+1).padStart(2,'0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium">{ex.name}</div>
                      {b.notes && <div className="text-[11px] italic mt-0.5" style={{color:"var(--ink-2)"}}>{b.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="display text-base tabular">
                        {b.sets}<span className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>×</span>{b.reps}
                        {plannedW != null && <span className="text-xs ml-1" style={{color:"var(--muted)"}}>@ {plannedW}{unitLabel(bUnit)}</span>}
                      </div>
                      <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{b.rest}s rest</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 rounded-lg flex items-start gap-2.5" style={{background:"var(--paper-2)", border:"1px dashed var(--line)"}}>
              <AlertTriangle size={13} style={{color:"var(--muted)", marginTop:"2px"}}/>
              <div className="text-[12px]" style={{color:"var(--ink-2)"}}>
                Your coach will log your sets during this session. You can add notes in the <b>Notes</b> tab.
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="card p-6 text-center">
          <div className="display text-xl tracking-tight mb-1.5">Nothing scheduled.</div>
          <div className="text-sm mb-4" style={{color:"var(--muted)"}}>Your coach hasn't assigned an upcoming workout yet.</div>
          <button onClick={onGoLog} className="btn btn-primary"><Plus size={14}/> Log a solo session</button>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <div className="mono text-[10px] uppercase tracking-[0.2em] mb-3" style={{color:"var(--muted)"}}>— Recently</div>
          <div className="space-y-1.5">
            {past.slice(0, 3).map(w => (
              <div key={w.id} className="card p-3 flex items-center gap-3">
                <div className="text-center w-10">
                  <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{weekday:'short'})}</div>
                  <div className="display text-lg tabular">{new Date(w.date+"T00:00:00").getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{w.name}</div>
                  <div className="mono text-[10px] uppercase tracking-wider" style={{color:"var(--muted)"}}>
                    {w.isSelfDirected ? "Solo session" : "With coach"} · {w.blocks.length} exercises
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClientHistoryTab({ past, exercises, logs, unitPref = "lb" }) {
  const [openId, setOpenId] = useState(null);

  const volumeFor = (log) => {
    if (log.mode === "modified" && log.perSet) {
      return log.perSet.reduce((acc, s) => acc + (Number(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    }
    const sets = Number(log.actualSets) || 0;
    const reps = parseInt(log.actualReps) || 0;
    const wt = Number(log.actualWeight) || 0;
    return sets * reps * wt;
  };

  return (
    <div>
      <div className="mb-6">
        <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— History</div>
        <h1 className="display text-3xl font-light tracking-tight mt-1">Past sessions</h1>
        <div className="mono text-xs uppercase tracking-wider mt-2" style={{color:"var(--muted)"}}>{past.length} total</div>
      </div>
      {past.length === 0 ? (
        <div className="card p-6 text-center">
          <div className="text-sm" style={{color:"var(--muted)"}}>No past workouts yet.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {past.map(w => {
            const wLogs = logs.filter(l => l.workoutId === w.id);
            const volumeLb = wLogs.reduce((acc, l) => acc + volumeFor(l), 0);
            const volumeDisplay = toDisplay(volumeLb, unitPref);
            const isOpen = openId === w.id;
            return (
              <div key={w.id} className="card overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : w.id)} className="w-full p-4 text-left">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-12 flex-shrink-0">
                      <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{new Date(w.date+"T00:00:00").toLocaleDateString(undefined,{month:'short'})}</div>
                      <div className="display text-xl tabular">{new Date(w.date+"T00:00:00").getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">{w.name}</div>
                      <div className="mono text-[10px] uppercase tracking-wider mt-0.5" style={{color:"var(--muted)"}}>
                        {w.isSelfDirected ? "Solo session" : "With coach"} · {w.blocks.length} exercises · {wLogs.length} logged
                      </div>
                    </div>
                    {volumeLb > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="display text-lg tabular">{Math.round(volumeDisplay).toLocaleString()}</div>
                        <div className="mono text-[9px] uppercase" style={{color:"var(--muted)"}}>{unitLabel(unitPref)} volume</div>
                      </div>
                    )}
                    <ChevronRight size={16} style={{transition:"transform .2s", transform: isOpen ? "rotate(90deg)":"rotate(0)", color:"var(--muted)"}}/>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 slide-in">
                    <div className="divider mb-3"/>
                    <div className="space-y-2">
                      {w.blocks.map((b, i) => {
                        const ex = exercises.find(e => e.id === b.exId);
                        if (!ex) return null;
                        const log = wLogs.find(l => l.exId === b.exId);
                        const bUnit = b.unit || "lb";
                        const logUnit = log?.unit || bUnit;
                        const plannedW = b.weight != null ? toDisplay(b.weight, bUnit) : null;
                        return (
                          <div key={i} className="rounded-lg p-3" style={{background:"var(--paper)", border:"1px solid var(--line-2)"}}>
                            <div className="flex items-start gap-2.5 mb-2">
                              <span className={`dot mt-1.5 ${movementClass(ex.movement)}`} style={{width:"8px",height:"8px"}}/>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[14px] font-medium">{ex.name}</span>
                                  {log?.mode === "modified" && <span className="chip chip-warn" style={{fontSize:"10px", padding:"2px 8px"}}>Modified</span>}
                                </div>
                                <div className="mono text-[10px] uppercase tracking-wider mt-0.5 tabular" style={{color:"var(--muted)"}}>
                                  planned {b.sets}×{b.reps}{plannedW != null ? ` @ ${plannedW}${unitLabel(bUnit)}` : ""} · {b.rest}s rest
                                </div>
                                {b.notes && <div className="text-[11px] italic mt-1" style={{color:"var(--ink-2)"}}>{b.notes}</div>}
                              </div>
                            </div>
                            {log ? (
                              log.mode === "modified" && log.perSet ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2">
                                  {log.perSet.map((s, si) => (
                                    <div key={si} className="rounded px-2 py-1.5 tabular text-center" style={{background:"#fff", border:"1px solid var(--line-2)"}}>
                                      <div className="mono text-[9px] uppercase" style={{color:"var(--muted)"}}>Set {si+1}</div>
                                      <div className="text-[13px] font-medium">
                                        {s.weight != null && s.weight > 0 && <>{toDisplay(s.weight, logUnit)}<span style={{color:"var(--muted)", fontSize:"10px"}}>{unitLabel(logUnit)}</span> × </>}
                                        {s.reps}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-2 rounded px-3 py-2 tabular" style={{background:"#fff", border:"1px solid var(--line-2)"}}>
                                  <span className="text-[13px] font-medium">
                                    {log.actualSets ?? b.sets} × {log.actualReps ?? b.reps}
                                    {log.actualWeight != null && log.actualWeight > 0 && <> @ {toDisplay(log.actualWeight, logUnit)}<span style={{color:"var(--muted)", fontSize:"10px"}}>{unitLabel(logUnit)}</span></>}
                                  </span>
                                  {log.notes && <span className="text-[11px] italic ml-2" style={{color:"var(--ink-2)"}}>{log.notes}</span>}
                                </div>
                              )
                            ) : (
                              <div className="mono text-[10px] uppercase tracking-wider mt-1" style={{color:"var(--muted)"}}>
                                Not logged
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientLogTab({ client, exercises, logs, unitPref = "lb", onCreateSelfDirected, onLog }) {
  // Self-directed session: client picks exercises, logs sets, saves
  const [session, setSession] = useState(null); // { id, blocks: [{exId, sets}] }
  const [name, setName] = useState("");
  const [pickingExercise, setPickingExercise] = useState(false);

  const startSession = () => {
    const n = name.trim() || `Solo — ${new Date().toLocaleDateString(undefined, { month:'short', day:'numeric' })}`;
    setSession({ id: uid("w"), name: n, date: today(), blocks: [] });
    setName(n);
  };

  const addExerciseToSession = (ex) => {
    setSession({...session, blocks: [...session.blocks, { exId: ex.id, sets: ex.defSets, reps: ex.defReps, rest: ex.defRest, notes: "", unit: "lb" }]});
    setPickingExercise(false);
  };

  const finalize = () => {
    if (!session || session.blocks.length === 0) return;
    const workoutId = onCreateSelfDirected({
      id: session.id,
      name: session.name,
      date: session.date,
      blocks: session.blocks,
    });
    setSession(null);
    setName("");
  };

  if (!session) {
    // Start screen
    const soloSessions = logs.filter(l => l.source === "client").length;
    return (
      <div>
        <div className="mb-6">
          <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— Log solo</div>
          <h1 className="display text-3xl font-light tracking-tight mt-1">Independent session</h1>
          <div className="text-sm mt-2" style={{color:"var(--ink-2)"}}>
            Track a workout you're doing on your own — outside your coach's plan.
          </div>
        </div>

        <div className="card p-5">
          <label className="mono text-[10px] uppercase tracking-widest" style={{color:"var(--muted)"}}>Session name (optional)</label>
          <input value={name} onChange={e => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Morning cardio, Hotel gym"/>
          <button onClick={startSession} className="btn btn-accent w-full mt-4 justify-center">
            <Plus size={14}/> Start session
          </button>
        </div>

        {soloSessions > 0 && (
          <div className="mt-5 text-center">
            <div className="mono text-[10px] uppercase tracking-wider" style={{color:"var(--muted)"}}>
              {soloSessions} solo {soloSessions === 1 ? "exercise" : "exercises"} logged all-time
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--accent)"}}>— In progress</div>
        <input
          value={name} onChange={e => { setName(e.target.value); setSession({...session, name: e.target.value}); }}
          className="display text-3xl font-light tracking-tight w-full mt-1"
          style={{background:"transparent", border:"none"}}
          placeholder="Name this session"
        />
        <div className="mono text-[10px] uppercase tracking-wider mt-1" style={{color:"var(--muted)"}}>
          {session.blocks.length} {session.blocks.length === 1 ? "exercise" : "exercises"}
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {session.blocks.map((b, i) => {
          const ex = exercises.find(e => e.id === b.exId);
          return <SelfLogBlock key={i} block={b} ex={ex} sessionId={session.id}
            onRemove={() => setSession({...session, blocks: session.blocks.filter((_,idx) => idx !== i)})}
            onLog={(data) => onLog({...data, workoutId: session.id, exId: b.exId, date: session.date})}
            blockLog={logs.find(l => l.workoutId === session.id && l.exId === b.exId)}
          />;
        })}
      </div>

      <button onClick={() => setPickingExercise(true)} className="btn btn-ghost w-full justify-center py-3 mb-4" style={{borderStyle:"dashed"}}>
        <Plus size={14}/> Add exercise
      </button>

      <div className="sticky bottom-0 py-3" style={{background:"linear-gradient(transparent, var(--paper) 25%)"}}>
        <div className="flex items-center gap-2">
          <button onClick={() => { if (confirm("Discard this session?")) setSession(null); }} className="btn btn-ghost">Discard</button>
          <button onClick={finalize} disabled={session.blocks.length === 0}
            style={session.blocks.length === 0 ? {opacity:0.45, cursor:"not-allowed"} : {}}
            className="btn btn-primary flex-1 justify-center"><Check size={14}/> Finish session</button>
        </div>
      </div>

      {pickingExercise && (
        <ClientExercisePicker exercises={exercises} client={client}
          onClose={() => setPickingExercise(false)}
          onPick={addExerciseToSession}/>
      )}
    </div>
  );
}

function SelfLogBlock({ block, ex, sessionId, onRemove, onLog, blockLog }) {
  if (!ex) return null;

  // Already logged — show summary
  if (blockLog) {
    const unit = blockLog.unit || block.unit || "lb";
    const actualW = blockLog.actualWeight != null ? toDisplay(blockLog.actualWeight, unit) : null;
    return (
      <div className="card p-4 grow-in" style={{borderColor: "var(--good)"}}>
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{background:"var(--good)"}}>
            <Check size={14} style={{color:"#fff"}} strokeWidth={3}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[14px]">{ex.name}</span>
              {blockLog.mode === "modified" && <span className="chip chip-warn" style={{fontSize:"10px", padding:"2px 8px"}}>Modified</span>}
            </div>
            <div className="mono text-[11px] uppercase tracking-wide mt-0.5 tabular" style={{color:"var(--ink-2)"}}>
              {blockLog.mode === "modified" && blockLog.perSet ? (
                blockLog.perSet.map(s => `${toDisplay(s.weight, unit) || "—"}${s.weight != null ? unitLabel(unit) : ""} × ${s.reps}`).join(" · ")
              ) : (
                `${blockLog.actualSets ?? block.sets} × ${blockLog.actualReps ?? block.reps}${actualW != null ? ` @ ${actualW}${unitLabel(unit)}` : ""}`
              )}
            </div>
            {blockLog.notes && <div className="text-[12px] italic mt-1.5" style={{color:"var(--ink-2)"}}>{blockLog.notes}</div>}
          </div>
          <button onClick={onRemove} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}}><X size={13}/></button>
        </div>
      </div>
    );
  }

  // Not logged — show the LogCard pattern
  return <ClientLogCard block={block} ex={ex} onLog={onLog} onRemove={onRemove}/>;
}

function ClientLogCard({ block, ex, onLog, onRemove }) {
  const unit = block.unit || "lb";
  const [actualSets, setActualSets] = useState(block.sets);
  const [actualReps, setActualReps] = useState(block.reps);
  const [actualWeight, setActualWeight] = useState("");
  const [modified, setModified] = useState(false);
  const [perSet, setPerSet] = useState([]);
  const [notes, setNotes] = useState("");

  const toggleModified = () => {
    if (!modified) {
      const rows = [];
      const nSets = Number(block.sets) || 1;
      for (let i = 0; i < nSets; i++) rows.push({ reps: block.reps, weight: "" });
      setPerSet(rows);
    }
    setModified(!modified);
  };
  const updatePerSet = (i, patch) => setPerSet(perSet.map((s, idx) => idx === i ? {...s, ...patch} : s));
  const addRow = () => setPerSet([...perSet, { reps: block.reps, weight: "" }]);
  const removeRow = (i) => setPerSet(perSet.filter((_, idx) => idx !== i));

  const markDone = () => {
    if (modified) {
      onLog({
        completed: true, mode: "modified",
        actualSets: perSet.length, actualReps: null, actualWeight: null,
        perSet: perSet.map(s => ({ reps: s.reps, weight: s.weight === "" ? null : fromDisplay(s.weight, unit) })),
        notes, source: "client", unit,
      });
    } else {
      onLog({
        completed: true, mode: "asPlanned",
        actualSets: Number(actualSets) || block.sets,
        actualReps, actualWeight: actualWeight === "" ? null : fromDisplay(actualWeight, unit),
        perSet: null, notes, source: "client", unit,
      });
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2.5">
          <span className={`dot mt-1.5 ${movementClass(ex.movement)}`} style={{width:"8px",height:"8px"}}/>
          <div>
            <div className="text-[14px] font-medium">{ex.name}</div>
            <div className="mono text-[10px] uppercase tracking-wider mt-0.5" style={{color:"var(--muted)"}}>
              target {block.sets}×{block.reps}
            </div>
          </div>
        </div>
        <button onClick={onRemove} className="p-1 rounded hover-lift" style={{color:"var(--muted)"}}><X size={13}/></button>
      </div>

      {!modified ? (
        <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Sets</label>
            <input type="text" inputMode="numeric" value={actualSets} onChange={e => setActualSets(filterNumericInput(e.target.value, true))} className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Reps</label>
            <input type="text" value={actualReps} onChange={e => setActualReps(e.target.value)} className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
          <div>
            <label className="mono text-[9px] uppercase tracking-[0.15em]" style={{color:"var(--muted)"}}>Weight ({unitLabel(unit)})</label>
            <input type="text" inputMode="decimal" value={actualWeight} onChange={e => setActualWeight(filterNumericInput(e.target.value))} placeholder="—" className="field mt-1 tabular" style={{padding:"7px 10px", fontSize:"13px"}}/>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 mt-3 mb-3">
          {perSet.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="mono text-[10px] uppercase tabular w-10" style={{color:"var(--muted)"}}>Set {i+1}</span>
              <input type="text" value={s.reps} onChange={e => updatePerSet(i, {reps: e.target.value})} placeholder="reps"
                className="field tabular" style={{padding:"6px 10px", fontSize:"13px", flex:1}}/>
              <input type="text" inputMode="decimal" value={s.weight} onChange={e => updatePerSet(i, {weight: filterNumericInput(e.target.value)})} placeholder={unitLabel(unit)}
                className="field tabular" style={{padding:"6px 10px", fontSize:"13px", flex:1}}/>
              <button onClick={() => removeRow(i)} className="p-1 rounded" style={{color:"var(--muted)"}}><X size={12}/></button>
            </div>
          ))}
          <button onClick={addRow} className="text-[11px] mono uppercase tracking-wider hover-lift px-2 py-1 rounded" style={{color:"var(--ink-2)"}}>+ Add set</button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <label className="flex items-center gap-1.5 text-[12px] cursor-pointer" style={{color:"var(--ink-2)"}}>
          <input type="checkbox" checked={modified} onChange={toggleModified}/>
          Modified
        </label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes"
          className="field" style={{padding:"6px 10px", fontSize:"12px", flex:1}}/>
      </div>

      <button onClick={markDone} className="btn btn-accent w-full justify-center">
        <Check size={14}/> Mark done
      </button>
    </div>
  );
}

function ClientExercisePicker({ exercises, client, onClose, onPick }) {
  const [search, setSearch] = useState("");
  const [mov, setMov] = useState(null);
  const filtered = exercises.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (mov && e.movement !== mov) return false;
    if (client.injuries?.some(i => e.contraindications.includes(i))) return false;
    return true;
  }).slice(0, 80);

  return (
    <Modal onClose={onClose} title="Pick an exercise">
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--muted)"}}/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="field pl-8" autoFocus/>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {["push","pull","squat","hinge","core","cardio","mobility","stretch"].map(m => (
          <button key={m} onClick={() => setMov(mov === m ? null : m)} className="chip hover-lift"
            style={mov === m ? {background:"var(--ink)",color:"var(--paper)",borderColor:"var(--ink)"} : {}}>
            <span className={`dot ${movementClass(m)}`}/> {m}
          </button>
        ))}
      </div>
      <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
        {filtered.map(ex => (
          <button key={ex.id} onClick={() => onPick(ex)} className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover-lift text-left"
            style={{background:"#fff", border:"1px solid var(--line-2)"}}>
            <span className={`dot ${movementClass(ex.movement)}`} style={{width:"8px",height:"8px"}}/>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{ex.name}</div>
              <div className="mono text-[10px] uppercase" style={{color:"var(--muted)"}}>{ex.defSets}×{ex.defReps}</div>
            </div>
            <Plus size={13} style={{color:"var(--muted)"}}/>
          </button>
        ))}
        {filtered.length === 0 && <div className="text-sm text-center py-6" style={{color:"var(--muted)"}}>Nothing matches.</div>}
      </div>
    </Modal>
  );
}

function ClientNotesTab({ client, onUpdateClient }) {
  const [entries, setEntries] = useState(client.clientNotes || []);
  const [draft, setDraft] = useState("");

  const save = () => {
    if (!draft.trim()) return;
    const next = [{ id: uid("note"), date: today(), ts: Date.now(), body: draft.trim() }, ...entries];
    setEntries(next);
    onUpdateClient({ clientNotes: next });
    setDraft("");
  };
  const remove = (id) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    onUpdateClient({ clientNotes: next });
  };

  return (
    <div>
      <div className="mb-5">
        <div className="mono text-[10px] uppercase tracking-[0.2em]" style={{color:"var(--muted)"}}>— Notes</div>
        <h1 className="display text-3xl font-light tracking-tight mt-1">Your journal</h1>
        <div className="text-sm mt-2" style={{color:"var(--ink-2)"}}>
          Track how you feel, pain flags, sleep, stress, wins. Your coach can see these.
        </div>
      </div>

      <div className="card p-4 mb-5">
        <textarea value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="How are you feeling today? Any soreness, energy level, wins…"
          className="w-full text-sm resize-none" style={{minHeight:"90px", border:"none", background:"transparent", outline:"none"}}/>
        <div className="flex justify-end mt-2">
          <button onClick={save} disabled={!draft.trim()}
            style={!draft.trim() ? {opacity:0.45, cursor:"not-allowed"} : {}}
            className="btn btn-primary btn-sm"><Check size={12}/> Save note</button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card p-6 text-center text-sm" style={{color:"var(--muted)"}}>No notes yet.</div>
      ) : (
        <div className="space-y-2">
          {entries.map(n => (
            <div key={n.id} className="card p-4 group">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="mono text-[10px] uppercase tracking-wider" style={{color:"var(--muted)"}}>
                  {prettyDate(n.date)}
                </div>
                <button onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded" style={{color:"var(--muted)"}}>
                  <Trash2 size={11}/>
                </button>
              </div>
              <div className="text-sm whitespace-pre-wrap" style={{color:"var(--ink)"}}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function seedDemoWorkouts(clients, exercises) {
  const byName = (n) => exercises.find(e => e.name === n);
  const t = today();
  const workouts = [];

  // Maya — today
  const maya = clients[0];
  if (maya) workouts.push({
    id: uid("w"), name: "Lower — Strength", clientId: maya.id, date: t, isTemplate: false,
    blocks: [
      { exId: byName("Back Squat").id, sets: 4, reps: "5", rest: 180, notes: "Work up to 85%" },
      { exId: byName("Romanian Deadlift").id, sets: 3, reps: "8", rest: 120, notes: "" },
      { exId: byName("Bulgarian Split Squat").id, sets: 3, reps: "8/leg", rest: 90, notes: "" },
      { exId: byName("Plank").id, sets: 3, reps: "45s", rest: 45, notes: "" },
    ]
  });

  // Daniel — today
  const daniel = clients[1];
  if (daniel) workouts.push({
    id: uid("w"), name: "Mobility + Accessory", clientId: daniel.id, date: t, isTemplate: false,
    blocks: [
      { exId: byName("Cat-Cow").id, sets: 2, reps: "8", rest: 0, notes: "Warm up" },
      { exId: byName("90/90 Hip Switch").id, sets: 2, reps: "6/side", rest: 0, notes: "" },
      { exId: byName("Goblet Squat").id, sets: 3, reps: "10", rest: 90, notes: "Light" },
      { exId: byName("Dumbbell Row").id, sets: 3, reps: "12", rest: 75, notes: "" },
      { exId: byName("Face Pull").id, sets: 3, reps: "15", rest: 45, notes: "" },
    ]
  });

  // Jonah — tomorrow
  const jonah = clients[3];
  if (jonah) workouts.push({
    id: uid("w"), name: "Upper — Heavy", clientId: jonah.id, date: addDays(t,1), isTemplate: false,
    blocks: [
      { exId: byName("Bench Press").id, sets: 5, reps: "3", rest: 180, notes: "Top set @ 90%" },
      { exId: byName("Pull-up").id, sets: 4, reps: "6", rest: 120, notes: "Weighted if possible" },
      { exId: byName("Overhead Press").id, sets: 4, reps: "6", rest: 120, notes: "" },
      { exId: byName("Dumbbell Row").id, sets: 3, reps: "10", rest: 75, notes: "" },
    ]
  });

  // Serafina — in 2 days
  const serafina = clients[2];
  if (serafina) workouts.push({
    id: uid("w"), name: "Prenatal Strength A", clientId: serafina.id, date: addDays(t,2), isTemplate: false,
    blocks: [
      { exId: byName("Goblet Squat").id, sets: 3, reps: "10", rest: 90, notes: "Moderate load" },
      { exId: byName("Hip Thrust").id, sets: 4, reps: "10", rest: 90, notes: "Glute focus" },
      { exId: byName("Dumbbell Row").id, sets: 3, reps: "12", rest: 75, notes: "" },
      { exId: byName("Cat-Cow").id, sets: 2, reps: "8", rest: 0, notes: "Cooldown" },
    ]
  });

  // Template
  workouts.push({
    id: uid("w"), name: "Full-Body Starter (Template)", clientId: null, date: null, isTemplate: true,
    blocks: [
      { exId: byName("Goblet Squat").id, sets: 3, reps: "10", rest: 90, notes: "" },
      { exId: byName("Dumbbell Bench Press").id, sets: 3, reps: "10", rest: 90, notes: "" },
      { exId: byName("Dumbbell Row").id, sets: 3, reps: "10", rest: 75, notes: "" },
      { exId: byName("Hip Thrust").id, sets: 3, reps: "12", rest: 75, notes: "" },
      { exId: byName("Plank").id, sets: 3, reps: "30s", rest: 45, notes: "" },
    ]
  });

  // Past workouts for Maya (for progress/history demo)
  if (maya) {
    [7, 14, 21, 28].forEach((d,i) => {
      workouts.push({
        id: uid("w"), name: "Lower — Strength", clientId: maya.id, date: addDays(t, -d), isTemplate: false,
        blocks: [
          { exId: byName("Back Squat").id, sets: 4, reps: "5", rest: 180, notes: "" },
          { exId: byName("Romanian Deadlift").id, sets: 3, reps: "8", rest: 120, notes: "" },
        ]
      });
    });
  }

  // Attach coachId — derive from client or default to first seed coach
  return workouts.map(w => ({
    ...w,
    coachId: w.clientId ? (clients.find(c => c.id === w.clientId)?.coachId || "coach_alex") : "coach_alex"
  }));
}
