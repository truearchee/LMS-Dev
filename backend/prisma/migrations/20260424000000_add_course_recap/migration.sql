-- CreateTable
CREATE TABLE "CourseRecap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lectureCount" INTEGER NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "promptVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseRecap_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_CourseRecapToLecture" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CourseRecapToLecture_A_fkey" FOREIGN KEY ("A") REFERENCES "CourseRecap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CourseRecapToLecture_B_fkey" FOREIGN KEY ("B") REFERENCES "Lecture" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_CourseRecapToLecture_AB_unique" ON "_CourseRecapToLecture"("A", "B");

-- CreateIndex
CREATE INDEX "_CourseRecapToLecture_B_index" ON "_CourseRecapToLecture"("B");

