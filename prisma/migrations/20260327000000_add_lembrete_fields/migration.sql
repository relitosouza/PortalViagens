-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN "qtdLembretes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ultimoLembrete" TIMESTAMP(3);
