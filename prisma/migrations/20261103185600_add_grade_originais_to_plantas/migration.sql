-- AlterTable
ALTER TABLE "plantas" ADD COLUMN     "grade_colunas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "grade_linhas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "originais" TEXT[] DEFAULT ARRAY[]::TEXT[];
