-- 4月にConsultationのassignedUsers（担当者複数選択）・ConsultationComment（相談への返信）が
-- schema.prismaに追加された際、対応するマイグレーションが一度も作成されていなかったための欠落分。
-- 本番データベースにはこの2テーブルが存在せず、受付ボックスの取得（相談のassignedUsers参照）が
-- 500エラーになっていた。

-- CreateTable
CREATE TABLE "ConsultationComment" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationComment_consultationId_idx" ON "ConsultationComment"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationComment_authorId_idx" ON "ConsultationComment"("authorId");

-- AddForeignKey
ALTER TABLE "ConsultationComment" ADD CONSTRAINT "ConsultationComment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationComment" ADD CONSTRAINT "ConsultationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "_ConsultationAssignedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ConsultationAssignedUsers_AB_unique" ON "_ConsultationAssignedUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_ConsultationAssignedUsers_B_index" ON "_ConsultationAssignedUsers"("B");

-- AddForeignKey
ALTER TABLE "_ConsultationAssignedUsers" ADD CONSTRAINT "_ConsultationAssignedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsultationAssignedUsers" ADD CONSTRAINT "_ConsultationAssignedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
