// Optional starter library, offered on first run. Everything here is editable or deletable.
// Food values are typical UK label figures; check them against the packets you actually buy.
window.STARTER = (function () {
  const ex = (id, name, pattern, muscles, equipment, sets, reps, rest, notes = "") =>
    ({ id, name, pattern, muscles, equipment, sets, reps, rest, notes, starter: true });
  const exercises = [
    // Push
    ex("x-bench", "Barbell bench press", "push", ["Chest", "Triceps", "Front delts"], ["Barbell", "Squat rack", "Bench"], 4, "6-8", 150),
    ex("x-ohp", "Overhead press", "push", ["Shoulders", "Triceps"], ["Barbell", "Squat rack"], 4, "6-8", 150),
    ex("x-incdb", "Incline dumbbell press", "push", ["Upper chest", "Front delts"], ["Dumbbells", "Bench"], 3, "8-12", 90),
    ex("x-lmpress", "Landmine press", "push", ["Shoulders", "Upper chest"], ["Landmine", "Barbell"], 3, "10-12", 90),
    ex("x-cfly", "Cable fly", "push", ["Chest"], ["Cables"], 3, "12-15", 60),
    ex("x-lat", "Dumbbell lateral raise", "push", ["Side delts"], ["Dumbbells"], 3, "12-20", 60),
    ex("x-push", "Cable triceps pushdown", "push", ["Triceps"], ["Cables"], 3, "10-15", 60),
    ex("x-ohtri", "Overhead dumbbell triceps extension", "push", ["Triceps"], ["Dumbbells"], 3, "10-12", 60),
    // Pull
    ex("x-pullup", "Pull-up", "pull", ["Lats", "Biceps"], ["Pull-up bar"], 4, "6-10", 120),
    ex("x-bbrow", "Barbell row", "pull", ["Upper back", "Lats"], ["Barbell"], 4, "8-10", 120),
    ex("x-tbar", "Landmine T-bar row", "pull", ["Mid back", "Lats"], ["Landmine", "Barbell"], 3, "10-12", 90),
    ex("x-crow", "Seated cable row", "pull", ["Mid back", "Lats"], ["Cables"], 3, "10-12", 90),
    ex("x-face", "Cable face pull", "pull", ["Rear delts", "Upper back"], ["Cables"], 3, "15", 60),
    ex("x-curl", "Dumbbell curl", "pull", ["Biceps"], ["Dumbbells"], 3, "10-12", 60),
    ex("x-hammer", "Dumbbell hammer curl", "pull", ["Biceps", "Forearms"], ["Dumbbells"], 3, "12", 60),
    // Legs
    ex("x-squat", "Back squat", "legs", ["Quads", "Glutes"], ["Barbell", "Squat rack"], 4, "5-8", 180),
    ex("x-rdl", "Romanian deadlift", "legs", ["Hamstrings", "Glutes"], ["Barbell"], 3, "8-10", 150),
    ex("x-deadlift", "Deadlift", "legs", ["Posterior chain"], ["Barbell"], 3, "5", 180),
    ex("x-bss", "Bulgarian split squat", "legs", ["Quads", "Glutes"], ["Dumbbells", "Bench"], 3, "8-10", 90, "Reps per leg"),
    ex("x-lmsquat", "Landmine squat", "legs", ["Quads", "Glutes"], ["Landmine", "Barbell"], 3, "10-12", 90),
    ex("x-pullthru", "Cable pull-through", "legs", ["Glutes", "Hamstrings"], ["Cables"], 3, "12", 60),
    ex("x-calf", "Standing dumbbell calf raise", "legs", ["Calves"], ["Dumbbells"], 4, "12-15", 60),
    // Core
    ex("x-hlr", "Hanging leg raise", "core", ["Abs", "Hip flexors"], ["Pull-up bar"], 3, "10-15", 60),
    ex("x-ccrunch", "Cable crunch", "core", ["Abs"], ["Cables"], 3, "12-15", 60),
    ex("x-lmrot", "Landmine rotation", "core", ["Obliques"], ["Landmine", "Barbell"], 3, "10", 60, "Reps per side"),
    ex("x-plank", "Plank", "core", ["Abs"], ["Bodyweight"], 3, "45s", 60)
  ];
  const item = (exId, sets, reps, rest) => ({ exId, sets, reps, weight: 0, rest });
  const workouts = [
    { id: "w-push-a", name: "Push A", tag: "push", notes: "Starter template", starter: true, items: [
      item("x-bench", 4, "6-8", 150), item("x-ohp", 3, "6-8", 150), item("x-incdb", 3, "8-12", 90),
      item("x-cfly", 3, "12-15", 60), item("x-lat", 3, "12-20", 60), item("x-push", 3, "10-15", 60)] },
    { id: "w-pull-a", name: "Pull A", tag: "pull", notes: "Starter template", starter: true, items: [
      item("x-pullup", 4, "6-10", 120), item("x-bbrow", 4, "8-10", 120), item("x-crow", 3, "10-12", 90),
      item("x-face", 3, "15", 60), item("x-curl", 3, "10-12", 60), item("x-hammer", 2, "12", 60)] },
    { id: "w-legs-a", name: "Legs A", tag: "legs", notes: "Starter template", starter: true, items: [
      item("x-squat", 4, "5-8", 180), item("x-rdl", 3, "8-10", 150), item("x-bss", 3, "8-10", 90),
      item("x-calf", 4, "12-15", 60), item("x-hlr", 3, "10-15", 60), item("x-ccrunch", 3, "12-15", 60)] }
  ];
  const f = (id, name, size, unit, kcal, p, c, fat, fibre) =>
    Object.assign({ id, name, size, unit, kcal, p, c, f: fat, starter: true }, fibre != null ? { fibre } : {});
  const foods = [
    f("f-chicken", "Chicken breast, raw", 100, "g", 106, 24, 0, 1.1),
    f("f-mince5", "Beef mince 5% fat, raw", 100, "g", 124, 21, 0, 4.5),
    f("f-salmon", "Salmon fillet, raw", 100, "g", 206, 20, 0, 13.4),
    f("f-tuna", "Tuna in spring water, drained", 100, "g", 110, 25, 0, 1),
    f("f-egg", "Egg, large", 1, "piece", 78, 6.8, 0.4, 5.3),
    f("f-greek0", "Greek yoghurt 0% fat", 100, "g", 57, 10, 3.6, 0.2),
    f("f-whey", "Whey protein", 30, "g", 120, 24, 3, 1.5),
    f("f-milk", "Semi-skimmed milk", 100, "ml", 50, 3.6, 4.8, 1.8),
    f("f-oats", "Rolled oats", 40, "g", 150, 4.4, 24, 3.2, 3.6),
    f("f-rice", "Basmati rice, dry", 75, "g", 263, 5.6, 58.5, 0.7),
    f("f-pasta", "Wholewheat pasta, dry", 75, "g", 261, 9.8, 46.5, 1.9, 6),
    f("f-sweetpot", "Sweet potato", 100, "g", 86, 1.6, 20, 0.1, 3),
    f("f-bread", "Wholemeal bread", 1, "slice", 94, 4, 15.5, 1, 2.7),
    f("f-banana", "Banana, medium", 1, "piece", 105, 1.3, 27, 0.4, 3.1),
    f("f-blueb", "Blueberries", 100, "g", 57, 0.7, 14.5, 0.3, 2.4),
    f("f-broc", "Broccoli", 100, "g", 35, 3, 4, 0.4, 2.6),
    f("f-pb", "Peanut butter", 15, "g", 90, 3.8, 1.8, 7.5),
    f("f-oil", "Olive oil", 1, "tbsp", 119, 0, 0, 13.5)
  ];
  // Mon Push, Tue Pull, Wed Legs, Thu rest, Fri Push, Sat Pull, Sun rest
  const split = { 0: "w-push-a", 1: "w-pull-a", 2: "w-legs-a", 3: "rest", 4: "w-push-a", 5: "w-pull-a", 6: "rest" };
  return { exercises, workouts, foods, split };
})();
