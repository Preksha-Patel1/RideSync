const bcrypt = require("bcrypt");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const generateToken = require("../utils/generateToken");

const SALT_ROUNDS = 10;

async function register({ name, email, phone, password, role }) {
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new ApiError(409, "Phone number is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email,
    phone,
    password: hashedPassword,
    role,
  });

  const token = generateToken(user._id, user.role);

  return { user, token };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = generateToken(user._id, user.role);

  return { user, token };
}

module.exports = { register, login };
