// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");
// const fs = require("fs");
// const path = require("path");

// // Simple file-based user storage (in production, use a proper database)
// const USERS_FILE = path.join(__dirname, "../data/users.json");
// const JWT_SECRET =
//   process.env.JWT_SECRET || "your-secret-key-change-in-production";
// const ENCRYPTION_KEY =
//   process.env.ENCRYPTION_KEY || "your-32-char-encryption-key-here!!"; // 32 characters

// class AuthManager {
//   constructor() {
//     this.ensureUsersFile();
//   }

//   ensureUsersFile() {
//     if (!fs.existsSync(USERS_FILE)) {
//       fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
//     }
//   }

//   getUsers() {
//     try {
//       const data = fs.readFileSync(USERS_FILE, "utf8");
//       return JSON.parse(data);
//     } catch (error) {
//       return [];
//     }
//   }

//   saveUsers(users) {
//     fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
//   }

//   async hashPassword(password) {
//     return await bcrypt.hash(password, 12);
//   }

//   async comparePassword(password, hashedPassword) {
//     return await bcrypt.compare(password, hashedPassword);
//   }

//   encrypt(text) {
//     const cipher = crypto.createCipher("aes-256-cbc", ENCRYPTION_KEY);
//     let encrypted = cipher.update(text, "utf8", "hex");
//     encrypted += cipher.final("hex");
//     return encrypted;
//   }

//   decrypt(encryptedText) {
//     const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_KEY);
//     let decrypted = decipher.update(encryptedText, "hex", "utf8");
//     decrypted += decipher.final("utf8");
//     return decrypted;
//   }

//   generateToken(user) {
//     return jwt.sign(
//       {
//         id: user.id,
//         email: user.email,
//         carmaxEmail: user.carmaxEmail,
//         vautoUsername: user.vautoUsername,
//       },
//       JWT_SECRET,
//       { expiresIn: "24h" }
//     );
//   }

//   verifyToken(token) {
//     try {
//       return jwt.verify(token, JWT_SECRET);
//     } catch (error) {
//       return null;
//     }
//   }

//   async register(userData) {
//     const users = this.getUsers();

//     // Check if user already exists
//     const existingUser = users.find((u) => u.email === userData.email);
//     if (existingUser) {
//       throw new Error("User already exists");
//     }

//     // Hash passwords
//     const hashedPassword = await this.hashPassword(userData.password);
//     const encryptedCarmaxPassword = this.encrypt(userData.carmaxPassword);
//     const encryptedVautoPassword = this.encrypt(userData.vautoPassword);

//     const newUser = {
//       id: Date.now().toString(),
//       // Personal Information
//       email: userData.email,
//       username: userData.username,
//       firstName: userData.firstName,
//       lastName: userData.lastName,
//       password: hashedPassword,

//       // Business Information
//       businessName: userData.businessName,
//       businessAddress: userData.businessAddress,
//       businessCity: userData.businessCity,
//       businessState: userData.businessState,
//       businessZip: userData.businessZip,
//       businessPhone: userData.businessPhone,
//       taxId: userData.taxId,
//       dealerLicense: userData.dealerLicense,
//       numberOfLocations: userData.numberOfLocations || 1,
//       yearsInBusiness: userData.yearsInBusiness || 0,

//       // Platform Credentials
//       carmaxEmail: userData.carmaxEmail,
//       carmaxPassword: encryptedCarmaxPassword,
//       vautoUsername: userData.vautoUsername,
//       vautoPassword: encryptedVautoPassword,
//       vautoSecretKey: this.encrypt(userData.vautoSecretKey),

//       // Subscription & Payment
//       selectedPlan: userData.selectedPlan,
//       billingCycle: userData.billingCycle, // monthly, yearly
//       paymentMethod: userData.paymentMethod, // card, bank

//       // Account Status
//       status: "pending", // pending, approved, suspended
//       approvalRequested: true,
//       createdAt: new Date().toISOString(),
//       lastLogin: null,
//     };

//     users.push(newUser);
//     this.saveUsers(users);

//     return {
//       id: newUser.id,
//       email: newUser.email,
//       username: newUser.username,
//       businessName: newUser.businessName,
//       status: newUser.status,
//     };
//   }

//   async login(email, password) {
//     const users = this.getUsers();
//     const user = users.find((u) => u.email === email);

//     if (!user) {
//       throw new Error("User not found");
//     }

//     const isValidPassword = await this.comparePassword(password, user.password);
//     if (!isValidPassword) {
//       throw new Error("Invalid password");
//     }

//     return {
//       id: user.id,
//       email: user.email,
//       carmaxEmail: user.carmaxEmail,
//       vautoUsername: user.vautoUsername,
//       token: this.generateToken(user),
//     };
//   }

//   async getUserById(id) {
//     const users = this.getUsers();
//     const user = users.find((u) => u.id === id);
//     if (!user) return null;

//     return {
//       id: user.id,
//       email: user.email,
//       carmaxEmail: user.carmaxEmail,
//       vautoUsername: user.vautoUsername,
//     };
//   }

//   async getUserCredentials(id) {
//     const users = this.getUsers();
//     const user = users.find((u) => u.id === id);
//     if (!user) return null;

//     return {
//       carmaxEmail: user.carmaxEmail,
//       carmaxPassword: this.decrypt(user.carmaxPassword),
//       vautoUsername: user.vautoUsername,
//       vautoPassword: this.decrypt(user.vautoPassword),
//       vautoSecretKey: this.decrypt(user.vautoSecretKey),
//     };
//   }

//   // Middleware to protect routes
//   authenticateToken(req, res, next) {
//     const authHeader = req.headers["authorization"];
//     const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

//     if (!token) {
//       return res.status(401).json({ error: "Access token required" });
//     }

//     const user = this.verifyToken(token);
//     if (!user) {
//       return res.status(403).json({ error: "Invalid or expired token" });
//     }

//     req.user = user;
//     next();
//   }

//   // Middleware to check if user is authenticated via session or token
//   requireAuth(req, res, next) {
//     // Check for JWT token first
//     const authHeader = req.headers["authorization"];
//     const token = authHeader && authHeader.split(" ")[1];

//     if (token) {
//       const user = this.verifyToken(token);
//       if (user) {
//         req.user = user;
//         return next();
//       }
//     }

//     // Check session
//     if (req.session && req.session.user) {
//       req.user = req.session.user;
//       return next();
//     }

//     // Redirect to login if accessing web interface
//     if (req.accepts("html")) {
//       return res.redirect("/login");
//     }

//     // Return JSON error for API requests
//     return res.status(401).json({ error: "Authentication required" });
//   }
// }

// module.exports = new AuthManager();
