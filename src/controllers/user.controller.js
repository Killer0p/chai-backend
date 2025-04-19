import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import apiResponse from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, userName, password } = req.body;
  // console.log("email:", email);
  // Validate fields
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
//console.log("req.files", req.files);

  // Get file paths
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

let coverImageLocalPath;
if (req.files && Array.isArray(req.files.
  coverImage) && req.files.coverImage.length > 0) {
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

  // Create user
  const newUser = await User.create({
    fullname: fullName,
    username: userName.toLowerCase(),
    email,
    password,
    avatar: avatarUrl,
    coverImage: coverImageUrl
  });

  // Return created user (excluding sensitive data)
  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong registering user");
  }

  return res.status(201).json(
    new apiResponse(201, createdUser, "User created successfully")
  );
});

export { registerUser };
