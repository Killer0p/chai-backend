import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import apiResponse from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

// Helper function to generate access and refresh tokens
const generateAccessTokenAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    console.log("Access Token:", accessToken);
    console.log("Refresh Token:", refreshToken);
    
    // Update the refresh token in the user document
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });  // Avoid validation if you don't need it for refreshToken

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh and access tokens");
  }
};

// Register user controller
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;

  // Validate required fields
  if ([fullName, email, userName, password].some(field => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  // Check for existing user
  const existedUser = await User.findOne({
    $or: [{ username: userName.toLowerCase() }, { email }]
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  // Get file paths for avatar and cover image
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Upload images to Cloudinary
  const avatarUpload = await uploadOnCloudinary(avatarLocalPath);
  const coverImageUpload = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  const avatarUrl = avatarUpload?.secure_url;
  const coverImageUrl = coverImageUpload?.secure_url || "";

  if (!avatarUrl) {
    throw new ApiError(400, "Avatar upload failed");
  }

  // Create new user
  const newUser = await User.create({
    fullname: fullName,
    username: userName.toLowerCase(),
    email,
    password,
    avatar: avatarUrl,
    coverImage: coverImageUrl
  });

  // Return the created user excluding sensitive data (password, refreshToken)
  const createdUser = await User.findById(newUser._id).select("-password -refreshToken");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong registering user");
  }

  return res.status(201).json(new apiResponse(201, createdUser, "User created successfully"));
});

// Login user controller
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Validate required fields
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  // Find user by email or username
  const user = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Check if the provided password is correct
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessTokenAndRefreshTokens(user._id);

  // Exclude sensitive data from the user object (password and refreshToken)
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  // Set cookies with the tokens
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // Ensure 'secure' is set only in production
  };

  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new apiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully"));
});

// Logout user controller
const logoutUser = asyncHandler(async (req, res) => {
  // Remove the refresh token from the user's document
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  // Clear cookies for both accessToken and refreshToken
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // Set 'secure' flag only in production
  };

  return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken 

    if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    try {
      const decodedToken = jwt.verify(
        incomingRefreshToken, 
        process.env.REFRESH_TOKEN_SECRET
      );

      const user = await User.findById(decodedToken?.id);
      if (!user) {
        throw new ApiError(401, "User not found");
      }

      if (incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(401, "Refresh Token is expired or used");
      }

      const option = {
        httpOnly: true,
        secure: true
      };

      const { accessToken, refreshToken: newRefreshToken } = await generateAccessTokenAndRefreshTokens(user._id);

      return res.status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", newRefreshToken, option)
        .json(new apiResponse(200, 
          { accessToken, newRefreshToken },
          "Access token refreshed successfully"
        ));
    } catch (error) {
      throw new ApiError(401, error?.message || 
        "Invalid refresh token"
      );
    }
      
})

export { 
  registerUser, 
  loginUser, 
  logoutUser, 
  refreshAccessToken
}
