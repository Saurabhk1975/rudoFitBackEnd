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
