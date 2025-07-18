// src/controllers/vehicleController.js
const VehicleModel = require("../Models/vehiclesModel");

class VehicleController {
  static async saveVehicles(vehicles) {
    try {
      await VehicleModel.insertOrUpdateVehicles(vehicles);
      console.log(`✅ Saved ${vehicles.length} vehicles to the database.`);
    } catch (err) {
      console.error("❌ Error in VehicleController:", err.message);
      throw err;
    }
  }
}

module.exports = VehicleController;
