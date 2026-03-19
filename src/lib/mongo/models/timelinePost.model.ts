import { Schema, model, models, type InferSchemaType } from "mongoose";

const QuoteSchema = new Schema(
  {
    postId: { type: String, default: "" },
    uid: { type: String, default: "" },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
    isOfficial: { type: Boolean, default: false },
    body: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date },
  },
  { _id: false }
);

const TimelinePostSchema = new Schema(
  {
    _id: { type: String, required: true },
    uid: { type: String, index: true, required: true },
    userId: { type: String, default: "" },
    name: { type: String, default: "" },
    avatar: { type: String, default: "" },
    isOfficial: { type: Boolean, default: false },
    body: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    messageType: { type: String, default: "text" },
    replyCount: { type: Number, default: 0 },
    repostCount: { type: Number, default: 0 },
    respectCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    quotePostId: { type: String, default: "" },
    quote: { type: QuoteSchema, default: undefined },
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: "timelinePosts",
    versionKey: false,
    strict: false,
  }
);

TimelinePostSchema.index({ uid: 1, createdAt: -1 });

export type TimelinePostDocument = InferSchemaType<typeof TimelinePostSchema>;

export const TimelinePostModel = models.TimelinePost || model("TimelinePost", TimelinePostSchema);
