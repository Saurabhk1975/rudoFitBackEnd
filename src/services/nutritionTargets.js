// src/utils/nutritionTargets.js

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function calculateSurplusDeficit({
  goal,
  weightKg,
  targetCalories,
  targetProtein
}) {
  let caloriesSurplus = 0;
  let caloriesDeficit = 0;
  let proteinSurplus = 0;
  let proteinDeficit = 0;

  // -------------------
  // CALORIES
  // -------------------
  if (goal === "lose") {
    caloriesDeficit = clamp(0.2 * targetCalories, 300, 500);
  }

  if (goal === "gain") {
    caloriesSurplus = clamp(0.15 * targetCalories, 250, 400);
  }

  // -------------------
  // PROTEIN
  // -------------------
  let recommendedProtein = 0;

  if (goal === "lose") {
    recommendedProtein = weightKg * 1.8;
  } else if (goal === "gain") {
    recommendedProtein = weightKg * 2.0;
  } else {
    recommendedProtein = weightKg * 1.0;
  }

  if (recommendedProtein > targetProtein) {
    proteinDeficit = Math.round(recommendedProtein - targetProtein);
  } else {
    proteinSurplus = Math.round(targetProtein - recommendedProtein);
  }

  return {
    caloriesSurplus: Math.round(caloriesSurplus),
    caloriesDeficit: Math.round(caloriesDeficit),
    proteinSurplus,
    proteinDeficit,
  };
}

module.exports = { calculateSurplusDeficit };
