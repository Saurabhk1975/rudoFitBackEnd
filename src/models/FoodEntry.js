<<<<<<< HEAD
const mongoose = require("mongoose");

const FoodEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  nutritionByDate: [
    {
      year: Number,
      months: [
        {
          month: Number,
          days: [
            {
              day: Number,
              calories: { type: Number, default: 0 },
              protein: { type: Number, default: 0 },
              fat: { type: Number, default: 0 },
              carbs: { type: Number, default: 0 },
              sugar: { type: Number, default: 0 },
              calcium: { type: Number, default: 0 },
              
              goodCalories: { type: Number, default: 0 },
              badCalories: { type: Number, default: 0 },

              foodItems: [
                {
                  name: String,
                  label: String,
                  healthTag: String, // good_to_have | avoid_often

                  calories: Number,
                  protein: Number,
                  fat: Number,
                  carbs: Number,
                  sugar: Number,
                  calcium: Number,

                  imageUrl: String,
                  sourceType: String, 
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("FoodEntry", FoodEntrySchema);
=======
const mongoose = require("mongoose");

const FoodEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  nutritionByDate: [
    {
      year: Number,
      months: [
        {
          month: Number,
          days: [
            {
              day: Number,
              calories: { type: Number, default: 0 },
              protein: { type: Number, default: 0 },
              fat: { type: Number, default: 0 },
              carbs: { type: Number, default: 0 },
              sugar: { type: Number, default: 0 },
              calcium: { type: Number, default: 0 },
              foodItems: [
                {
                  name: String,
                  calories: Number,
                  protein: Number,
                  fat: Number,
                  carbs: Number,
                  imageUrl: String,
                  sourceType: String, // json | text | image
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("FoodEntry", FoodEntrySchema);
>>>>>>> 144b3b460fbdfcb1fe8ce0688ced89453835d895
