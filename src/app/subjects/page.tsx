"use client";

import React from "react";
import SubjectManager from "@/components/subjects/SubjectManager";
import { motion } from "framer-motion";

export default function SubjectsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <SubjectManager />
    </motion.div>
  );
}
