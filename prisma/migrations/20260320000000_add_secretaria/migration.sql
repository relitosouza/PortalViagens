-- CreateTable
CREATE TABLE "Secretaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secretaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Secretaria_nome_key" ON "Secretaria"("nome");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "secretariaId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_secretariaId_fkey" FOREIGN KEY ("secretariaId") REFERENCES "Secretaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
