const { z } = require('zod');

const bulkUpdateAvailabilitySchema = z.object({
  availability: z.record(z.array(z.string()))
});

try {
  const data = bulkUpdateAvailabilitySchema.parse({
    availability: {
      "Monday": ["Morning", "Afternoon"],
      "Sunday": []
    }
  });
  console.log("Success");
} catch(e) {
  console.log("Error:", e);
}
