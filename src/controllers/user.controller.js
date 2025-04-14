import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {apiResponse} from "../utils/apiResponse.js";
import { json } from "express";


const registerUser = asyncHandler(async (req, res) => {  
   // get user details from frontend
   // validation - not empty
   // check if user already exists; username or email
   // check for images , check for avatar
   // upload them to cloudinary
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation 
   // return response

   const {fullName, email, userName, password } = req.body;
if (
  ["fullName", "email", "userName", "password"].some((field) => field?.trim() === "")
){
  throw new ApiError(400, "All fields are required");
}
const existedUser = User.findOne({
  $or: [{ username: userName }, { email: email }]
});
if (existedUser) {
  throw new ApiError(409, "User already exists");
}

 const avatarLocalPath =req.files?.avatar[0]?.path;
 const coverImageLocalPath = req.files?.avatar[0]?.path;

 if (!avatarLocalPath) {
  throw new ApiError(400, "Avatar file is required")

} 

const avatar = await uploadOnCloudinary(avatarLocalPath)

const coverImage = await uploadOnCloudinary(coverImageLocalPath)

if (!avatar) {
  throw new ApiError(400, "Avatar upload failed")
}

const user = await user.create({
  fullName,
  avatar: avatar.url,
  coverImage: coverImage?.URL || "",
  email,
  userName: userName.toLowerCase(),
  password,
})

const createdUser = await User.findById(user._id).select(
  "-password -refreshToken"
)

if (!createdUser) {
  throw new ApiError(500, "something went wrong registering user ")
}

return res.status(201),json(
  new apiResponse(200, createdUser, "User created successfully")
  
)


} )
 
export { registerUser 

};

