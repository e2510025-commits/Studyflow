import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserProfileSchema = new Schema(
  {
    _id: { type: String, required: true },
    uid: { type: String, required: true },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    visibility: { type: String, default: "public" },
    dailyGoal: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    bonusPoints: { type: Number, default: 0 },
    profileSetupDone: { type: Boolean, default: false },
    badges: { type: [String], default: [] },
    equippedBadges: { type: [String], default: [] },
    statusMessage: { type: String, default: "" },
    headerImage: { type: String, default: "" },
    headerImageUrl: { type: String, default: "" },
    isOfficial: { type: Boolean, default: false },
    showFollowCount: { type: Boolean, default: true },
    showFollowerCount: { type: Boolean, default: true },
    showFriendCount: { type: Boolean, default: true },
    helpfulReceived: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "userProfiles",
    versionKey: false,
    strict: false,
  }
);

UserProfileSchema.index({ uid: 1 }, { unique: true });
UserProfileSchema.index({ name: 1 });

export type UserProfileDocument = InferSchemaType<typeof UserProfileSchema>;

export const UserProfileModel = models.UserProfile || model("UserProfile", UserProfileSchema);
