// const mongoose = require("mongoose");

// const FoodEntrySchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   nutritionByDate: [
//     {
//       year: Number,
//       months: [
//         {
//           month: Number,
//           days: [
//             {
//               day: Number,
//               calories: { type: Number, default: 0 },
//               protein: { type: Number, default: 0 },
//               fat: { type: Number, default: 0 },
//               carbs: { type: Number, default: 0 },
//               sugar: { type: Number, default: 0 },
//               calcium: { type: Number, default: 0 },
              
//               goodCalories: { type: Number, default: 0 },
//               badCalories: { type: Number, default: 0 },

//               foodItems: [
//                 {
//                   name: String,
//                   label: String,
//                   healthTag: String, // good_to_have | avoid_often

//                   calories: Number,
//                   protein: Number,
//                   fat: Number,
//                   carbs: Number,
//                   sugar: Number,
//                   calcium: Number,

//                   imageUrl: String,
//                   sourceType: String, 
//                 },
//               ],
//             },
//           ],
//         },
//       ],
//     },
//   ],
// });

// module.exports = mongoose.model("FoodEntry", FoodEntrySchema);

const mongoose = require("mongoose");

const FoodEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },

    date: { type: String, index: true }, // YYYY-MM-DD
    year: Number,
    month: Number,
    day: Number,

    totals: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      sugar: { type: Number, default: 0 },
      calcium: { type: Number, default: 0 },

      goodCalories: { type: Number, default: 0 },
      badCalories: { type: Number, default: 0 },
      avgCalories: { type: Number, default: 0 },
    },

    foodItems: [
      {
        name: String,
        label: String,
        healthTag: {
          type: String,
          enum: ["good_to_have", "bad_to_have", "average"],
        },
        calories: Number,
        protein: Number,
        fat: Number,
        carbs: Number,
        sugar: Number,
        calcium: Number,
        imageUrl: String,
        sourceType: String,
        createdAt: Date,
      },
    ],
  },
  { timestamps: true }
);

FoodEntrySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("FoodEntry", FoodEntrySchema);
