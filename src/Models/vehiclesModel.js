// src/models/vehicleModel.js
const { db } = require("../config/database");

async function insertOrUpdateVehicles(vehicles) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return;

  const query = `
    INSERT INTO vehicles.vehicles (
      vin,
      run_number,
      vehicle_name,
      mileage,
      source,
      carmax_data
    ) VALUES 
      ${vehicles
        .map(
          (_, i) =>
            `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${
              i * 6 + 5
            }, $${i * 6 + 6})`
        )
        .join(",\n      ")}
    ON CONFLICT (vin) DO UPDATE SET
      run_number = EXCLUDED.run_number,
      vehicle_name = EXCLUDED.vehicle_name,
      mileage = EXCLUDED.mileage,
      source = EXCLUDED.source,
      carmax_data = EXCLUDED.carmax_data,
      updated_at = CURRENT_TIMESTAMP;
  `;

  const values = vehicles.flatMap((v) => {
    const mileageInt =
      typeof v.mileage === "string"
        ? parseInt(v.mileage.replace(/[^\d]/g, ""), 10) || null
        : typeof v.mileage === "number"
        ? v.mileage
        : null;

    return [
      v.vin,
      v.runNumber || null,
      [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || null,
      mileageInt,
      "carmax",
      JSON.stringify(v),
    ];
  });

  return db.query(query, values);
}

module.exports = {
  insertOrUpdateVehicles,
};
