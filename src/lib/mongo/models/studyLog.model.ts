import { Schema, model, models, type InferSchemaType } from "mongoose";

const StudyLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    userUid: { type: String, index: true, required: true },
    subjectId: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    memo: { type: String, default: "" },
    points: { type: Number, default: 0 },
    focusRating: { type: Number, default: 0 },
    focusBonus: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: "studyLogs",
    versionKey: false,
    strict: false,
  }
);

StudyLogSchema.index({ userUid: 1, createdAt: -1 });

export type StudyLogDocument = InferSchemaType<typeof StudyLogSchema>;

export const StudyLogModel = models.StudyLog || model("StudyLog", StudyLogSchema);
